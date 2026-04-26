const crypto = require('crypto');
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const razorpayInstance = require('../config/razorpay');
const { createShipment, schedulePickup } = require('../services/delhiveryService');
const { sendOrderConfirmation, sendAdminNewOrderAlert } = require('../services/emailService');

const GST_RATE = 0.18;
const SHIPPING_RATE_PER_KG = 70;

const roundToTwo = (value) => Math.round((value + Number.EPSILON) * 100) / 100;
const roundWeight = (value) => Math.round((value + Number.EPSILON) * 1000) / 1000;

const calculateBilling = (items = [], productMap = new Map()) => {
  const normalizedItems = items.map((item) => {
    const productId = String(item.id || item.product || '');
    const product = productMap.get(productId);

    if (!product) {
      throw new Error(`Product not found for checkout item: ${productId}`);
    }

    const selectedSize = typeof item.size === 'string' ? item.size.trim() : '';
    const matchedVariant = selectedSize
      ? (product.variants || []).find((variant) => variant.label === selectedSize)
      : null;

    if (selectedSize && !matchedVariant) {
      throw new Error(`Selected size "${selectedSize}" is unavailable for ${product.name}`);
    }

    const quantity = Number(item.quantity) || 0;
    if (quantity < 1) {
      throw new Error(`Invalid quantity for ${product.name}`);
    }

    const price = Number(matchedVariant?.price ?? product.price) || 0;
    const weightKg = Math.max(0, Number(matchedVariant?.weight ?? product.weightKg ?? 0) || 0);
    const baseAmount = price * quantity;
    const gstAmount = roundToTwo(baseAmount * GST_RATE);
    const totalAmount = roundToTwo(baseAmount + gstAmount);

    return {
      product: product._id,
      name: product.name,
      quantity,
      price,
      weightKg: roundWeight(weightKg),
      baseAmount: roundToTwo(baseAmount),
      gstAmount,
      totalAmount,
      size: selectedSize || undefined,
    };
  });

  const subtotal = roundToTwo(normalizedItems.reduce((acc, item) => acc + item.baseAmount, 0));
  const gstAmount = roundToTwo(normalizedItems.reduce((acc, item) => acc + item.gstAmount, 0));
  const totalWeightKg = roundWeight(normalizedItems.reduce((acc, item) => acc + item.weightKg * item.quantity, 0));
  const shippingAmount = roundToTwo(totalWeightKg * SHIPPING_RATE_PER_KG);
  const totalAmount = roundToTwo(subtotal + gstAmount + shippingAmount);

  return { normalizedItems, subtotal, gstAmount, shippingAmount, totalWeightKg, totalAmount };
};

const ensureRazorpayConfigured = () => {
  if (!razorpayInstance || !process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    const error = new Error('Payment gateway is not configured');
    error.statusCode = 503;
    throw error;
  }
};

const buildReceiptId = (userId) => {
  const userChunk = String(userId || '').slice(-8);
  const timeChunk = Date.now().toString().slice(-10);
  return `rcpt_${userChunk}_${timeChunk}`;
};

// @desc    Create new Order & corresponding Razorpay Order
// @route   POST /api/orders
// @access  Private
const createOrder = async (req, res) => {
  try {
    ensureRazorpayConfigured();

    const { shippingAddress, items: bodyItems } = req.body;

    const required = ['firstName', 'lastName', 'street', 'city', 'state', 'pincode', 'phone'];
    for (const field of required) {
      if (!shippingAddress?.[field]) {
        return res.status(400).json({ message: `Missing required field: ${field}` });
      }
    }

    let orderItems = [];
    let subtotal = 0;
    let gstAmount = 0;
    let shippingAmount = 0;
    let totalWeightKg = 0;
    let totalAmount = 0;
    let checkoutItems = [];

    if (bodyItems && bodyItems.length > 0) {
      checkoutItems = bodyItems;
    } else {
      const cart = await Cart.findOne({ user: req.user._id }).populate('items.product');
      if (!cart || cart.items.length === 0) {
        return res.status(400).json({ message: 'Your cart is empty. Add items before placing an order.' });
      }
      checkoutItems = cart.items.map((item) => ({
        id: item.product._id,
        quantity: item.quantity,
      }));
    }

    const productIds = [...new Set(checkoutItems.map((item) => String(item.id || item.product || '')))].filter(Boolean);
    if (productIds.length === 0) {
      return res.status(400).json({ message: 'No valid items found for checkout.' });
    }

    const products = await Product.find({ _id: { $in: productIds } }).select('name price variants weightKg');
    const productMap = new Map(products.map((product) => [String(product._id), product]));

    if (productMap.size !== productIds.length) {
      return res.status(400).json({ message: 'One or more products in your cart are unavailable.' });
    }

    const billing = calculateBilling(checkoutItems, productMap);
    orderItems = billing.normalizedItems;
    subtotal = billing.subtotal;
    gstAmount = billing.gstAmount;
    shippingAmount = billing.shippingAmount;
    totalWeightKg = billing.totalWeightKg;
    totalAmount = billing.totalAmount;

    const razorpayOrder = await razorpayInstance.orders.create({
      amount: Math.round(totalAmount * 100),
      currency: 'INR',
      receipt: buildReceiptId(req.user._id),
    });

    const newOrder = await Order.create({
      user: req.user._id,
      items: orderItems,
      totalAmount,
      subtotal,
      gstAmount,
      shippingAmount,
      totalWeightKg,
      shippingAddress,
      orderStatus: 'pending',
      paymentStatus: 'pending',
    });

    await Payment.create({
      order: newOrder._id,
      user: req.user._id,
      razorpay_order_id: razorpayOrder.id,
      amount: totalAmount,
      status: 'created',
    });

    res.status(201).json({
      order: newOrder,
      razorpayOrderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      key: process.env.RAZORPAY_KEY_ID,
      subtotal,
      gstAmount,
      shippingAmount,
      totalWeightKg,
      totalAmount,
    });
  } catch (error) {
    console.error('createOrder error:', error.message);
    const message =
      process.env.NODE_ENV === 'development'
        ? error.message || 'Error creating order'
        : 'Error creating order';
    res.status(error.statusCode || 500).json({ message });
  }
};

// @desc    Verify Razorpay payment signature, update DB, and trigger logistics
// @route   POST /api/orders/verify
// @access  Private
const verifyPayment = async (req, res) => {
  try {
    ensureRazorpayConfigured();

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ message: 'Missing payment verification details' });
    }

    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(body).digest('hex');

    if (expectedSignature.length !== razorpay_signature.length) {
      return res.status(400).json({ message: 'Payment verification failed: invalid signature' });
    }

    const isAuthentic = crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(razorpay_signature));

    if (isAuthentic) {
      const payment = await Payment.findOne({ razorpay_order_id });
      if (!payment) {
        return res.status(404).json({ message: 'Payment record not found' });
      }
      payment.razorpay_payment_id = razorpay_payment_id;
      payment.razorpay_signature = razorpay_signature;
      payment.status = 'captured';
      await payment.save();

      const order = await Order.findById(payment.order);
      order.paymentStatus = 'paid';
      order.orderStatus = 'processing';
      await order.save();

      await Cart.findOneAndUpdate({ user: req.user._id }, { items: [] });

      try {
        for (const item of order.items) {
          await Product.findByIdAndUpdate(item.product, {
            $inc: { stock: -item.quantity },
          });
        }
      } catch (stockError) {
        console.error('Stock reduction failed:', stockError.message);
      }

      try {
        const shipmentResult = await createShipment(order);
        if (shipmentResult?.awbNumber) {
          order.awbNumber = shipmentResult.awbNumber;
          order.orderStatus = 'shipped';
          await order.save();

          await schedulePickup(order);
        }

        await sendOrderConfirmation(order, req.user.email);
        await sendAdminNewOrderAlert(order);
      } catch (logisticsError) {
        console.error('Delhivery AWB generation failed:', logisticsError.message);
      }

      return res.status(200).json({
        message: 'Payment verified successfully',
        orderId: order._id,
        awbNumber: order.awbNumber || null,
      });
    }

    const payment = await Payment.findOne({ razorpay_order_id });
    if (payment) {
      payment.status = 'failed';
      await payment.save();
      await Order.findByIdAndUpdate(payment.order, {
        paymentStatus: 'failed',
        orderStatus: 'cancelled',
      });
    }

    return res.status(400).json({ message: 'Payment verification failed: invalid signature' });
  } catch (error) {
    console.error('verifyPayment error:', error.message);
    res.status(error.statusCode || 500).json({ message: 'Error verifying payment' });
  }
};

// @desc    Get orders for the logged-in user
// @route   GET /api/orders/my-orders
// @access  Private
const getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({
      user: req.user._id,
      paymentStatus: 'paid',
      orderStatus: { $in: ['processing', 'shipped', 'delivered'] },
    })
      .sort({ createdAt: -1 })
      .populate('items.product', 'name images');

    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching orders', error: error.message });
  }
};

// @desc    Get single order by ID
// @route   GET /api/orders/:id
// @access  Private
const getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate('items.product', 'name images');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (order.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to view this order' });
    }

    res.json(order);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching order', error: error.message });
  }
};

// @desc    Get all orders (Admin only)
// @route   GET /api/orders
// @access  Private/Admin
const getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find({})
      .sort({ createdAt: -1 })
      .populate('user', 'name email phone')
      .populate('items.product', 'name images');

    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching orders', error: error.message });
  }
};

// @desc    Update order and/or payment status (Admin only)
// @route   PUT /api/orders/:id/status
// @access  Private/Admin
const updateOrderStatus = async (req, res) => {
  try {
    const { orderStatus, paymentStatus } = req.body;
    const order = await Order.findById(req.params.id);

    if (order) {
      if (orderStatus) order.orderStatus = orderStatus;
      if (paymentStatus) order.paymentStatus = paymentStatus;

      const updatedOrder = await order.save();
      res.json(updatedOrder);
    } else {
      res.status(404).json({ message: 'Order not found' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Error updating order status', error: error.message });
  }
};

module.exports = {
  createOrder,
  verifyPayment,
  getMyOrders,
  getOrderById,
  getAllOrders,
  updateOrderStatus,
};

const crypto = require('crypto');
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const User = require('../models/User');
const razorpayInstance = require('../config/razorpay');
const { createShipment, schedulePickup } = require('../services/delhiveryService');
const { sendOrderConfirmation, sendAdminNewOrderAlert } = require('../services/emailService');

const GST_RATE = 0.18;
const SHIPPING_RATE_PER_KG = 70;

const roundToTwo = (value) => Math.round((value + Number.EPSILON) * 100) / 100;
const roundWeight = (value) => Math.round((value + Number.EPSILON) * 1000) / 1000;

const calculateBilling = (items = [], productMap = new Map()) => {
  const normalizedItems = items.map((item) => {
    const productId = getCheckoutItemProductId(item);
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

const normalizeEmail = (email = '') => String(email).trim().toLowerCase();
const normalizePhone = (phone = '') => String(phone).replace(/[^\d+]/g, '');
const getCheckoutItemProductId = (item = {}) =>
  String(item?.id || item?.product || item?._id || item?.productId || '').trim();

const settlePaidOrder = async ({ payment, order, customerEmail, clearCartUserId }) => {
  if (!payment || !order) return;

  const wasAlreadyPaid = order.paymentStatus === 'paid';

  if (!wasAlreadyPaid) {
    order.paymentStatus = 'paid';
    order.orderStatus = 'processing';
    order.paymentMethod = payment.paymentMethod || order.paymentMethod || 'razorpay';
    await order.save();

    try {
      for (const item of order.items) {
        if (item.product) {
          await Product.findByIdAndUpdate(item.product, {
            $inc: { stock: -item.quantity },
          });
        }
      }
    } catch (stockError) {
      console.error('Stock reduction failed:', stockError.message);
    }

    if (clearCartUserId) {
      await Cart.findOneAndUpdate({ user: clearCartUserId }, { items: [] });
    }

    try {
      const shipmentResult = await createShipment(order);
      if (shipmentResult?.awbNumber) {
        order.awbNumber = shipmentResult.awbNumber;
        order.orderStatus = 'shipped';
        order.logisticsStatus = 'in_transit';
        await order.save();

        await schedulePickup(order);
      }
    } catch (logisticsError) {
      console.error('Delhivery AWB generation failed:', logisticsError.message);
    }

    try {
      if (customerEmail) {
        await sendOrderConfirmation(order, customerEmail);
      }
      await sendAdminNewOrderAlert(order);
    } catch (emailError) {
      console.error('Order email notification failed:', emailError.message);
    }
  }
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

    const productIds = [...new Set(checkoutItems.map((item) => getCheckoutItemProductId(item)))].filter(Boolean);
    if (productIds.length === 0) {
      return res.status(400).json({ message: 'No valid items found for checkout. Please re-add products to cart and try again.' });
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
      paymentMethod: 'razorpay',
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
    if (error?.name === 'ValidationError') {
      return res.status(400).json({ message: error.message || 'Invalid order details.' });
    }

    if (error?.code === 11000) {
      return res.status(409).json({ message: 'Order creation conflict. Please retry checkout.' });
    }

    const knownUserSafeError =
      /Product not found|unavailable|Invalid quantity|Selected size|No valid items found|cart is empty/i.test(
        String(error?.message || '')
      );
    if (knownUserSafeError) {
      return res.status(400).json({ message: error.message });
    }

    res.status(error.statusCode || 500).json({ message: 'Error creating order' });
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
      payment.paymentMethod = payment.paymentMethod || 'razorpay';
      await payment.save();

      const order = await Order.findById(payment.order);
      await settlePaidOrder({
        payment,
        order,
        customerEmail: req.user.email,
        clearCartUserId: req.user._id,
      });

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
        logisticsStatus: 'cancelled',
      });
    }

    return res.status(400).json({ message: 'Payment verification failed: invalid signature' });
  } catch (error) {
    console.error('verifyPayment error:', error.message);
    res.status(error.statusCode || 500).json({ message: 'Error verifying payment' });
  }
};

// @desc    Confirm payment status for an order (fallback for missed checkout callbacks)
// @route   POST /api/orders/:id/confirm-payment
// @access  Private
const confirmPaymentStatus = async (req, res) => {
  try {
    ensureRazorpayConfigured();

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (order.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to verify this order' });
    }

    if (order.paymentStatus === 'paid') {
      return res.json({ paid: true, orderId: order._id, paymentStatus: order.paymentStatus });
    }

    const payment = await Payment.findOne({ order: order._id });
    if (!payment) {
      return res.status(404).json({ message: 'Payment record not found' });
    }

    if (payment.status === 'captured' && payment.razorpay_payment_id) {
      await settlePaidOrder({
        payment,
        order,
        customerEmail: req.user.email,
        clearCartUserId: req.user._id,
      });
      return res.json({ paid: true, orderId: order._id, paymentStatus: order.paymentStatus });
    }

    const paymentsResponse = await razorpayInstance.orders.fetchPayments(payment.razorpay_order_id);
    const capturedPayment = (paymentsResponse?.items || []).find((item) => item.status === 'captured');

    if (!capturedPayment) {
      return res.json({ paid: false, orderId: order._id, paymentStatus: order.paymentStatus });
    }

    payment.razorpay_payment_id = capturedPayment.id;
    payment.status = 'captured';
    payment.paymentMethod = capturedPayment.method || payment.paymentMethod || 'razorpay';
    await payment.save();

    await settlePaidOrder({
      payment,
      order,
      customerEmail: req.user.email,
      clearCartUserId: req.user._id,
    });

    return res.json({ paid: true, orderId: order._id, paymentStatus: order.paymentStatus });
  } catch (error) {
    console.error('confirmPaymentStatus error:', error.message);
    return res.status(500).json({ message: 'Unable to confirm payment status' });
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
    const orders = await Order.find({ paymentStatus: 'paid' })
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
      if (orderStatus === 'delivered') {
        order.isFulfilled = true;
        order.fulfilledAt = new Date();
        order.deliveredAt = new Date();
        order.logisticsStatus = 'delivered';
      }

      const updatedOrder = await order.save();
      res.json(updatedOrder);
    } else {
      res.status(404).json({ message: 'Order not found' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Error updating order status', error: error.message });
  }
};

// @desc    Create custom manual paid order (Admin only)
// @route   POST /api/orders/custom
// @access  Private/Admin
const createCustomOrder = async (req, res) => {
  try {
    const { customer, items, shippingAddress, paymentMethod } = req.body || {};

    if (!customer?.email || !customer?.phone || !customer?.name) {
      return res.status(400).json({ message: 'Customer name, email, and phone are required.' });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'At least one custom product item is required.' });
    }

    const normalizedItems = items.map((item) => {
      const quantity = Number(item.quantity) || 0;
      const price = Number(item.price) || 0;
      const weightKg = Math.max(0, Number(item.weightKg) || 0);

      if (!item.name || quantity < 1 || price < 0) {
        throw new Error('Each item must include name, quantity >= 1 and valid price.');
      }

      const baseAmount = roundToTwo(quantity * price);
      const gstAmount = roundToTwo(baseAmount * GST_RATE);
      return {
        name: String(item.name).trim(),
        quantity,
        price,
        weightKg,
        size: item.size ? String(item.size).trim() : undefined,
        baseAmount,
        gstAmount,
        totalAmount: roundToTwo(baseAmount + gstAmount),
      };
    });

    const subtotal = roundToTwo(normalizedItems.reduce((acc, item) => acc + item.baseAmount, 0));
    const gstAmount = roundToTwo(normalizedItems.reduce((acc, item) => acc + item.gstAmount, 0));
    const totalWeightKg = roundWeight(normalizedItems.reduce((acc, item) => acc + item.weightKg * item.quantity, 0));
    const shippingAmount = roundToTwo(totalWeightKg * SHIPPING_RATE_PER_KG);
    const totalAmount = roundToTwo(subtotal + gstAmount + shippingAmount);

    const email = normalizeEmail(customer.email);
    const phone = normalizePhone(customer.phone);

    let user = await User.findOne({ email });
    if (!user) {
      user = await User.findOne({ phone });
    }
    if (!user) {
      user = await User.create({
        name: String(customer.name).trim(),
        email,
        phone,
        isVerified: true,
      });
    }

    const order = await Order.create({
      user: user._id,
      items: normalizedItems,
      totalAmount,
      subtotal,
      gstAmount,
      shippingAmount,
      totalWeightKg,
      shippingAddress: shippingAddress || {
        firstName: String(customer.name).trim(),
        lastName: '',
        street: 'Custom order',
        city: 'Custom',
        state: 'Custom',
        pincode: '000000',
        phone,
        country: 'India',
      },
      orderStatus: 'processing',
      paymentStatus: 'paid',
      paymentMethod: paymentMethod || 'manual',
      logisticsStatus: 'pending',
    });

    await Payment.create({
      order: order._id,
      user: user._id,
      razorpay_order_id: `manual_${order._id}_${Date.now()}`,
      amount: totalAmount,
      currency: 'INR',
      status: 'captured',
      paymentMethod: paymentMethod || 'manual',
    });

    try {
      const shipmentResult = await createShipment(order);
      if (shipmentResult?.awbNumber) {
        order.awbNumber = shipmentResult.awbNumber;
        order.orderStatus = 'shipped';
        order.logisticsStatus = 'in_transit';
        await order.save();
        await schedulePickup(order);
      }
    } catch (logisticsError) {
      console.error('Custom order logistics error:', logisticsError.message);
    }

    return res.status(201).json(order);
  } catch (error) {
    console.error('createCustomOrder error:', error.message);
    return res.status(500).json({ message: error.message || 'Failed to create custom order.' });
  }
};

module.exports = {
  createOrder,
  verifyPayment,
  getMyOrders,
  getOrderById,
  getAllOrders,
  updateOrderStatus,
  createCustomOrder,
  confirmPaymentStatus,
};

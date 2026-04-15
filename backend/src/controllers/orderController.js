const Order = require('../models/Order');
const Payment = require('../models/Payment');
const Cart = require('../models/Cart');
const razorpayInstance = require('../config/razorpay');
const { createShipment, schedulePickup } = require('../services/delhiveryService');
const { sendOrderConfirmation, sendAdminNewOrderAlert } = require('../services/emailService');
const { sendOrderConfirmationSMS, sendShippingSMS } = require('../services/smsService');
const crypto = require('crypto');

// @desc    Create new Order & corresponding Razorpay Order
// @route   POST /api/orders
// @access  Private
const createOrder = async (req, res) => {
  try {
    const { shippingAddress, items: bodyItems } = req.body;

    // Validate required address fields
    const required = ['firstName', 'lastName', 'street', 'city', 'state', 'pincode', 'phone'];
    for (const field of required) {
      if (!shippingAddress?.[field]) {
        return res.status(400).json({ message: `Missing required field: ${field}` });
      }
    }

    // 1. Get Items: Either from body (Guest/LocalStorage) or from Database Cart
    let orderItems = [];
    let totalAmount = 0;

    if (bodyItems && bodyItems.length > 0) {
      // Use items from body
      orderItems = bodyItems.map(item => ({
        product: item.id || item.product,
        name: item.name,
        quantity: item.quantity,
        price: item.price,
      }));
      totalAmount = orderItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    } else {
      // Fetch user's cart from DB
      const cart = await Cart.findOne({ user: req.user._id }).populate('items.product');
      if (!cart || cart.items.length === 0) {
        return res.status(400).json({ message: 'Your cart is empty. Add items before placing an order.' });
      }
      orderItems = cart.items.map(item => ({
        product: item.product._id,
        name: item.product.name,
        quantity: item.quantity,
        price: item.product.price,
      }));
      totalAmount = cart.items.reduce((acc, item) => acc + (item.product.price * item.quantity), 0);
    }

    // Create Razorpay Order (amount in paise)
    const razorpayOrder = await razorpayInstance.orders.create({
      amount: totalAmount * 100,
      currency: 'INR',
      receipt: `rcpt_${req.user._id}_${Date.now()}`
    });

    // Create MongoDB Order (Status: pending until payment confirmed)
    const newOrder = await Order.create({
      user: req.user._id,
      items: orderItems,
      totalAmount,
      shippingAddress,
      orderStatus: 'pending',
      paymentStatus: 'pending'
    });

    // Create Payment record linked to Razorpay Order ID
    await Payment.create({
      order: newOrder._id,
      user: req.user._id,
      razorpay_order_id: razorpayOrder.id,
      amount: totalAmount,
      status: 'created'
    });

    // Return Razorpay credentials + order info to client to launch payment modal
    res.status(201).json({
      order: newOrder,
      razorpayOrderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      key: process.env.RAZORPAY_KEY_ID
    });

  } catch (error) {
    console.error('createOrder error:', error.message);
    res.status(500).json({ message: 'Error creating order', error: error.message });
  }
};

// @desc    Verify Razorpay payment signature, update DB, and trigger logistics
// @route   POST /api/orders/verify
// @access  Private
const verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ message: 'Missing payment verification details' });
    }

    // Cryptographically verify the payment signature using HMAC-SHA256
    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || 'secret_placeholder')
      .update(body)
      .digest('hex');

    const isAuthentic = expectedSignature === razorpay_signature;

    if (isAuthentic) {
      // --- PAYMENT SUCCESS ---

      // 1. Update Payment record
      const payment = await Payment.findOne({ razorpay_order_id });
      if (!payment) {
        return res.status(404).json({ message: 'Payment record not found' });
      }
      payment.razorpay_payment_id = razorpay_payment_id;
      payment.razorpay_signature = razorpay_signature;
      payment.status = 'captured';
      await payment.save();

      // 2. Update Order status to processing + mark as paid
      const order = await Order.findById(payment.order);
      order.paymentStatus = 'paid';
      order.orderStatus = 'processing';
      await order.save();

      // 3. Clear user's cart (DB-side)
      await Cart.findOneAndUpdate({ user: req.user._id }, { items: [] });

      // 4. Reduce Stock levels for each item
      try {
        const Product = require('../models/Product');
        for (const item of order.items) {
           await Product.findByIdAndUpdate(item.product, {
             $inc: { stock: -item.quantity }
           });
        }
      } catch (stockError) {
        console.error('Stock reduction failed:', stockError.message);
      }

      // 5. Trigger Delhivery shipment creation (non-blocking)
      try {
        const shipmentResult = await createShipment(order);
        if (shipmentResult?.awbNumber) {
          order.awbNumber = shipmentResult.awbNumber;
          order.orderStatus = 'shipped';
          await order.save();

          // New: Automated Pickup Request
          await schedulePickup(order);
        }

        // New: Send Email Notifications
        await sendOrderConfirmation(order, req.user.email);
        await sendAdminNewOrderAlert(order);

        // New: Send SMS Notifications (to the phone provided in shipping address)
        await sendOrderConfirmationSMS(order, order.shippingAddress.phone);
        if (order.awbNumber) {
          await sendShippingSMS(order, order.shippingAddress.phone);
        }

      } catch (logisticsError) {
        console.error('Delhivery AWB generation failed:', logisticsError.message);
      }

      res.status(200).json({
        message: 'Payment verified successfully',
        orderId: order._id,
        awbNumber: order.awbNumber || null
      });

    } else {
      // --- PAYMENT FAILURE / SIGNATURE MISMATCH ---
      const payment = await Payment.findOne({ razorpay_order_id });
      if (payment) {
        payment.status = 'failed';
        await payment.save();
        await Order.findByIdAndUpdate(payment.order, {
          paymentStatus: 'failed',
          orderStatus: 'cancelled'
        });
      }

      res.status(400).json({ message: 'Payment verification failed: invalid signature' });
    }

  } catch (error) {
    console.error('verifyPayment error:', error.message);
    res.status(500).json({ message: 'Error verifying payment', error: error.message });
  }
};

// @desc    Get orders for the logged-in user
// @route   GET /api/orders/my-orders
// @access  Private
const getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id })
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

    // Ensure user can only view their own orders (unless admin)
    if (order.user.toString() !== req.user._id.toString() && !req.user.isAdmin) {
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
  updateOrderStatus
};

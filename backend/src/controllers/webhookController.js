const crypto = require('crypto');
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const { sendOrderConfirmation, sendAdminNewOrderAlert } = require('../services/emailService');
const Product = require('../models/Product');
const Cart = require('../models/Cart');

/**
 * @desc    Handle Razorpay Webhook events
 * @route   POST /api/webhooks/razorpay
 * @access  Public (Secret verification required)
 */
const handleRazorpayWebhook = async (req, res) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const signature = req.headers['x-razorpay-signature'];
  const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.rawBody || '');

  if (!secret) {
    return res.status(503).json({ message: 'Webhook secret is not configured' });
  }

  if (!signature || rawBody.length === 0) {
    return res.status(400).json({ message: 'Missing webhook signature or payload' });
  }

  const expectedSignature = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

  if (expectedSignature.length !== signature.length) {
    return res.status(400).json({ message: 'Invalid signature' });
  }

  if (!crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(signature))) {
    console.warn('Webhook signature mismatch');
    return res.status(400).json({ message: 'Invalid signature' });
  }

  let parsedBody;

  try {
    parsedBody = JSON.parse(rawBody.toString('utf8'));
  } catch (error) {
    return res.status(400).json({ message: 'Invalid webhook payload' });
  }

  const { event, payload } = parsedBody;

  if (event === 'payment.captured') {
    const paymentEntity = payload.payment.entity;
    const razorpayOrderId = paymentEntity.order_id;
    const razorpayPaymentId = paymentEntity.id;
    const paymentMethod = paymentEntity.method || 'razorpay';

    try {
      const payment = await Payment.findOne({ razorpay_order_id: razorpayOrderId });
      if (!payment) {
        console.error('Payment record not found for Order ID:', razorpayOrderId);
        return res.status(200).json({ status: 'ok' });
      }

      if (payment.status === 'captured') {
        return res.status(200).json({ status: 'ok' });
      }

      payment.razorpay_payment_id = razorpayPaymentId;
      payment.status = 'captured';
      payment.paymentMethod = paymentMethod;
      await payment.save();

      const order = await Order.findById(payment.order).populate('user');
      if (!order) {
        console.error('Order not found for Payment ID:', payment._id);
        return res.status(200).json({ status: 'ok' });
      }

      if (order.paymentStatus !== 'paid') {
        order.paymentStatus = 'paid';
        order.orderStatus = 'processing';
        order.paymentMethod = paymentMethod;
        await order.save();

        for (const item of order.items) {
          await Product.findByIdAndUpdate(item.product, {
            $inc: { stock: -item.quantity },
          });
        }

        await Cart.findOneAndUpdate({ user: order.user }, { items: [] });

        try {
          await sendOrderConfirmation(order, order.user.email);
          await sendAdminNewOrderAlert(order);
        } catch (emailError) {
          console.error('Order email notification failed during webhook processing:', emailError.message);
        }
      }
    } catch (error) {
      console.error('Error processing webhook event:', error.message);
      return res.status(500).json({ message: 'Webhook processing error' });
    }
  }

  res.status(200).json({ status: 'ok' });
};

module.exports = {
  handleRazorpayWebhook,
};

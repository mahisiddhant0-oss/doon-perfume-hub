const crypto = require('crypto');
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const { createShipment, schedulePickup } = require('../services/delhiveryService');
const { sendOrderConfirmation, sendAdminNewOrderAlert } = require('../services/emailService');
const { sendOrderConfirmationSMS, sendShippingSMS } = require('../services/smsService');
const Product = require('../models/Product');
const Cart = require('../models/Cart');

/**
 * @desc    Handle Razorpay Webhook events
 * @route   POST /api/webhooks/razorpay
 * @access  Public (Secret verification required)
 */
const handleRazorpayWebhook = async (req, res) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET || 'your_webhook_secret';
  const signature = req.headers['x-razorpay-signature'];

  // 1. Verify webhook signature for security
  // req.rawBody is captured in server.js middleware
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(req.rawBody)
    .digest('hex');

  if (expectedSignature !== signature) {
    console.warn('⚠️ Webhook signature mismatch');
    return res.status(400).json({ message: 'Invalid signature' });
  }

  const { event, payload } = req.body;

  if (event === 'payment.captured') {
    const paymentEntity = payload.payment.entity;
    const razorpayOrderId = paymentEntity.order_id;
    const razorpayPaymentId = paymentEntity.id;

    try {
      // 2. Find the payment record in our DB
      const payment = await Payment.findOne({ razorpay_order_id: razorpayOrderId });
      if (!payment) {
        console.error('❌ Payment record not found for Order ID:', razorpayOrderId);
        return res.status(200).json({ status: 'ok' }); // Return 200 to acknowledge receipt even if record missing
      }

      // If already captured, skip to avoid duplicate processing
      if (payment.status === 'captured') {
        return res.status(200).json({ status: 'ok' });
      }

      // 3. Update Payment record
      payment.razorpay_payment_id = razorpayPaymentId;
      payment.status = 'captured';
      await payment.save();

      // 4. Update Order status (+ Populate User for email)
      const order = await Order.findById(payment.order).populate('user');
      if (!order) {
        console.error('❌ Order not found for Payment ID:', payment._id);
        return res.status(200).json({ status: 'ok' });
      }

      if (order.paymentStatus !== 'paid') {
        order.paymentStatus = 'paid';
        order.orderStatus = 'processing';
        await order.save();

        // 5. Stock reduction
        for (const item of order.items) {
           await Product.findByIdAndUpdate(item.product, {
             $inc: { stock: -item.quantity }
           });
        }

        // 6. Clear user cart
        await Cart.findOneAndUpdate({ user: order.user }, { items: [] });

        // 7. Trigger Logistics API
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
          await sendOrderConfirmation(order, order.user.email);
          await sendAdminNewOrderAlert(order);

          // New: Send SMS Notifications (to the phone provided in shipping address)
          await sendOrderConfirmationSMS(order, order.shippingAddress.phone);
          if (order.awbNumber) {
            await sendShippingSMS(order, order.shippingAddress.phone);
          }

        } catch (logisticsError) {
          console.error('❌ Logistics API failed during webhook processing:', logisticsError.message);
        }
      }

    } catch (error) {
      console.error('❌ Error processing webhook event:', error.message);
      return res.status(500).json({ message: 'Webhook processing error' });
    }
  }

  // Acknowledge receipt of the webhook
  res.status(200).json({ status: 'ok' });
};

module.exports = {
  handleRazorpayWebhook
};

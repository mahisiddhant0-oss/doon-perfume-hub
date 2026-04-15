const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  razorpay_order_id: {
    type: String,
    required: true,
    unique: true
  },
  razorpay_payment_id: {
    type: String,
    sparse: true
  },
  razorpay_signature: {
    type: String
  },
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'INR'
  },
  status: {
    type: String,
    enum: ['created', 'authorized', 'captured', 'failed', 'refunded'],
    default: 'created'
  },
  paymentMethod: {
    type: String // e.g., 'card', 'upi', 'netbanking'
  }
}, { timestamps: true });

module.exports = mongoose.model('Payment', paymentSchema);

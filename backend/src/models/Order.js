const mongoose = require('mongoose');
const Counter = require('./Counter');

const orderItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: false
  },
  name: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
  price: { type: Number, required: true }, // Price at the time of purchase
  size: { type: String },
  weightKg: { type: Number, default: 0, min: 0 },
  baseAmount: { type: Number, required: true },
  gstAmount: { type: Number, required: true },
  totalAmount: { type: Number, required: true }
});

const orderSchema = new mongoose.Schema({
  orderCode: {
    type: String,
    unique: true,
    sparse: true,
    trim: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  items: [orderItemSchema],
  totalAmount: {
    type: Number,
    required: true
  },
  subtotal: {
    type: Number,
    required: true
  },
  gstAmount: {
    type: Number,
    required: true
  },
  shippingAmount: {
    type: Number,
    required: true,
    default: 0
  },
  totalWeightKg: {
    type: Number,
    required: true,
    default: 0
  },
  shippingAddress: {
    firstName: { type: String, required: true },
    lastName:  { type: String, required: true },
    street:    { type: String, required: true },
    apartment: { type: String },
    city:      { type: String, required: true },
    state:     { type: String, required: true },
    pincode:   { type: String, required: true },
    phone:     { type: String, required: true },
    country:   { type: String, default: 'India' }
  },
  orderStatus: {
    type: String,
    enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'],
    default: 'pending'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    default: 'razorpay'
  },
  awbNumber: {
    type: String, // For Delhivery tracking mapping
    trim: true
  },
  logisticsStatus: {
    type: String,
    default: 'pending'
  },
  isFulfilled: {
    type: Boolean,
    default: false
  },
  fulfilledAt: {
    type: Date
  },
  deliveredAt: {
    type: Date
  }
}, { timestamps: true });

orderSchema.pre('validate', async function () {
  if (!this.isNew || this.orderCode) {
    return;
  }

  const counter = await Counter.findOneAndUpdate(
    { key: 'order' },
    { $setOnInsert: { key: 'order', seq: 1000 }, $inc: { seq: 1 } },
    { upsert: true, new: true }
  );

  this.orderCode = `DPH#${counter.seq}`;
});

module.exports = mongoose.model('Order', orderSchema);

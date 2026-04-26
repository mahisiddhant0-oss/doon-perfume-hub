const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  phone: {
    type: String,
    required: false,
    unique: true,
    sparse: true,
    trim: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    unique: true,
    sparse: true // Useful if some users log in via phone and don't provide email immediately
  },
  address: {
    street: String,
    city: String,
    state: String,
    postalCode: String,
    country: {
      type: String,
      default: 'India'
    }
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  otpCodeHash: {
    type: String
  },
  otpExpiresAt: {
    type: Date
  },
  otpAttempts: {
    type: Number,
    default: 0
  },
  lastLoginAt: {
    type: Date
  }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);

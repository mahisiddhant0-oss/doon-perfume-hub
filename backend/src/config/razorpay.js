const Razorpay = require('razorpay');

// Ensure you set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in your .env file
const razorpayInstance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'secret_placeholder',
});

module.exports = razorpayInstance;

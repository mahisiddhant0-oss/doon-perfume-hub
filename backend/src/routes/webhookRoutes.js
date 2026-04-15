const express = require('express');
const router = express.Router();
const { handleRazorpayWebhook } = require('../controllers/webhookController');

// Razorpay Webhook endpoint
// Note: Verification requires the raw body for signature matching.
// Middleware for raw body should be applied in server.js before this route.
router.post('/razorpay', handleRazorpayWebhook);

module.exports = router;

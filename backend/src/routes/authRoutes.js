const express = require('express');
const router = express.Router();
const { authWithFirebase, getUserProfile, updateUserProfile, getUsers, sendOtp, verifyOtpLogin } = require('../controllers/authController');
const { protect, adminRights } = require('../middlewares/authMiddleware');
const { authValidation, otpSendValidation, otpVerifyValidation } = require('../middlewares/validationMiddleware');

// Public route to exchange Firebase ID token for our local JWT token
router.post('/firebase', authValidation, authWithFirebase);
router.post('/otp/send', otpSendValidation, sendOtp);
router.post('/otp/verify', otpVerifyValidation, verifyOtpLogin);

// Protected routes (requires Bearer token generated from /firebase login)
router.get('/profile', protect, getUserProfile);
router.put('/profile', protect, updateUserProfile);

// Admin-only: List all registered users
router.get('/', protect, adminRights, getUsers);

module.exports = router;

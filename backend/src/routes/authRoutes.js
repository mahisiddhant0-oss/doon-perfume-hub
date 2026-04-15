const express = require('express');
const router = express.Router();
const { authWithFirebase, getUserProfile, updateUserProfile, getUsers } = require('../controllers/authController');
const { protect, adminRights } = require('../middlewares/authMiddleware');
const { authValidation } = require('../middlewares/validationMiddleware');

// Public route to exchange Firebase ID token for our local JWT token
router.post('/firebase', authValidation, authWithFirebase);

// Protected routes (requires Bearer token generated from /firebase login)
router.get('/profile', protect, getUserProfile);
router.put('/profile', protect, updateUserProfile);

// Admin-only: List all registered users
router.get('/', protect, adminRights, getUsers);

module.exports = router;

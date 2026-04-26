const express = require('express');
const router = express.Router();
const {
  createOrder,
  verifyPayment,
  getMyOrders,
  getOrderById,
  getAllOrders,
  updateOrderStatus,
  createCustomOrder,
} = require('../controllers/orderController');
const { protect, adminRights } = require('../middlewares/authMiddleware');
const { orderValidation } = require('../middlewares/validationMiddleware');

// Create a new order + Razorpay order in one shot
router.post('/', protect, orderValidation, createOrder);

// Verify the payment signature returned by Razorpay frontend SDK
router.post('/verify', protect, verifyPayment);

// Fetch all orders for the logged-in user (order history)
router.get('/my-orders', protect, getMyOrders);

// Fetch a single order by ID
router.get('/:id', protect, getOrderById);

// Admin-only: Fetch all orders and update status
router.get('/', protect, adminRights, getAllOrders);
router.put('/:id/status', protect, adminRights, updateOrderStatus);
router.post('/custom', protect, adminRights, createCustomOrder);

module.exports = router;

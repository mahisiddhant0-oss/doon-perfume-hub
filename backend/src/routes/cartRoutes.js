const express = require('express');
const router = express.Router();
const {
  getCart,
  addToCart,
  updateQuantity,
  removeFromCart
} = require('../controllers/cartController');
const { protect } = require('../middlewares/authMiddleware');

router.route('/')
  .get(protect, getCart)
  .post(protect, addToCart);

router.route('/:productId')
  .put(protect, updateQuantity)
  .delete(protect, removeFromCart);

module.exports = router;

const express = require('express');
const router = express.Router();
const {
  getProductCategories,
  createProductCategory,
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
} = require('../controllers/productController');
const { protect, adminRights } = require('../middlewares/authMiddleware');
const { productValidation } = require('../middlewares/validationMiddleware');

// Public routes
router.route('/categories').get(getProductCategories);
router.route('/').get(getProducts);
router.route('/:id').get(getProductById);

// Admin-only routes
router.route('/categories').post(protect, adminRights, createProductCategory);
router.route('/').post(protect, adminRights, productValidation, createProduct);
router.route('/:id').put(protect, adminRights, productValidation, updateProduct);
router.route('/:id').delete(protect, adminRights, deleteProduct);

module.exports = router;

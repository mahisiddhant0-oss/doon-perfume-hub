const express = require('express');
const router = express.Router();
const {
  getProductCategories,
  createProductCategory,
  getProductCategoryById,
  updateProductCategory,
  deleteProductCategory,
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  submitProductEnquiry,
  syncWixImages,
  syncEssentialOil100mlVariants,
  mapEssentialOilImages,
} = require('../controllers/productController');
const { protect, adminRights } = require('../middlewares/authMiddleware');
const { productValidation } = require('../middlewares/validationMiddleware');

// Public routes
router.route('/categories').get(getProductCategories);
router.route('/categories/:id').get(getProductCategoryById);
router.route('/').get(getProducts);
router.route('/:id').get(getProductById);
router.route('/:id/enquiry').post(submitProductEnquiry);

// Admin-only routes
router.route('/categories').post(protect, adminRights, createProductCategory);
router.route('/categories/:id').put(protect, adminRights, updateProductCategory);
router.route('/categories/:id').delete(protect, adminRights, deleteProductCategory);
router.route('/').post(protect, adminRights, productValidation, createProduct);
router.route('/admin/sync-wix-images').post(protect, adminRights, syncWixImages);
router.route('/admin/sync-essential-oils-100ml').post(protect, adminRights, syncEssentialOil100mlVariants);
router.route('/admin/map-essential-oil-images').post(protect, adminRights, mapEssentialOilImages);
router.route('/:id').put(protect, adminRights, productValidation, updateProduct);
router.route('/:id').delete(protect, adminRights, deleteProduct);

module.exports = router;

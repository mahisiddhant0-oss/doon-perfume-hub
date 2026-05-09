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
  setStandardVariantWeights,
  uploadAdminProductImages,
  syncSelectedEssentialOils250ml,
  repriceAll250mlVariants,
  setFiveKgProductsImage,
  syncTenKgEnquiryVariants,
  syncTenKgForAllEssentialOils,
} = require('../controllers/productController');
const { protect, adminRights } = require('../middlewares/authMiddleware');
const { productValidation } = require('../middlewares/validationMiddleware');
const { uploadProductImages } = require('../middlewares/uploadMiddleware');

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
router
  .route('/admin/upload-images')
  .post(protect, adminRights, uploadProductImages.array('images', 10), uploadAdminProductImages);
router.route('/admin/sync-essential-oils-100ml').post(protect, adminRights, syncEssentialOil100mlVariants);
router.route('/admin/map-essential-oil-images').post(protect, adminRights, mapEssentialOilImages);
router.route('/admin/set-standard-variant-weights').post(protect, adminRights, setStandardVariantWeights);
router.route('/admin/sync-selected-essential-oils-250ml').post(protect, adminRights, syncSelectedEssentialOils250ml);
router.route('/admin/reprice-250ml-variants').post(protect, adminRights, repriceAll250mlVariants);
router.route('/admin/set-5kg-image').post(protect, adminRights, setFiveKgProductsImage);
router.route('/admin/sync-10kg-enquiry-variants').post(protect, adminRights, syncTenKgEnquiryVariants);
router.route('/admin/sync-10kg-essential-oils').post(protect, adminRights, syncTenKgForAllEssentialOils);
router.route('/:id').put(protect, adminRights, productValidation, updateProduct);
router.route('/:id').delete(protect, adminRights, deleteProduct);

module.exports = router;

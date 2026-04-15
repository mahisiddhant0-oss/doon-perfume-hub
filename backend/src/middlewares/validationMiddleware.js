const { body, validationResult } = require('express-validator');

/**
 * @desc    Common middleware to handle validation results
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      message: 'Validation failed', 
      errors: errors.array().map(err => ({ field: err.param, msg: err.msg })) 
    });
  }
  next();
};

/**
 * @desc    Auth Validation Rules
 */
const authValidation = [
  body('idToken').notEmpty().withMessage('Firebase ID token is required'),
  validate
];

/**
 * @desc    Product Validation Rules
 */
const productValidation = [
  body('name').trim().notEmpty().withMessage('Product name is required'),
  body('price').isNumeric().withMessage('Price must be a number').custom(v => v >= 0).withMessage('Price cannot be negative'),
  body('category').notEmpty().withMessage('Category is required'),
  body('sku').notEmpty().withMessage('SKU is required').isLength({ min: 3 }).withMessage('SKU must be at least 3 characters'),
  body('stock').optional().isNumeric().withMessage('Stock must be a number'),
  validate
];

/**
 * @desc    Order Validation Rules
 */
const orderValidation = [
  body('shippingAddress.firstName').trim().notEmpty().withMessage('First name is required'),
  body('shippingAddress.lastName').trim().notEmpty().withMessage('Last name is required'),
  body('shippingAddress.street').trim().notEmpty().withMessage('Street address is required'),
  body('shippingAddress.city').trim().notEmpty().withMessage('City is required'),
  body('shippingAddress.state').trim().notEmpty().withMessage('State is required'),
  body('shippingAddress.pincode').isLength({ min: 6, max: 6 }).withMessage('Pincode must be 6 digits'),
  body('shippingAddress.phone').isLength({ min: 10, max: 15 }).withMessage('Valid phone number is required'),
  validate
];

module.exports = {
  authValidation,
  productValidation,
  orderValidation
};

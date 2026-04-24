const { body, validationResult } = require('express-validator');

/**
 * @desc    Common middleware to handle validation results
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      message: 'Validation failed',
      errors: errors.array().map((err) => ({ field: err.param, msg: err.msg })),
    });
  }
  next();
};

/**
 * @desc    Auth Validation Rules
 */
const authValidation = [body('idToken').trim().notEmpty().withMessage('Firebase ID token is required'), validate];

const otpSendValidation = [
  body('phone')
    .trim()
    .matches(/^(\+?\d{10,15})$/)
    .withMessage('Valid phone number is required'),
  body('name').optional().trim().isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),
  validate,
];

const otpVerifyValidation = [
  body('phone')
    .trim()
    .matches(/^(\+?\d{10,15})$/)
    .withMessage('Valid phone number is required'),
  body('otp').trim().matches(/^\d{6}$/).withMessage('OTP must be 6 digits'),
  validate,
];

/**
 * @desc    Product Validation Rules
 */
const productValidation = [
  body('name').trim().isLength({ min: 2, max: 120 }).withMessage('Product name must be between 2 and 120 characters'),
  body('price').isNumeric().withMessage('Price must be a number').custom((v) => v >= 0).withMessage('Price cannot be negative'),
  body('category').trim().notEmpty().withMessage('Category is required'),
  body('sku').trim().notEmpty().withMessage('SKU is required').isLength({ min: 3, max: 64 }).withMessage('SKU must be between 3 and 64 characters'),
  body('stock').optional().isNumeric().withMessage('Stock must be a number'),
  body('description').optional().trim().isLength({ max: 5000 }).withMessage('Description is too long'),
  validate,
];

/**
 * @desc    Order Validation Rules
 */
const orderValidation = [
  body('shippingAddress.firstName').trim().isLength({ min: 1, max: 60 }).withMessage('First name is required'),
  body('shippingAddress.lastName').trim().isLength({ min: 1, max: 60 }).withMessage('Last name is required'),
  body('shippingAddress.street').trim().isLength({ min: 1, max: 200 }).withMessage('Street address is required'),
  body('shippingAddress.city').trim().isLength({ min: 1, max: 100 }).withMessage('City is required'),
  body('shippingAddress.state').trim().isLength({ min: 1, max: 100 }).withMessage('State is required'),
  body('shippingAddress.pincode').trim().matches(/^[0-9]{6}$/).withMessage('Pincode must be 6 digits'),
  body('shippingAddress.phone').trim().matches(/^[0-9+\-\s]{10,15}$/).withMessage('Valid phone number is required'),
  validate,
];

module.exports = {
  authValidation,
  otpSendValidation,
  otpVerifyValidation,
  productValidation,
  orderValidation,
};

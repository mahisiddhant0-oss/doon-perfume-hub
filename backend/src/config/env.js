const REQUIRED_IN_PRODUCTION = [
  'MONGO_URI',
  'JWT_SECRET',
  'FRONTEND_URL',
  'RAZORPAY_KEY_ID',
  'RAZORPAY_KEY_SECRET',
  'RAZORPAY_WEBHOOK_SECRET',
  'DELHIVERY_TOKEN',
];

const REQUIRED_EMAIL_VARS = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM_EMAIL', 'ADMIN_EMAIL'];

const splitCsv = (value = '') =>
  value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

const isProduction = process.env.NODE_ENV === 'production';

const getAllowedOrigins = () => splitCsv(process.env.FRONTEND_URL);

const getPrimaryFrontendUrl = () => getAllowedOrigins()[0] || '';

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET must be set and at least 32 characters long');
  }

  return secret;
};

const PLACEHOLDER_PATTERNS = [/replace_with_/i, /yourdomain\.com/i, /set_a_private_strong_password/i];

const hasPlaceholderValue = (value = '') => PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(String(value)));

const validateEnv = () => {
  if (!isProduction) {
    return;
  }

  const missing = REQUIRED_IN_PRODUCTION.filter((key) => !process.env[key]);
  const missingEmail = REQUIRED_EMAIL_VARS.filter((key) => !process.env[key]);
  missing.push(...missingEmail);

  if (missing.length > 0) {
    throw new Error(`Missing required production environment variables: ${missing.join(', ')}`);
  }

  const baseRequiredForPlaceholderCheck = [...REQUIRED_IN_PRODUCTION];

  const requiredKeysForPlaceholderCheck = [...baseRequiredForPlaceholderCheck, ...REQUIRED_EMAIL_VARS];

  const placeholders = requiredKeysForPlaceholderCheck.filter((key) => hasPlaceholderValue(process.env[key]));

  if (placeholders.length > 0) {
    throw new Error(`Production environment variables still use placeholder values: ${placeholders.join(', ')}`);
  }

  getJwtSecret();
};

module.exports = {
  getAllowedOrigins,
  getJwtSecret,
  getPrimaryFrontendUrl,
  isProduction,
  validateEnv,
};

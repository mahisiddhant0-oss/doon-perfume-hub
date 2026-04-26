const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { getJwtSecret } = require('../config/env');

const normalizeEmail = (value = '') => String(value).trim().toLowerCase();

const DEFAULT_PERMANENT_ADMIN_EMAILS = ['doonperfumehub@gmail.com', 'mahisiddhant0@gmail.com'];

const getPermanentAdminEmails = () => {
  const values = [process.env.PERMANENT_ADMIN_EMAILS]
    .filter(Boolean)
    .flatMap((entry) => String(entry).split(','));

  const normalized = values.map((entry) => normalizeEmail(entry)).filter(Boolean);
  if (normalized.length > 0) {
    return new Set(normalized);
  }
  return new Set(DEFAULT_PERMANENT_ADMIN_EMAILS.map((email) => normalizeEmail(email)));
};

const isPermanentAdminUser = (user) => {
  const email = normalizeEmail(user?.email);
  if (!email) return false;
  return getPermanentAdminEmails().has(email);
};

const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];

      // --- MOCK MODE (Strictly for development) ---
      if (process.env.NODE_ENV === 'development' && token.startsWith('MOCK_')) {
        console.warn('⚠️ [DEV] Using Mock Authentication for testing');
        req.user = { _id: '67ee3a207221000000000000', name: 'Test User', role: 'user' };
        return next();
      }

      // Decode our custom JWT
      const decoded = jwt.verify(token, getJwtSecret());
      req.user = await User.findById(decoded.id);

      if (!req.user) {
         return res.status(401).json({ message: 'Not authorized, user not found' });
      }

      const shouldBeAdmin = isPermanentAdminUser(req.user);
      if (shouldBeAdmin && req.user.role !== 'admin') {
        req.user.role = 'admin';
        await req.user.save();
      }

      if (!shouldBeAdmin && req.user.role === 'admin') {
        // Force non-allowlisted users back to customer role.
        req.user.role = 'user';
        await req.user.save();
      }

      next();
    } catch (error) {
      console.error(error);
      res.status(401).json({ message: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    res.status(401).json({ message: 'Not authorized, no token' });
  }
};

// Check for Admin access
const adminRights = (req, res, next) => {
  if (req.user && req.user.role === 'admin' && isPermanentAdminUser(req.user)) {
    next();
  } else {
    res.status(403).json({ message: 'Not authorized as an admin' });
  }
};

module.exports = { protect, adminRights };

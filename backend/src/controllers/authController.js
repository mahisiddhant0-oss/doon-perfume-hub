const admin = require('../config/firebase');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { getJwtSecret } = require('../config/env');
const { sendOTPSMS } = require('../services/smsService');

// Generate custom JWT (Backend Authorization)
const generateToken = (id) => {
  return jwt.sign({ id }, getJwtSecret(), {
    expiresIn: '30d',
  });
};

const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;

const normalizePhone = (phone = '') => {
  const cleaned = String(phone).replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+')) {
    return cleaned;
  }
  if (/^\d{10}$/.test(cleaned)) {
    return `+91${cleaned}`;
  }
  if (/^91\d{10}$/.test(cleaned)) {
    return `+${cleaned}`;
  }
  return cleaned;
};

const hashOtp = (phone, otp) =>
  crypto.createHash('sha256').update(`${phone}:${otp}:${getJwtSecret()}`).digest('hex');

const createOtp = () => String(crypto.randomInt(100000, 1000000));

// @desc    Auth user & get token (Login / Register via Firebase)
// @route   POST /api/auth/firebase
// @access  Public
const authWithFirebase = async (req, res) => {
  const { idToken } = req.body;

  if (!idToken) {
    return res.status(400).json({ message: 'No Firebase ID token provided' });
  }

  try {
    if (!admin.apps.length) {
      return res.status(503).json({ message: 'Authentication service is not configured' });
    }

    // Verify the Firebase ID token
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    
    const uid = decodedToken.uid;
    const phone = decodedToken.phone_number || undefined;
    const email = decodedToken.email || undefined;
    const name = decodedToken.name || (phone ? `User_${phone.slice(-4)}` : 'Guest User');

    // Make sure we have at least an email or a phone
    if (!phone && !email) {
      return res.status(400).json({ message: 'Invalid payload from Firebase: Missing email and phone number' });
    }

    // Try to find an existing user in our MongoDB by phone OR email
    let user = null;
    if (phone) {
        user = await User.findOne({ phone });
    } 
    if (!user && email) {
        user = await User.findOne({ email });
    }

    // If User doesn't exist, Create them (Auto-Registration on first OTP login)
    if (!user) {
      user = await User.create({
        name,
        phone: phone || `temp_${uid}`, // Phone is required in schema, so we assign a temp if missing
        email,
        isVerified: true
      });
    }

    // Send back our completely independent Custom Backend JWT
    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      token: generateToken(user._id),
    });

  } catch (error) {
    console.error('Firebase Auth Error:', error);
    res.status(401).json({ message: 'Not authorized, invalid or expired Firebase token' });
  }
};

// @desc    Get user profile
// @route   GET /api/auth/profile
// @access  Private
const getUserProfile = async (req, res) => {
  const user = await User.findById(req.user._id);

  if (user) {
    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      address: user.address,
      role: user.role,
    });
  } else {
    res.status(404).json({ message: 'User not found' });
  }
};

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
const updateUserProfile = async (req, res) => {
  const user = await User.findById(req.user._id);

  if (user) {
    user.name = req.body.name || user.name;
    user.email = req.body.email || user.email;
    
    // Specifically handle nested address object without overwriting undefined fields
    if (req.body.address) {
      user.address.street = req.body.address.street || user.address.street;
      user.address.city = req.body.address.city || user.address.city;
      user.address.state = req.body.address.state || user.address.state;
      user.address.postalCode = req.body.address.postalCode || user.address.postalCode;
      user.address.country = req.body.address.country || user.address.country;
    }

    const updatedUser = await user.save();

    res.json({
      _id: updatedUser._id,
      name: updatedUser.name,
      email: updatedUser.email,
      phone: updatedUser.phone,
      address: updatedUser.address,
      role: updatedUser.role,
      token: generateToken(updatedUser._id),
    });
  } else {
    res.status(404).json({ message: 'User not found' });
  }
};

// @desc    Get all users (Admin only)
// @route   GET /api/users
// @access  Private/Admin
const getUsers = async (req, res) => {
  try {
    const users = await User.find({}).sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching users', error: error.message });
  }
};

// @desc    Send OTP to mobile number
// @route   POST /api/auth/otp/send
// @access  Public
const sendOtp = async (req, res) => {
  try {
    const phone = normalizePhone(req.body.phone);
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';

    const otp = createOtp();
    const otpCodeHash = hashOtp(phone, otp);
    const otpExpiresAt = new Date(Date.now() + OTP_TTL_MS);

    let user = await User.findOne({ phone });

    if (!user) {
      user = await User.create({
        name: name || `User_${phone.slice(-4)}`,
        phone,
        isVerified: false,
        otpCodeHash,
        otpExpiresAt,
        otpAttempts: 0,
      });
    } else {
      user.name = name || user.name;
      user.otpCodeHash = otpCodeHash;
      user.otpExpiresAt = otpExpiresAt;
      user.otpAttempts = 0;
      await user.save();
    }

    const smsResult = await sendOTPSMS(phone, otp);
    if (smsResult?.error) {
      return res.status(502).json({ message: `Failed to send OTP SMS: ${smsResult.error}` });
    }

    const payload = {
      message: 'OTP sent successfully',
      phone,
    };

    if (process.env.NODE_ENV !== 'production') {
      payload.devOtp = otp;
    }

    res.json(payload);
  } catch (error) {
    console.error('sendOtp error:', error.message);
    res.status(500).json({ message: 'Failed to send OTP' });
  }
};

// @desc    Verify OTP and return auth token
// @route   POST /api/auth/otp/verify
// @access  Public
const verifyOtpLogin = async (req, res) => {
  try {
    const phone = normalizePhone(req.body.phone);
    const otp = String(req.body.otp || '').trim();

    const user = await User.findOne({ phone });
    if (!user) {
      return res.status(404).json({ message: 'User not found for this phone number' });
    }

    if (!user.otpCodeHash || !user.otpExpiresAt) {
      return res.status(400).json({ message: 'No OTP request found. Please request OTP again.' });
    }

    if (user.otpExpiresAt.getTime() < Date.now()) {
      return res.status(400).json({ message: 'OTP expired. Please request a new OTP.' });
    }

    if (user.otpAttempts >= MAX_OTP_ATTEMPTS) {
      return res.status(429).json({ message: 'Too many failed attempts. Please request a new OTP.' });
    }

    const expectedHash = hashOtp(phone, otp);
    if (user.otpCodeHash !== expectedHash) {
      user.otpAttempts += 1;
      await user.save();
      return res.status(400).json({ message: 'Invalid OTP. Please try again.' });
    }

    user.isVerified = true;
    user.lastLoginAt = new Date();
    user.otpCodeHash = undefined;
    user.otpExpiresAt = undefined;
    user.otpAttempts = 0;
    await user.save();

    return res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      token: generateToken(user._id),
    });
  } catch (error) {
    console.error('verifyOtpLogin error:', error.message);
    return res.status(500).json({ message: 'Failed to verify OTP' });
  }
};

module.exports = {
  authWithFirebase,
  getUserProfile,
  updateUserProfile,
  getUsers,
  sendOtp,
  verifyOtpLogin,
};

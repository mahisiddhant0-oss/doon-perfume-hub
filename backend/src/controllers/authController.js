const admin = require('../config/firebase');
const User = require('../models/User');
const BlockedCredential = require('../models/BlockedCredential');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const mongoose = require('mongoose');
const { getJwtSecret } = require('../config/env');
const { sendLoginOtpEmail } = require('../services/emailService');
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

const normalizeEmail = (email = '') => String(email).trim().toLowerCase();

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

const isPermanentAdminEmail = (email = '') => {
  const normalizedEmail = normalizeEmail(email);
  return normalizedEmail ? getPermanentAdminEmails().has(normalizedEmail) : false;
};

const isPermanentAdminUser = (user) => {
  const email = normalizeEmail(user?.email);
  return email ? isPermanentAdminEmail(email) : false;
};

const syncUserRoleFromAllowlist = (user) => {
  if (isPermanentAdminEmail(user?.email)) {
    if (user.role !== 'admin') {
      user.role = 'admin';
    }
    return;
  }

  if (user.role !== 'user') {
    // Everyone outside allowlist is always a customer/user.
    user.role = 'user';
  }
};

const hashOtp = (email, otp) =>
  crypto.createHash('sha256').update(`${email}:${otp}:${getJwtSecret()}`).digest('hex');

const createOtp = () => String(crypto.randomInt(100000, 1000000));

const getBlockedCredentialMatch = async ({ email, phone }) => {
  const values = [normalizeEmail(email), normalizePhone(phone)].filter(Boolean);
  if (values.length === 0) return null;
  return BlockedCredential.findOne({ value: { $in: values } });
};

const denyIfCredentialBlocked = async (res, { email, phone }) => {
  const blocked = await getBlockedCredentialMatch({ email, phone });
  if (!blocked) return null;

  res.status(403).json({ message: 'Access denied. Your account is restricted.' });
  return blocked;
};

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

    const denied = await denyIfCredentialBlocked(res, { email, phone });
    if (denied) return;

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

    if (user.isBlocked) {
      return res.status(403).json({ message: 'Your account is blocked. Please contact support.' });
    }

    syncUserRoleFromAllowlist(user);
    await user.save();

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

// @desc    Send OTP to email address (with mandatory phone capture)
// @route   POST /api/auth/otp/send
// @access  Public
const sendOtp = async (req, res) => {
  try {
    const phone = normalizePhone(req.body.phone);
    const email = normalizeEmail(req.body.email);
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';

    const denied = await denyIfCredentialBlocked(res, { email, phone });
    if (denied) return;

    const otp = createOtp();
    const otpCodeHash = hashOtp(email, otp);
    const otpExpiresAt = new Date(Date.now() + OTP_TTL_MS);

    const userByEmail = await User.findOne({ email });
    const userByPhone = await User.findOne({ phone });

    if (userByEmail && userByPhone && userByEmail._id.toString() !== userByPhone._id.toString()) {
      return res.status(409).json({
        message: 'This email and phone belong to different accounts. Please use the originally registered pair.',
      });
    }

    let user = userByEmail || userByPhone;

    if (!user) {
      user = await User.create({
        name: name || `User_${email.split('@')[0] || 'customer'}`,
        email,
        phone,
        isVerified: false,
        otpCodeHash,
        otpExpiresAt,
        otpAttempts: 0,
      });
    } else {
      if (user.email && user.email !== email) {
        return res.status(409).json({ message: 'This phone is already linked to another email.' });
      }

      if (user.phone && user.phone !== phone) {
        return res.status(409).json({ message: 'This email is already linked to another phone number.' });
      }

      user.name = name || user.name;
      user.email = email;
      user.phone = phone;
      user.otpCodeHash = otpCodeHash;
      user.otpExpiresAt = otpExpiresAt;
      user.otpAttempts = 0;
      await user.save();
    }

    if (user.isBlocked) {
      return res.status(403).json({ message: 'Your account is blocked. Please contact support.' });
    }

    const emailResult = await sendLoginOtpEmail({ email, otp, name: user.name });
    if (emailResult?.error) {
      const smsResult = await sendOTPSMS(phone, otp);
      if (smsResult?.error) {
        return res.status(502).json({
          message: `Failed to send OTP. Email error: ${emailResult.error}. SMS error: ${smsResult.error}`,
        });
      }
    }

    const payload = { message: 'OTP sent successfully', email, phone };

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
    const email = normalizeEmail(req.body.email);
    const otp = String(req.body.otp || '').trim();

    const denied = await denyIfCredentialBlocked(res, { email, phone });
    if (denied) return;

    const user = await User.findOne({ email, phone });
    if (!user) {
      return res.status(404).json({ message: 'No user found for this email and phone combination' });
    }

    if (user.isBlocked) {
      return res.status(403).json({ message: 'Your account is blocked. Please contact support.' });
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

    const expectedHash = hashOtp(email, otp);
    if (user.otpCodeHash !== expectedHash) {
      user.otpAttempts += 1;
      await user.save();
      return res.status(400).json({ message: 'Invalid OTP. Please try again.' });
    }

    user.isVerified = true;
    user.lastLoginAt = new Date();
    syncUserRoleFromAllowlist(user);
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

// @desc    Elevate current authenticated user to admin after admin-password verification
// @route   POST /api/auth/admin/elevate
// @access  Private
const elevateAdminAccess = async (req, res) => {
  try {
    const configuredAdminPassword = process.env.ADMIN_ACCESS_PASSWORD || '';
    if (!configuredAdminPassword) {
      return res.status(503).json({ message: 'Admin access password is not configured on server.' });
    }

    const providedPassword = String(req.body?.password || '');
    const expected = Buffer.from(configuredAdminPassword, 'utf8');
    const provided = Buffer.from(providedPassword, 'utf8');

    if (expected.length !== provided.length || !crypto.timingSafeEqual(expected, provided)) {
      return res.status(401).json({ message: 'Invalid admin password' });
    }

    if (!isPermanentAdminEmail(req.user?.email)) {
      return res.status(403).json({ message: 'This account is not permitted for admin access.' });
    }

    req.user.role = 'admin';
    await req.user.save();

    return res.json({
      message: 'Admin access granted',
      _id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      phone: req.user.phone,
      role: req.user.role,
    });
  } catch (error) {
    console.error('elevateAdminAccess error:', error.message);
    return res.status(500).json({ message: 'Failed to grant admin access' });
  }
};

// @desc    Block/unblock user (Admin only)
// @route   PATCH /api/auth/:userId/block
// @access  Private/Admin
const setUserBlockStatus = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.userId)) {
      return res.status(400).json({ message: 'Invalid user id' });
    }

    const targetUser = await User.findById(req.params.userId);
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (isPermanentAdminUser(targetUser)) {
      return res.status(403).json({ message: 'Permanent admin users cannot be blocked.' });
    }

    const shouldBlock =
      typeof req.body?.isBlocked === 'boolean' ? req.body.isBlocked : !Boolean(targetUser.isBlocked);

    targetUser.isBlocked = shouldBlock;
    if (shouldBlock) {
      targetUser.blockedAt = new Date();
      targetUser.blockedBy = req.user?._id;
      targetUser.blockReason = typeof req.body?.reason === 'string' ? req.body.reason.trim().slice(0, 250) : '';
      targetUser.otpCodeHash = undefined;
      targetUser.otpExpiresAt = undefined;
      targetUser.otpAttempts = 0;
    } else {
      targetUser.blockedAt = undefined;
      targetUser.blockedBy = undefined;
      targetUser.blockReason = '';
    }

    syncUserRoleFromAllowlist(targetUser);
    const updatedUser = await targetUser.save();

    return res.json({
      message: updatedUser.isBlocked ? 'User blocked successfully' : 'User unblocked successfully',
      user: updatedUser,
    });
  } catch (error) {
    console.error('setUserBlockStatus error:', error.message);
    return res.status(500).json({ message: 'Failed to update block status' });
  }
};

// @desc    Delete user permanently (Admin only)
// @route   DELETE /api/auth/:userId
// @access  Private/Admin
const deleteUser = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.userId)) {
      return res.status(400).json({ message: 'Invalid user id' });
    }

    const targetUser = await User.findById(req.params.userId);
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (isPermanentAdminUser(targetUser)) {
      return res.status(403).json({ message: 'Permanent admin users cannot be deleted.' });
    }

    const blockOps = [];
    if (targetUser.email) {
      blockOps.push(
        BlockedCredential.updateOne(
          { value: normalizeEmail(targetUser.email) },
          {
            $set: {
              type: 'email',
              value: normalizeEmail(targetUser.email),
              reason: 'deleted_by_admin',
              sourceUserId: targetUser._id,
            },
          },
          { upsert: true }
        )
      );
    }
    if (targetUser.phone) {
      blockOps.push(
        BlockedCredential.updateOne(
          { value: normalizePhone(targetUser.phone) },
          {
            $set: {
              type: 'phone',
              value: normalizePhone(targetUser.phone),
              reason: 'deleted_by_admin',
              sourceUserId: targetUser._id,
            },
          },
          { upsert: true }
        )
      );
    }

    if (blockOps.length > 0) {
      await Promise.all(blockOps);
    }

    await User.deleteOne({ _id: targetUser._id });
    return res.json({ message: 'User deleted permanently and credentials blocked' });
  } catch (error) {
    console.error('deleteUser error:', error.message);
    return res.status(500).json({ message: 'Failed to delete user' });
  }
};

module.exports = {
  authWithFirebase,
  getUserProfile,
  updateUserProfile,
  getUsers,
  sendOtp,
  verifyOtpLogin,
  elevateAdminAccess,
  setUserBlockStatus,
  deleteUser,
};

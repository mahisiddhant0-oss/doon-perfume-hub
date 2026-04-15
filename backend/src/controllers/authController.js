const admin = require('../config/firebase');
const User = require('../models/User');
const jwt = require('jsonwebtoken');

// Generate custom JWT (Backend Authorization)
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'fallback_secret_key', {
    expiresIn: '30d',
  });
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

module.exports = {
  authWithFirebase,
  getUserProfile,
  updateUserProfile,
  getUsers
};

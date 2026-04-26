const Cart = require('../models/Cart');

// @desc    Get user cart
// @route   GET /api/cart
// @access  Private
const getCart = async (req, res) => {
  try {
    let cart = await Cart.findOne({ user: req.user._id }).populate('items.product', 'name price images stock weightKg variants');
    if (!cart) {
      // Create empty cart if it doesn't exist
      cart = await Cart.create({ user: req.user._id, items: [] });
    }
    res.json(cart);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching cart', error: error.message });
  }
};

// @desc    Add item to cart
// @route   POST /api/cart
// @access  Private
const addToCart = async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    
    let cart = await Cart.findOne({ user: req.user._id });

    if (!cart) {
      cart = new Cart({ user: req.user._id, items: [] });
    }

    // Check if item already exists in cart
    const itemIndex = cart.items.findIndex(item => item.product.toString() === productId);

    if (itemIndex > -1) {
      // Increment quantity if it exists
      cart.items[itemIndex].quantity += (quantity || 1);
    } else {
      // Add new item
      cart.items.push({ product: productId, quantity: quantity || 1 });
    }

    await cart.save();
    
    // Return populated cart to client for immediate UI updates
    const populatedCart = await Cart.findById(cart._id).populate('items.product', 'name price images stock weightKg variants');
    res.json(populatedCart);
  } catch (error) {
    res.status(500).json({ message: 'Error adding to cart', error: error.message });
  }
};

// @desc    Update cart item quantity
// @route   PUT /api/cart/:productId
// @access  Private
const updateQuantity = async (req, res) => {
  try {
    const { quantity } = req.body;
    const productId = req.params.productId;

    if (quantity < 1) {
      return res.status(400).json({ message: 'Quantity must be at least 1' });
    }

    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      return res.status(404).json({ message: 'Cart not found' });
    }

    const itemIndex = cart.items.findIndex(item => item.product.toString() === productId);
    
    if (itemIndex > -1) {
      cart.items[itemIndex].quantity = quantity;
      await cart.save();
      const populatedCart = await Cart.findById(cart._id).populate('items.product', 'name price images stock weightKg variants');
      res.json(populatedCart);
    } else {
      res.status(404).json({ message: 'Item not found in cart' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Error updating cart quantity', error: error.message });
  }
};

// @desc    Remove item from cart
// @route   DELETE /api/cart/:productId
// @access  Private
const removeFromCart = async (req, res) => {
  try {
    const productId = req.params.productId;

    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      return res.status(404).json({ message: 'Cart not found' });
    }

    cart.items = cart.items.filter(item => item.product.toString() !== productId);
    
    await cart.save();
    const populatedCart = await Cart.findById(cart._id).populate('items.product', 'name price images stock weightKg variants');
    res.json(populatedCart);
  } catch (error) {
    res.status(500).json({ message: 'Error removing from cart', error: error.message });
  }
};

module.exports = {
  getCart,
  addToCart,
  updateQuantity,
  removeFromCart
};

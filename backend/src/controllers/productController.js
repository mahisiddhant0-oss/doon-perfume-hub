const Product = require('../models/Product');
const MAX_SEARCH_KEYWORD_LENGTH = 120;

const normalizeKeyword = (value = '') => String(value).trim().slice(0, MAX_SEARCH_KEYWORD_LENGTH);
const escapeRegex = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const normalizeWeightKg = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }
  return parsed;
};

const normalizeCategories = (category, categories) => {
  const fromArray = Array.isArray(categories)
    ? categories.map((entry) => String(entry || '').trim())
    : [];
  const fromPrimary = String(category || '').trim();

  const merged = [...fromArray, fromPrimary].filter(Boolean);
  const uniqueCategories = Array.from(new Set(merged));
  return uniqueCategories.length > 0 ? uniqueCategories : ['general'];
};

const normalizeVariants = (variants = []) => {
  if (!Array.isArray(variants)) {
    return [];
  }

  return variants
    .map((variant) => {
      const label = String(variant?.label || '').trim();
      const price = Number(variant?.price);
      const stock = Number(variant?.stock);
      const weight = Number(variant?.weight);

      if (!label || !Number.isFinite(price) || price < 0) {
        return null;
      }

      return {
        label,
        price,
        stock: Number.isFinite(stock) && stock >= 0 ? stock : 0,
        weight: Number.isFinite(weight) && weight >= 0 ? weight : 0,
      };
    })
    .filter(Boolean);
};

const MOCK_PRODUCTS = [
  {
    _id: "mock1",
    name: "Signature Scent",
    description: "Our signature artisanal fragrance with notes of amber and spice.",
    price: 120,
    category: "perfumes",
    categories: ["perfumes"],
    isActive: true,
    images: ["https://images.unsplash.com/photo-1541643600914-78b084683601?w=800&q=80"]
  },
  {
    _id: "mock2",
    name: "Oud Luxe",
    description: "Premium pure oud extract from the finest aged agarwood.",
    price: 250,
    category: "ouds",
    categories: ["ouds"],
    isActive: true,
    images: ["https://images.unsplash.com/photo-1583445013765-46c20c4a6772?w=800&q=80"]
  },
  {
    _id: "mock3",
    name: "Floral Bloom",
    description: "A fresh bouquet of jasmine and rose in a concentrated oil base.",
    price: 85,
    category: "essential-oils",
    categories: ["essential-oils"],
    isActive: true,
    images: ["https://images.unsplash.com/photo-1512909006721-3d6018887383?w=800&q=80"]
  },
  {
    _id: "mock4",
    name: "Musk Pure",
    description: "Warm, long-lasting musk that develops uniquely on every skin.",
    price: 150,
    category: "attars",
    categories: ["attars"],
    isActive: true,
    images: ["https://images.unsplash.com/photo-1615397587889-cbcedb5679ac?w=800&q=80"]
  }
];

// @desc    Fetch all products
// @route   GET /api/products
// @access  Public
const getProducts = async (req, res) => {
  try {
    const safeKeyword = normalizeKeyword(req.query.keyword);

    // Escape user input before regex to prevent invalid patterns and regex injection.
    const keyword = safeKeyword
      ? {
          name: {
            $regex: escapeRegex(safeKeyword),
            $options: 'i', // case-insensitive
          },
        }
      : {};

    const requestedCategories = String(req.query.category || '')
      .split(',')
      .map((entry) => String(entry || '').trim())
      .filter(Boolean);

    const categoryFilter =
      requestedCategories.length > 0
        ? {
            $or: [
              { category: { $in: requestedCategories } },
              { categories: { $in: requestedCategories } },
            ],
          }
        : {};

    // For public, we might only want to show active products
    const products = await Product.find({ ...keyword, ...categoryFilter, isActive: true });
    
    // If no products in DB, return mock data
    if (products.length === 0) {
      return res.json(MOCK_PRODUCTS);
    }
    
    res.json(products);
  } catch (error) {
    console.warn('DB Fetch failed, returning MOCK_PRODUCTS');
    res.json(MOCK_PRODUCTS); // Return mock data on error as well
  }
};

// @desc    Fetch single product
// @route   GET /api/products/:id
// @access  Public
const getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (product) {
      res.json(product);
    } else {
      res.status(404).json({ message: 'Product not found' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server Error fetching product' });
  }
};

// @desc    Create a product
// @route   POST /api/products
// @access  Private/Admin
const createProduct = async (req, res) => {
  try {
    const { name, description, price, sku, category, categories, stock, images, attributes, weightKg, variants } = req.body;
    const normalizedCategories = normalizeCategories(category, categories);

    const productExists = await Product.findOne({ sku });
    if (productExists) {
        return res.status(400).json({ message: 'Product with this SKU already exists' });
    }

    const product = new Product({
      name,
      description,
      price,
      sku,
      category: normalizedCategories[0],
      categories: normalizedCategories,
      stock,
      weightKg: normalizeWeightKg(weightKg),
      images,
      attributes,
      variants: normalizeVariants(variants),
    });

    const createdProduct = await product.save();
    res.status(201).json(createdProduct);
  } catch (error) {
    res.status(500).json({ message: 'Server Error creating product', error: error.message });
  }
};

// @desc    Update a product
// @route   PUT /api/products/:id
// @access  Private/Admin
const updateProduct = async (req, res) => {
  try {
    const { name, description, price, sku, category, categories, stock, images, attributes, isActive, weightKg, variants } = req.body;

    const product = await Product.findById(req.params.id);

    if (product) {
      product.name = name || product.name;
      product.description = description || product.description;
      product.price = price !== undefined ? price : product.price;
      product.sku = sku || product.sku;
      if (category !== undefined || categories !== undefined) {
        const normalizedCategories = normalizeCategories(
          category !== undefined ? category : product.category,
          categories !== undefined ? categories : product.categories
        );
        product.category = normalizedCategories[0];
        product.categories = normalizedCategories;
      }
      product.stock = stock !== undefined ? stock : product.stock;
      product.weightKg = weightKg !== undefined ? normalizeWeightKg(weightKg) : product.weightKg;
      
      if (images) product.images = images;
      if (attributes) product.attributes = attributes;
      if (variants !== undefined) product.variants = normalizeVariants(variants);
      if (isActive !== undefined) product.isActive = isActive;

      const updatedProduct = await product.save();
      res.json(updatedProduct);
    } else {
      res.status(404).json({ message: 'Product not found' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server Error updating product', error: error.message });
  }
};

// @desc    Delete a product (Soft Delete)
// @route   DELETE /api/products/:id
// @access  Private/Admin
const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      res.status(404).json({ message: 'Product not found' });
      return;
    }

    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: 'Product permanently deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server Error deleting product' });
  }
};

module.exports = {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct
};

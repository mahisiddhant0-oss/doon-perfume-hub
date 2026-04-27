const Product = require('../models/Product');
const ProductCategory = require('../models/ProductCategory');
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

const normalizeSku = (value = '') => String(value || '').trim();
const EXCLUDED_CATEGORY_VALUES = new Set(['attars', 'ouds']);
const DEFAULT_CATEGORY_VALUES = ['perfumes', 'essential-oils', 'bottles', 'general'];

const normalizeCategories = (category, categories) => {
  const fromArray = Array.isArray(categories)
    ? categories.map((entry) => String(entry || '').trim())
    : typeof categories === 'string'
      ? categories.split(',').map((entry) => String(entry || '').trim())
      : [];
  const fromPrimary = String(category || '').trim();

  const merged = [...fromArray, fromPrimary]
    .filter(Boolean)
    .filter((entry) => !EXCLUDED_CATEGORY_VALUES.has(String(entry).toLowerCase()));

  const seen = new Set();
  const uniqueCategories = merged.filter((entry) => {
    const normalized = String(entry).toLowerCase();
    if (seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });

  return uniqueCategories.length > 0 ? uniqueCategories : ['general'];
};

const upsertCategories = async (categories = []) => {
  const normalized = normalizeCategories('', categories);
  if (normalized.length === 0) return;
  await ProductCategory.bulkWrite(
    normalized.map((value) => ({
      updateOne: {
        filter: { value: String(value).toLowerCase() },
        update: { $setOnInsert: { value: String(value).toLowerCase() } },
        upsert: true,
      },
    })),
    { ordered: false }
  );
};

const getProductCategories = async (req, res) => {
  try {
    await upsertCategories(DEFAULT_CATEGORY_VALUES);

    const categoryDocs = await ProductCategory.find({}, { value: 1, _id: 0 }).lean();
    const fromProductsCategories = await Product.distinct('categories');
    const fromProductsPrimary = await Product.distinct('category');

    const merged = [
      ...DEFAULT_CATEGORY_VALUES,
      ...categoryDocs.map((doc) => doc.value),
      ...fromProductsCategories,
      ...fromProductsPrimary,
    ]
      .map((entry) => String(entry || '').trim().toLowerCase())
      .filter(Boolean)
      .filter((entry) => !EXCLUDED_CATEGORY_VALUES.has(entry));

    const unique = Array.from(new Set(merged));
    res.json(unique);
  } catch (error) {
    res.status(500).json({ message: 'Server Error fetching categories', error: error.message });
  }
};

const createProductCategory = async (req, res) => {
  try {
    const rawValue = String(req.body?.value || '').trim().toLowerCase();
    if (!rawValue) {
      return res.status(400).json({ message: 'Category value is required' });
    }
    if (EXCLUDED_CATEGORY_VALUES.has(rawValue)) {
      return res.status(400).json({ message: 'This category is not allowed' });
    }
    if (rawValue.length > 80) {
      return res.status(400).json({ message: 'Category is too long' });
    }

    const doc = await ProductCategory.findOneAndUpdate(
      { value: rawValue },
      { $setOnInsert: { value: rawValue } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return res.status(201).json({ value: doc.value });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(200).json({ value: String(req.body?.value || '').trim().toLowerCase() });
    }
    res.status(500).json({ message: 'Server Error creating category', error: error.message });
  }
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
      const image = String(variant?.image || '').trim();

      if (!label || !Number.isFinite(price) || price < 0) {
        return null;
      }

      return {
        label,
        price,
        stock: Number.isFinite(stock) && stock >= 0 ? stock : 0,
        weight: Number.isFinite(weight) && weight >= 0 ? weight : 0,
        image,
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
    category: "perfumes",
    categories: ["perfumes"],
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
    category: "perfumes",
    categories: ["perfumes"],
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
    const normalizedSku = normalizeSku(sku);

    const productExists = await Product.findOne({ sku: normalizedSku });
    if (productExists) {
        return res.status(400).json({ message: 'Product with this SKU already exists' });
    }

    const product = new Product({
      name: String(name || '').trim(),
      description,
      price,
      sku: normalizedSku,
      category: normalizedCategories[0],
      categories: normalizedCategories,
      stock,
      weightKg: normalizeWeightKg(weightKg),
      images,
      attributes,
      variants: normalizeVariants(variants),
    });

    const createdProduct = await product.save();
    await upsertCategories(normalizedCategories);
    res.status(201).json(createdProduct);
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(400).json({ message: 'Product with this SKU already exists' });
    }
    if (error?.name === 'ValidationError') {
      return res.status(400).json({ message: 'Validation failed while creating product', error: error.message });
    }
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
      product.name = name !== undefined ? String(name || '').trim() : product.name;
      product.description = description || product.description;
      product.price = price !== undefined ? price : product.price;
      product.sku = sku !== undefined ? normalizeSku(sku) : product.sku;
      if (category !== undefined || categories !== undefined) {
        const normalizedCategories = normalizeCategories(
          category !== undefined ? category : product.category,
          categories !== undefined ? categories : product.categories
        );
        product.category = normalizedCategories[0];
        product.categories = normalizedCategories;
        await upsertCategories(normalizedCategories);
      }
      product.stock = stock !== undefined ? stock : product.stock;
      product.weightKg = weightKg !== undefined ? normalizeWeightKg(weightKg) : product.weightKg;
      
      if (images) product.images = images;
      if (attributes) product.attributes = attributes;
      if (variants !== undefined) product.variants = normalizeVariants(variants);
      if (isActive !== undefined) product.isActive = isActive;

      const updatedProduct = await product.save();
      const freshProduct = await Product.findById(updatedProduct._id);
      res.json(freshProduct || updatedProduct);
    } else {
      res.status(404).json({ message: 'Product not found' });
    }
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(400).json({ message: 'Product with this SKU already exists' });
    }
    if (error?.name === 'ValidationError') {
      return res.status(400).json({ message: 'Validation failed while updating product', error: error.message });
    }
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
  getProductCategories,
  createProductCategory,
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct
};

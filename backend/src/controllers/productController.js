const Product = require('../models/Product');
const ProductCategory = require('../models/ProductCategory');
const Enquiry = require('../models/Enquiry');
const { syncProductImagesFromWix } = require('../services/wixImageSyncService');
const { ensureEssentialOil100mlVariants } = require('../services/essentialOilVariantService');
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
const normalizeSearchKeywords = (searchKeywords) => {
  const fromArray = Array.isArray(searchKeywords)
    ? searchKeywords
    : typeof searchKeywords === 'string'
      ? searchKeywords.split(',')
      : [];

  const seen = new Set();
  return fromArray
    .map((entry) => String(entry || '').trim().toLowerCase())
    .filter(Boolean)
    .filter((entry) => {
      if (entry.length > 80) return false;
      if (seen.has(entry)) return false;
      seen.add(entry);
      return true;
    });
};
const EXCLUDED_CATEGORY_VALUES = new Set(['attars', 'ouds']);
const DEFAULT_CATEGORY_VALUES = ['all', 'perfumes', 'essential-oils', 'bottles'];
const formatCategoryName = (value = '') =>
  String(value || '')
    .trim()
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());

const normalizeNameKey = (value = '') =>
  String(value || '')
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/\s+essential\s+oil$/i, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

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

  const baseCategories = uniqueCategories.length > 0 ? uniqueCategories : ['perfumes'];
  const hasAll = baseCategories.some((entry) => String(entry).toLowerCase() === 'all');
  return hasAll ? baseCategories : [...baseCategories, 'all'];
};

const upsertCategories = async (categories = []) => {
  const normalized = normalizeCategories('', categories);
  if (normalized.length === 0) return;
  await ProductCategory.bulkWrite(
    normalized.map((value) => ({
      updateOne: {
        filter: { value: String(value).toLowerCase() },
        update: { $setOnInsert: { value: String(value).toLowerCase(), name: formatCategoryName(value) } },
        upsert: true,
      },
    })),
    { ordered: false }
  );
};

const getProductCategories = async (req, res) => {
  try {
    const fromProductsCategories = await Product.distinct('categories');
    const fromProductsPrimary = await Product.distinct('category');
    await upsertCategories([...DEFAULT_CATEGORY_VALUES, ...fromProductsCategories, ...fromProductsPrimary]);

    const categoryDocs = await ProductCategory.find({}, { value: 1, name: 1, description: 1, image: 1 }).lean();

    const mergedValues = [
      ...DEFAULT_CATEGORY_VALUES,
      ...categoryDocs.map((doc) => doc.value),
      ...fromProductsCategories,
      ...fromProductsPrimary,
    ]
      .map((entry) => String(entry || '').trim().toLowerCase())
      .filter(Boolean)
      .filter((entry) => !EXCLUDED_CATEGORY_VALUES.has(entry));

    const unique = Array.from(new Set(mergedValues));
    const docsByValue = new Map(
      categoryDocs.map((doc) => [String(doc.value || '').toLowerCase(), doc])
    );
    const payload = unique.map((value) => {
      const existing = docsByValue.get(value);
      return {
        _id: existing?._id || value,
        value,
        name: existing?.name || formatCategoryName(value),
        description: existing?.description || '',
        image: existing?.image || '',
      };
    });
    res.json(payload);
  } catch (error) {
    res.status(500).json({ message: 'Server Error fetching categories', error: error.message });
  }
};

const createProductCategory = async (req, res) => {
  try {
    const rawValue = String(req.body?.value || '').trim().toLowerCase();
    const rawName = String(req.body?.name || '').trim();
    const rawDescription = String(req.body?.description || '').trim();
    const rawImage = String(req.body?.image || '').trim();
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
      {
        $set: {
          ...(rawName ? { name: rawName } : {}),
          ...(rawDescription ? { description: rawDescription } : {}),
          ...(rawImage ? { image: rawImage } : {}),
        },
        $setOnInsert: {
          value: rawValue,
          name: rawName || formatCategoryName(rawValue),
          description: rawDescription,
          image: rawImage,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return res.status(201).json(doc);
  } catch (error) {
    if (error?.code === 11000) {
      const value = String(req.body?.value || '').trim().toLowerCase();
      const existing = await ProductCategory.findOne({ value });
      return res.status(200).json(existing || { value });
    }
    res.status(500).json({ message: 'Server Error creating category', error: error.message });
  }
};

const getProductCategoryById = async (req, res) => {
  try {
    const category = await ProductCategory.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }
    return res.json(category);
  } catch (error) {
    return res.status(500).json({ message: 'Server Error fetching category', error: error.message });
  }
};

const updateProductCategory = async (req, res) => {
  try {
    const category = await ProductCategory.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    const nextName = String(req.body?.name || '').trim();
    const nextDescription = String(req.body?.description || '').trim();
    const nextImage = String(req.body?.image || '').trim();

    category.name = nextName || category.name || formatCategoryName(category.value);
    category.description = nextDescription;
    category.image = nextImage;

    const updated = await category.save();
    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ message: 'Server Error updating category', error: error.message });
  }
};

const deleteProductCategory = async (req, res) => {
  try {
    const category = await ProductCategory.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    const value = String(category.value || '').toLowerCase();
    const usageQuery = {
      $or: [{ category: value }, { categories: value }],
    };
    const usageCount = await Product.countDocuments(usageQuery);

    if (usageCount > 0) {
      const blockingProducts = await Product.find(usageQuery)
        .select('name sku category categories isActive')
        .limit(20)
        .lean();

      return res.status(400).json({
        message: `Category is used by ${usageCount} product(s). Reassign those products before deleting.`,
        products: blockingProducts.map((product) => ({
          id: product._id,
          name: product.name,
          sku: product.sku,
          category: product.category,
          categories: product.categories,
          isActive: product.isActive,
        })),
      });
    }

    await ProductCategory.deleteOne({ _id: category._id });
    return res.json({ message: 'Category deleted' });
  } catch (error) {
    return res.status(500).json({ message: 'Server Error deleting category', error: error.message });
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
    const keywordFilter = safeKeyword
      ? {
          $or: [
            {
              name: {
                $regex: escapeRegex(safeKeyword),
                $options: 'i', // case-insensitive
              },
            },
            {
              sku: {
                $regex: escapeRegex(safeKeyword),
                $options: 'i',
              },
            },
            {
              searchKeywords: {
                $elemMatch: {
                  $regex: escapeRegex(safeKeyword),
                  $options: 'i',
                },
              },
            },
          ],
        }
      : {};

    const requestedCategories = String(req.query.category || '')
      .split(',')
      .map((entry) => String(entry || '').trim())
      .filter(Boolean);
    const hasSearchFilter = Boolean(safeKeyword) || requestedCategories.length > 0;

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
    const products = await Product.find({ ...keywordFilter, ...categoryFilter, isActive: true });

    // For filtered searches/categories, preserve empty results so frontend can show "No products found".
    if (products.length === 0 && hasSearchFilter) {
      return res.json([]);
    }

    // Keep legacy mock fallback only for completely unfiltered requests.
    if (products.length === 0) {
      return res.json(MOCK_PRODUCTS);
    }

    res.json(products);
  } catch (error) {
    console.warn('DB Fetch failed, returning MOCK_PRODUCTS');
    const requestedCategories = String(req.query.category || '')
      .split(',')
      .map((entry) => String(entry || '').trim())
      .filter(Boolean);
    const hasSearchFilter = Boolean(normalizeKeyword(req.query.keyword)) || requestedCategories.length > 0;
    if (hasSearchFilter) {
      return res.json([]);
    }
    res.json(MOCK_PRODUCTS); // Return mock data on unfiltered errors
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
    const { name, description, searchKeywords, price, sku, category, categories, stock, images, attributes, weightKg, variants, enquiryOnly } = req.body;
    const normalizedCategories = normalizeCategories(category, categories);
    const normalizedSku = normalizeSku(sku);
    const normalizedSearchKeywords = normalizeSearchKeywords(searchKeywords);

    const productExists = await Product.findOne({ sku: normalizedSku });
    if (productExists) {
        return res.status(400).json({ message: 'Product with this SKU already exists' });
    }

    const product = new Product({
      name: String(name || '').trim(),
      description,
      searchKeywords: normalizedSearchKeywords,
      price,
      sku: normalizedSku,
      category: normalizedCategories[0],
      categories: normalizedCategories,
      stock,
      weightKg: normalizeWeightKg(weightKg),
      images,
      attributes,
      variants: normalizeVariants(variants),
      enquiryOnly: Boolean(enquiryOnly),
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
    const { name, description, searchKeywords, price, sku, category, categories, stock, images, attributes, isActive, weightKg, variants, enquiryOnly } = req.body;

    const product = await Product.findById(req.params.id);

    if (product) {
      product.name = name !== undefined ? String(name || '').trim() : product.name;
      product.description = description || product.description;
      if (searchKeywords !== undefined) product.searchKeywords = normalizeSearchKeywords(searchKeywords);
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
      if (enquiryOnly !== undefined) product.enquiryOnly = Boolean(enquiryOnly);

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

// @desc    Submit price enquiry for enquiry-only products
// @route   POST /api/products/:id/enquiry
// @access  Public
const submitProductEnquiry = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).select('name sku enquiryOnly');
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    if (!product.enquiryOnly) {
      return res.status(400).json({ message: 'This product does not support price enquiry.' });
    }

    const name = String(req.body?.name || '').trim();
    const phone = String(req.body?.phone || '').trim();
    const normalizedPhone = phone.replace(/[^\d+]/g, '');

    if (name.length < 2 || name.length > 100) {
      return res.status(400).json({ message: 'Please enter a valid name.' });
    }
    if (!/^(\+?\d{10,15})$/.test(normalizedPhone)) {
      return res.status(400).json({ message: 'Please enter a valid phone number.' });
    }

    await Enquiry.create({
      name,
      phone: normalizedPhone,
      product: {
        productId: product._id,
        name: product.name,
        sku: product.sku || '',
      },
    });

    return res.status(201).json({
      message: 'Enquiry submitted successfully',
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to submit enquiry', error: error.message });
  }
};

// @desc    Sync product images from Wix media folder
// @route   POST /api/products/admin/sync-wix-images
// @access  Private/Admin
const syncWixImages = async (req, res) => {
  try {
    const folder = String(req.body?.folder || '').trim() || process.env.WIX_MEDIA_FOLDER || '';
    const matchBy = String(req.body?.matchBy || 'name').toLowerCase() === 'sku' ? 'sku' : 'name';

    const result = await syncProductImagesFromWix({ folder, matchBy });
    return res.status(200).json({
      message: 'Wix image sync completed',
      ...result,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Wix image sync failed', error: error.message });
  }
};

// @desc    Force-sync 100ml variants for essential-oils products
// @route   POST /api/products/admin/sync-essential-oils-100ml
// @access  Private/Admin
const syncEssentialOil100mlVariants = async (req, res) => {
  try {
    const result = await ensureEssentialOil100mlVariants();
    return res.status(200).json({
      message: 'Essential-oil 100ml variant sync completed',
      ...result,
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Essential-oil 100ml variant sync failed',
      error: error.message,
    });
  }
};

// @desc    Apply manual image mappings to essential-oil products by name
// @route   POST /api/products/admin/map-essential-oil-images
// @access  Private/Admin
const mapEssentialOilImages = async (req, res) => {
  try {
    const mappings = Array.isArray(req.body?.mappings) ? req.body.mappings : [];
    if (mappings.length === 0) {
      return res.status(400).json({ message: 'mappings array is required' });
    }

    const normalizedMappings = mappings
      .map((entry) => ({
        name: String(entry?.name || '').trim(),
        key: normalizeNameKey(entry?.name || ''),
        imageUrl: String(entry?.imageUrl || '').trim(),
      }))
      .filter((entry) => entry.key && /^https?:\/\//i.test(entry.imageUrl));

    if (normalizedMappings.length === 0) {
      return res.status(400).json({ message: 'No valid mappings found (name + imageUrl required)' });
    }

    const products = await Product.find({ isActive: true }).select('name category categories images variants');
    let updatedProducts = 0;
    const applied = [];
    const notFound = [];

    for (const mapping of normalizedMappings) {
      const product = products.find((item) => {
        const primary = String(item.category || '').toLowerCase();
        const categories = Array.isArray(item.categories)
          ? item.categories.map((entry) => String(entry || '').toLowerCase())
          : [];
        const isEssentialOil = primary === 'essential-oils' || categories.includes('essential-oils');
        if (!isEssentialOil) return false;
        return normalizeNameKey(item.name) === mapping.key;
      });

      if (!product) {
        notFound.push(mapping.name);
        continue;
      }

      let didChange = false;
      const currentFirstImage = Array.isArray(product.images) && product.images.length > 0 ? String(product.images[0] || '') : '';
      if (currentFirstImage !== mapping.imageUrl) {
        product.images = [mapping.imageUrl];
        didChange = true;
      }

      const variants = Array.isArray(product.variants) ? [...product.variants] : [];
      const vIndex = variants.findIndex((variant) => String(variant?.label || '').trim().toLowerCase() === '100ml');
      if (vIndex >= 0 && String(variants[vIndex]?.image || '').trim() !== mapping.imageUrl) {
        variants[vIndex] = { ...variants[vIndex], image: mapping.imageUrl };
        product.variants = variants;
        didChange = true;
      }

      if (didChange) {
        await product.save();
        updatedProducts += 1;
      }

      applied.push({
        mappingName: mapping.name,
        productName: product.name,
        imageUrl: mapping.imageUrl,
        updated: didChange,
      });
    }

    return res.status(200).json({
      message: 'Manual essential-oil image mapping completed',
      requestedMappings: mappings.length,
      validMappings: normalizedMappings.length,
      updatedProducts,
      applied,
      notFound,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Manual image mapping failed', error: error.message });
  }
};

// @desc    Set variant weight to 1kg for 100ml/250ml/500ml/1000ml across all products
// @route   POST /api/products/admin/set-standard-variant-weights
// @access  Private/Admin
const setStandardVariantWeights = async (req, res) => {
  try {
    const targetLabels = new Set(['100ml', '250ml', '500ml', '1000ml']);
    const targetWeight = 1;

    const products = await Product.find({}).select('variants');
    let productsUpdated = 0;
    let variantsUpdated = 0;

    for (const product of products) {
      if (!Array.isArray(product.variants) || product.variants.length === 0) continue;

      let changed = false;
      const nextVariants = product.variants.map((variant) => {
        const normalizedLabel = String(variant?.label || '').trim().toLowerCase().replace(/\s+/g, '');
        if (!targetLabels.has(normalizedLabel)) return variant;
        if (Number(variant?.weight) === targetWeight) return variant;

        changed = true;
        variantsUpdated += 1;
        return {
          ...variant.toObject?.(),
          weight: targetWeight,
        };
      });

      if (!changed) continue;
      product.variants = nextVariants;
      await product.save();
      productsUpdated += 1;
    }

    return res.status(200).json({
      message: 'Variant weight sync completed',
      result: {
        productsScanned: products.length,
        productsUpdated,
        variantsUpdated,
        labels: ['100ml', '250ml', '500ml', '1000ml'],
        weight: 1,
      },
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Variant weight sync failed',
      error: error.message,
    });
  }
};

// @desc    Add/update 250ml variants for selected essential oils and set all variant stocks to 50
// @route   POST /api/products/admin/sync-selected-essential-oils-250ml
// @access  Private/Admin
const syncSelectedEssentialOils250ml = async (req, res) => {
  try {
    const TARGET_PRODUCTS = [
      'OUD FOREST', 'ROSE AGRA 9624', 'DOWNTOWN TOM', 'VIKING', 'GLORIA',
      'COOL DRIFT', 'DARK COUNTY', 'WHITE DESERT', 'ARABIAN SONG', 'VELVET CREPE',
      'PHULORA', 'KESARI CHANDAN', 'NOBLE OUD', 'MAJESTIC EAGLE', 'ARABIAN MIRAGE',
      'SAFFRON BLISS', 'AMBER DREAMS', 'OUD GLORY', 'ROYAL WOODS', 'WILD BOULEVARD',
      'DARING AVENUE', 'FURIOUS FLARE', 'UNIVERSAL POWER', 'STONEWOOD', 'PURPLE SPORT',
      'MOST DESIRED', 'CREATIVE IMPACT', 'ADVENTURE TRAILS', 'SAVAGE FIRE', 'LOUVRE MAGIC',
      'PARISIAN LANES', 'LIBERATED GIRL', 'AIR DRONE', 'ERASURE FRESH', 'HER HIGHNESS',
      'LADY MACBETH', 'DUSKLINE', 'BLACK VELVET', 'IMAGINE STARS', 'ARABIC LURE',
      'AFGHAN TIGER', 'GYPSY TRAIL', 'RED DIAMOND', 'ORCHID SUNSET', 'AMBERY NIGHTS',
      'SANDAL WOOD', 'CHANDAN PURE', 'PURE GEELI MITTI', 'ARABIAN HONEY',
    ];

    const normalizeNameKey = (value = '') =>
      String(value || '')
        .toUpperCase()
        .replace(/\s+ESSENTIAL\s+OIL$/i, '')
        .replace(/[^A-Z0-9]+/g, ' ')
        .trim();
    const normalizeLabel = (value = '') => String(value || '').trim().toLowerCase().replace(/\s+/g, '');
    const getVariant = (variants, label) =>
      Array.isArray(variants)
        ? variants.find((variant) => normalizeLabel(variant?.label) === normalizeLabel(label)) || null
        : null;
    const isEssentialOil = (product) => {
      const category = String(product?.category || '').toLowerCase();
      const categories = Array.isArray(product?.categories) ? product.categories.map((entry) => String(entry || '').toLowerCase()) : [];
      return category === 'essential-oils' || categories.includes('essential-oils');
    };

    const targetSet = new Set(TARGET_PRODUCTS.map(normalizeNameKey));
    const products = await Product.find({ isActive: true }).select('name category categories variants');
    const candidates = products.filter((product) => isEssentialOil(product) && targetSet.has(normalizeNameKey(product.name)));

    let updated = 0;
    const skippedNo100ml = [];

    for (const product of candidates) {
      const variants = Array.isArray(product.variants) ? [...product.variants] : [];
      const variant100ml = getVariant(variants, '100ml');

      if (!variant100ml || !Number.isFinite(Number(variant100ml.price))) {
        skippedNo100ml.push(product.name);
        continue;
      }

      const variant250Price = Math.round(Number(variant100ml.price) * 2 + 75);
      const current250 = getVariant(variants, '250ml');
      const weightFrom100 = Number.isFinite(Number(variant100ml.weight)) ? Number(variant100ml.weight) : 1;

      const nextVariants = variants.map((variant) => ({
        ...variant.toObject?.(),
        stock: 50,
      }));

      if (current250) {
        const idx = nextVariants.findIndex((variant) => normalizeLabel(variant?.label) === '250ml');
        nextVariants[idx] = {
          ...nextVariants[idx],
          label: '250ml',
          price: variant250Price,
          stock: 50,
          weight: weightFrom100,
        };
      } else {
        nextVariants.push({
          label: '250ml',
          price: variant250Price,
          stock: 50,
          weight: weightFrom100,
          image: '',
        });
      }

      product.variants = nextVariants;
      await product.save();
      updated += 1;
    }

    return res.status(200).json({
      message: 'Selected essential-oil 250ml sync completed',
      result: {
        targetRequested: TARGET_PRODUCTS.length,
        matchedProducts: candidates.length,
        updatedProducts: updated,
        skippedNo100mlCount: skippedNo100ml.length,
        skippedNo100ml,
      },
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Selected essential-oil 250ml sync failed',
      error: error.message,
    });
  }
};

// @desc    Recalculate all 250ml variant prices using 100ml base: (100ml * 2.5) + 75
// @route   POST /api/products/admin/reprice-250ml-variants
// @access  Private/Admin
const repriceAll250mlVariants = async (req, res) => {
  try {
    const normalizeLabel = (value = '') => String(value || '').trim().toLowerCase().replace(/\s+/g, '');

    const products = await Product.find({ isActive: true }).select('name variants');
    let productsUpdated = 0;
    let variantsUpdated = 0;
    let skippedNo100ml = 0;
    let skippedNo250ml = 0;

    for (const product of products) {
      const variants = Array.isArray(product.variants) ? [...product.variants] : [];
      if (variants.length === 0) continue;

      const idx100 = variants.findIndex((variant) => normalizeLabel(variant?.label) === '100ml');
      const idx250 = variants.findIndex((variant) => normalizeLabel(variant?.label) === '250ml');

      if (idx250 === -1) {
        skippedNo250ml += 1;
        continue;
      }
      if (idx100 === -1 || !Number.isFinite(Number(variants[idx100]?.price))) {
        skippedNo100ml += 1;
        continue;
      }

      const newPrice = Math.round(Number(variants[idx100].price) * 2.5 + 75);
      const prevPrice = Number(variants[idx250]?.price);
      if (prevPrice === newPrice) continue;

      variants[idx250] = {
        ...variants[idx250].toObject?.(),
        price: newPrice,
      };

      product.variants = variants;
      await product.save();
      productsUpdated += 1;
      variantsUpdated += 1;
    }

    return res.status(200).json({
      message: '250ml repricing completed',
      result: {
        productsScanned: products.length,
        productsUpdated,
        variantsUpdated,
        formula: '(100ml * 2.5) + 75',
        skippedNo100ml,
        skippedNo250ml,
      },
    });
  } catch (error) {
    return res.status(500).json({
      message: '250ml repricing failed',
      error: error.message,
    });
  }
};

// @desc    Upload product images from admin panel (drag-drop / file picker)
// @route   POST /api/products/admin/upload-images
// @access  Private/Admin
const uploadAdminProductImages = async (req, res) => {
  try {
    const files = Array.isArray(req.files) ? req.files : [];
    if (files.length === 0) {
      return res.status(400).json({ message: 'No image files uploaded' });
    }

    const host = req.get('host');
    const protocol = req.headers['x-forwarded-proto'] ? String(req.headers['x-forwarded-proto']).split(',')[0] : req.protocol;
    const baseUrl = `${protocol}://${host}`;
    const urls = files.map((file) => `${baseUrl}/uploads/products/${file.filename}`);

    return res.status(201).json({
      message: 'Images uploaded successfully',
      urls,
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Image upload failed',
      error: error.message,
    });
  }
};

// @desc    Apply one image URL to all products that contain a 5kg variant
// @route   POST /api/products/admin/set-5kg-image
// @access  Private/Admin
const setFiveKgProductsImage = async (req, res) => {
  try {
    const imageUrl = String(req.body?.imageUrl || '').trim();
    if (!/^https?:\/\//i.test(imageUrl)) {
      return res.status(400).json({ message: 'Valid imageUrl is required' });
    }

    const normalizeLabel = (value = '') => String(value || '').trim().toLowerCase().replace(/\s+/g, '');
    const products = await Product.find({ isActive: true }).select('name images variants');

    let matchedProducts = 0;
    let updatedProducts = 0;
    let updatedVariantImages = 0;

    for (const product of products) {
      const variants = Array.isArray(product.variants) ? [...product.variants] : [];
      if (!variants.length) continue;

      const fiveKgIndexes = [];
      variants.forEach((variant, idx) => {
        if (normalizeLabel(variant?.label) === '5kg') fiveKgIndexes.push(idx);
      });
      if (fiveKgIndexes.length === 0) continue;

      matchedProducts += 1;
      let changed = false;

      const currentFirstImage = Array.isArray(product.images) && product.images.length > 0 ? String(product.images[0] || '').trim() : '';
      if (currentFirstImage !== imageUrl) {
        product.images = [imageUrl];
        changed = true;
      }

      for (const idx of fiveKgIndexes) {
        const currentVariantImage = String(variants[idx]?.image || '').trim();
        if (currentVariantImage !== imageUrl) {
          variants[idx] = {
            ...variants[idx].toObject?.(),
            image: imageUrl,
          };
          changed = true;
          updatedVariantImages += 1;
        }
      }

      if (changed) {
        product.variants = variants;
        await product.save();
        updatedProducts += 1;
      }
    }

    return res.status(200).json({
      message: '5kg image sync completed',
      result: {
        imageUrl,
        productsScanned: products.length,
        matchedProducts,
        updatedProducts,
        updatedVariantImages,
      },
    });
  } catch (error) {
    return res.status(500).json({
      message: '5kg image sync failed',
      error: error.message,
    });
  }
};

// @desc    Add/update 10kg variant for products containing 5KG/25KG ESSENTIAL OIL in name
// @route   POST /api/products/admin/sync-10kg-enquiry-variants
// @access  Private/Admin
const syncTenKgEnquiryVariants = async (req, res) => {
  try {
    const normalizeLabel = (value = '') => String(value || '').trim().toLowerCase().replace(/\s+/g, '');
    const isTargetName = (name = '') => {
      const value = String(name || '').toUpperCase();
      return /(^|\s)5\s*KG\s+ESSENTIAL\s+OIL\b/.test(value) || /(^|\s)25\s*KG\s+ESSENTIAL\s+OIL\b/.test(value);
    };

    const products = await Product.find({ isActive: true }).select('name variants');
    let matchedProducts = 0;
    let updatedProducts = 0;
    let createdVariants = 0;
    let updatedVariants = 0;

    for (const product of products) {
      if (!isTargetName(product.name)) continue;
      matchedProducts += 1;

      const variants = Array.isArray(product.variants) ? [...product.variants] : [];
      const idx10 = variants.findIndex((variant) => normalizeLabel(variant?.label) === '10kg');
      const baseVariant = variants[0] || null;
      const fallbackImage = String(baseVariant?.image || '').trim();

      let changed = false;
      if (idx10 >= 0) {
        const current = variants[idx10];
        const next = {
          ...current.toObject?.(),
          label: '10kg',
          weight: 10,
          stock: Number.isFinite(Number(current?.stock)) ? Number(current.stock) : 50,
          price: 0,
        };
        if (String(next.image || '').trim().length === 0 && fallbackImage) {
          next.image = fallbackImage;
        }

        const currentWeight = Number(current?.weight);
        const currentPrice = Number(current?.price);
        const currentLabel = String(current?.label || '').trim().toLowerCase();
        const currentImage = String(current?.image || '').trim();
        const nextImage = String(next.image || '').trim();
        if (
          currentLabel !== '10kg' ||
          currentWeight !== 10 ||
          currentPrice !== 0 ||
          currentImage !== nextImage
        ) {
          variants[idx10] = next;
          changed = true;
          updatedVariants += 1;
        }
      } else {
        variants.push({
          label: '10kg',
          price: 0,
          stock: 50,
          weight: 10,
          image: fallbackImage,
        });
        changed = true;
        createdVariants += 1;
      }

      if (!changed) continue;
      product.variants = variants;
      await product.save();
      updatedProducts += 1;
    }

    return res.status(200).json({
      message: '10kg enquiry variant sync completed',
      result: {
        productsScanned: products.length,
        matchedProducts,
        updatedProducts,
        createdVariants,
        updatedVariants,
      },
    });
  } catch (error) {
    return res.status(500).json({
      message: '10kg enquiry variant sync failed',
      error: error.message,
    });
  }
};

// @desc    Add/update 10kg enquiry variant for all essential-oils products and apply provided image
// @route   POST /api/products/admin/sync-10kg-essential-oils
// @access  Private/Admin
const syncTenKgForAllEssentialOils = async (req, res) => {
  try {
    const imageUrl = String(req.body?.imageUrl || '').trim();
    if (!/^https?:\/\//i.test(imageUrl)) {
      return res.status(400).json({ message: 'Valid imageUrl is required' });
    }

    const normalizeLabel = (value = '') => String(value || '').trim().toLowerCase().replace(/\s+/g, '');
    const isEssentialOilProduct = (product) => {
      const primary = String(product?.category || '').toLowerCase();
      const categories = Array.isArray(product?.categories)
        ? product.categories.map((entry) => String(entry || '').toLowerCase())
        : [];
      return primary === 'essential-oils' || categories.includes('essential-oils');
    };

    const products = await Product.find({ isActive: true }).select('name category categories images variants');
    let matchedProducts = 0;
    let updatedProducts = 0;
    let createdVariants = 0;
    let updatedVariants = 0;
    let updatedProductImages = 0;

    for (const product of products) {
      if (!isEssentialOilProduct(product)) continue;
      matchedProducts += 1;

      const variants = Array.isArray(product.variants) ? [...product.variants] : [];
      const idx10 = variants.findIndex((variant) => normalizeLabel(variant?.label) === '10kg');
      const baseVariant = variants[0] || null;
      const fallbackStock = Number.isFinite(Number(baseVariant?.stock)) ? Number(baseVariant.stock) : 50;

      let changed = false;

      const currentFirstImage = Array.isArray(product.images) && product.images.length > 0 ? String(product.images[0] || '').trim() : '';
      if (currentFirstImage !== imageUrl) {
        product.images = [imageUrl];
        changed = true;
        updatedProductImages += 1;
      }

      if (idx10 >= 0) {
        const current = variants[idx10];
        const next = {
          ...current.toObject?.(),
          label: '10kg',
          weight: 10,
          price: 0,
          image: imageUrl,
          stock: Number.isFinite(Number(current?.stock)) ? Number(current.stock) : fallbackStock,
        };
        const currentLabel = String(current?.label || '').trim().toLowerCase();
        const currentWeight = Number(current?.weight);
        const currentPrice = Number(current?.price);
        const currentImage = String(current?.image || '').trim();
        const nextStock = Number(next.stock);
        const currentStock = Number(current?.stock);
        if (
          currentLabel !== '10kg' ||
          currentWeight !== 10 ||
          currentPrice !== 0 ||
          currentImage !== imageUrl ||
          currentStock !== nextStock
        ) {
          variants[idx10] = next;
          changed = true;
          updatedVariants += 1;
        }
      } else {
        variants.push({
          label: '10kg',
          price: 0,
          stock: fallbackStock,
          weight: 10,
          image: imageUrl,
        });
        changed = true;
        createdVariants += 1;
      }

      if (!changed) continue;
      product.variants = variants;
      await product.save();
      updatedProducts += 1;
    }

    return res.status(200).json({
      message: '10kg essential-oils sync completed',
      result: {
        imageUrl,
        productsScanned: products.length,
        matchedProducts,
        updatedProducts,
        createdVariants,
        updatedVariants,
        updatedProductImages,
      },
    });
  } catch (error) {
    return res.status(500).json({
      message: '10kg essential-oils sync failed',
      error: error.message,
    });
  }
};

module.exports = {
  getProductCategories,
  createProductCategory,
  getProductCategoryById,
  updateProductCategory,
  deleteProductCategory,
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  submitProductEnquiry,
  syncWixImages,
  syncEssentialOil100mlVariants,
  mapEssentialOilImages,
  setStandardVariantWeights,
  uploadAdminProductImages,
  syncSelectedEssentialOils250ml,
  repriceAll250mlVariants,
  setFiveKgProductsImage,
  syncTenKgEnquiryVariants,
  syncTenKgForAllEssentialOils,
};

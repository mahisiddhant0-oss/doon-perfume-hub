const mongoose = require('mongoose');

const variantSchema = new mongoose.Schema({
  label: { type: String, required: true }, // e.g. '100ml', '250ml', '500ml'
  price: { type: Number, required: true, min: 0 },
  stock: { type: Number, default: 100, min: 0 },
  weight: { type: Number, default: 0 }, // in kg
  image: { type: String, default: '' },
}, { _id: false });

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  sku: {
    type: String,
    unique: true,
    sparse: true,
    index: true
  },
  description: {
    type: String,
    default: ''
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  category: {
    type: String,
    required: true,
    index: true
  },
  categories: {
    type: [String],
    default: [],
    index: true
  },
  stock: {
    type: Number,
    default: 100,
    min: 0
  },
  weightKg: {
    type: Number,
    default: 0,
    min: 0
  },
  images: [String], // Simple array of URL strings
  variants: [variantSchema],
  isActive: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

productSchema.pre('validate', function syncCategoryFields() {
  const normalizedCategories = Array.isArray(this.categories)
    ? this.categories
        .map((entry) => String(entry || '').trim())
        .filter(Boolean)
    : [];

  const uniqueCategories = Array.from(new Set(normalizedCategories));
  const normalizedPrimary = String(this.category || '').trim();

  if (uniqueCategories.length === 0 && normalizedPrimary) {
    uniqueCategories.push(normalizedPrimary);
  }

  this.categories = uniqueCategories;
  this.category = uniqueCategories[0] || normalizedPrimary || 'general';

});

module.exports = mongoose.model('Product', productSchema);

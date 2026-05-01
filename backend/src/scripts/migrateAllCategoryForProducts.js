const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const Product = require('../models/Product');
const ProductCategory = require('../models/ProductCategory');

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI || '';

const normalizeCategories = (category, categories) => {
  const fromArray = Array.isArray(categories)
    ? categories.map((entry) => String(entry || '').trim())
    : [];
  const fromPrimary = String(category || '').trim();

  const merged = [...fromArray, fromPrimary].filter(Boolean);
  const seen = new Set();
  const unique = merged.filter((entry) => {
    const key = entry.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const withoutAll = unique.filter((entry) => entry.toLowerCase() !== 'all');
  return [...withoutAll, 'all'];
};

async function run() {
  if (!MONGODB_URI) throw new Error('MONGODB_URI is not configured');

  await mongoose.connect(MONGODB_URI);

  await ProductCategory.updateOne(
    { value: 'all' },
    { $set: { name: 'All' }, $setOnInsert: { value: 'all', description: '', image: '' } },
    { upsert: true }
  );
  await ProductCategory.updateOne(
    { value: 'perfumes' },
    { $set: { name: 'Perfumes' }, $setOnInsert: { value: 'perfumes', description: '', image: '' } },
    { upsert: true }
  );

  const products = await Product.find({}, { category: 1, categories: 1 }).lean();
  let updated = 0;

  for (const product of products) {
    const nextCategories = normalizeCategories(product.category, product.categories);
    const nextPrimary = nextCategories.find((entry) => entry.toLowerCase() !== 'all') || 'all';

    const oldCategories = Array.isArray(product.categories) ? product.categories.map((x) => String(x || '').trim()) : [];
    const oldPrimary = String(product.category || '').trim();
    const changed =
      oldPrimary.toLowerCase() !== nextPrimary.toLowerCase() ||
      oldCategories.length !== nextCategories.length ||
      oldCategories.some((entry, idx) => entry.toLowerCase() !== String(nextCategories[idx] || '').toLowerCase());

    if (!changed) continue;

    await Product.updateOne(
      { _id: product._id },
      { $set: { category: nextPrimary, categories: nextCategories } }
    );
    updated += 1;
  }

  console.log(`All-category migration complete. Total products: ${products.length}, updated: ${updated}`);
}

run()
  .then(async () => {
    await mongoose.disconnect();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('Migration failed:', error.message);
    try {
      await mongoose.disconnect();
    } catch (_) {}
    process.exit(1);
  });


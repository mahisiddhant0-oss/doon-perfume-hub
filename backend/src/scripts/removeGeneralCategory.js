const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const Product = require('../models/Product');
const ProductCategory = require('../models/ProductCategory');

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI || '';

async function run() {
  if (!MONGODB_URI) throw new Error('MONGODB_URI is not configured');

  await mongoose.connect(MONGODB_URI);

  const products = await Product.find({}, { category: 1, categories: 1 }).lean();
  let updated = 0;

  for (const product of products) {
    const currentCategories = Array.isArray(product.categories)
      ? product.categories.map((entry) => String(entry || '').trim()).filter(Boolean)
      : [];
    const filtered = currentCategories.filter((entry) => entry.toLowerCase() !== 'general');

    const currentPrimary = String(product.category || '').trim().toLowerCase();
    const nextPrimary =
      currentPrimary === 'general'
        ? filtered.find((entry) => entry.toLowerCase() !== 'all') || 'perfumes'
        : (product.category || filtered.find((entry) => entry.toLowerCase() !== 'all') || 'perfumes');

    const nextCategories = filtered.length > 0 ? filtered : ['perfumes', 'all'];
    if (!nextCategories.some((entry) => entry.toLowerCase() === 'all')) {
      nextCategories.push('all');
    }

    const changed =
      currentPrimary !== String(nextPrimary || '').trim().toLowerCase() ||
      currentCategories.length !== nextCategories.length ||
      currentCategories.some(
        (entry, index) => entry.toLowerCase() !== String(nextCategories[index] || '').toLowerCase()
      );

    if (!changed) continue;

    await Product.updateOne(
      { _id: product._id },
      { $set: { category: nextPrimary, categories: nextCategories } }
    );
    updated += 1;
  }

  const deleteResult = await ProductCategory.deleteMany({ value: 'general' });
  console.log(
    `General category cleanup complete. Products updated: ${updated}, category docs deleted: ${deleteResult.deletedCount}`
  );
}

run()
  .then(async () => {
    await mongoose.disconnect();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('Cleanup failed:', error.message);
    try {
      await mongoose.disconnect();
    } catch (_) {}
    process.exit(1);
  });


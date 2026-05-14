const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const Product = require('../models/Product');

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI || '';

const TARGET_SKUS = [
  'GF125',
  'ASG001',
  'HB001',
  'SK001',
  'MD001',
  'PUD001',
  'PC001',
  'LKW001',
];

const extractMediaIdFromUrl = (value = '') => {
  const text = String(value || '').trim();
  const match = text.match(/\/api\/products\/media\/([a-f0-9]{24})$/i);
  return match ? match[1] : '';
};

async function run() {
  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI is not configured');
  }

  await mongoose.connect(MONGODB_URI);

  const products = await Product.find({ sku: { $in: TARGET_SKUS } })
    .select('_id name sku images variants')
    .lean();

  if (products.length === 0) {
    console.log(
      JSON.stringify(
        {
          matchedProducts: 0,
          deletedProducts: 0,
          deletedMediaFiles: 0,
          targetSkus: TARGET_SKUS,
        },
        null,
        2
      )
    );
    return;
  }

  const mediaIds = new Set();

  for (const product of products) {
    const imageUrls = Array.isArray(product.images) ? product.images : [];
    for (const url of imageUrls) {
      const mediaId = extractMediaIdFromUrl(url);
      if (mediaId) mediaIds.add(mediaId);
    }

    const variants = Array.isArray(product.variants) ? product.variants : [];
    for (const variant of variants) {
      const mediaId = extractMediaIdFromUrl(variant?.image || '');
      if (mediaId) mediaIds.add(mediaId);
    }
  }

  const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
    bucketName: 'product_media',
  });

  let deletedMediaFiles = 0;
  for (const id of mediaIds) {
    try {
      await bucket.delete(new mongoose.Types.ObjectId(id));
      deletedMediaFiles += 1;
    } catch (_) {
      // Ignore already-missing files.
    }
  }

  const productIds = products.map((item) => item._id);
  const deleteResult = await Product.deleteMany({ _id: { $in: productIds } });

  console.log(
    JSON.stringify(
      {
        matchedProducts: products.length,
        deletedProducts: Number(deleteResult?.deletedCount || 0),
        deletedMediaFiles,
        deletedSkus: products.map((item) => item.sku),
      },
      null,
      2
    )
  );
}

run()
  .then(async () => {
    await mongoose.disconnect();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('Delete selected products failed:', error.message);
    try {
      await mongoose.disconnect();
    } catch (_) {}
    process.exit(1);
  });


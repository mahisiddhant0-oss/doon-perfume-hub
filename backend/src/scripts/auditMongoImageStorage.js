require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('../models/Product');
const ProductCategory = require('../models/ProductCategory');

const MONGO_URI = process.env.MONGO_URI || '';

const bytesToMB = (bytes = 0) => (Number(bytes || 0) / (1024 * 1024)).toFixed(2);

const run = async () => {
  if (!MONGO_URI) {
    throw new Error('MONGO_URI is required');
  }

  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db;

  const filesCollection = db.collection('product_media.files');
  const chunksCollection = db.collection('product_media.chunks');

  const [fileCount, chunkCount] = await Promise.all([
    filesCollection.countDocuments({}),
    chunksCollection.countDocuments({}),
  ]);

  const files = await filesCollection
    .find({}, { projection: { _id: 1, filename: 1, length: 1, uploadDate: 1, contentType: 1 } })
    .sort({ uploadDate: -1 })
    .limit(200)
    .toArray();

  const totalBytes = files.reduce((sum, file) => sum + Number(file.length || 0), 0);

  const mediaUrlRegex = /\/api\/products\/media\/[a-f0-9]{24}/i;
  const productsUsingLocalMedia = await Product.find({
    $or: [
      { images: { $elemMatch: { $regex: mediaUrlRegex } } },
      { 'variants.image': { $regex: mediaUrlRegex } },
    ],
  })
    .select('_id name sku images variants')
    .limit(200)
    .lean();

  const categoriesUsingLocalMedia = await ProductCategory.find({
    image: { $regex: mediaUrlRegex },
  })
    .select('_id name value image')
    .limit(200)
    .lean();

  console.log('=== Mongo Image Storage Audit ===');
  console.log(`GridFS files: ${fileCount}`);
  console.log(`GridFS chunks: ${chunkCount}`);
  console.log(`Total bytes (sampled files): ${totalBytes} (${bytesToMB(totalBytes)} MB)`);
  console.log('');

  if (files.length > 0) {
    console.log('Recent uploaded binary photos in MongoDB (GridFS):');
    files.forEach((file) => {
      console.log(
        `- id=${String(file._id)} | name=${String(file.filename || '')} | size=${Number(file.length || 0)} bytes (${bytesToMB(file.length)} MB) | type=${String(file.contentType || '')} | uploaded=${file.uploadDate?.toISOString?.() || ''}`
      );
    });
  } else {
    console.log('No binary photos found in GridFS.');
  }

  console.log('');
  console.log(`Products with local media URLs: ${productsUsingLocalMedia.length}`);
  productsUsingLocalMedia.forEach((product) => {
    const imageUrls = Array.isArray(product.images) ? product.images : [];
    const variantUrls = Array.isArray(product.variants)
      ? product.variants.map((variant) => variant?.image).filter(Boolean)
      : [];
    const localRefs = [...imageUrls, ...variantUrls].filter((url) => mediaUrlRegex.test(String(url || '')));
    console.log(`- ${product.name} (${product.sku || 'no-sku'}): ${localRefs.join(', ')}`);
  });

  console.log('');
  console.log(`Categories with local media URLs: ${categoriesUsingLocalMedia.length}`);
  categoriesUsingLocalMedia.forEach((category) => {
    console.log(`- ${category.name || category.value}: ${category.image}`);
  });
};

run()
  .then(async () => {
    await mongoose.disconnect();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('Audit failed:', error.message);
    try {
      await mongoose.disconnect();
    } catch (_) {}
    process.exit(1);
  });


require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('../models/Product');
const ProductCategory = require('../models/ProductCategory');
const { uploadBufferToWix } = require('../services/wixMediaService');

const MONGO_URI = process.env.MONGO_URI || '';
const GRIDFS_BUCKET = 'product_media';
const MEDIA_ROUTE_REGEX = /\/api\/products\/media\/([a-f0-9]{24})$/i;
const shouldDeleteGridFs = process.argv.includes('--delete');
const limitArg = process.argv.find((arg) => arg.startsWith('--limit='));
const maxItems = limitArg ? Math.max(1, Number(limitArg.split('=')[1] || 0)) : 0;

const parseMediaIdFromUrl = (url = '') => {
  const value = String(url || '').trim();
  if (!value) return '';
  try {
    const parsed = new URL(value);
    const match = parsed.pathname.match(MEDIA_ROUTE_REGEX);
    return match ? String(match[1] || '') : '';
  } catch {
    const match = value.match(MEDIA_ROUTE_REGEX);
    return match ? String(match[1] || '') : '';
  }
};

const downloadGridFsFile = async (bucket, fileId) =>
  new Promise((resolve, reject) => {
    const objectId = new mongoose.Types.ObjectId(fileId);
    const chunks = [];
    const stream = bucket.openDownloadStream(objectId);
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks)));
  });

const deleteGridFsFile = async (bucket, fileId) => {
  const objectId = new mongoose.Types.ObjectId(fileId);
  await bucket.delete(objectId);
};

const run = async () => {
  if (!MONGO_URI) throw new Error('MONGO_URI is required');
  if (!String(process.env.WIX_API_KEY || '').trim()) throw new Error('WIX_API_KEY is required');

  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db;
  const bucket = new mongoose.mongo.GridFSBucket(db, { bucketName: GRIDFS_BUCKET });
  const filesCollection = db.collection(`${GRIDFS_BUCKET}.files`);

  const products = await Product.find({}).select('_id name sku images variants').lean();
  const categories = await ProductCategory.find({}).select('_id name value image').lean();

  const referencedIds = new Set();
  products.forEach((product) => {
    (Array.isArray(product.images) ? product.images : []).forEach((url) => {
      const id = parseMediaIdFromUrl(url);
      if (id) referencedIds.add(id);
    });
    (Array.isArray(product.variants) ? product.variants : []).forEach((variant) => {
      const id = parseMediaIdFromUrl(variant?.image || '');
      if (id) referencedIds.add(id);
    });
  });
  categories.forEach((category) => {
    const id = parseMediaIdFromUrl(category.image || '');
    if (id) referencedIds.add(id);
  });

  const allIds = Array.from(referencedIds);
  const targetIds = maxItems > 0 ? allIds.slice(0, maxItems) : allIds;

  const idToWixUrl = new Map();
  const failedIds = [];

  console.log(`Starting migration for ${targetIds.length} of ${allIds.length} referenced GridFS files...`);
  let processed = 0;
  for (const fileId of targetIds) {
    processed += 1;
    console.log(`[${processed}/${targetIds.length}] Processing fileId=${fileId}`);
    const fileDoc = await filesCollection.findOne({ _id: new mongoose.Types.ObjectId(fileId) });
    if (!fileDoc) {
      console.log(`  -> skipped (file doc missing)`);
      continue;
    }
    try {
      const buffer = await downloadGridFsFile(bucket, fileId);
      const wixUrl = await uploadBufferToWix({
        fileName: String(fileDoc.filename || `product-${fileId}.jpg`),
        mimeType: String(fileDoc.contentType || 'application/octet-stream'),
        buffer,
      });
      if (wixUrl) {
        idToWixUrl.set(fileId, wixUrl);
        console.log(`  -> uploaded to Wix`);
      } else {
        failedIds.push(fileId);
        console.log(`  -> failed (no URL returned)`);
      }
    } catch (error) {
      failedIds.push(fileId);
      console.error(`  -> upload failed: ${error.message}`);
    }
  }

  let productsUpdated = 0;
  for (const product of products) {
    let changed = false;
    const nextImages = (Array.isArray(product.images) ? product.images : []).map((url) => {
      const id = parseMediaIdFromUrl(url);
      const wixUrl = id ? idToWixUrl.get(id) : '';
      if (wixUrl) {
        changed = true;
        return wixUrl;
      }
      return url;
    });

    const nextVariants = (Array.isArray(product.variants) ? product.variants : []).map((variant) => {
      const id = parseMediaIdFromUrl(variant?.image || '');
      const wixUrl = id ? idToWixUrl.get(id) : '';
      if (wixUrl) {
        changed = true;
        return { ...variant, image: wixUrl };
      }
      return variant;
    });

    if (changed) {
      await Product.updateOne({ _id: product._id }, { $set: { images: nextImages, variants: nextVariants } });
      productsUpdated += 1;
    }
  }

  let categoriesUpdated = 0;
  for (const category of categories) {
    const id = parseMediaIdFromUrl(category.image || '');
    const wixUrl = id ? idToWixUrl.get(id) : '';
    if (wixUrl) {
      await ProductCategory.updateOne({ _id: category._id }, { $set: { image: wixUrl } });
      categoriesUpdated += 1;
    }
  }

  let deletedCount = 0;
  if (shouldDeleteGridFs) {
  for (const [fileId] of idToWixUrl.entries()) {
      try {
        await deleteGridFsFile(bucket, fileId);
        deletedCount += 1;
      } catch (error) {
        console.error(`Delete failed for ${fileId}: ${error.message}`);
      }
    }
  }

  console.log('=== GridFS -> Wix Migration Summary ===');
  console.log(`Referenced GridFS IDs found: ${allIds.length}`);
  console.log(`Targeted in this run: ${targetIds.length}`);
  console.log(`Successfully uploaded to Wix: ${idToWixUrl.size}`);
  console.log(`Failed uploads: ${failedIds.length}`);
  console.log(`Products updated: ${productsUpdated}`);
  console.log(`Categories updated: ${categoriesUpdated}`);
  console.log(`GridFS files deleted: ${deletedCount} ${shouldDeleteGridFs ? '' : '(dry-run: deletion disabled)'}`);
  if (failedIds.length > 0) {
    console.log(`Failed IDs: ${failedIds.join(', ')}`);
  }
};

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

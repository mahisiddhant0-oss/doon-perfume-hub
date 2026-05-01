const Product = require('../models/Product');
const { queryWixFiles, extractFileMeta } = require('./wixMediaService');

const normalize = (value = '') =>
  String(value || '')
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const buildMatchKeys = (product, matchBy = 'name') => {
  const fullName = normalize(product?.name || '');
  const trimmedName = normalize(String(product?.name || '').replace(/\s+\d+\s*kg\s+essential\s+oil$/i, '').replace(/\s+essential\s+oil$/i, ''));
  const sku = normalize(product?.sku || '');

  if (matchBy === 'sku') {
    return Array.from(new Set([sku].filter(Boolean)));
  }

  return Array.from(new Set([fullName, trimmedName].filter(Boolean)));
};

const inTargetFolder = (meta, folderHint) => {
  if (!folderHint) return true;
  const target = normalize(folderHint);
  const pool = [meta.parentFolderName, meta.parentFolderId, meta.raw?.path, meta.raw?.displayName, meta.raw?.name]
    .map((entry) => normalize(entry))
    .filter(Boolean)
    .join(' ');
  return pool.includes(target);
};

const pickBestFileForProduct = (product, files, matchBy) => {
  const keys = buildMatchKeys(product, matchBy);
  if (keys.length === 0) return null;

  for (const file of files) {
    if (!file.mediaUrl || !file.normalizedName) continue;
    if (keys.includes(file.normalizedName)) return file;
  }

  for (const file of files) {
    if (!file.mediaUrl || !file.normalizedName) continue;
    if (keys.some((key) => file.normalizedName.includes(key) || key.includes(file.normalizedName))) return file;
  }

  return null;
};

const syncProductImagesFromWix = async ({ folder, matchBy = 'name' } = {}) => {
  const wixFilesRaw = await queryWixFiles();
  const mappedFiles = wixFilesRaw.map(extractFileMeta);
  const folderHint = folder || process.env.WIX_MEDIA_FOLDER || '';
  const wixFiles = mappedFiles.filter((file) => inTargetFolder(file, folderHint));

  const products = await Product.find({ isActive: true }).select('_id name sku images');

  let matched = 0;
  let updated = 0;
  const unmatchedProducts = [];

  for (const product of products) {
    const candidate = pickBestFileForProduct(product, wixFiles, matchBy);
    if (!candidate) {
      unmatchedProducts.push({ id: product._id, name: product.name, sku: product.sku || '' });
      continue;
    }

    matched += 1;
    const nextImage = candidate.mediaUrl;
    const currentFirst = Array.isArray(product.images) && product.images.length > 0 ? String(product.images[0] || '') : '';
    const alreadyLinked = currentFirst === nextImage || (product.images || []).includes(nextImage);
    if (alreadyLinked) continue;

    product.images = [nextImage];
    await product.save();
    updated += 1;
  }

  return {
    folder: folderHint || null,
    totalProducts: products.length,
    wixFilesScanned: mappedFiles.length,
    wixFilesInFolder: wixFiles.length,
    matched,
    updated,
    unmatchedCount: unmatchedProducts.length,
    unmatchedPreview: unmatchedProducts.slice(0, 20),
    matchBy,
  };
};

module.exports = {
  syncProductImagesFromWix,
};

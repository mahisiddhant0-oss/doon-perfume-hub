/**
 * Safe catalog importer for Doon Perfume Hub.
 *
 * Usage:
 *   node src/scripts/importCatalogCsv.js "C:\path\to\catalog.csv"
 *
 * Behavior:
 * - Reads the provided CSV export
 * - Builds products + variants
 * - Upserts by `sku` (falls back to `handleId` when sku is missing)
 * - Does NOT delete existing products first
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Product = require('../models/Product');

function splitCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];

    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }

  result.push(current);
  return result;
}

function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const cleanContent = content.startsWith('\ufeff') ? content.slice(1) : content;
  const lines = cleanContent.split(/\r?\n/).filter((line) => line.trim() !== '');

  const header = splitCSVLine(lines[0]).map((value) => value.trim());

  return lines.slice(1).map((line) => {
    const values = splitCSVLine(line);
    const row = {};

    header.forEach((columnName, index) => {
      row[columnName] = (values[index] || '').trim();
    });

    return row;
  });
}

function stripHtml(value) {
  if (!value) return '';

  return value
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function deriveCategory(collectionValue) {
  const collection = (collectionValue || '').toLowerCase();

  if (collection.includes('essential oil') || collection.includes('fixative')) return 'essential-oils';
  if (collection.includes('attar')) return 'attars';
  if (collection.includes('oud')) return 'ouds';
  if (collection.includes('bottle')) return 'bottles';
  if (collection.includes('perfume')) return 'perfumes';

  return 'general';
}

function normalizeImages(productImageUrl) {
  return (productImageUrl || '')
    .split(';')
    .map((value) => value.trim())
    .filter(Boolean)
    .map((image) => (image.startsWith('http') ? image : `https://static.wixstatic.com/media/${image}`));
}

function parseNumber(value, fallback = 0) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseStock(inventoryValue) {
  return (inventoryValue || '').toLowerCase() === 'instock' ? 100 : 0;
}

function getVariantLabel(row) {
  for (let index = 1; index <= 6; index += 1) {
    const value = row[`productOptionDescription${index}`];
    if (value) {
      return value.trim();
    }
  }

  return '';
}

function buildProducts(rows) {
  const productMap = new Map();

  for (const row of rows) {
    const handleId = row.handleId;
    if (!handleId) continue;

    if (row.fieldType === 'Product') {
      if ((row.visible || '').toLowerCase() === 'false') {
        continue;
      }

      const sku = row.sku || handleId;
      const basePrice = parseNumber(row.price);

      productMap.set(handleId, {
        sku,
        name: (row.name || '').trim(),
        description: stripHtml(row.description) || (row.name || '').trim(),
        price: basePrice,
        category: deriveCategory(row.collection),
        stock: parseStock(row.inventory),
        images: normalizeImages(row.productImageUrl),
        isActive: true,
        variants: [],
      });
    } else if (row.fieldType === 'Variant' && productMap.has(handleId)) {
      const product = productMap.get(handleId);
      const label = getVariantLabel(row);

      if (!label) {
        continue;
      }

      const variantPriceFromRow = parseNumber(row.price, NaN);
      const variantSurcharge = parseNumber(row.surcharge, NaN);

      let variantPrice = product.price;
      if (Number.isFinite(variantPriceFromRow)) {
        variantPrice = variantPriceFromRow;
      } else if (Number.isFinite(variantSurcharge)) {
        variantPrice = product.price + variantSurcharge;
      }

      product.variants.push({
        label,
        price: variantPrice,
        stock: parseStock(row.inventory),
        weight: parseNumber(row.weight),
      });
    }
  }

  return Array.from(productMap.values()).filter((product) => product.name && product.sku);
}

async function run() {
  const inputPath = process.argv[2];

  if (!inputPath) {
    throw new Error('Please provide a CSV file path');
  }

  const resolvedPath = path.resolve(inputPath);

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`CSV file not found: ${resolvedPath}`);
  }

  const rows = parseCSV(resolvedPath);
  const products = buildProducts(rows);

  if (products.length === 0) {
    throw new Error('No importable products were found in the CSV');
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log(`Connected to MongoDB. Preparing to import ${products.length} products...`);

  let created = 0;
  let updated = 0;

  for (const product of products) {
    const existing = await Product.findOne({ sku: product.sku }).select('_id');

    await Product.updateOne(
      { sku: product.sku },
      {
        $set: {
          name: product.name,
          description: product.description,
          price: product.price,
          category: product.category,
          stock: product.stock,
          images: product.images,
          variants: product.variants,
          isActive: product.isActive,
        },
      },
      { upsert: true }
    );

    if (existing) {
      updated += 1;
    } else {
      created += 1;
    }
  }

  const totalProducts = await Product.countDocuments();

  console.log(`Import complete. Created: ${created}, Updated: ${updated}, Total in catalog: ${totalProducts}`);

  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error(`Import failed: ${error.message}`);
  try {
    await mongoose.disconnect();
  } catch (disconnectError) {
    // Ignore disconnect cleanup failures.
  }
  process.exit(1);
});

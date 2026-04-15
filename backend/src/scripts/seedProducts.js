/**
 * ============================================================
 * DOON PERFUME HUB — Product Seed Script (Re-run for Price Fix)
 * Usage: node src/scripts/seedProducts.js
 * 
 * Reads catalog_products.csv, parses Product + Variant rows, 
 * calculates variant prices correctly (Base + Surcharge), 
 * and bulk-inserts to MongoDB Atlas.
 * ============================================================
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

// ---- Parse CSV Manually (Robust parsing) ----
function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  // Handle UTF-8 BOM if present
  const cleanContent = content.startsWith('\ufeff') ? content.slice(1) : content;
  const lines = cleanContent.split('\n').filter(l => l.trim() !== '');
  
  // Parse header
  const header = splitCSVLine(lines[0]).map(h => h.trim());
  
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = splitCSVLine(lines[i]);
    const row = {};
    header.forEach((h, idx) => {
      row[h] = (values[idx] || '').trim();
    });
    rows.push(row);
  }
  return rows;
}

function splitCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
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

function stripHtml(str) {
  if (!str) return '';
  return str.replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

function deriveCategory(collection) {
  if (!collection) return 'general';
  const col = collection.toLowerCase();
  if (col.includes('essential oil') || col.includes('fixative')) return 'essential-oils';
  if (col.includes('perfume')) return 'perfumes';
  if (col.includes('attar')) return 'attars';
  if (col.includes('chinese bottle') || col.includes('empty bottle') || col.includes('bottle')) return 'bottles';
  if (col.includes('coloured bottle')) return 'coloured-bottles';
  return 'general';
}

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ MongoDB Connected to Atlas');

  const Product = require('../models/Product');
  const csvPath = path.resolve('C:/Users/mahis/Downloads/catalog_products.csv');
  const rows = parseCSV(csvPath);

  const productMap = new Map();

  for (const row of rows) {
    const handleId = row['handleId'];
    if (!handleId) continue;

    const { fieldType, name, description, productImageUrl, collection, price, surcharge, visible, weight } = row;

    if (fieldType === 'Product') {
      if (visible === 'false') continue;

      const images = (productImageUrl || '')
        .split(';')
        .map(img => img.trim())
        .filter(Boolean)
        .map(img => img.startsWith('http') ? img : `https://static.wixstatic.com/media/${img}`);

      productMap.set(handleId, {
        name: name.trim(),
        description: stripHtml(description) || name.trim(),
        price: parseFloat(price) || 0,
        images,
        category: deriveCategory(collection),
        variants: [],
        stock: 100,
        isActive: true,
      });

    } else if (fieldType === 'Variant' && productMap.has(handleId)) {
      const prod = productMap.get(handleId);
      
      // Wix Logic: Variant Price = Base Product Price + Surcharge
      const basePrice = prod.price;
      const variantSurcharge = parseFloat(surcharge) || 0;
      const totalVariantPrice = basePrice + variantSurcharge;

      // Find the label from productOptionDescription1 through 6
      let variantLabel = '';
      for (let i = 1; i <= 6; i++) {
        const val = row[`productOptionDescription${i}`];
        if (val) {
          variantLabel = val.trim();
          break;
        }
      }

      if (variantLabel) {
        prod.variants.push({
          label: variantLabel,
          price: totalVariantPrice > 0 ? totalVariantPrice : basePrice,
          stock: 100,
          weight: parseFloat(weight) || 0,
        });
      }
    }
  }

  const products = Array.from(productMap.values()).filter(p => p.price > 0 || p.variants.length > 0);

  console.log(`📦 Parsed ${products.length} products. Calculating final prices and variants...`);
  
  // Wipe and Re-seed
  await Product.deleteMany({});
  console.log('🗑️  Cleared existing products in Atlas');

  const inserted = await Product.insertMany(products);
  console.log(`✅ Successfully re-seeded ${inserted.length} products with CORRECT PRICES.`);

  await mongoose.disconnect();
  console.log('👋 Disconnected');
}

seed().catch(err => {
  console.error('❌ SEED FAILED:', err.message);
  process.exit(1);
});

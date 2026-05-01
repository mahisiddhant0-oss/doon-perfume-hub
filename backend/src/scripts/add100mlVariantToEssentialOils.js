const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const Product = require('../models/Product');

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

const normalizeLabel = (value = '') => String(value || '').trim().toLowerCase().replace(/\s+/g, '');

const isEssentialOilProduct = (product) => {
  const primary = String(product?.category || '').trim().toLowerCase();
  const categories = Array.isArray(product?.categories)
    ? product.categories.map((entry) => String(entry || '').trim().toLowerCase())
    : [];
  return primary === 'essential-oils' || categories.includes('essential-oils');
};

const findVariant = (variants = [], label) => {
  const target = normalizeLabel(label);
  return variants.find((variant) => normalizeLabel(variant?.label) === target) || null;
};

const computeBookedPrice = (seed) => {
  // Stable pseudo-random value in [700, 800], spread per product.
  return 700 + (seed % 101);
};

const main = async () => {
  if (!MONGO_URI) {
    throw new Error('MONGO_URI is missing');
  }

  await mongoose.connect(MONGO_URI);

  const products = await Product.find({}).select('name sku category categories variants enquiryOnly price');
  const essentialOilProducts = products.filter(isEssentialOilProduct);

  let updated = 0;
  let skippedNo1000ml = 0;
  let updatedBooking = 0;
  let updatedPriced = 0;

  for (let i = 0; i < essentialOilProducts.length; i += 1) {
    const product = essentialOilProducts[i];
    const variants = Array.isArray(product.variants) ? [...product.variants] : [];
    const existing100ml = findVariant(variants, '100ml');

    let nextPrice = 0;
    if (product.enquiryOnly) {
      nextPrice = computeBookedPrice(i + 1);
      updatedBooking += 1;
    } else {
      const variant1000ml = findVariant(variants, '1000ml');
      const base1000mlPrice = Number(variant1000ml?.price);
      if (!Number.isFinite(base1000mlPrice) || base1000mlPrice <= 0) {
        skippedNo1000ml += 1;
        continue;
      }
      nextPrice = Math.round(base1000mlPrice / 10 + 100);
      updatedPriced += 1;
    }

    const next100ml = {
      label: '100ml',
      price: nextPrice,
      stock: 50,
      weight: 1,
      image: existing100ml?.image || '',
    };

    if (existing100ml) {
      const nextVariants = variants.map((variant) =>
        normalizeLabel(variant?.label) === '100ml' ? next100ml : variant
      );
      product.variants = nextVariants;
    } else {
      product.variants = [...variants, next100ml];
    }

    await product.save();
    updated += 1;
  }

  console.log(
    JSON.stringify(
      {
        totalProductsScanned: products.length,
        essentialOilProducts: essentialOilProducts.length,
        updatedProducts: updated,
        updatedPricedProducts: updatedPriced,
        updatedBookingProducts: updatedBooking,
        skippedPricedWithout1000ml: skippedNo1000ml,
      },
      null,
      2
    )
  );
};

main()
  .then(async () => {
    await mongoose.disconnect();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('Failed to add 100ml variants:', error.message);
    try {
      await mongoose.disconnect();
    } catch (_) {
      // no-op
    }
    process.exit(1);
  });

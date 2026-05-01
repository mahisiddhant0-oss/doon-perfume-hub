const Product = require('../models/Product');

const normalizeCategoryKey = (value = '') =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

const normalizeLabel = (value = '') => String(value || '').trim().toLowerCase().replace(/\s+/g, '');

const isEssentialOilProduct = (product) => {
  const target = 'essentialoils';
  const primary = normalizeCategoryKey(product?.category || '');
  const categories = Array.isArray(product?.categories)
    ? product.categories.map((entry) => normalizeCategoryKey(entry))
    : [];
  return primary === target || categories.includes(target);
};

const findVariant = (variants = [], label) => {
  const target = normalizeLabel(label);
  return variants.find((variant) => normalizeLabel(variant?.label) === target) || null;
};

const computeEnquiryPrice = (seed) => 700 + (seed % 101);

const ensureEssentialOil100mlVariants = async () => {
  const products = await Product.find({ isActive: true }).select(
    '_id name sku category categories variants enquiryOnly stock'
  );

  const essentialOilProducts = products.filter(isEssentialOilProduct);
  let updatedProducts = 0;
  let updatedPricedProducts = 0;
  let updatedEnquiryProducts = 0;
  let skippedPricedWithout1000ml = 0;

  for (let i = 0; i < essentialOilProducts.length; i += 1) {
    const product = essentialOilProducts[i];
    const variants = Array.isArray(product.variants) ? [...product.variants] : [];
    const existing100ml = findVariant(variants, '100ml');

    let nextPrice = 0;
    let shouldSkip = false;

    if (product.enquiryOnly) {
      nextPrice = computeEnquiryPrice(i + 1);
    } else {
      const variant1000ml = findVariant(variants, '1000ml');
      const base1000mlPrice = Number(variant1000ml?.price);
      if (!Number.isFinite(base1000mlPrice) || base1000mlPrice <= 0) {
        shouldSkip = true;
        skippedPricedWithout1000ml += 1;
      } else {
        nextPrice = Math.round(base1000mlPrice / 10 + 100);
      }
    }

    let didChange = false;

    if (!shouldSkip) {
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
      didChange = true;
    }

    // For priced essential-oil products, set main stock to 50 as requested.
    if (!product.enquiryOnly && Number(product.stock) !== 50) {
      product.stock = 50;
      didChange = true;
    }

    if (!didChange) continue;
    await product.save();
    updatedProducts += 1;
    if (product.enquiryOnly) {
      updatedEnquiryProducts += 1;
    } else {
      updatedPricedProducts += 1;
    }
  }

  return {
    essentialOilProducts: essentialOilProducts.length,
    updatedProducts,
    updatedPricedProducts,
    updatedEnquiryProducts,
    skippedPricedWithout1000ml,
  };
};

module.exports = {
  ensureEssentialOil100mlVariants,
};

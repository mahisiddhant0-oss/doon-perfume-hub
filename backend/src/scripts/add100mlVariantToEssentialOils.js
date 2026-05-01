const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const { ensureEssentialOil100mlVariants } = require('../services/essentialOilVariantService');

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

const main = async () => {
  if (!MONGO_URI) {
    throw new Error('MONGO_URI is missing');
  }

  await mongoose.connect(MONGO_URI);
  const result = await ensureEssentialOil100mlVariants();
  console.log(JSON.stringify(result, null, 2));
};

main()
  .then(async () => {
    await mongoose.disconnect();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('Failed to sync essential-oil 100ml variants:', error.message);
    try {
      await mongoose.disconnect();
    } catch (_) {
      // no-op
    }
    process.exit(1);
  });

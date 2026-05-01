const mongoose = require('mongoose');
const dotenv = require('dotenv');
const { upsertSpecialEnquiryProducts } = require('../services/specialEnquiryProducts');

dotenv.config();

const main = async () => {
  const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/doonperfumehub';
  await mongoose.connect(mongoUri);
  const { created, updated } = await upsertSpecialEnquiryProducts();

  console.log(`Special enquiry products seeded. Created: ${created}, Updated: ${updated}`);
  await mongoose.disconnect();
};

main().catch(async (error) => {
  console.error('Failed to seed special enquiry products:', error.message);
  try {
    await mongoose.disconnect();
  } catch {
    // no-op
  }
  process.exit(1);
});

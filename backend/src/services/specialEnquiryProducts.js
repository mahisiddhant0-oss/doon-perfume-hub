const Product = require('../models/Product');

const SPECIAL_ROWS = [
  ['SWEET CARESS', 'TF TOBACCO VANILLE TYPE'],
  ['BEAUTY OF ARABIA 72', 'ROSE MUSK'],
  ['ASLI GULAB', 'CREATIONS'],
  ['ATTAR PHOOL SUPER', 'CREATIONS'],
  ['BLOSSOM LC', 'GUCCI BLOOM'],
  ['MOST WANTED', 'AZZARO MOST WANTED'],
  ['GIVEX 510355', 'DARK BLACK'],
  ['GIVEX 510376', 'OPIUM'],
  ['GIVEX 54177 MX IN DE', 'POLO SPORT FOR MEN'],
  ['GIVEX 54184', 'AQUA MARINE'],
  ['GIVEX 610374', 'Polo sport for Men'],
  ['GIVEX 610398', 'Eternity for men'],
  ['GIVEX 613512', 'One million'],
  ['GIVEX 69328', 'OMBRE ROSE'],
  ['GIVEX 69352', 'AMARIGE'],
  ['GIVEX 78018', 'WHITE MUSK'],
  ['GIVEX 54099', 'BOSS GREEN'],
  ['GIVEX 67009', 'FAWAKEH'],
  ['GIVEX 59309', 'COOL WATER MEN'],
  ['GIVEX 69304', 'COOL WATER WOMEN'],
  ['GIVEX 610399', 'BRUT'],
  ['GIVEX 510378', 'HAVOC'],
  ['GIVEX 510397', 'OPEN'],
  ['GIVEX 54088', 'TOMMY TYPE'],
  ['GIVEX 54192', 'ISSE MIYAKE'],
  ['GIVEX 64202', 'CIGAR'],
  ['PAREFX 11551', 'JANNAT EL FIRDAUS'],
  ['BLACK INTENSE', 'BLACK OPIUM'],
  ['CLASSIC SAFARI', 'SAFARI BY RALF LAURENT'],
];

const toSku = (firstColumn) => `GIVEX5KG${String(firstColumn || '').trim()}`;
const toName = (secondColumn) => `${String(secondColumn || '').trim()} 5KG ESSENTIAL OIL`;

const buildSpecialPayload = (firstColumn, secondColumn) => ({
  name: toName(secondColumn),
  sku: toSku(firstColumn),
  description: 'Price on enquiry. Click GET BEST PRICE to request a callback.',
  price: 0,
  enquiryOnly: true,
  stock: 0,
  weightKg: 5,
  category: 'essential-oils',
  categories: ['essential-oils', 'all'],
  images: [],
  isActive: true,
});

const upsertSpecialEnquiryProducts = async () => {
  let created = 0;
  let updated = 0;

  for (const [firstColumn, secondColumn] of SPECIAL_ROWS) {
    const payload = buildSpecialPayload(firstColumn, secondColumn);
    const existing = await Product.findOne({ sku: payload.sku });
    if (!existing) {
      await Product.create(payload);
      created += 1;
    } else {
      Object.assign(existing, payload);
      await existing.save();
      updated += 1;
    }
  }

  return { created, updated, total: SPECIAL_ROWS.length };
};

module.exports = {
  SPECIAL_ROWS,
  upsertSpecialEnquiryProducts,
};

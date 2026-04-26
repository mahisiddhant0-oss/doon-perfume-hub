const mongoose = require('mongoose');

const productCategorySchema = new mongoose.Schema(
  {
    value: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      minlength: 1,
      maxlength: 80,
      index: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ProductCategory', productCategorySchema);


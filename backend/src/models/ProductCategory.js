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
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 600,
      default: '',
    },
    image: {
      type: String,
      trim: true,
      default: '',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ProductCategory', productCategorySchema);

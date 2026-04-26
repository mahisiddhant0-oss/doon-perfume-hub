const mongoose = require('mongoose');

const blockedCredentialSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['email', 'phone'],
      required: true,
    },
    value: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      index: true,
    },
    reason: {
      type: String,
      trim: true,
      maxlength: 250,
      default: 'access_denied',
    },
    sourceUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('BlockedCredential', blockedCredentialSchema);

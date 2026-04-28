const mongoose = require("mongoose");

const gmbTokenSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  userEmail: { type: String, required: true },
  accessToken: { type: String, required: true },
  refreshToken: { type: String, required: true },
  expiryDate: { type: Number },
  scope: { type: String },
  accountId: { type: String },
  locationId: { type: String },
}, { timestamps: true });

gmbTokenSchema.index({ userId: 1 }, { unique: true });

const GmbToken = mongoose.model("GmbToken", gmbTokenSchema);
module.exports = GmbToken;

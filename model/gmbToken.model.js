const mongoose = require("mongoose");

const gmbTokenSchema = new mongoose.Schema({
  accessToken: { type: String, required: true },
  refreshToken: { type: String, required: true },
  expiryDate: { type: Number },
  scope: { type: String },
  accountId: { type: String },
  locationId: { type: String },
}, { timestamps: true });

const GmbToken = mongoose.model("GmbToken", gmbTokenSchema);
module.exports = GmbToken;

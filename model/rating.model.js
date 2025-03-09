const mongoose = require("mongoose");

const ratingSchema = new mongoose.Schema({
  employee: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  customerName: { type: String, required: true },
  customerEmail: {type: String, required: true},
  customerPhone:{type: Number, required: true},
  avgRating:{type: Number},
  inRange:{type: Boolean, default: false},
  rating: { type: Number, required: true, min: 1, max: 5 },
  feedback: { type: String },
}, { timestamps: true });

const Rating = mongoose.model("Rating", ratingSchema);
module.exports = Rating;

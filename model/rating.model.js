const mongoose = require("mongoose");

const ratingSchema = new mongoose.Schema({
  employee: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User", 
    required: true 
  },

  // Google unique review ID (prevents duplicates)
  googleReviewId: { 
    type: String, 
    unique: true 
  },

  customerName: { type: String },
  rating: { 
    type: Number, 
    min: 1, 
    max: 5 
  },
  feedback: { type: String },

  source: { 
    type: String, 
    default: "GMB" 
  }

}, { timestamps: true });

const Rating = mongoose.model("Rating", ratingSchema);
module.exports = Rating;
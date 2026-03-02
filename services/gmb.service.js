const Rating = require("../model/rating.model");
const User = require("../model/user.model");

/**
 * 🔁 Sync Google Business Reviews
 * Currently using dummy data.
 * Later replace dummy section with real Google API call.
 */

const syncGMBReviews = async () => {
  try {

    console.log("🔄 Starting GMB Sync...");

    // ============================================
    // 🔴 REAL GOOGLE API CALL (COMMENTED)
    // ============================================
    /*
    const axios = require("axios");

    const response = await axios.get("GOOGLE_GMB_API_URL", {
      headers: {
        Authorization: `Bearer ${process.env.GMB_ACCESS_TOKEN}`
      }
    });

    const reviews = response.data.reviews;
    */

    // ============================================
    // 🟢 DUMMY DATA FOR NOW
    // ============================================

    const reviews = [
      {
        reviewId: "gmb_001",
        reviewerName: "Rahul Sharma",
        rating: 5,
        comment: "Amazing service by #AB12CD34"
      },
      {
        reviewId: "gmb_002",
        reviewerName: "Priya Verma",
        rating: 4,
        comment: "Good experience #EF56GH78"
      },
      {
        reviewId: "gmb_003",
        reviewerName: "Rakesh Singh",
        rating: 5,
        comment: "Very professional staff #AB12CD34"
      }
    ];

    // ============================================
    // PROCESS REVIEWS
    // ============================================

    for (const review of reviews) {

      // Check if already saved
      const existing = await Rating.findOne({
        googleReviewId: review.reviewId
      });

      if (existing) {
        console.log(`⚠ Review ${review.reviewId} already exists`);
        continue;
      }

      // Extract reviewCode from comment using regex
      const match = review.comment.match(/#([a-zA-Z0-9]+)/);
      if (!match) {
        console.log(`❌ No review code found in review ${review.reviewId}`);
        continue;
      }

      const reviewCode = match[1].toUpperCase();

      // Find employee
      const employee = await User.findOne({ employeeId: reviewCode });

      if (!employee) {
        console.log(`❌ No employee found for code ${reviewCode}`);
        continue;
      }

      // Save rating
      const newRating = new Rating({
        employee: employee._id,
        googleReviewId: review.reviewId,
        customerName: review.reviewerName,
        rating: review.rating,
        feedback: review.comment,
        source: "GMB"
      });

      await newRating.save();

      console.log(`✅ Saved review ${review.reviewId}`);

      // Update employee average rating
      await updateEmployeeAverage(employee._id);
    }

    console.log("✅ GMB Sync Completed");

  } catch (error) {
    console.error("❌ Error in GMB Sync:", error.message);
  }
};

/**
 * 📊 Update Employee Average Rating
 */
const updateEmployeeAverage = async (employeeId) => {
  const ratings = await Rating.find({ employee: employeeId });

  if (ratings.length === 0) return;

  const total = ratings.reduce((acc, r) => acc + r.rating, 0);
  const average = total / ratings.length;

  await User.findByIdAndUpdate(employeeId, {
    averageRating: parseFloat(average.toFixed(1))
  });
};

module.exports = { syncGMBReviews, updateEmployeeAverage };
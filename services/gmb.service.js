const { google } = require("googleapis");
const Rating = require("../model/rating.model");
const User = require("../model/user.model");
const GmbToken = require("../model/gmbToken.model");
const { getOAuth2Client } = require("../controller/gmb.controller");

/**
 * Fetch reviews from Google Business Profile API
 */
const fetchGoogleReviews = async () => {
  const token = await GmbToken.findOne();
  if (!token || !token.accountId || !token.locationId) {
    console.log("[GMB Sync] Not configured — token:", !!token, "accountId:", token?.accountId || "missing", "locationId:", token?.locationId || "missing");
    return null;
  }

  console.log("[GMB Sync] Using account:", token.accountId, "location:", token.locationId);
  console.log("[GMB Sync] Token expiry:", token.expiryDate ? new Date(token.expiryDate).toISOString() : "unknown");

  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    access_token: token.accessToken,
    refresh_token: token.refreshToken,
    expiry_date: token.expiryDate,
  });

  // Auto-refresh tokens
  oauth2Client.on("tokens", async (newTokens) => {
    console.log("[GMB Sync] Token refreshed — new access_token:", newTokens.access_token ? "✅" : "❌");
    if (newTokens.access_token) {
      await GmbToken.findOneAndUpdate({}, {
        accessToken: newTokens.access_token,
        expiryDate: newTokens.expiry_date,
      });
    }
  });

  // The reviews endpoint uses the My Business API v4 via direct HTTP
  // Google Business Profile API for reviews: accounts/{accountId}/locations/{locationId}/reviews
  const allReviews = [];
  let nextPageToken = null;

  do {
    const url = `https://mybusiness.googleapis.com/v4/${token.accountId}/${token.locationId}/reviews`;
    console.log("[GMB Sync] Fetching reviews from:", url);
    const params = { pageSize: 50 };
    if (nextPageToken) params.pageToken = nextPageToken;

    const response = await oauth2Client.request({ url, params });
    console.log("[GMB Sync] API response status:", response.status, "reviews in page:", response.data.reviews?.length || 0);

    if (response.data.reviews) {
      allReviews.push(...response.data.reviews);
    }

    nextPageToken = response.data.nextPageToken;
  } while (nextPageToken);

  console.log("[GMB Sync] Total reviews fetched:", allReviews.length);

  return allReviews.map((review) => ({
    reviewId: review.reviewId,
    reviewerName: review.reviewer?.displayName || "Anonymous",
    rating: starRatingToNumber(review.starRating),
    comment: review.comment || "",
  }));
};

/**
 * Convert Google's star rating string to number
 */
function starRatingToNumber(starRating) {
  const map = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };
  return map[starRating] || 0;
}

/**
 * Sync Google Business Reviews
 * Uses real API if connected, otherwise skips.
 */
const syncGMBReviews = async () => {
  try {
    console.log("🔄 Starting GMB Sync...");

    const reviews = await fetchGoogleReviews();

    if (!reviews) {
      console.log("⚠ No GMB connection — sync skipped");
      return;
    }

    if (reviews.length === 0) {
      console.log("ℹ No reviews found on Google");
      return;
    }

    console.log(`📥 Fetched ${reviews.length} reviews from Google`);


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
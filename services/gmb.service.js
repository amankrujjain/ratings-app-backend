const { google } = require("googleapis");
const Rating = require("../model/rating.model");
const User = require("../model/user.model");
const GmbToken = require("../model/gmbToken.model");
const {
  getOAuth2Client,
  getTokenForUser,
  persistTokenUpdateForUser,
} = require("../controller/gmb.controller");
const { getNotifyEmployee, getBroadcastToAdmins } = require("../utils/websocket");

function isGmbAuthError(error) {
  const message = `${error?.message || ""} ${error?.response?.data?.error || ""}`.toLowerCase();
  const description = `${error?.response?.data?.error_description || ""}`.toLowerCase();

  return (
    error?.code === 401 ||
    error?.response?.status === 401 ||
    message.includes("invalid_grant") ||
    message.includes("invalid_token") ||
    message.includes("invalid credentials") ||
    message.includes("invalid authentication") ||
    message.includes("unauthorized") ||
    description.includes("expired")
  );
}

function buildGmbAuthError(message = "Failed to sync GMB: authentication error") {
  const error = new Error(message);
  error.code = "GMB_AUTH_ERROR";
  error.statusCode = 401;
  error.requiresReauth = true;
  return error;
}

function buildGmbConfigError(message = "GMB account is not fully configured for this admin.") {
  const error = new Error(message);
  error.code = "GMB_CONFIG_ERROR";
  error.statusCode = 400;
  error.requiresReauth = false;
  return error;
}

function createOAuthClientForToken(token, tokenOwner) {
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    access_token: token.accessToken,
    refresh_token: token.refreshToken,
    expiry_date: token.expiryDate,
  });

  oauth2Client.on("tokens", async (newTokens) => {
    if (newTokens.access_token && tokenOwner?._id) {
      await persistTokenUpdateForUser(tokenOwner, {
        accessToken: newTokens.access_token,
        refreshToken: newTokens.refresh_token || token.refreshToken,
        expiryDate: newTokens.expiry_date,
      });
    }
  });

  return oauth2Client;
}

async function validateGoogleBusinessAuth({ token, adminUser }) {
  if (!token) {
    throw buildGmbAuthError();
  }

  const oauth2Client = createOAuthClientForToken(token, adminUser);

  try {
    await oauth2Client.getAccessToken();

    const mybusinessaccountmanagement = google.mybusinessaccountmanagement({
      version: "v1",
      auth: oauth2Client,
    });

    await mybusinessaccountmanagement.accounts.list({ pageSize: 1 });
    return oauth2Client;
  } catch (error) {
    if (isGmbAuthError(error)) {
      console.error(
        "[GMB Sync] Auth validation failed for admin:",
        adminUser?.email || token.userEmail || token.userId?.toString() || "unknown",
        error.message
      );
      throw buildGmbAuthError();
    }

    throw error;
  }
}

function starRatingToNumber(starRating) {
  const map = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };
  return map[starRating] || 0;
}

async function fetchGoogleReviews({ token, oauth2Client }) {
  if (!token || !token.accountId || !token.locationId) {
    console.log("[GMB Sync] Missing account or location configuration for token owner:", token?.userEmail || "unknown");
    throw buildGmbConfigError();
  }

  console.log("[GMB Sync] Using account:", token.accountId, "location:", token.locationId);
  console.log(
    "[GMB Sync] Token expiry:",
    token.expiryDate ? new Date(token.expiryDate).toISOString() : "unknown"
  );

  const allReviews = [];
  let nextPageToken = null;

  do {
    const url = `https://mybusiness.googleapis.com/v4/${token.accountId}/${token.locationId}/reviews`;
    const params = { pageSize: 50 };

    if (nextPageToken) {
      params.pageToken = nextPageToken;
    }

    console.log("[GMB Sync] Fetching reviews from:", url);
    let response;

    try {
      response = await oauth2Client.request({ url, params });
    } catch (error) {
      if (isGmbAuthError(error)) {
        throw buildGmbAuthError();
      }
      throw error;
    }

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
}

async function persistFetchedReviews(reviews) {
  if (!reviews) {
    console.log("[GMB Sync] No configured reviews source - sync skipped");
    return 0;
  }

  if (reviews.length === 0) {
    console.log("[GMB Sync] No reviews found on Google");
    return 0;
  }

  let processedCount = 0;

  for (const review of reviews) {
    const existing = await Rating.findOne({ googleReviewId: review.reviewId });
    if (existing) {
      console.log("[GMB Sync] Review already exists:", review.reviewId);
      continue;
    }

    const match = review.comment.match(/#([a-zA-Z0-9]+)/);
    if (!match) {
      console.log("[GMB Sync] No review code found in review:", review.reviewId);
      continue;
    }

    const reviewCode = match[1].toUpperCase();
    const employee = await User.findOne({ employeeId: reviewCode });

    if (!employee) {
      console.log("[GMB Sync] No employee found for code:", reviewCode);
      continue;
    }

    const newRating = new Rating({
      employee: employee._id,
      googleReviewId: review.reviewId,
      customerName: review.reviewerName,
      rating: review.rating,
      feedback: review.comment,
      source: "GMB",
    });

    await newRating.save();
    processedCount += 1;

    await updateEmployeeAverage(employee._id);

    const notify = getNotifyEmployee();
    const broadcast = getBroadcastToAdmins();

    if (notify) {
      notify(employee._id.toString(), {
        type: "NEW_REVIEW",
        title: "New Google Review!",
        message: `${review.reviewerName} gave you ${review.rating} star(s)`,
        rating: review.rating,
        reviewId: newRating._id,
        timestamp: new Date().toISOString(),
      });
    }

    if (broadcast) {
      broadcast({
        type: "NEW_REVIEW",
        title: "New Google Review",
        message: `${review.reviewerName} reviewed ${employee.employeeName || employee.employeeId} - ${review.rating} star(s)`,
        employeeId: employee.employeeId,
        rating: review.rating,
        reviewId: newRating._id,
        timestamp: new Date().toISOString(),
      });
    }
  }

  console.log("[GMB Sync] Saved reviews:", processedCount);
  return processedCount;
}

async function syncGMBReviews(options = {}) {
  const { adminUser = null, trigger = "system" } = options;

  console.log(
    "[GMB Sync] Starting sync. Trigger:",
    trigger,
    "actor:",
    adminUser ? `${adminUser.email} (${adminUser._id})` : "scheduled-job"
  );

  if (adminUser) {
    const token = await getTokenForUser(adminUser);
    if (!token) {
      throw buildGmbAuthError();
    }

    const oauth2Client = await validateGoogleBusinessAuth({ token, adminUser });
    const reviews = await fetchGoogleReviews({ token, oauth2Client });
    const processedCount = await persistFetchedReviews(reviews);

    return {
      success: true,
      started: true,
      processedCount,
      message: "GMB review sync started successfully",
    };
  }

  const tokens = await GmbToken.find({
    accountId: { $exists: true, $ne: null },
    locationId: { $exists: true, $ne: null },
  }).lean();

  if (tokens.length === 0) {
    console.log("[GMB Sync] No connected admin GMB accounts found for scheduled sync");
    return {
      success: true,
      started: false,
      processedCount: 0,
      message: "No connected GMB accounts found",
    };
  }

  let processedCount = 0;

  for (const token of tokens) {
    try {
      const tokenOwner = token.userId
        ? await User.findById(token.userId).select("_id email employeeName")
        : null;
      const oauth2Client = await validateGoogleBusinessAuth({ token, adminUser: tokenOwner });
      const reviews = await fetchGoogleReviews({ token, oauth2Client });
      processedCount += await persistFetchedReviews(reviews);
    } catch (error) {
      console.error(
        "[GMB Sync] Scheduled sync failed for admin:",
        token.userEmail || token.userId?.toString() || "unknown",
        error.message
      );
    }
  }

  return {
    success: true,
    started: true,
    processedCount,
    message: "Scheduled GMB sync completed",
  };
}

async function updateEmployeeAverage(employeeId) {
  const ratings = await Rating.find({ employee: employeeId });
  if (ratings.length === 0) return;

  const total = ratings.reduce((acc, rating) => acc + rating.rating, 0);
  const average = total / ratings.length;

  await User.findByIdAndUpdate(employeeId, {
    averageRating: parseFloat(average.toFixed(1)),
  });
}

module.exports = {
  syncGMBReviews,
  updateEmployeeAverage,
  validateGoogleBusinessAuth,
};

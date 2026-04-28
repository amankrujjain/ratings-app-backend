const { google } = require("googleapis");
const GmbToken = require("../model/gmbToken.model");
const User = require("../model/user.model");

const SCOPES = ["https://www.googleapis.com/auth/business.manage"];
const FRONTEND_GMB_PATH = "/all-ratings";

function getOAuth2Client() {
  const redirectUri =
    process.env.GMB_REDIRECT_URI || "http://localhost:5000/api/gmb/oauth/callback";

  if (process.env.NODE_ENV !== "production") {
    console.log("[GMB] OAuth2Client init - clientId:", process.env.GOOGLE_CLIENT_ID ? "set" : "missing");
    console.log("[GMB] OAuth2Client init - clientSecret:", process.env.GOOGLE_CLIENT_SECRET ? "set" : "missing");
    console.log("[GMB] OAuth2Client init - redirectUri:", redirectUri);
  }

  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri
  );
}

function getFrontendGmbRedirectUrl(params = {}) {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
  const query = new URLSearchParams(params).toString();
  return `${frontendUrl}${FRONTEND_GMB_PATH}${query ? `?${query}` : ""}`;
}

function encodeOAuthState(payload) {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

function decodeOAuthState(state) {
  if (!state) return null;

  try {
    return JSON.parse(Buffer.from(state, "base64url").toString("utf8"));
  } catch (error) {
    console.error("[GMB] Failed to decode OAuth state:", error.message);
    return null;
  }
}

function getTokenFilterForUser(user) {
  return { userId: user._id };
}

async function getTokenForUser(user) {
  return GmbToken.findOne(getTokenFilterForUser(user));
}

async function persistTokenUpdateForUser(user, tokenUpdate) {
  return GmbToken.findOneAndUpdate(
    getTokenFilterForUser(user),
    {
      ...tokenUpdate,
      userId: user._id,
      userEmail: user.email,
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  );
}

const getAuthUrl = async (req, res) => {
  try {
    const oauth2Client = getOAuth2Client();
    const state = encodeOAuthState({
      userId: req.user._id.toString(),
      userEmail: req.user.email,
      issuedAt: Date.now(),
    });

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: SCOPES,
      state,
    });

    console.log("[GMB] Auth URL generated for admin:", req.user.email, req.user._id.toString());
    return res.status(200).json({ success: true, authUrl });
  } catch (error) {
    console.error("[GMB] Error generating auth URL:", error.message, error.stack);
    return res.status(500).json({
      success: false,
      message: "Failed to generate auth URL",
      error: error.message,
    });
  }
};

const handleCallback = async (req, res) => {
  try {
    const { code, state } = req.query;

    if (!code) {
      console.error("[GMB] Callback hit without authorization code. Query:", req.query);
      return res.status(400).json({ success: false, message: "Authorization code missing" });
    }

    const parsedState = decodeOAuthState(state);
    if (!parsedState?.userId) {
      console.error("[GMB] Callback missing valid admin state. Raw state:", state);
      return res.redirect(
        getFrontendGmbRedirectUrl({
          gmb_connected: "false",
          gmb_error: "invalid_state",
          error: "Missing admin authorization context",
        })
      );
    }

    const adminUser = await User.findById(parsedState.userId).select("_id email employeeName");
    if (!adminUser) {
      console.error("[GMB] Callback admin not found:", parsedState.userId);
      return res.redirect(
        getFrontendGmbRedirectUrl({
          gmb_connected: "false",
          gmb_error: "admin_not_found",
          error: "Admin account not found",
        })
      );
    }

    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    const existingToken = await getTokenForUser(adminUser);

    await persistTokenUpdateForUser(adminUser, {
      accessToken: tokens.access_token || existingToken?.accessToken,
      refreshToken: tokens.refresh_token || existingToken?.refreshToken,
      expiryDate: tokens.expiry_date,
      scope: tokens.scope,
    });

    console.log("[GMB] OAuth callback completed for admin:", adminUser.email, adminUser._id.toString());
    return res.redirect(
      getFrontendGmbRedirectUrl({
        gmb_connected: "true",
        gmb_authorized: "true",
      })
    );
  } catch (error) {
    console.error("[GMB] OAuth callback error:", error.message, error.stack);
    if (error.response) {
      console.error("[GMB] Google API response:", JSON.stringify(error.response.data));
    }

    return res.redirect(
      getFrontendGmbRedirectUrl({
        gmb_connected: "false",
        gmb_error: "oauth_callback_failed",
        error: error.message,
      })
    );
  }
};

const getConnectionStatus = async (req, res) => {
  try {
    const token = await getTokenForUser(req.user);
    const connected = !!token;

    console.log(
      "[GMB] Connection status for admin:",
      req.user.email,
      "connected:",
      connected,
      "accountId:",
      token?.accountId || "none",
      "locationId:",
      token?.locationId || "none"
    );

    return res.status(200).json({
      success: true,
      connected,
      accountId: token?.accountId || null,
      locationId: token?.locationId || null,
    });
  } catch (error) {
    console.error("[GMB] Error checking connection status:", error.message, error.stack);
    return res.status(500).json({
      success: false,
      message: "Error checking connection",
      error: error.message,
    });
  }
};

const listAccounts = async (req, res) => {
  try {
    const token = await getTokenForUser(req.user);
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "GMB not connected. Please authorize first.",
      });
    }

    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials({
      access_token: token.accessToken,
      refresh_token: token.refreshToken,
      expiry_date: token.expiryDate,
    });

    oauth2Client.on("tokens", async (newTokens) => {
      if (newTokens.access_token) {
        await persistTokenUpdateForUser(req.user, {
          accessToken: newTokens.access_token,
          refreshToken: newTokens.refresh_token || token.refreshToken,
          expiryDate: newTokens.expiry_date,
        });
      }
    });

    console.log("[GMB] Fetching accounts for admin:", req.user.email);
    const mybusinessaccountmanagement = google.mybusinessaccountmanagement({
      version: "v1",
      auth: oauth2Client,
    });
    const response = await mybusinessaccountmanagement.accounts.list();

    return res.status(200).json({
      success: true,
      accounts: response.data.accounts || [],
    });
  } catch (error) {
    console.error("[GMB] Error listing accounts:", error.message, error.stack);
    if (error.response) {
      console.error("[GMB] Google API response:", JSON.stringify(error.response.data));
    }
    return res.status(500).json({
      success: false,
      message: "Failed to list accounts",
      error: error.message,
    });
  }
};

const listLocations = async (req, res) => {
  try {
    const { accountId } = req.query;

    if (!accountId) {
      return res.status(400).json({
        success: false,
        message: "accountId query parameter is required (e.g. accounts/123456789)",
      });
    }

    const token = await getTokenForUser(req.user);
    if (!token) {
      return res.status(401).json({ success: false, message: "GMB not connected." });
    }

    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials({
      access_token: token.accessToken,
      refresh_token: token.refreshToken,
      expiry_date: token.expiryDate,
    });

    oauth2Client.on("tokens", async (newTokens) => {
      if (newTokens.access_token) {
        await persistTokenUpdateForUser(req.user, {
          accessToken: newTokens.access_token,
          refreshToken: newTokens.refresh_token || token.refreshToken,
          expiryDate: newTokens.expiry_date,
        });
      }
    });

    console.log("[GMB] Fetching locations for admin:", req.user.email, "account:", accountId);
    const mybusinessbusinessinformation = google.mybusinessbusinessinformation({
      version: "v1",
      auth: oauth2Client,
    });

    const response = await mybusinessbusinessinformation.accounts.locations.list({
      parent: accountId,
      readMask: "name,title,storefrontAddress",
    });

    return res.status(200).json({
      success: true,
      locations: response.data.locations || [],
    });
  } catch (error) {
    console.error("[GMB] Error listing locations:", error.message, error.stack);
    if (error.response) {
      console.error("[GMB] Google API response:", JSON.stringify(error.response.data));
    }
    return res.status(500).json({
      success: false,
      message: "Failed to list locations",
      error: error.message,
    });
  }
};

const saveAccountConfig = async (req, res) => {
  try {
    const { accountId, locationId } = req.body;

    if (!accountId || !locationId) {
      return res.status(400).json({
        success: false,
        message: "accountId and locationId are required",
      });
    }

    const token = await getTokenForUser(req.user);
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "GMB not connected. Please authorize first.",
      });
    }

    await persistTokenUpdateForUser(req.user, { accountId, locationId });
    console.log("[GMB] Config saved for admin:", req.user.email, "accountId:", accountId, "locationId:", locationId);

    return res.status(200).json({
      success: true,
      message: "GMB account configuration saved",
    });
  } catch (error) {
    console.error("[GMB] Error saving config:", error.message, error.stack);
    return res.status(500).json({
      success: false,
      message: "Failed to save config",
      error: error.message,
    });
  }
};

const disconnect = async (req, res) => {
  try {
    await GmbToken.deleteOne(getTokenFilterForUser(req.user));
    console.log("[GMB] Disconnected admin:", req.user.email, req.user._id.toString());

    return res.status(200).json({
      success: true,
      message: "GMB disconnected",
    });
  } catch (error) {
    console.error("[GMB] Error disconnecting:", error.message, error.stack);
    return res.status(500).json({
      success: false,
      message: "Failed to disconnect",
      error: error.message,
    });
  }
};

module.exports = {
  getOAuth2Client,
  getTokenForUser,
  persistTokenUpdateForUser,
  getAuthUrl,
  handleCallback,
  getConnectionStatus,
  listAccounts,
  listLocations,
  saveAccountConfig,
  disconnect,
};

const { google } = require("googleapis");
const GmbToken = require("../model/gmbToken.model");

const SCOPES = [
  "https://www.googleapis.com/auth/business.manage",
];

function getOAuth2Client() {
  const redirectUri = process.env.GMB_REDIRECT_URI || "http://localhost:5000/api/gmb/oauth/callback";
  if (process.env.NODE_ENV !== "production") {
    console.log("[GMB] OAuth2Client init — clientId:", process.env.GOOGLE_CLIENT_ID ? "✅ set" : "❌ MISSING");
    console.log("[GMB] OAuth2Client init — clientSecret:", process.env.GOOGLE_CLIENT_SECRET ? "✅ set" : "❌ MISSING");
    console.log("[GMB] OAuth2Client init — redirectUri:", redirectUri);
  }
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri
  );
}

// Generate the Google OAuth consent URL for admin to authorize
const getAuthUrl = async (req, res) => {
  try {
    const oauth2Client = getOAuth2Client();

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: SCOPES,
    });

    console.log("[GMB] Auth URL generated:", authUrl);
    return res.status(200).json({ success: true, authUrl });
  } catch (error) {
    console.error("[GMB] Error generating auth URL:", error.message, error.stack);
    return res.status(500).json({ success: false, message: "Failed to generate auth URL", error: error.message });
  }
};

// Handle OAuth callback from Google
const handleCallback = async (req, res) => {
  try {
    const { code } = req.query;

    if (!code) {
      console.error("[GMB] Callback hit without authorization code. Query:", req.query);
      return res.status(400).json({ success: false, message: "Authorization code missing" });
    }

    console.log("[GMB] Callback received with code:", code.substring(0, 20) + "...");
    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    console.log("[GMB] Tokens received — access_token:", tokens.access_token ? "✅" : "❌", "refresh_token:", tokens.refresh_token ? "✅" : "❌");

    // Upsert: keep only one token document
    await GmbToken.findOneAndUpdate(
      {},
      {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiryDate: tokens.expiry_date,
        scope: tokens.scope,
      },
      { upsert: true, new: true }
    );

    // Redirect admin back to frontend with success
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    return res.redirect(`${frontendUrl}/admin/incentives?gmb_connected=true`);
  } catch (error) {
    console.error("[GMB] OAuth callback error:", error.message, error.stack);
    if (error.response) console.error("[GMB] Google API response:", JSON.stringify(error.response.data));
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    return res.redirect(`${frontendUrl}/admin/incentives?gmb_connected=false&error=${encodeURIComponent(error.message)}`);
  }
};

// Check if GMB is connected (token exists)
const getConnectionStatus = async (req, res) => {
  try {
    const token = await GmbToken.findOne();
    const connected = !!token;
    console.log("[GMB] Connection status — connected:", connected, "accountId:", token?.accountId || "none", "locationId:", token?.locationId || "none");
    return res.status(200).json({ success: true, connected, accountId: token?.accountId || null, locationId: token?.locationId || null });
  } catch (error) {
    console.error("[GMB] Error checking connection status:", error.message, error.stack);
    return res.status(500).json({ success: false, message: "Error checking connection", error: error.message });
  }
};

// List Google Business accounts for admin to pick
const listAccounts = async (req, res) => {
  try {
    const token = await GmbToken.findOne();
    if (!token) {
      return res.status(401).json({ success: false, message: "GMB not connected. Please authorize first." });
    }

    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials({
      access_token: token.accessToken,
      refresh_token: token.refreshToken,
      expiry_date: token.expiryDate,
    });

    // Listen for token refresh
    oauth2Client.on("tokens", async (newTokens) => {
      if (newTokens.access_token) {
        await GmbToken.findOneAndUpdate({}, { accessToken: newTokens.access_token, expiryDate: newTokens.expiry_date });
      }
    });

    console.log("[GMB] Fetching accounts list...");
    const mybusinessaccountmanagement = google.mybusinessaccountmanagement({ version: "v1", auth: oauth2Client });
    const response = await mybusinessaccountmanagement.accounts.list();
    console.log("[GMB] Accounts found:", response.data.accounts?.length || 0);

    return res.status(200).json({ success: true, accounts: response.data.accounts || [] });
  } catch (error) {
    console.error("[GMB] Error listing accounts:", error.message, error.stack);
    if (error.response) console.error("[GMB] Google API response:", JSON.stringify(error.response.data));
    return res.status(500).json({ success: false, message: "Failed to list accounts", error: error.message });
  }
};

// List locations under a selected account
const listLocations = async (req, res) => {
  try {
    const { accountId } = req.query;

    if (!accountId) {
      return res.status(400).json({ success: false, message: "accountId query parameter is required (e.g. accounts/123456789)" });
    }

    const token = await GmbToken.findOne();
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
        await GmbToken.findOneAndUpdate({}, { accessToken: newTokens.access_token, expiryDate: newTokens.expiry_date });
      }
    });

    console.log("[GMB] Fetching locations for account:", accountId);
    const mybusinessbusinessinformation = google.mybusinessbusinessinformation({ version: "v1", auth: oauth2Client });
    const response = await mybusinessbusinessinformation.accounts.locations.list({
      parent: accountId,
      readMask: "name,title,storefrontAddress",
    });
    console.log("[GMB] Locations found:", response.data.locations?.length || 0);

    return res.status(200).json({ success: true, locations: response.data.locations || [] });
  } catch (error) {
    console.error("[GMB] Error listing locations:", error.message, error.stack);
    if (error.response) console.error("[GMB] Google API response:", JSON.stringify(error.response.data));
    return res.status(500).json({ success: false, message: "Failed to list locations", error: error.message });
  }
};

// Save selected account & location
const saveAccountConfig = async (req, res) => {
  try {
    const { accountId, locationId } = req.body;

    if (!accountId || !locationId) {
      return res.status(400).json({ success: false, message: "accountId and locationId are required" });
    }

    await GmbToken.findOneAndUpdate({}, { accountId, locationId });
    console.log("[GMB] Config saved — accountId:", accountId, "locationId:", locationId);

    return res.status(200).json({ success: true, message: "GMB account configuration saved" });
  } catch (error) {
    console.error("[GMB] Error saving config:", error.message, error.stack);
    return res.status(500).json({ success: false, message: "Failed to save config", error: error.message });
  }
};

// Disconnect GMB (remove stored tokens)
const disconnect = async (req, res) => {
  try {
    await GmbToken.deleteMany({});
    console.log("[GMB] Disconnected — all tokens removed");
    return res.status(200).json({ success: true, message: "GMB disconnected" });
  } catch (error) {
    console.error("[GMB] Error disconnecting:", error.message, error.stack);
    return res.status(500).json({ success: false, message: "Failed to disconnect", error: error.message });
  }
};

module.exports = {
  getOAuth2Client,
  getAuthUrl,
  handleCallback,
  getConnectionStatus,
  listAccounts,
  listLocations,
  saveAccountConfig,
  disconnect,
};

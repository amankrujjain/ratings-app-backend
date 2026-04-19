const express = require("express");
const { authenticateToken, authorizeRoles } = require("../middleware/auth.middleware");
const { syncGMBReviews } = require("../services/gmb.service");
const {
  getAuthUrl,
  handleCallback,
  getConnectionStatus,
  listAccounts,
  listLocations,
  saveAccountConfig,
  disconnect,
} = require("../controller/gmb.controller");

const router = express.Router();

// OAuth flow
router.get("/oauth/url", authenticateToken, authorizeRoles("admin"), getAuthUrl);
router.get("/oauth/callback", handleCallback); // No auth — Google redirects here

// Dev-only routes — disabled in production
if (process.env.NODE_ENV !== "production") {
  // Quick test: open http://localhost:5000/api/gmb/oauth/start in browser to begin OAuth
  router.get("/oauth/start", async (req, res) => {
    try {
      const { google } = require("googleapis");
      const redirectUri = process.env.GMB_REDIRECT_URI || "http://localhost:5000/api/gmb/oauth/callback";
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        redirectUri
      );
      const authUrl = oauth2Client.generateAuthUrl({
        access_type: "offline",
        prompt: "consent",
        scope: ["https://www.googleapis.com/auth/business.manage"],
      });
      console.log("[GMB] Redirecting to Google OAuth:", authUrl);
      res.redirect(authUrl);
    } catch (error) {
      console.error("[GMB] Error starting OAuth:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Quick setup: open http://localhost:5000/api/gmb/setup in browser to auto-pick account & location
  router.get("/setup", async (req, res) => {
    try {
      const { google } = require("googleapis");
      const GmbToken = require("../model/gmbToken.model");
      const { getOAuth2Client } = require("../controller/gmb.controller");

      const token = await GmbToken.findOne();
      if (!token) {
        return res.status(401).send("<h2>No token found. <a href='/api/gmb/oauth/start'>Authorize first</a></h2>");
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

      // 1. List accounts
      console.log("[GMB Setup] Fetching accounts...");
      const mybusinessaccountmanagement = google.mybusinessaccountmanagement({ version: "v1", auth: oauth2Client });
      const accountsRes = await mybusinessaccountmanagement.accounts.list();
      const accounts = accountsRes.data.accounts || [];
      console.log("[GMB Setup] Accounts found:", accounts.length);

      if (accounts.length === 0) {
        return res.status(404).send("<h2>No Google Business accounts found for this Google account.</h2>");
      }

      // 2. List locations for first account
      const accountId = accounts[0].name;
      console.log("[GMB Setup] Fetching locations for:", accountId);

      const mybusinessbusinessinformation = google.mybusinessbusinessinformation({ version: "v1", auth: oauth2Client });
      const locationsRes = await mybusinessbusinessinformation.accounts.locations.list({
        parent: accountId,
        readMask: "name,title,storefrontAddress",
      });
      const locations = locationsRes.data.locations || [];
      console.log("[GMB Setup] Locations found:", locations.length);

      if (locations.length === 0) {
        return res.status(404).send(`<h2>No locations found under account ${accountId}</h2>`);
      }

      // 3. Auto-save first account + first location
      const locationId = locations[0].name;
      await GmbToken.findOneAndUpdate({}, { accountId, locationId });
      console.log("[GMB Setup] Saved config — account:", accountId, "location:", locationId);

      return res.send(`
        <h2>GMB Setup Complete!</h2>
        <p><strong>Account:</strong> ${accounts[0].accountName} (${accountId})</p>
        <p><strong>Location:</strong> ${locations[0].title} (${locationId})</p>
        <p>You can now use the app's sync button.</p>
      `);
    } catch (error) {
      console.error("[GMB Setup] Error:", error.message);
      return res.status(500).send(`<h2>Setup Error</h2><pre>${error.message}</pre>`);
    }
  });

  // Quick sync test (no auth required, for dev only)
  router.get("/sync-test", async (req, res) => {
    try {
      await syncGMBReviews();
      res.status(200).json({ message: "GMB Sync executed successfully" });
    } catch (error) {
      console.error("[GMB] Sync test error:", error);
      res.status(500).json({ message: "GMB Sync failed", error: error.message });
    }
  });
}

router.get("/status", authenticateToken, authorizeRoles("admin"), getConnectionStatus);
router.get("/accounts", authenticateToken, authorizeRoles("admin"), listAccounts);
router.get("/locations", authenticateToken, authorizeRoles("admin"), listLocations);
router.post("/config", authenticateToken, authorizeRoles("admin"), saveAccountConfig);
router.delete("/disconnect", authenticateToken, authorizeRoles("admin"), disconnect);

// Manual sync
router.get(
  "/sync",
  authenticateToken,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      await syncGMBReviews();
      res.status(200).json({ message: "GMB Sync executed successfully" });
    } catch (error) {
      res.status(500).json({ message: "GMB Sync failed", error: error.message });
    }
  }
);

module.exports = router;
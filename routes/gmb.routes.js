const express = require("express");
const { authenticateToken, authorizeRoles } = require("../middleware/auth.middleware");
const { syncGMBReviews } = require("../services/gmb.service");

const router = express.Router();

router.get(
  "/sync",
  authenticateToken,
  authorizeRoles("admin"),
  async (req, res) => {
    await syncGMBReviews();
    res.status(200).json({ message: "GMB Sync executed successfully" });
  }
);

module.exports = router;
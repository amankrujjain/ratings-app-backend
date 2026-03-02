const express = require("express");
const { authenticateToken, authorizeRoles } = require("../middleware/auth.middleware");
const { getMonthlyIncentive, getMonthlyIncentiveSummary, exportMonthlyIncentive } = require("../controller/incentive.controller");

const router = express.Router();

// Employee wallet view
router.get(
  "/monthly/:employeeId",
  authenticateToken,
  getMonthlyIncentive
);

router.get(
  "/monthly-summary",
  authenticateToken,
  authorizeRoles("admin", "subadmin"),
  getMonthlyIncentiveSummary
);

router.get(
  "/export-monthly",
  authenticateToken,
  authorizeRoles("admin", "subadmin"),
  exportMonthlyIncentive
);

module.exports = router;
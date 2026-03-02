const express = require("express");
const { authenticateToken, authorizeRoles } = require("../middleware/auth.middleware");
const { getRatingsById, getEmployeeRatings, editRating, deleteRating, allRatings, recalculateAverage } = require("../controller/rating.controller");

const router = express.Router();

// ❌ Removed public submit route


router.get(
  "/employee-ratings/:employeeId",
  authenticateToken,
  // authorizeRoles(),
  getEmployeeRatings
);

router.get(
  "/all-ratings",
  authenticateToken,
  authorizeRoles("admin", "subadmin"),
  allRatings
);

router.put(
  "/update-rating/:ratingId",
  authenticateToken,
  authorizeRoles("admin"),
  editRating
);

router.delete(
  "/delete-rating/:ratingId",
  authenticateToken,
  authorizeRoles("admin"),
  deleteRating
);
router.post(
  "/recalculate/:employeeId",
  authenticateToken,
  authorizeRoles("admin"),
  recalculateAverage
);
router.get("/:ratingId", getRatingsById);

module.exports = router;
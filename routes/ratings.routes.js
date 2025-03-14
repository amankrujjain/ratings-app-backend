const express = require("express");
const { authenticateToken, authorizeRoles } = require("../middleware/auth.middleware");

const { submitRating, getEmployeeRatings, editRating, deleteRating, allRatings } = require("../controller/rating.controller");

const router = express.Router();

router.post("/submit/:employeeId", submitRating);
router.get("/employee/:employeeId", getEmployeeRatings);
router.get("/all-ratings",authenticateToken, authorizeRoles("admin", "subadmin"), allRatings );

// Update a rating (Admin only)
router.put("/update-rating/:ratingId", authenticateToken, authorizeRoles("admin"), editRating);

// Delete a rating (Admin only)
router.delete("/delete-rating/:ratingId", authenticateToken, authorizeRoles("admin"), deleteRating);

module.exports = router;

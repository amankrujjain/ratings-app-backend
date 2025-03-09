const express = require("express");
const { authenticateToken, authorizeRoles } = require("../middleware/auth.middleware");

const { submitRating, getEmployeeRatings, editRating, deleteRating } = require("../controller/rating.controller");

const router = express.Router();

router.post("/submit/:employeeId", submitRating);
router.get("/employee/:employeeId", getEmployeeRatings);

// Update a rating (Admin only)
router.put("/update-rating/:ratingId", authenticateToken, authorizeRoles("admin"), editRating);

// Delete a rating (Admin only)
router.delete("/delete-rating/:ratingId", authenticateToken, authorizeRoles("admin"), deleteRating);

module.exports = router;

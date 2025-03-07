const express = require("express");
const { submitRating, getEmployeeRatings } = require("../controller/rating.controller");

const router = express.Router();

router.post("/submit/:employeeId", submitRating);
router.get("/employee/:employeeId", getEmployeeRatings);

module.exports = router;

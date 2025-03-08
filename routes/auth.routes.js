const express = require("express");
const multer = require("multer");
const { signup, login, refreshToken, logout, forgotPassword, verifyOTP, resetPassword } = require("../controller/auth.controller");
const {createRole} = require('../controller/role.controller')
const { authenticateToken, authorizeRoles } = require("../middleware/auth.middleware");

const router = express.Router();

// Multer setup for image upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
const upload = multer({ storage });

router.post("/signup", upload.single("employeePhoto"), signup);
router.post("/login", login);
router.post("/refresh-token", refreshToken);
router.post("/logout", logout);
router.post("/role", authenticateToken, authorizeRoles("admin"), createRole);
router.post("/forgot-password", forgotPassword);
router.post("/verify-otp", verifyOTP);
router.post("/reset-password", resetPassword);

module.exports = router;

// routes/user.routes.js
const express = require("express");
const { authenticateToken, authorizeRoles } = require("../middleware/auth.middleware");
const { createUser, getAllUsers, getUserById, updateUser, deleteUser, generateQRCode, getProfile } = require("../controller/user.controller");
const multer = require('multer');
const path = require('path');

const router = express.Router();

// Configure Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); // Ensure this directory exists
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

// File filter to accept only PNG, JPEG, JPG, WebP
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only PNG, JPEG, JPG, and WebP files are allowed'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // Optional: 5MB limit
});

router.post("/add-user", authenticateToken, authorizeRoles("admin", "subadmin"), upload.single('employeePhoto'), createUser);
router.get("/all-user", authenticateToken, authorizeRoles("admin", "subadmin"), getAllUsers);
router.get("/get-user/:id", authenticateToken, getUserById);
router.put("/update-user/:id", authenticateToken, authorizeRoles("admin", "subadmin"), upload.single('employeePhoto'), updateUser);
router.delete("/delete-user/:id", authenticateToken, authorizeRoles("admin", "subadmin"), deleteUser);
router.get("/generate-qr/:employeeId", generateQRCode);
router.get("/profile", authenticateToken, getProfile);

module.exports = router;
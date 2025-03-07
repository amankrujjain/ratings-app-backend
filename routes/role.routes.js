const express = require("express");
const { verifyToken } = require("../middleware/auth.middleware");
const { 
    getRoles, 
    getRoleById, 
    updateRole, 
    deleteRole 
} = require("../controllers/roleController");

const router = express.Router();

// Protected Routes (Require Valid Token)
router.get("/", verifyToken, getRoles);          // Get all roles
router.get("/:id", verifyToken, getRoleById);    // Get role by ID
router.put("/:id", verifyToken, updateRole);     // Update role
router.delete("/:id", verifyToken, deleteRole);  // Delete role

module.exports = router;

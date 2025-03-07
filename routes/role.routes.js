const express = require("express");
const { verifyToken } = require("../middleware/auth.middleware");
const { 
    getRoles, 
    getRoleById, 
    updateRole, 
    deleteRole 
} = require("../controller/role.controller");

const router = express.Router();

// Protected Routes (Require Valid Token)
router.get("/all-roles", verifyToken, getRoles);          // Get all roles
router.get("/get-role/:id", verifyToken, getRoleById);    // Get role by ID
router.put("/update-role/:id", verifyToken, updateRole);     // Update role
router.delete("/delete/:id", verifyToken, deleteRole);  // Delete role

module.exports = router;

const express = require("express");
const { authenticateToken, authorizeRoles } = require("../middleware/auth.middleware");
const { 
    createRole,
    getRoles, 
    getRoleById, 
    updateRole, 
    deleteRole 
} = require("../controller/role.controller");

const router = express.Router();

// Protected Routes (Require Valid Token)
router.post("/create-roles", createRole)
router.get("/all-roles", authenticateToken, authorizeRoles("admin", "subadmin"), getRoles);          // Get all roles
router.get("/get-role/:id",authenticateToken, authorizeRoles("admin", "subadmin"), getRoleById);    // Get role by ID
router.put("/update-role/:id",authenticateToken, authorizeRoles("admin", "subadmin"),  updateRole);     // Update role
router.delete("/delete/:id",authenticateToken, authorizeRoles("admin", "subadmin"),  deleteRole);  // Delete role

module.exports = router;

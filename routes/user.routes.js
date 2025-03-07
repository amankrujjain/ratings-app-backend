const express = require("express");
const { authenticateToken, authorizeRoles } = require("../middleware/auth.middleware");
const { createUser, getAllUsers, getUserById, updateUser, deleteUser } = require("../controller/user.controller");

const router = express.Router();

router.post("/add-user", authenticateToken, authorizeRoles("admin","subadmin"), createUser);
router.get("/all-user", authenticateToken, authorizeRoles("admin","subadmin"), getAllUsers);
router.get("/get-user/:id", authenticateToken, getUserById);
router.put("/update-user/:id", authenticateToken, authorizeRoles("admin","subadmin"), updateUser);
router.delete("/delete-user/:id", authenticateToken, authorizeRoles("admin","subadmin"), deleteUser);

module.exports = router;

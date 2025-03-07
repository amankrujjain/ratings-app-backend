const User = require("../model/user.model");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

// Create a new user (Admin only)
const createUser = async (req, res) => {
  try {
    const { employeeName, employeeId, department, designation, contactNo, bloodGroup, joiningDate, role, password } = req.body;
    
    const existingUser = await User.findOne({ employeeId });
    if (existingUser) return res.status(400).json({ message: "User already exists" });

    const newUser = new User({ employeeName, employeeId, department, designation, contactNo, bloodGroup, joiningDate, role, password });
    await newUser.save();

    res.status(201).json({ message: "User created successfully", user: newUser });
  } catch (error) {
    res.status(500).json({ message: "Error creating user", error });
  }
};

// Get all users (Protected: Admin only)
const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().populate("role");
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ message: "Error fetching users", error });
  }
};

// Get user by ID (Protected)
const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).populate("role");
    if (!user) return res.status(404).json({ message: "User not found" });

    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ message: "Error fetching user", error });
  }
};

// Update user (Admin only)
const updateUser = async (req, res) => {
  try {
    const { employeeName, department, designation, contactNo, bloodGroup, joiningDate, role, isActive } = req.body;

    const updatedUser = await User.findByIdAndUpdate(req.params.id, { employeeName, department, designation, contactNo, bloodGroup, joiningDate, role, isActive }, { new: true });

    if (!updatedUser) return res.status(404).json({ message: "User not found" });

    res.status(200).json({ message: "User updated successfully", user: updatedUser });
  } catch (error) {
    res.status(500).json({ message: "Error updating user", error });
  }
};

// Delete user (Admin only)
const deleteUser = async (req, res) => {
  try {
    const deletedUser = await User.findByIdAndDelete(req.params.id);
    if (!deletedUser) return res.status(404).json({ message: "User not found" });

    res.status(200).json({ message: "User deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting user", error });
  }
};

module.exports = { createUser, getAllUsers, getUserById, updateUser, deleteUser };

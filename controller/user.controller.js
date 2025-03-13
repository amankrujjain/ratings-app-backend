const User = require("../model/user.model");
const QRCode = require("qrcode");
const fs = require("fs");
const path = require("path");

// Create a new user (Admin only)
const createUser = async (req, res) => {
  try {
    const {
      employeeName,
      email,
      employeeId,
      department,
      designation,
      contactNo,
      bloodGroup,
      joiningDate,
      role,
      password
    } = req.body;

    // Check for existing user
    const existingUser = await User.findOne({ employeeId });
    if (existingUser) return res.status(400).json({ message: "User already exists" });

    // Get file path if uploaded
    const employeePhoto = req.file ? req.file.path : null;

    const newUser = new User({
      employeeName,
      email,
      employeeId,
      department,
      designation,
      contactNo,
      bloodGroup,
      joiningDate,
      employeePhoto, // Add the photo path
      role,
      password
    });

    await newUser.save();

    return res.status(201).json({ message: "User created successfully", user: newUser });
  } catch (error) {
    console.log("Error while creating user", error);
    return res.status(500).json({ message: "Error creating user", error: error.message });
  }
};

// Get all users (Protected: Admin only)
const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().populate("role").sort({employeeId: 1});
    return res.status(200).json(users);
  } catch (error) {
    return res.status(500).json({ message: "Error fetching users", error });
  }
};

// Get user by ID (Protected)
const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).populate("role").select('-password');
    if (!user) return res.status(404).json({ message: "User not found" });

    return res.status(200).json(user);
  } catch (error) {
    return res.status(500).json({ message: "Error fetching user", error });
  }
};

// Update user (Admin only)
const updateUser = async (req, res) => {
  try {
    console.log('Request Params (ID):', req.params.id);
    console.log('Request Body:', req.body);
    console.log('Request File:', req.file ? req.file.path : 'No file uploaded');

    const {
      employeeId,
      employeeName,
      email,
      designation,
      isActive,
      contactNo,
      department,
      bloodGroup,
      joiningDate,
    } = req.body;

    // Ensure ID is valid
    if (!req.params.id) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    // Prepare update data
    const updateData = {
      employeeId,
      employeeName,
      email,
      designation,
      isActive: isActive === 'true' || isActive === true, // Handle both string and boolean
      contactNo,
      department,
      bloodGroup,
      joiningDate: joiningDate ? new Date(joiningDate) : undefined,
    };

    // Handle file upload
    if (req.file) {
      updateData.employeePhoto = req.file.path;
    }

    // Perform update
    const updatedUser = await User.findByIdAndUpdate(req.params.id, updateData, { new: true });

    if (!updatedUser) {
      console.log('User not found:', req.params.id);
      return res.status(404).json({ message: "User not found" });
    }

    console.log('Updated User:', updatedUser);
    return res.status(200).json({ message: "User updated successfully", user: updatedUser });

  } catch (error) {
    console.error('Error updating user:', error);
    return res.status(500).json({ message: "Error updating user", error: error.message });
  }
};
// Delete user (Admin only)
const deleteUser = async (req, res) => {
  try {
    const deletedUser = await User.findByIdAndDelete(req.params.id);
    if (!deletedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({
      message: "User deleted successfully",
      deletedUser, // Send deleted user data
    });
  } catch (error) {
    return res.status(500).json({ message: "Error deleting user", error });
  }
};


const generateQRCode = async (req, res) => {
    try {
        const { id } = req.params; // Employee ID
    
        if (!id) {
          return res.status(400).json({ message: "Employee ID is required" });
        }
    
        // Fetch employee details from DB
        const employee = await User.findById(id);
        if (!employee) {
          return res.status(404).json({ message: "Employee not found" });
        }
    
        const employeeName = employee.employeeName.replace(/\s+/g, "_"); // Replace spaces with underscores
        const profileURL = `https://yourfrontend.com/profile/${id}`;
    
        // Define folder path and file path
        const qrFolderPath = path.join(__dirname, "../uploads/qr", employeeName);
        const qrFilePath = path.join(qrFolderPath, `${id}.png`);
    
        // Ensure directory exists
        if (!fs.existsSync(qrFolderPath)) {
          fs.mkdirSync(qrFolderPath, { recursive: true });
        }
    
        // Generate and save QR code
        await QRCode.toFile(qrFilePath, profileURL);
    
        return res.status(200).json({
          message: "QR Code generated successfully",
          qrCodePath: `/uploads/qr/${employeeName}/${id}.png`,
          profileURL,
        });
      } catch (error) {
        return res.status(500).json({ message: "Internal Server Error", error: error.message });
      }
  };
  // Get logged-in user's profile
const getProfile = async (req, res) => {
  try {
    const userId = req.user.id; // Extract user ID from token

    const user = await User.findById(userId).select("-password"); // Exclude password
    if (!user) return res.status(404).json({ message: "User not found" });

    return res.status(200).json(user);
  } catch (error) {
    return res.status(500).json({ message: "Error fetching profile", error });
  }
};

module.exports = { createUser, getAllUsers, getUserById, updateUser, deleteUser, generateQRCode, getProfile };

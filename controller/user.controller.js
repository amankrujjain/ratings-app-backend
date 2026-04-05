const User = require("../model/user.model");
const crypto = require("crypto");

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

    const existingUser = await User.findOne({ employeeId });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

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
      employeePhoto,
      role,
      password,
    });

    await newUser.save();

    return res.status(201).json({
      message: "User created successfully",
      user: newUser
    });

  } catch (error) {
    console.log("Error while creating user", error);
    return res.status(500).json({
      message: "Error creating user",
      error: error.message
    });
  }
};

// Get all users (Protected: Admin only) - exclude users with role "admin"
const getAllUsers = async (req, res) => {
  try {
    const Role = require("../model/role.model");

    // ===== Query Params =====
    let {
      page = 1,
      limit = 10,
      sortBy = "employeeId",
      order = "asc",
      search = ""
    } = req.query;

    page = parseInt(page);
    limit = parseInt(limit);

    const skip = (page - 1) * limit;

    // ===== Exclude Admin Role =====
    const adminRole = await Role.findOne({ name: "admin" });

    const query = {};

    if (adminRole) {
      query.role = { $ne: adminRole._id };
    }

    // ===== Search Logic =====
    if (search) {
      query.$or = [
        { employeeName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { employeeId: { $regex: search, $options: "i" } },
        { department: { $regex: search, $options: "i" } },
        { designation: { $regex: search, $options: "i" } }
      ];
    }

    // ===== Allowed Sort Fields (Security) =====
    const allowedSortFields = [
      "employeeName",
      "employeeId",
      "email",
      "department",
      "designation",
      "joiningDate",
      "averageRating",
      "createdAt"
    ];

    const sortField = allowedSortFields.includes(sortBy)
      ? sortBy
      : "employeeId";

    const sortOrder = order === "desc" ? -1 : 1;

    // ===== Fetch Data =====
    const users = await User.find(query)
      .populate("role")
      .sort({ [sortField]: sortOrder })
      .skip(skip)
      .limit(limit);

    const totalUsers = await User.countDocuments(query);

    return res.status(200).json({
      data: users,
      pagination: {
        total: totalUsers,
        page,
        limit,
        totalPages: Math.ceil(totalUsers / limit)
      }
    });

  } catch (error) {
    return res.status(500).json({
      message: "Error fetching users",
      error: error.message
    });
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

module.exports = { createUser, getAllUsers, getUserById, updateUser, deleteUser, getProfile };

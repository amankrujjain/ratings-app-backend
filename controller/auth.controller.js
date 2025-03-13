const User = require("../model/user.model");
const Role = require("../model/role.model");
const OTP = require("../model/otp.model");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { sendOTP, sendEmail } = require("../utils/email");


const generateAccessToken = (user) => {
  return jwt.sign(
    { userId: user._id, role: user.role.name },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: "15m" }
  );
};

const generateRefreshToken = (user) => {
  return jwt.sign({ userId: user._id }, process.env.REFRESH_TOKEN_SECRET, {
    expiresIn: "7d",
  });
};

exports.signup = async (req, res) => {
  try {
    const {
      employeeName,
      email, // Added email since it's in the schema
      employeeId,
      department,
      designation,
      contactNo,
      bloodGroup,
      joiningDate,
      role,
      password,
    } = req.body;

    const employeePhoto = req.file ? req.file.path : null;

    // Validate role
    const existingRole = await Role.findById(role);
    if (!existingRole) {
      return res.status(400).json({ message: "Invalid role ID" });
    }

    // Check for existing user
    const existingUser = await User.findOne({ employeeId });
    if (existingUser) {
      return res.status(400).json({ message: "Employee ID already exists" });
    }

    // Check for existing email (optional, if you want unique emails)
    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({ message: "Email already exists" });
    }

    // Create new user - let pre-save hook handle password hashing
    const newUser = new User({
      employeeName,
      email,
      employeeId,
      department,
      designation,
      contactNo,
      bloodGroup,
      joiningDate: new Date(joiningDate), // Ensure proper date format
      employeePhoto,
      role,
      password, // Pass plain password, pre-save hook will hash it
    });

    await newUser.save();

    return res.status(201).json({ message: "User created successfully" });
  } catch (error) {
    console.error("Signup Error:", error);
    return res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

exports.login = async (req, res) => {
  try {
    const { employeeId, password } = req.body;
    const user = await User.findOne({ employeeId })
      .select("+password +refreshToken")
      .populate("role");

    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    const isPasswordMatch = await user.comparePassword(password);
    if (!isPasswordMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    user.refreshToken = refreshToken;
    user.isLogin = true; // Set isLogin
    await user.save();

    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    const userResponse = user.toObject();
    delete userResponse.password;
    delete userResponse.refreshToken;

    // ✅ Include accessToken in the response
    return res.status(200).json({
      message: "Login successful",
      user: userResponse,
      accessToken,  // 🔥 Ensure this is sent to frontend
    });
  } catch (error) {
    console.error("Login Error:", error);
    return res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

exports.logout = async (req, res) => {
  try {
    const user = await User.findOne({ refreshToken: req.cookies.refreshToken });
    if (user) {
      user.refreshToken = null;
      user.isLogin = false; // Clear isLogin
      await user.save();
    }

    res.clearCookie("accessToken", { httpOnly: true, secure: true, sameSite: "strict" });
    res.clearCookie("refreshToken", { httpOnly: true, secure: true, sameSite: "strict" });

    return res.json({ message: "Logged out successfully" });
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

exports.refreshToken = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    console.log("Refresh token received:", refreshToken);

    if (!refreshToken) {
      return res.status(401).json({ message: "Refresh token missing" });
    }

    // Verify refresh token
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
    } catch (err) {
      console.log("Invalid refresh token:", err.message);
      return res.status(403).json({ message: "Invalid refresh token" });
    }

    // Find the user by ID from the decoded token
    const user = await User.findById(decoded.userId).populate("role");

    if (!user || user.refreshToken !== refreshToken) {
      return res.status(403).json({ message: "Invalid refresh token" });
    }

    console.log("User found:", user.employeeId);

    // Generate new tokens
    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);

    // Update user's refresh token in DB
    user.refreshToken = newRefreshToken;
    await user.save();
    console.log("New refresh token saved:", newRefreshToken);

    // Set new cookies
    res.cookie("accessToken", newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 15 minutes
    });

    res.cookie("refreshToken", newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 30 * 24 * 60 * 60 * 1000, // 7 days
    });

    // Send response with the new access token
    res.json({ message: "Token refreshed", accessToken: newAccessToken });
  } catch (error) {
    console.error("Refresh token error:", error.message);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    // Generate 6-digit OTP
    const otp = crypto.randomInt(100000, 999999).toString();

    // Save OTP in MongoDB (It will expire in 5 minutes)
    await OTP.create({ email, otp });

    // Send OTP via email
    await sendOTP(email, otp);

    res.status(200).json({ message: "OTP sent to your email" });
  } catch (error) {
    res.status(500).json({ message: "Error sending OTP", error: error.message });
  }
};

// Step 2: Verify OTP
exports.verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;
    const otpRecord = await OTP.findOne({ email, otp });

    if (!otpRecord) return res.status(400).json({ message: "Invalid or expired OTP" });

    // OTP is valid, allow password reset
    res.status(200).json({ message: "OTP verified. Proceed to reset password." });
  } catch (error) {
    res.status(500).json({ message: "Error verifying OTP", error: error.message });
  }
};

// Step 3: Reset Password
exports.resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    const otpRecord = await OTP.findOne({ email, otp });

    if (!otpRecord) return res.status(400).json({ message: "Invalid or expired OTP" });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    // Hash new password and update user
    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    // Delete OTP after successful password reset
    await OTP.deleteOne({ email });


    await sendEmail(email);

    res.status(200).json({ message: "Password reset successful" });
  } catch (error) {
    res.status(500).json({ message: "Error resetting password", error: error.message });
  }
};

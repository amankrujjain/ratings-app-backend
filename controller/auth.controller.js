const User = require("../model/user.model");
const Role = require("../model/role.model");
const OTP = require("../model/otp.model");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const { sendOTP } = require("../utils/email");


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

    const existingRole = await Role.findById(role);
    if (!existingRole)
      return res.status(400).json({ message: "Invalid role ID" });

    const existingUser = await User.findOne({ employeeId });
    if (existingUser)
      return res.status(400).json({ message: "Employee ID already exists" });

    const salt = await bcrypt.genSalt(10);
    const hashPassword = await bcrypt.hash(password, salt);

    const newUser = new User({
      employeeName,
      employeeId,
      department,
      designation,
      contactNo,
      bloodGroup,
      joiningDate,
      employeePhoto,
      role,
      password : hashPassword,
    });

    await newUser.save();

    return res.status(201).json({ message: "User created successfully" });
  } catch (error) {
    return res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

exports.login = async (req, res) => {
  try {
    const { employeeId, password } = req.body;
    const user = await User.findOne({ employeeId }).populate("role");

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    user.refreshToken = refreshToken;
    await user.save();

    // Store tokens in HTTP-only cookies
    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: false, // Set to true in production
      sameSite: "strict",
      maxAge: 15 * 60 * 1000, // 15 minutes
    });

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: true, // Set to true in production
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return res.status(200).json({ message: "Login successful", user: user });
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

exports.refreshToken = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) return res.status(401).json({ message: "Refresh token missing" });

    const user = await User.findOne({ refreshToken }).populate("role");
    if (!user) return res.status(403).json({ message: "Invalid Refresh Token" });

    jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET, (err, decoded) => {
      if (err) return res.status(403).json({ message: "Invalid Refresh Token" });

      const newAccessToken = generateAccessToken(user);

      res.cookie("accessToken", newAccessToken, {
        httpOnly: true,
        secure: true,
        sameSite: "strict",
        maxAge: 15 * 60 * 1000, // 15 minutes
      });

      res.json({ message: "Token refreshed" });
    });
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

exports.logout = async (req, res) => {
  try {
    const user = await User.findOne({ refreshToken: req.cookies.refreshToken });
    if (user) {
      user.refreshToken = null;
      await user.save();
    }

    res.clearCookie("accessToken", { httpOnly: true, secure: true, sameSite: "strict" });
    res.clearCookie("refreshToken", { httpOnly: true, secure: true, sameSite: "strict" });

    return res.json({ message: "Logged out successfully" });
  } catch (error) {
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

    const subject = "Password Reset Successful";
    const message = `Hello ${user.employeeName},\n\nYour password has been successfully reset.\nIf you did not request this change, please contact support immediately.\n\nBest regards,\nYour Company Name`;

    await sendEmail(email, subject, message);

    res.status(200).json({ message: "Password reset successful" });
  } catch (error) {
    res.status(500).json({ message: "Error resetting password", error: error.message });
  }
};

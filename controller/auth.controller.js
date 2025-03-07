const User = require("../model/user.model");
const Role = require("../model/role.model");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

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
      password,
    });

    await newUser.save();
    res.status(201).json({ message: "User created successfully" });
  } catch (error) {
    res.status(500).json({
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
    res.status(500).json({ message: "Internal Server Error", error: error.message });
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
    res.status(500).json({ message: "Internal Server Error", error: error.message });
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

    res.json({ message: "Logged out successfully" });
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

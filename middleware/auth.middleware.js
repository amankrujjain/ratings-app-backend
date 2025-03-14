// middleware/auth.middleware.js
const jwt = require("jsonwebtoken");
const User = require("../model/user.model");

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Extract token from "Bearer <token>"

  if (!token) {
    return res.status(401).json({ message: "Access Denied: No token provided" });
  }

  try {
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    req.user = await User.findById(decoded.userId).populate("role");
    if (!req.user) {
      return res.status(401).json({ message: "Access Denied: User not found" });
    }

    next();
  } catch (error) {
    return res.status(401).json({ message: "Access Denied: Invalid or expired token" });
  }
};

const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role || !roles.includes(req.user.role.name)) {
      return res.status(403).json({ message: "Forbidden: Insufficient privileges" });
    }
    next();
  };
};

module.exports = {
  authenticateToken,
  authorizeRoles
};
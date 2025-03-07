const jwt = require("jsonwebtoken");
const User = require("../model/user.model");

const authenticateToken = async (req, res, next) => {
  const token = req.cookies.accessToken;
  if (!token) return res.status(401).json({ message: "Access Denied" });

  try {
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    req.user = await User.findById(decoded.userId).populate("role");
    if (!req.user) return res.status(401).json({ message: "User not found" });

    next();
  } catch (error) {
    return res.status(403).json({ message: "Invalid Token" });
  }
};

const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role.name)) {
      return res.status(403).json({ message: "Forbidden: Insufficient privileges" });
    }
    next();
  };
};

const verifyToken = (req, res, next) => {
    const token = req.cookies.accessToken || req.header("Authorization")?.split(" ")[1];

    if (!token) return res.status(403).json({ message: "Access Denied" });

    try {
        const verified = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
        req.user = verified;
        next();
    } catch (error) {
        res.status(401).json({ message: "Invalid Token" });
    }
};

module.exports = {
    authenticateToken,
    authorizeRoles,
    verifyToken
}
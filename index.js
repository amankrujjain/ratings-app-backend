const dotenv = require("dotenv");
dotenv.config();

const express = require("express");
const mongoose = require("mongoose");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const path = require("path");
const fs = require('fs');

const authRoutes = require("./routes/auth.routes");
const roleRoutes = require('./routes/role.routes');
const userRoutes = require('./routes/user.routes');
const ratingRoutes = require("./routes/ratings.routes");
const reviewRoutes = require("./routes/review.routes");
const gmbRoutes = require("./routes/gmb.routes");
const incentiveRoutes = require("./routes/incentive.routes");
require("./cron/googleReviewCron");

const http = require('http');

const setupWebSocket = require("./utils/websocket");

const app = express();
const server = http.createServer(app);

const { notifyEmployee, broadcastToAdmins } = setupWebSocket(server);

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use(express.json());
app.use(cookieParser());

const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(",").map(o => o.trim())
  : ["http://localhost:5173", "http://localhost:3000", "http://192.168.29.232:3000"];
app.use(cors({ credentials: true, origin: allowedOrigins }));

app.use("/api/auth", authRoutes);
app.use('/api', roleRoutes);
app.use('/api',userRoutes);
app.use("/api/ratings", ratingRoutes);
// app.use("/review", reviewRoutes);
app.use("/api/gmb", gmbRoutes);
app.use("/incentive", incentiveRoutes);

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.log("MongoDB connection error:", err));

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

module.exports = { notifyEmployee, broadcastToAdmins };
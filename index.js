const dotenv = require("dotenv");
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

dotenv.config();

const app = express();

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use(express.json());
app.use(cookieParser());
app.use(cors({ credentials: true, origin: "http://localhost:5173" }));

app.use("/api/auth", authRoutes);
app.use('/api', roleRoutes);
app.use('/api',userRoutes);
app.use("/api/ratings", ratingRoutes);

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.log("MongoDB connection error:", err));

app.listen(5000, () => console.log("Server running on port 5000"));

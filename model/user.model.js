const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const userSchema = new mongoose.Schema({
  employeeName: { type: String, required: true },
  employeeId: { type: String, required: true, unique: true },
  department: { type: String, required: true },
  designation: { type: String, required: true },
  contactNo: { type: String, required: true },
  bloodGroup: { type: String, required: true },
  joiningDate: { type: Date, required: true },
  employeePhoto: { type: String }, // Stores image path
  isActive: { type: Boolean, default: true },
  role: { type: mongoose.Schema.Types.ObjectId, ref: "Role", required: true },
  password: { type: String, required: true },
  averageRating: { type: Number, default: 0 },
  refreshToken: { type: String },
}, { timestamps: true });

// Hash password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Compare password
userSchema.methods.comparePassword = async function (password) {
  return await bcrypt.compare(password, this.password);
};

const User = mongoose.model("User", userSchema);
module.exports = User;

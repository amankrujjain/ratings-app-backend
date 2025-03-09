const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema({
  employeeName: { type: String, required: true },
  email: { type: String, required: true }, // Fixed typo: 'requied' → 'required'
  employeeId: { type: String, required: true, unique: true },
  department: { type: String, required: true },
  designation: { type: String, required: true },
  contactNo: { type: String, required: true },
  bloodGroup: { type: String, required: true },
  joiningDate: { type: Date, required: true },
  employeePhoto: { type: String }, // Stores image path
  isActive: { type: Boolean, default: true },
  role: { type: mongoose.Schema.Types.ObjectId, ref: "Role", required: true },
  password: { type: String, required: true, select: false }, // Added select: false for security
  averageRating: { type: Number, default: 0 },
  refreshToken: { type: String, select: false }, // Added select: false for security
}, { timestamps: true });

// Hash password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  try {
    this.password = await bcrypt.hash(this.password, 10);
    next();
  } catch (err) {
    next(err);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model("User", userSchema);
module.exports = User;
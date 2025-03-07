const Rating = require("../model/rating.model");
const User = require("../model/user.model");

// Submit Rating
const submitRating = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { customerName,customerEmail, customerPhone, rating, feedback } = req.body;

    // Validate Employee
    const employee = await User.findById(employeeId);
    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    // Save Rating
    const newRating = new Rating({ employee: employeeId, customerName,customerEmail, customerPhone, rating, feedback });
    await newRating.save();

    // Calculate & Update Employee Average Rating
    const ratings = await Rating.find({ employee: employeeId });
    const averageRating = ratings.reduce((acc, r) => acc + r.rating, 0) / ratings.length;

    employee.averageRating = parseFloat(averageRating.toFixed(1)); // Store rounded value
    await employee.save();

    return res.status(201).json({ message: "Rating submitted successfully" });
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

// Get Ratings of an Employee
const getEmployeeRatings = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const ratings = await Rating.find({ employee: employeeId }).sort({ createdAt: -1 });

    return res.status(200).json(ratings);
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

module.exports = {
    submitRating,
    getEmployeeRatings
}
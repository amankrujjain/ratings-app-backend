const Rating = require("../model/rating.model");
const User = require("../model/user.model");

// Submit Rating
const submitRating = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { customerName, customerEmail, customerPhone, rating, feedback, latitude, longitude } = req.body;

    // Validate Employee
    const employee = await User.findById(employeeId);
    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    // Validate required fields
    if (!customerName || !customerEmail || !customerPhone || !rating) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Default shop coordinates (could be stored in DB or env vars)
    const shopLatitude = process.env.SHOP_LATITUDE || 12.9716; // Example: latitude of shop
    const shopLongitude = process.env.SHOP_LONGITUDE || 77.5946; // Example: longitude of shop
    const MAX_DISTANCE = 10; // 10 meters

    // Calculate inRange using Haversine formula if coordinates are provided
    let inRange = false;
    if (latitude && longitude) {
      const distance = calculateDistance(
        parseFloat(latitude),
        parseFloat(longitude),
        parseFloat(shopLatitude),
        parseFloat(shopLongitude)
      );
      inRange = distance <= MAX_DISTANCE;
    }

    // Save Rating
    const newRating = new Rating({
      employee: employeeId,
      customerName,
      customerEmail,
      customerPhone,
      rating,
      feedback,
      inRange, // Set based on distance calculation or default false
    });
    await newRating.save();

    // Calculate & Update Employee Average Rating
    const ratings = await Rating.find({ employee: employeeId });
    const averageRating = ratings.reduce((acc, r) => acc + r.rating, 0) / ratings.length;

    employee.averageRating = parseFloat(averageRating.toFixed(1)); // Store rounded value
    await employee.save();

    return res.status(201).json({ message: "Rating submitted successfully" ,range: inRange});
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

// Haversine formula to calculate distance between two points (in meters)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180; // Convert to radians
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

const allRatings = async (req, res) => {
  try {
    const ratings = await Rating.find().sort({ createdAt: -1 }).populate("employee");

    if (ratings.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No ratings available",
      });
    }

    return res.status(200).json({
      success: true,
      data: ratings,
    });
  } catch (error) {
    console.error("Error received while getting ratings:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get Ratings of an Employee
const getEmployeeRatings = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const ratings = await Rating.find({ employee: employeeId }).sort({ createdAt: -1 }).populate("employee");

    return res.status(200).json(ratings);
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

const getEmployeeRatingsID = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const ratings = await Rating.find({ employee: employeeId }).sort({ createdAt: -1 }).populate("employee");

    return res.status(200).json(ratings);
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

const editRating = async (req, res) => {
  try {
    const { ratingId } = req.params;
    const { rating, comment } = req.body;

    const updatedRating = await Rating.findByIdAndUpdate(
      ratingId,
      { rating, comment },
      { new: true, runValidators: true }
    );

    if (!updatedRating) return res.status(404).json({ message: "Rating not found" });

    return res.status(200).json({ message: "Rating updated successfully", updatedRating });
  } catch (error) {
    return res.status(500).json({ message: "Error updating rating", error: error.message });
  }
};

// Delete Rating (Admin Only)
const deleteRating = async (req, res) => {
  try {
    const { ratingId } = req.params;

    const deletedRating = await Rating.findByIdAndDelete(ratingId);
    if (!deletedRating) return res.status(404).json({ message: "Rating not found" });

    return res.status(200).json({ message: "Rating deleted successfully" });
  } catch (error) {
    return res.status(500).json({ message: "Error deleting rating", error: error.message });
  }
};

module.exports = {
    submitRating,
    getEmployeeRatings,
    editRating,
    deleteRating,
    allRatings,
    getEmployeeRatingsID
}
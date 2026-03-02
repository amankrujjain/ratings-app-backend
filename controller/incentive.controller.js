const Rating = require("../model/rating.model");
const User = require("../model/user.model");
/**
 * 💰 Get Monthly Incentive Wallet
 */
const getMonthlyIncentive = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { month, year } = req.query;

    if (!month || !year) {
      return res.status(400).json({
        message: "Month and year are required"
      });
    }

    const loggedInUser = req.user;

    const userRole = loggedInUser.role?.name;
    const loggedInUserId = loggedInUser._id.toString();

    // 🔐 Access Rules
    const isAdmin = userRole === "admin" || userRole === "subadmin";
    const isSelf = loggedInUserId === employeeId;

    if (!isAdmin && !isSelf) {
      return res.status(403).json({
        message: "You are not authorized to view this wallet"
      });
    }

    // ensure target employee is not an admin
    const targetUser = await User.findById(employeeId).populate("role");
    if (!targetUser) {
      return res.status(404).json({ message: "Employee not found" });
    }
    if (targetUser.role?.name === "admin") {
      return res.status(403).json({ message: "Incentives not available for admin users" });
    }

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const ratings = await Rating.find({
      employee: employeeId,
      createdAt: { $gte: startDate, $lte: endDate }
    });

    if (ratings.length === 0) {
      return res.status(200).json({
        totalReviews: 0,
        averageRating: 0,
        incentivePerReview: 0,
        totalIncentive: 0
      });
    }

    const total = ratings.reduce((acc, r) => acc + r.rating, 0);
    const average = total / ratings.length;

    let incentivePerReview = 0;

    if (average >= 4 && average <= 4.5) {
      incentivePerReview = 50;
    } else if (average > 4.5) {
      incentivePerReview = 100;
    }

    const totalIncentive = incentivePerReview * ratings.length;

    return res.status(200).json({
      totalReviews: ratings.length,
      averageRating: parseFloat(average.toFixed(2)),
      incentivePerReview,
      totalIncentive
    });

  } catch (error) {
    return res.status(500).json({
      message: "Error calculating incentive",
      error: error.message
    });
  }
};

const getMonthlyIncentiveSummary = async (req, res) => {
try {
    const { month, year } = req.query;

    if (!month || !year) {
      return res.status(400).json({ message: "Month and year required" });
    }

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    // exclude admin users from summary
    const Role = require("../model/role.model");
    const adminRole = await Role.findOne({ name: "admin" });
    const matchStage = { role: { $exists: true } };
    if (adminRole) {
      matchStage.role = { $ne: adminRole._id };
    }

    const employees = await User.aggregate([
      {
        $match: matchStage,
      },
      {
        $lookup: {
          from: "ratings",
          let: { empId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$employee", "$$empId"] },
                    { $gte: ["$createdAt", startDate] },
                    { $lte: ["$createdAt", endDate] },
                  ],
                },
              },
            },
          ],
          as: "monthlyRatings",
        },
      },
      {
        $addFields: {
          totalReviews: { $size: "$monthlyRatings" },
          averageRating: {
            $cond: [
              { $gt: [{ $size: "$monthlyRatings" }, 0] },
              { $avg: "$monthlyRatings.rating" },
              0,
            ],
          },
        },
      },
      {
        $project: {
          employeeId: "$_id",
          employeeName: "$employeeName",
          totalReviews: 1,
          averageRating: { $round: ["$averageRating", 2] },
        },
      },
    ]);

    const finalData = employees.map((item) => {
      let incentivePerReview = 0;

      if (item.averageRating >= 4 && item.averageRating < 4.5) {
        incentivePerReview = 50;
      } else if (item.averageRating >= 4.5) {
        incentivePerReview = 100;
      }

      return {
        ...item,
        incentivePerReview,
        totalIncentive: item.totalReviews * incentivePerReview,
      };
    });

    res.status(200).json(finalData);

  } catch (error) {
    console.error("Summary Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};


const exportMonthlyIncentive = async (req, res) => {
  try {
    const { month, year } = req.query;

    if (!month || !year) {
      return res.status(400).json({ message: "Month and year required" });
    }

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    // determine admin role id for exclusion
    const Role = require("../model/role.model");
    const adminRole = await Role.findOne({ name: "admin" });

    const matchStage = {};
    if (adminRole) {
      matchStage.role = { $ne: adminRole._id };
    }

    const employees = await User.aggregate([
      { $match: matchStage },
      {
        $lookup: {
          from: "ratings",
          let: { empId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$employee", "$$empId"] },
                    { $gte: ["$createdAt", startDate] },
                    { $lte: ["$createdAt", endDate] },
                  ],
                },
              },
            },
          ],
          as: "monthlyRatings",
        },
      },
      {
        $addFields: {
          totalReviews: { $size: "$monthlyRatings" },
          averageRating: {
            $cond: [
              { $gt: [{ $size: "$monthlyRatings" }, 0] },
              { $avg: "$monthlyRatings.rating" },
              0,
            ],
          },
        },
      },
      {
        $project: {
          employeeName: 1,
          totalReviews: 1,
          averageRating: { $round: ["$averageRating", 2] },
        },
      },
    ]);

    const finalData = employees.map((item) => {
      let incentivePerReview = 0;

      if (item.averageRating >= 4 && item.averageRating < 4.5) {
        incentivePerReview = 50;
      } else if (item.averageRating >= 4.5) {
        incentivePerReview = 100;
      }

      return {
        Employee: item.employeeName,
        "Total Reviews": item.totalReviews,
        "Average Rating": item.averageRating,
        "₹ Per Review": incentivePerReview,
        "Total Incentive": item.totalReviews * incentivePerReview,
      };
    });

    const XLSX = require("xlsx");
    const worksheet = XLSX.utils.json_to_sheet(finalData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Monthly Incentives");

    const buffer = XLSX.write(workbook, {
      type: "buffer",
      bookType: "xlsx",
    });

    res.setHeader(
      "Content-Disposition",
      `attachment; filename=Incentives_${month}_${year}.xlsx`
    );
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    res.send(buffer);

  } catch (error) {
    console.error("Export Error:", error);
    res.status(500).json({ message: "Export failed" });
  }
};

module.exports = { getMonthlyIncentive, getMonthlyIncentiveSummary, exportMonthlyIncentive };
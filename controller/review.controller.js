// const User = require("../model/user.model");

// const redirectToGoogleReview = async (req, res) => {
//   try {
//     const { code } = req.params;

//     const employee = await User.findOne({ reviewCode: code });

//     if (!employee) {
//       return res.status(404).json({ message: "Invalid review code" });
//     }

//     const googleReviewURL =
//       "https://search.google.com/local/writereview?placeid=YOUR_PLACE_ID";

//     return res.redirect(googleReviewURL);

//   } catch (error) {
//     return res.status(500).json({
//       message: "Error redirecting",
//       error: error.message
//     });
//   }
// };

// module.exports = { redirectToGoogleReview };
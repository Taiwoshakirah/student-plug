
// const User = require('../models/signUp')

// const updateFcmToken = async (req, res) => {
//     const { fcmToken } = req.body;
  
//     if (!fcmToken) {
//       return res.status(400).json({ success: false, message: "FCM token is required" });
//     }
  
//     try {
//       const userId = req.user.userId; 
//       const user = await User.findById(userId);
  
//       if (!user) {
//         return res.status(404).json({ success: false, message: "User not found" });
//       }
  
//       user.fcmToken = fcmToken;
//       await user.save();
  
//       return res.json({ success: true, message: "FCM token updated successfully" });
//     } catch (error) {
//       console.error("Error updating FCM token:", error);
//       res.status(500).json({ success: false, message: "Internal server error" });
//     }
//   };
//  module.exports = updateFcmToken  
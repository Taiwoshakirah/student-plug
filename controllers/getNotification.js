const express = require("express");
const router = express.Router();
const { Notification } = require("../models/notification");

// Endpoint to fetch notifications for a user
const fetchNotification = async (req, res) => {
  try {
    const { userId } = req.params;

    // Fetch notifications for the user
    const notifications = await Notification.find({ userId }).sort({
      createdAt: -1, // Sort by newest first
    });

    res.status(200).json(notifications);
  } catch (error) {
    console.error("Error fetching notifications:", error.message);
    res.status(500).json({ message: "Failed to fetch notifications" });
  }
}

module.exports = fetchNotification;

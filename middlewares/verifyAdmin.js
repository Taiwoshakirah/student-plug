const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const SugUser = require("../models/schoolSug");

const verifySugToken = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ message: "No Token Provided" });
    }

    const token = authHeader.split(" ")[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Casting userId to ObjectId
        const userId = mongoose.Types.ObjectId.isValid(decoded.userId)
            ?new mongoose.Types.ObjectId(decoded.userId)
            : decoded.userId;

        const user = await SugUser.findById(userId).select("-password");

        if (!user) {
            return res.status(401).json({ message: "User not found" });
        }

        req.user = {
            userId: user._id,
            role: user.role,
        };

        console.log("Authenticated User:", req.user);
        next();
    } catch (error) {
        if (error.name === "TokenExpiredError") {
            return res.status(401).json({ message: "Token has expired" });
        }
        console.error("Token verification error:", error);
        return res.status(401).json({ message: "Invalid Token" });
    }
};

module.exports = verifySugToken;

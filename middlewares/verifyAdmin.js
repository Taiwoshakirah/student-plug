const jwt = require("jsonwebtoken");
const SugUser = require("../models/schoolSug"); // Adjust the path to your model

const verifySugToken = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ message: "No Token Provided" });
    }

    const token = authHeader.split(" ")[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await SugUser.findById(decoded.userId).select("-password");
        
        if (!user) {
            return res.status(401).json({ message: "User not found" });
        }

        req.user = {
            userId: user._id,
            role: user.role, // Attach the role to req.user
        };

        next();
    } catch (error) {
        console.error("Token verification error:", error);
        return res.status(401).json({ message: "Invalid Token" });
    }
};

module.exports = verifySugToken;

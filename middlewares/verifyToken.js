const jwt = require("jsonwebtoken");

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No Token Provided" });
    }
  
    const token = authHeader.split(" ")[1];
  
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
    //   console.log("Decoded token:", decoded); 
      req.user = { userId: decoded.userId };
      next();
    } catch (error) {
      return res.status(401).json({ message: "Invalid Token" });
    }
  };
  

module.exports = authenticateToken;

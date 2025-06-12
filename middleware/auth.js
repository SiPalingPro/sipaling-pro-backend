const jwt = require("jsonwebtoken")
const User = require("../models/User")

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"]
    const token = authHeader && authHeader.split(" ")[1]

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Access token required",
      })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    const user = await User.findById(decoded.userId)

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: "Invalid token or user not found",
      })
    }

    req.user = user
    next()
  } catch (error) {
    console.error("Authentication error:", error)
    return res.status(401).json({
      success: false,
      message: "Invalid token",
    })
  }
}

const requirePremium = (req, res, next) => {
  if (!req.user.isPremium) {
    return res.status(403).json({
      success: false,
      message: "Premium account required",
    })
  }
  next()
}

module.exports = {
  authenticateToken,
  requirePremium,
}

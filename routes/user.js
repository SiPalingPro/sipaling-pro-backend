const express = require("express")
const { body, validationResult } = require("express-validator")
const User = require("../models/User")
const Stream = require("../models/Stream")

const router = express.Router()

// Get user profile
router.get("/profile", async (req, res) => {
  try {
    const userId = req.user.userId
    const user = await User.findById(userId).select("-password")

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      })
    }

    // Get user statistics
    const totalStreams = await Stream.countDocuments({ userId, isActive: true })
    const liveStreams = await Stream.countDocuments({ userId, status: "live" })

    res.json({
      success: true,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        isPremium: user.isPremium,
        premiumExpiry: user.premiumExpiry,
        streamCount: user.streamCount,
        maxStreams: user.maxStreams,
        maxResolution: user.maxResolution,
        lastLogin: user.lastLogin,
        createdAt: user.createdAt,
      },
      stats: {
        totalStreams,
        liveStreams,
        remainingStreams: user.maxStreams - user.streamCount,
      },
    })
  } catch (error) {
    console.error("Get profile error:", error)
    res.status(500).json({
      success: false,
      message: "Internal server error",
    })
  }
})

// Update user profile
router.put(
  "/profile",
  [
    body("username")
      .optional()
      .isLength({ min: 3, max: 30 })
      .withMessage("Username must be between 3 and 30 characters")
      .matches(/^[a-zA-Z0-9_]+$/)
      .withMessage("Username can only contain letters, numbers, and underscores"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
        })
      }

      const userId = req.user.userId
      const { username } = req.body

      const user = await User.findById(userId)
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        })
      }

      // Check if username is already taken
      if (username && username !== user.username) {
        const existingUser = await User.findOne({ username })
        if (existingUser) {
          return res.status(400).json({
            success: false,
            message: "Username already taken",
          })
        }
        user.username = username
      }

      await user.save()

      res.json({
        success: true,
        message: "Profile updated successfully",
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          avatar: user.avatar,
          isPremium: user.isPremium,
        },
      })
    } catch (error) {
      console.error("Update profile error:", error)
      res.status(500).json({
        success: false,
        message: "Internal server error",
      })
    }
  },
)

// Get user dashboard stats
router.get("/dashboard", async (req, res) => {
  try {
    const userId = req.user.userId

    // Get recent streams
    const recentStreams = await Stream.find({ userId, isActive: true })
      .sort({ createdAt: -1 })
      .limit(5)
      .select("title status startTime endTime stats createdAt")

    // Get stream statistics
    const streamStats = await Stream.aggregate([
      { $match: { userId: userId, isActive: true } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ])

    const stats = {
      total: 0,
      live: 0,
      stopped: 0,
      error: 0,
    }

    streamStats.forEach((stat) => {
      stats[stat._id] = stat.count
      stats.total += stat.count
    })

    res.json({
      success: true,
      dashboard: {
        recentStreams,
        stats,
        user: {
          streamCount: req.user.streamCount,
          maxStreams: req.user.maxStreams,
          remainingStreams: req.user.maxStreams - req.user.streamCount,
          isPremium: req.user.isPremium,
        },
      },
    })
  } catch (error) {
    console.error("Get dashboard error:", error)
    res.status(500).json({
      success: false,
      message: "Internal server error",
    })
  }
})

module.exports = router

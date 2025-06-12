const express = require("express")
const { body, validationResult } = require("express-validator")
const Stream = require("../models/Stream")
const StreamManager = require("../services/StreamManager")

const router = express.Router()

// Get stream manager instance (will be injected by server.js)
let streamManager

// Set stream manager
router.setStreamManager = (manager) => {
  streamManager = manager
}

// Create new stream configuration
router.post(
  "/create",
  [
    body("title").isLength({ min: 1, max: 100 }).withMessage("Title must be between 1 and 100 characters"),
    body("rtmpServer").isIn(["youtube", "facebook"]).withMessage("RTMP server must be youtube or facebook"),
    body("streamKey").notEmpty().withMessage("Stream key is required"),
    body("resolution")
      .isIn(["144p", "240p", "360p", "480p", "720p", "1080p", "2K", "4K"])
      .withMessage("Invalid resolution"),
    body("liveMode").isIn(["portrait", "landscape"]).withMessage("Live mode must be portrait or landscape"),
    body("autoLoop").isBoolean().withMessage("Auto loop must be boolean"),
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

      const { title, rtmpServer, streamKey, resolution, liveMode, autoLoop } = req.body
      const userId = req.user.userId

      // Check if user can create stream
      const user = req.user
      if (!user.canCreateStream()) {
        return res.status(403).json({
          success: false,
          message: "Maximum stream limit reached",
        })
      }

      // Check if resolution is allowed
      if (!user.isResolutionAllowed(resolution)) {
        return res.status(403).json({
          success: false,
          message: "Resolution not allowed for your account type",
        })
      }

      // Create stream
      const stream = new Stream({
        userId,
        title,
        rtmpServer,
        streamKey,
        resolution,
        liveMode,
        autoLoop,
      })

      await stream.save()

      res.status(201).json({
        success: true,
        message: "Stream configuration created successfully",
        stream: {
          id: stream._id,
          title: stream.title,
          rtmpServer: stream.rtmpServer,
          resolution: stream.resolution,
          liveMode: stream.liveMode,
          autoLoop: stream.autoLoop,
          status: stream.status,
        },
      })
    } catch (error) {
      console.error("Create stream error:", error)
      res.status(500).json({
        success: false,
        message: "Internal server error",
      })
    }
  },
)

// Update stream configuration
router.put(
  "/:streamId",
  [
    body("title").optional().isLength({ min: 1, max: 100 }).withMessage("Title must be between 1 and 100 characters"),
    body("rtmpServer").optional().isIn(["youtube", "facebook"]).withMessage("RTMP server must be youtube or facebook"),
    body("streamKey").optional().notEmpty().withMessage("Stream key cannot be empty"),
    body("resolution")
      .optional()
      .isIn(["144p", "240p", "360p", "480p", "720p", "1080p", "2K", "4K"])
      .withMessage("Invalid resolution"),
    body("liveMode").optional().isIn(["portrait", "landscape"]).withMessage("Live mode must be portrait or landscape"),
    body("autoLoop").optional().isBoolean().withMessage("Auto loop must be boolean"),
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

      const { streamId } = req.params
      const userId = req.user.userId
      const updates = req.body

      // Find stream
      const stream = await Stream.findOne({ _id: streamId, userId })
      if (!stream) {
        return res.status(404).json({
          success: false,
          message: "Stream not found",
        })
      }

      // Check if stream is currently live
      if (stream.status === "live") {
        return res.status(400).json({
          success: false,
          message: "Cannot update configuration while stream is live",
        })
      }

      // Check resolution permission if being updated
      if (updates.resolution && !req.user.isResolutionAllowed(updates.resolution)) {
        return res.status(403).json({
          success: false,
          message: "Resolution not allowed for your account type",
        })
      }

      // Update stream
      Object.assign(stream, updates)
      await stream.save()

      res.json({
        success: true,
        message: "Stream configuration updated successfully",
        stream: {
          id: stream._id,
          title: stream.title,
          rtmpServer: stream.rtmpServer,
          resolution: stream.resolution,
          liveMode: stream.liveMode,
          autoLoop: stream.autoLoop,
          status: stream.status,
        },
      })
    } catch (error) {
      console.error("Update stream error:", error)
      res.status(500).json({
        success: false,
        message: "Internal server error",
      })
    }
  },
)

// Start stream
router.post("/:streamId/start", async (req, res) => {
  try {
    const { streamId } = req.params
    const userId = req.user.userId

    const result = await streamManager.startStream(streamId, userId)

    res.json(result)
  } catch (error) {
    console.error("Start stream error:", error)
    res.status(400).json({
      success: false,
      message: error.message,
    })
  }
})

// Stop stream
router.post("/:streamId/stop", async (req, res) => {
  try {
    const { streamId } = req.params
    const userId = req.user.userId

    const result = await streamManager.stopStream(streamId, userId)

    res.json(result)
  } catch (error) {
    console.error("Stop stream error:", error)
    res.status(400).json({
      success: false,
      message: error.message,
    })
  }
})

// Schedule stream stop
router.post(
  "/:streamId/schedule-stop",
  [body("stopTime").isISO8601().withMessage("Stop time must be a valid ISO 8601 date")],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
        })
      }

      const { streamId } = req.params
      const { stopTime } = req.body
      const userId = req.user.userId

      const result = await streamManager.scheduleStop(streamId, userId, stopTime)

      res.json(result)
    } catch (error) {
      console.error("Schedule stop error:", error)
      res.status(400).json({
        success: false,
        message: error.message,
      })
    }
  },
)

// Get stream status
router.get("/:streamId/status", async (req, res) => {
  try {
    const { streamId } = req.params
    const userId = req.user.userId

    const status = await streamManager.getStreamStatus(streamId, userId)

    res.json({
      success: true,
      status,
    })
  } catch (error) {
    console.error("Get stream status error:", error)
    res.status(400).json({
      success: false,
      message: error.message,
    })
  }
})

// Get user streams
router.get("/", async (req, res) => {
  try {
    const userId = req.user.userId
    const { page = 1, limit = 10, status } = req.query

    const query = { userId, isActive: true }
    if (status) {
      query.status = status
    }

    const streams = await Stream.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .select("-logs") // Exclude logs for list view

    const total = await Stream.countDocuments(query)

    res.json({
      success: true,
      streams: streams.map((stream) => ({
        id: stream._id,
        title: stream.title,
        rtmpServer: stream.rtmpServer,
        resolution: stream.resolution,
        liveMode: stream.liveMode,
        autoLoop: stream.autoLoop,
        status: stream.status,
        startTime: stream.startTime,
        endTime: stream.endTime,
        stats: stream.stats,
        createdAt: stream.createdAt,
      })),
      pagination: {
        page: Number.parseInt(page),
        limit: Number.parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error("Get streams error:", error)
    res.status(500).json({
      success: false,
      message: "Internal server error",
    })
  }
})

// Delete stream
router.delete("/:streamId", async (req, res) => {
  try {
    const { streamId } = req.params
    const userId = req.user.userId

    const stream = await Stream.findOne({ _id: streamId, userId })
    if (!stream) {
      return res.status(404).json({
        success: false,
        message: "Stream not found",
      })
    }

    // Check if stream is currently live
    if (stream.status === "live") {
      return res.status(400).json({
        success: false,
        message: "Cannot delete stream while it is live",
      })
    }

    // Soft delete
    stream.isActive = false
    await stream.save()

    res.json({
      success: true,
      message: "Stream deleted successfully",
    })
  } catch (error) {
    console.error("Delete stream error:", error)
    res.status(500).json({
      success: false,
      message: "Internal server error",
    })
  }
})

module.exports = router

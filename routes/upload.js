const express = require("express")
const multer = require("multer")
const path = require("path")
const fs = require("fs").promises
const { v4: uuidv4 } = require("uuid")
const Stream = require("../models/Stream")

const router = express.Router()

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, "..", "uploads", "videos")
    try {
      await fs.mkdir(uploadDir, { recursive: true })
      cb(null, uploadDir)
    } catch (error) {
      cb(error)
    }
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}-${Date.now()}${path.extname(file.originalname)}`
    cb(null, uniqueName)
  },
})

const fileFilter = (req, file, cb) => {
  // Check file type
  const allowedTypes = /mp4|avi|mov|wmv|flv|webm|mkv/
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase())
  const mimetype = allowedTypes.test(file.mimetype)

  if (mimetype && extname) {
    return cb(null, true)
  } else {
    cb(new Error("Only video files are allowed"))
  }
}

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 200 * 1024 * 1024, // 200MB
  },
  fileFilter: fileFilter,
})

// Upload video endpoint
router.post("/video", upload.single("video"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No video file uploaded",
      })
    }

    const { streamId } = req.body
    const userId = req.user.userId

    // Validate stream ID if provided
    let stream = null
    if (streamId) {
      stream = await Stream.findOne({ _id: streamId, userId })
      if (!stream) {
        // Clean up uploaded file
        await fs.unlink(req.file.path)
        return res.status(404).json({
          success: false,
          message: "Stream not found",
        })
      }

      // Check if stream is currently live
      if (stream.status === "live") {
        // Clean up uploaded file
        await fs.unlink(req.file.path)
        return res.status(400).json({
          success: false,
          message: "Cannot upload video while stream is live",
        })
      }

      // Remove old video file if exists
      if (stream.videoFile && stream.videoFile.path) {
        try {
          await fs.unlink(stream.videoFile.path)
        } catch (error) {
          console.warn("Failed to delete old video file:", error)
        }
      }

      // Update stream with new video file
      stream.videoFile = {
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size,
        path: req.file.path,
        mimetype: req.file.mimetype,
      }

      await stream.save()
    }

    res.json({
      success: true,
      message: "Video uploaded successfully",
      file: {
        id: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
      },
      streamId: stream ? stream._id : null,
    })
  } catch (error) {
    console.error("Video upload error:", error)

    // Clean up uploaded file on error
    if (req.file) {
      try {
        await fs.unlink(req.file.path)
      } catch (unlinkError) {
        console.error("Failed to clean up uploaded file:", unlinkError)
      }
    }

    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message: "File size exceeds 200MB limit",
      })
    }

    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    })
  }
})

// Delete video endpoint
router.delete("/video/:streamId", async (req, res) => {
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
        message: "Cannot delete video while stream is live",
      })
    }

    // Delete video file
    if (stream.videoFile && stream.videoFile.path) {
      try {
        await fs.unlink(stream.videoFile.path)
      } catch (error) {
        console.warn("Failed to delete video file:", error)
      }
    }

    // Remove video file reference from stream
    stream.videoFile = undefined
    await stream.save()

    res.json({
      success: true,
      message: "Video deleted successfully",
    })
  } catch (error) {
    console.error("Delete video error:", error)
    res.status(500).json({
      success: false,
      message: "Internal server error",
    })
  }
})

// Get video info endpoint
router.get("/video/:streamId", async (req, res) => {
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

    if (!stream.videoFile) {
      return res.status(404).json({
        success: false,
        message: "No video file found for this stream",
      })
    }

    res.json({
      success: true,
      video: {
        filename: stream.videoFile.filename,
        originalName: stream.videoFile.originalName,
        size: stream.videoFile.size,
        mimetype: stream.videoFile.mimetype,
        uploadedAt: stream.updatedAt,
      },
    })
  } catch (error) {
    console.error("Get video info error:", error)
    res.status(500).json({
      success: false,
      message: "Internal server error",
    })
  }
})

module.exports = router

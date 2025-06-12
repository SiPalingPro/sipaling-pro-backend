const mongoose = require("mongoose")

const streamSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    videoFile: {
      filename: String,
      originalName: String,
      size: Number,
      path: String,
      mimetype: String,
    },
    rtmpServer: {
      type: String,
      enum: ["youtube", "facebook"],
      required: true,
    },
    streamKey: {
      type: String,
      required: true,
    },
    resolution: {
      type: String,
      enum: ["144p", "240p", "360p", "480p", "720p", "1080p", "2K", "4K"],
      default: "720p",
    },
    liveMode: {
      type: String,
      enum: ["portrait", "landscape"],
      default: "landscape",
    },
    autoLoop: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ["idle", "starting", "live", "stopping", "stopped", "error"],
      default: "idle",
    },
    ffmpegPid: {
      type: Number,
    },
    startTime: {
      type: Date,
    },
    endTime: {
      type: Date,
    },
    scheduledStopTime: {
      type: Date,
    },
    logs: [
      {
        timestamp: { type: Date, default: Date.now },
        level: { type: String, enum: ["info", "warn", "error"] },
        message: String,
      },
    ],
    stats: {
      duration: { type: Number, default: 0 },
      bitrate: String,
      fps: String,
      viewers: { type: Number, default: 0 },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
)

// Index for efficient queries
streamSchema.index({ userId: 1, status: 1 })
streamSchema.index({ status: 1 })

// Add log entry
streamSchema.methods.addLog = function (level, message) {
  this.logs.push({ level, message })
  if (this.logs.length > 100) {
    this.logs = this.logs.slice(-100) // Keep only last 100 logs
  }
  return this.save()
}

// Get RTMP URL based on server
streamSchema.methods.getRtmpUrl = function () {
  const rtmpUrls = {
    youtube: "rtmp://a.rtmp.youtube.com/live2",
    facebook: "rtmps://live-api-s.facebook.com:443/rtmp",
  }
  return rtmpUrls[this.rtmpServer]
}

// Get FFmpeg command arguments
streamSchema.methods.getFFmpegArgs = function () {
  const rtmpUrl = `${this.getRtmpUrl()}/${this.streamKey}`

  const baseArgs = [
    "-re",
    "-i",
    this.videoFile.path,
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-maxrate",
    "3000k",
    "-bufsize",
    "6000k",
    "-pix_fmt",
    "yuv420p",
    "-g",
    "50",
    "-c:a",
    "aac",
    "-b:a",
    "160k",
    "-ac",
    "2",
    "-ar",
    "44100",
  ]

  // Add resolution-specific settings
  const resolutionSettings = {
    "144p": ["-s", "256x144", "-b:v", "200k"],
    "240p": ["-s", "426x240", "-b:v", "400k"],
    "360p": ["-s", "640x360", "-b:v", "800k"],
    "480p": ["-s", "854x480", "-b:v", "1200k"],
    "720p": ["-s", "1280x720", "-b:v", "2500k"],
    "1080p": ["-s", "1920x1080", "-b:v", "4500k"],
    "2K": ["-s", "2560x1440", "-b:v", "8000k"],
    "4K": ["-s", "3840x2160", "-b:v", "15000k"],
  }

  if (resolutionSettings[this.resolution]) {
    baseArgs.push(...resolutionSettings[this.resolution])
  }

  // Add orientation filter for portrait mode
  if (this.liveMode === "portrait") {
    baseArgs.push("-vf", "transpose=1")
  }

  // Add loop option
  if (this.autoLoop) {
    baseArgs.unshift("-stream_loop", "-1")
  }

  baseArgs.push("-f", "flv", rtmpUrl)

  return baseArgs
}

module.exports = mongoose.model("Stream", streamSchema)

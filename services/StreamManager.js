const ffmpeg = require("fluent-ffmpeg")
const { spawn } = require("child_process")
const Stream = require("../models/Stream")
const User = require("../models/User")
const path = require("path")

class StreamManager {
  constructor(io) {
    this.io = io
    this.activeStreams = new Map()
    this.scheduledStops = new Map()

    // Set FFmpeg paths
    if (process.env.FFMPEG_PATH) {
      ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH)
    }
    if (process.env.FFPROBE_PATH) {
      ffmpeg.setFfprobePath(process.env.FFPROBE_PATH)
    }
  }

  async startStream(streamId, userId) {
    try {
      const stream = await Stream.findById(streamId).populate("userId")
      if (!stream || stream.userId._id.toString() !== userId) {
        throw new Error("Stream not found or unauthorized")
      }

      // Check if user can create stream
      if (!stream.userId.canCreateStream()) {
        throw new Error("Maximum stream limit reached")
      }

      // Check if resolution is allowed
      if (!stream.userId.isResolutionAllowed(stream.resolution)) {
        throw new Error("Resolution not allowed for your account type")
      }

      // Update stream status
      stream.status = "starting"
      stream.startTime = new Date()
      await stream.save()

      // Get FFmpeg arguments
      const args = stream.getFFmpegArgs()

      // Start FFmpeg process
      const ffmpegProcess = spawn("ffmpeg", args)

      // Store process reference
      this.activeStreams.set(streamId, {
        process: ffmpegProcess,
        stream: stream,
        startTime: Date.now(),
      })

      // Update stream with process ID
      stream.ffmpegPid = ffmpegProcess.pid
      stream.status = "live"
      await stream.save()
      await stream.addLog("info", "Stream started successfully")

      // Increment user stream count
      await stream.userId.incrementStreamCount()

      // Handle process events
      ffmpegProcess.stdout.on("data", (data) => {
        const output = data.toString()
        this.handleFFmpegOutput(streamId, output)
      })

      ffmpegProcess.stderr.on("data", (data) => {
        const output = data.toString()
        this.handleFFmpegError(streamId, output)
      })

      ffmpegProcess.on("close", (code) => {
        this.handleStreamEnd(streamId, code)
      })

      // Emit status update
      this.io.to(`stream-${streamId}`).emit("stream-status", {
        streamId,
        status: "live",
        message: "Stream started successfully",
      })

      return { success: true, message: "Stream started successfully" }
    } catch (error) {
      console.error("Error starting stream:", error)

      // Update stream status to error
      const stream = await Stream.findById(streamId)
      if (stream) {
        stream.status = "error"
        await stream.save()
        await stream.addLog("error", `Failed to start stream: ${error.message}`)
      }

      throw error
    }
  }

  async stopStream(streamId, userId) {
    try {
      const stream = await Stream.findById(streamId).populate("userId")
      if (!stream || stream.userId._id.toString() !== userId) {
        throw new Error("Stream not found or unauthorized")
      }

      const activeStream = this.activeStreams.get(streamId)
      if (!activeStream) {
        throw new Error("Stream is not currently active")
      }

      // Kill FFmpeg process
      if (activeStream.process && !activeStream.process.killed) {
        activeStream.process.kill("SIGTERM")
      }

      // Update stream status
      stream.status = "stopping"
      await stream.save()
      await stream.addLog("info", "Stream stop requested")

      // Clean up scheduled stop if exists
      if (this.scheduledStops.has(streamId)) {
        clearTimeout(this.scheduledStops.get(streamId))
        this.scheduledStops.delete(streamId)
      }

      return { success: true, message: "Stream stop initiated" }
    } catch (error) {
      console.error("Error stopping stream:", error)
      throw error
    }
  }

  async scheduleStop(streamId, userId, stopTime) {
    try {
      const stream = await Stream.findById(streamId)
      if (!stream || stream.userId.toString() !== userId) {
        throw new Error("Stream not found or unauthorized")
      }

      const delay = new Date(stopTime).getTime() - Date.now()
      if (delay <= 0) {
        throw new Error("Stop time must be in the future")
      }

      // Clear existing scheduled stop
      if (this.scheduledStops.has(streamId)) {
        clearTimeout(this.scheduledStops.get(streamId))
      }

      // Schedule new stop
      const timeoutId = setTimeout(() => {
        this.stopStream(streamId, userId)
        this.scheduledStops.delete(streamId)
      }, delay)

      this.scheduledStops.set(streamId, timeoutId)

      // Update stream
      stream.scheduledStopTime = new Date(stopTime)
      await stream.save()
      await stream.addLog("info", `Stream scheduled to stop at ${new Date(stopTime).toISOString()}`)

      return { success: true, message: "Stream stop scheduled successfully" }
    } catch (error) {
      console.error("Error scheduling stream stop:", error)
      throw error
    }
  }

  async getStreamStatus(streamId, userId) {
    try {
      const stream = await Stream.findById(streamId).populate("userId")
      if (!stream || stream.userId._id.toString() !== userId) {
        throw new Error("Stream not found or unauthorized")
      }

      const activeStream = this.activeStreams.get(streamId)
      const isActive = activeStream && !activeStream.process.killed

      return {
        streamId,
        status: stream.status,
        isActive,
        startTime: stream.startTime,
        scheduledStopTime: stream.scheduledStopTime,
        stats: stream.stats,
        logs: stream.logs.slice(-10), // Last 10 logs
      }
    } catch (error) {
      console.error("Error getting stream status:", error)
      throw error
    }
  }

  handleFFmpegOutput(streamId, output) {
    // Parse FFmpeg output for statistics
    const bitrateMatch = output.match(/bitrate=\s*([^\s]+)/)
    const fpsMatch = output.match(/fps=\s*([^\s]+)/)
    const timeMatch = output.match(/time=([^\s]+)/)

    if (bitrateMatch || fpsMatch || timeMatch) {
      this.updateStreamStats(streamId, {
        bitrate: bitrateMatch ? bitrateMatch[1] : null,
        fps: fpsMatch ? fpsMatch[1] : null,
        time: timeMatch ? timeMatch[1] : null,
      })
    }

    // Emit real-time output
    this.io.to(`stream-${streamId}`).emit("stream-output", {
      streamId,
      type: "stdout",
      data: output,
    })
  }

  handleFFmpegError(streamId, output) {
    console.error(`FFmpeg error for stream ${streamId}:`, output)

    // Emit error output
    this.io.to(`stream-${streamId}`).emit("stream-output", {
      streamId,
      type: "stderr",
      data: output,
    })
  }

  async handleStreamEnd(streamId, code) {
    try {
      const activeStream = this.activeStreams.get(streamId)
      if (!activeStream) return

      const stream = activeStream.stream

      // Calculate duration
      const duration = Date.now() - activeStream.startTime

      // Update stream
      stream.status = code === 0 ? "stopped" : "error"
      stream.endTime = new Date()
      stream.stats.duration = Math.floor(duration / 1000)
      stream.ffmpegPid = null

      await stream.save()
      await stream.addLog("info", `Stream ended with code ${code}`)

      // Decrement user stream count
      const user = await User.findById(stream.userId)
      if (user) {
        await user.decrementStreamCount()
      }

      // Clean up
      this.activeStreams.delete(streamId)
      if (this.scheduledStops.has(streamId)) {
        clearTimeout(this.scheduledStops.get(streamId))
        this.scheduledStops.delete(streamId)
      }

      // Emit status update
      this.io.to(`stream-${streamId}`).emit("stream-status", {
        streamId,
        status: stream.status,
        message: `Stream ended with code ${code}`,
        duration: stream.stats.duration,
      })
    } catch (error) {
      console.error("Error handling stream end:", error)
    }
  }

  async updateStreamStats(streamId, stats) {
    try {
      const stream = await Stream.findById(streamId)
      if (!stream) return

      if (stats.bitrate) stream.stats.bitrate = stats.bitrate
      if (stats.fps) stream.stats.fps = stats.fps

      await stream.save()

      // Emit stats update
      this.io.to(`stream-${streamId}`).emit("stream-stats", {
        streamId,
        stats: stream.stats,
      })
    } catch (error) {
      console.error("Error updating stream stats:", error)
    }
  }

  // Clean up all streams on server shutdown
  async cleanup() {
    for (const [streamId, activeStream] of this.activeStreams) {
      if (activeStream.process && !activeStream.process.killed) {
        activeStream.process.kill("SIGTERM")
      }
    }
    this.activeStreams.clear()

    for (const timeoutId of this.scheduledStops.values()) {
      clearTimeout(timeoutId)
    }
    this.scheduledStops.clear()
  }
}

module.exports = StreamManager

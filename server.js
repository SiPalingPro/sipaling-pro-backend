const express = require("express")
const mongoose = require("mongoose")
const cors = require("cors")
const helmet = require("helmet")
const compression = require("compression")
const morgan = require("morgan")
const rateLimit = require("express-rate-limit")
const { createServer } = require("http")
const { Server } = require("socket.io")
const path = require("path")
require("dotenv").config()

// Import routes
const authRoutes = require("./routes/auth")
const userRoutes = require("./routes/user")
const streamRoutes = require("./routes/stream")
const uploadRoutes = require("./routes/upload")

// Import middleware
const { authenticateToken } = require("./middleware/auth")
const { errorHandler } = require("./middleware/errorHandler")

// Import services
const StreamManager = require("./services/StreamManager")
const SecurityService = require("./services/SecurityService")

const app = express()
const server = createServer(app)
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
  },
})

// Initialize services
const streamManager = new StreamManager(io)
const securityService = new SecurityService()

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:"],
        scriptSrc: ["'self'", "https://www.google.com", "https://www.gstatic.com"],
      },
    },
  }),
)

app.use(compression())
app.use(morgan("combined"))

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
})
app.use(limiter)

// Stricter rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: "Too many authentication attempts, please try again later.",
})

// CORS configuration
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  }),
)

app.use(express.json({ limit: "210mb" }))
app.use(express.urlencoded({ extended: true, limit: "210mb" }))

// Serve static files
app.use("/uploads", express.static(path.join(__dirname, "uploads")))
app.use(express.static(path.join(__dirname, "public")))

// Database connection
mongoose
  .connect(process.env.MONGODB_URI || "mongodb://localhost:27017/sipaling-pro", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => console.error("❌ MongoDB connection error:", err))

// Routes
app.use("/api/auth", authLimiter, authRoutes)
app.use("/api/user", authenticateToken, userRoutes)
app.use("/api/stream", authenticateToken, streamRoutes)
app.use("/api/upload", authenticateToken, uploadRoutes)

// Landing page route
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"))
})

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  })
})

// Socket.io connection handling
io.on("connection", (socket) => {
  console.log("User connected:", socket.id)

  socket.on("join-stream", (streamId) => {
    socket.join(`stream-${streamId}`)
  })

  socket.on("leave-stream", (streamId) => {
    socket.leave(`stream-${streamId}`)
  })

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id)
  })
})

// Error handling middleware
app.use(errorHandler)

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({ error: "Route not found" })
})

const PORT = process.env.PORT || 5000

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`)
  console.log(`📱 Frontend URL: ${process.env.FRONTEND_URL || "http://localhost:3000"}`)
  console.log(`🔗 API Base URL: http://localhost:${PORT}/api`)
})

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully")
  server.close(() => {
    mongoose.connection.close()
    process.exit(0)
  })
})

module.exports = app

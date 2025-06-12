const mongoose = require("mongoose")
const bcrypt = require("bcryptjs")

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 30,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      validate: {
        validator: (email) => /^[a-zA-Z0-9._%+-]+@gmail\.com$/.test(email),
        message: "Only Gmail addresses are allowed",
      },
    },
    password: {
      type: String,
      minlength: 6,
    },
    googleId: {
      type: String,
      sparse: true,
    },
    avatar: {
      type: String,
      default: "",
    },
    isPremium: {
      type: Boolean,
      default: false,
    },
    premiumExpiry: {
      type: Date,
    },
    streamCount: {
      type: Number,
      default: 0,
    },
    maxStreams: {
      type: Number,
      default: 3,
    },
    maxResolution: {
      type: String,
      default: "720p",
    },
    deviceFingerprints: [
      {
        fingerprint: String,
        ipAddress: String,
        userAgent: String,
        createdAt: { type: Date, default: Date.now },
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLogin: {
      type: Date,
      default: Date.now,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
)

// Hash password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next()

  try {
    const salt = await bcrypt.genSalt(12)
    this.password = await bcrypt.hash(this.password, salt)
    next()
  } catch (error) {
    next(error)
  }
})

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password)
}

// Check if user can create new stream
userSchema.methods.canCreateStream = function () {
  return this.streamCount < this.maxStreams
}

// Increment stream count
userSchema.methods.incrementStreamCount = function () {
  this.streamCount += 1
  return this.save()
}

// Decrement stream count
userSchema.methods.decrementStreamCount = function () {
  if (this.streamCount > 0) {
    this.streamCount -= 1
  }
  return this.save()
}

// Check if resolution is allowed
userSchema.methods.isResolutionAllowed = function (resolution) {
  if (this.isPremium) return true

  const allowedResolutions = ["144p", "240p", "360p", "480p", "720p"]
  return allowedResolutions.includes(resolution)
}

module.exports = mongoose.model("User", userSchema)

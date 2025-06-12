const express = require("express")
const jwt = require("jsonwebtoken")
const passport = require("passport")
const { body, validationResult } = require("express-validator")
const User = require("../models/User")
const SecurityService = require("../services/SecurityService")

const router = express.Router()
const securityService = new SecurityService()

// Configure Google OAuth
const GoogleStrategy = require("passport-google-oauth20").Strategy

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "/api/auth/google/callback",
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Check if user already exists
        let user = await User.findOne({ googleId: profile.id })

        if (user) {
          return done(null, user)
        }

        // Check if email already exists
        user = await User.findOne({ email: profile.emails[0].value })
        if (user) {
          // Link Google account to existing user
          user.googleId = profile.id
          await user.save()
          return done(null, user)
        }

        // Validate Gmail domain
        const email = profile.emails[0].value
        if (!email.endsWith("@gmail.com")) {
          return done(new Error("Only Gmail accounts are allowed"), null)
        }

        // Create new user
        user = new User({
          googleId: profile.id,
          username: profile.displayName.replace(/\s+/g, "").toLowerCase(),
          email: email,
          avatar: profile.photos[0].value,
        })

        await user.save()
        done(null, user)
      } catch (error) {
        done(error, null)
      }
    },
  ),
)

// Register endpoint
router.post(
  "/register",
  [
    body("username")
      .isLength({ min: 3, max: 30 })
      .withMessage("Username must be between 3 and 30 characters")
      .matches(/^[a-zA-Z0-9_]+$/)
      .withMessage("Username can only contain letters, numbers, and underscores"),
    body("email")
      .isEmail()
      .withMessage("Please provide a valid email")
      .custom((value) => {
        if (!value.endsWith("@gmail.com")) {
          throw new Error("Only Gmail addresses are allowed")
        }
        return true
      }),
    body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters long"),
    body("confirmPassword").custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error("Password confirmation does not match password")
      }
      return true
    }),
    body("recaptchaToken").notEmpty().withMessage("reCAPTCHA verification required"),
  ],
  async (req, res) => {
    try {
      // Validate input
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
        })
      }

      const { username, email, password, recaptchaToken } = req.body

      // Verify reCAPTCHA
      const recaptchaValid = await securityService.validateRecaptcha(recaptchaToken)
      if (!recaptchaValid) {
        return res.status(400).json({
          success: false,
          message: "reCAPTCHA verification failed",
        })
      }

      // Perform security checks
      const securityCheck = await securityService.performSecurityCheck(req, email)
      if (!securityCheck.allowed) {
        return res.status(403).json({
          success: false,
          message: "Registration blocked",
          reason: securityCheck.reason,
        })
      }

      // Check if user already exists
      const existingUser = await User.findOne({
        $or: [{ email }, { username }],
      })

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "User with this email or username already exists",
        })
      }

      // Create new user
      const user = new User({
        username,
        email,
        password,
      })

      await user.save()

      // Add device fingerprint
      await securityService.addDeviceFingerprint(user._id, req)

      // Generate JWT token
      const token = jwt.sign({ userId: user._id, email: user.email }, process.env.JWT_SECRET, { expiresIn: "7d" })

      res.status(201).json({
        success: true,
        message: "User registered successfully",
        token,
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          isPremium: user.isPremium,
          streamCount: user.streamCount,
          maxStreams: user.maxStreams,
        },
      })
    } catch (error) {
      console.error("Registration error:", error)
      res.status(500).json({
        success: false,
        message: "Internal server error",
      })
    }
  },
)

// Login endpoint
router.post(
  "/login",
  [
    body("email").isEmail().withMessage("Please provide a valid email"),
    body("password").notEmpty().withMessage("Password is required"),
    body("recaptchaToken").notEmpty().withMessage("reCAPTCHA verification required"),
  ],
  async (req, res) => {
    try {
      // Validate input
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
        })
      }

      const { email, password, recaptchaToken } = req.body

      // Verify reCAPTCHA
      const recaptchaValid = await securityService.validateRecaptcha(recaptchaToken)
      if (!recaptchaValid) {
        return res.status(400).json({
          success: false,
          message: "reCAPTCHA verification failed",
        })
      }

      // Perform security checks (without email check for login)
      const securityCheck = await securityService.performSecurityCheck(req)
      if (!securityCheck.allowed) {
        return res.status(403).json({
          success: false,
          message: "Login blocked",
          reason: securityCheck.reason,
        })
      }

      // Find user
      const user = await User.findOne({ email })
      if (!user) {
        return res.status(401).json({
          success: false,
          message: "Invalid email or password",
        })
      }

      // Check password
      const isPasswordValid = await user.comparePassword(password)
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: "Invalid email or password",
        })
      }

      // Check if account is active
      if (!user.isActive) {
        return res.status(403).json({
          success: false,
          message: "Account is deactivated",
        })
      }

      // Update last login
      user.lastLogin = new Date()
      await user.save()

      // Add device fingerprint
      await securityService.addDeviceFingerprint(user._id, req)

      // Generate JWT token
      const token = jwt.sign({ userId: user._id, email: user.email }, process.env.JWT_SECRET, { expiresIn: "7d" })

      res.json({
        success: true,
        message: "Login successful",
        token,
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          isPremium: user.isPremium,
          streamCount: user.streamCount,
          maxStreams: user.maxStreams,
          avatar: user.avatar,
        },
      })
    } catch (error) {
      console.error("Login error:", error)
      res.status(500).json({
        success: false,
        message: "Internal server error",
      })
    }
  },
)

// Google OAuth routes
router.get("/google", passport.authenticate("google", { scope: ["profile", "email"] }))

router.get("/google/callback", passport.authenticate("google", { session: false }), async (req, res) => {
  try {
    const user = req.user

    // Perform security checks
    const securityCheck = await securityService.performSecurityCheck(req)
    if (!securityCheck.allowed) {
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=security_check_failed`)
    }

    // Add device fingerprint
    await securityService.addDeviceFingerprint(user._id, req)

    // Generate JWT token
    const token = jwt.sign({ userId: user._id, email: user.email }, process.env.JWT_SECRET, { expiresIn: "7d" })

    // Redirect to frontend with token
    res.redirect(`${process.env.FRONTEND_URL}/dashboard?token=${token}`)
  } catch (error) {
    console.error("Google OAuth callback error:", error)
    res.redirect(`${process.env.FRONTEND_URL}/login?error=oauth_failed`)
  }
})

// Token verification endpoint
router.get("/verify", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1]

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "No token provided",
      })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    const user = await User.findById(decoded.userId).select("-password")

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: "Invalid token or user not found",
      })
    }

    res.json({
      success: true,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        isPremium: user.isPremium,
        streamCount: user.streamCount,
        maxStreams: user.maxStreams,
        avatar: user.avatar,
      },
    })
  } catch (error) {
    console.error("Token verification error:", error)
    res.status(401).json({
      success: false,
      message: "Invalid token",
    })
  }
})

module.exports = router

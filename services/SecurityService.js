const axios = require("axios")
const User = require("../models/User")

class SecurityService {
  constructor() {
    this.vpnProviders = [
      "nordvpn",
      "expressvpn",
      "surfshark",
      "cyberghost",
      "purevpn",
      "hotspot shield",
      "tunnelbear",
      "windscribe",
      "protonvpn",
    ]

    this.knownVPNASNs = [
      "AS13335", // Cloudflare
      "AS15169", // Google
      "AS16509", // Amazon
      "AS14061", // DigitalOcean
      "AS20473", // Choopa (Vultr)
    ]
  }

  async validateRecaptcha(token) {
    try {
      const response = await axios.post("https://www.google.com/recaptcha/api/siteverify", null, {
        params: {
          secret: process.env.RECAPTCHA_SECRET_KEY,
          response: token,
        },
      })

      return response.data.success
    } catch (error) {
      console.error("reCAPTCHA validation error:", error)
      return false
    }
  }

  async detectVPN(ipAddress) {
    try {
      // Use multiple IP detection services
      const services = [`https://ipapi.co/${ipAddress}/json/`, `http://ip-api.com/json/${ipAddress}`]

      for (const serviceUrl of services) {
        try {
          const response = await axios.get(serviceUrl, { timeout: 5000 })
          const data = response.data

          // Check for VPN indicators
          const vpnIndicators = [
            data.org && this.vpnProviders.some((provider) => data.org.toLowerCase().includes(provider)),
            data.org &&
              (data.org.toLowerCase().includes("vpn") ||
                data.org.toLowerCase().includes("proxy") ||
                data.org.toLowerCase().includes("hosting") ||
                data.org.toLowerCase().includes("datacenter")),
            data.asn && this.knownVPNASNs.includes(data.asn),
            data.proxy === true,
            data.hosting === true,
          ]

          if (vpnIndicators.some((indicator) => indicator)) {
            return {
              isVPN: true,
              provider: data.org,
              country: data.country,
              asn: data.asn,
            }
          }
        } catch (serviceError) {
          console.warn(`VPN detection service failed: ${serviceUrl}`, serviceError.message)
          continue
        }
      }

      return { isVPN: false }
    } catch (error) {
      console.error("VPN detection error:", error)
      return { isVPN: false } // Fail open for availability
    }
  }

  generateDeviceFingerprint(req) {
    const userAgent = req.headers["user-agent"] || ""
    const acceptLanguage = req.headers["accept-language"] || ""
    const acceptEncoding = req.headers["accept-encoding"] || ""
    const ipAddress = this.getClientIP(req)

    return Buffer.from(
      JSON.stringify({
        userAgent,
        acceptLanguage,
        acceptEncoding,
        ipAddress: ipAddress.substring(0, ipAddress.lastIndexOf(".")), // Partial IP for privacy
      }),
    ).toString("base64")
  }

  getClientIP(req) {
    return (
      req.headers["x-forwarded-for"] ||
      req.headers["x-real-ip"] ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
      "127.0.0.1"
    )
  }

  async checkMultipleAccounts(email, deviceFingerprint, ipAddress) {
    try {
      // Check for existing accounts with same email (should be unique anyway)
      const existingUser = await User.findOne({ email })
      if (existingUser) {
        return { allowed: false, reason: "Email already registered" }
      }

      // Check for accounts with same device fingerprint
      const fingerprintMatch = await User.findOne({
        "deviceFingerprints.fingerprint": deviceFingerprint,
      })

      if (fingerprintMatch) {
        return {
          allowed: false,
          reason: "Device already associated with another account",
        }
      }

      // Check for accounts with same IP (more lenient, allow up to 2 accounts per IP)
      const ipMatches = await User.countDocuments({
        "deviceFingerprints.ipAddress": ipAddress,
      })

      if (ipMatches >= 2) {
        return {
          allowed: false,
          reason: "Too many accounts from this IP address",
        }
      }

      return { allowed: true }
    } catch (error) {
      console.error("Multiple account check error:", error)
      return { allowed: true } // Fail open for availability
    }
  }

  async performSecurityCheck(req, email = null) {
    const ipAddress = this.getClientIP(req)
    const deviceFingerprint = this.generateDeviceFingerprint(req)

    // Run security checks
    const [vpnCheck, multiAccountCheck] = await Promise.all([
      this.detectVPN(ipAddress),
      email ? this.checkMultipleAccounts(email, deviceFingerprint, ipAddress) : { allowed: true },
    ])

    const securityResult = {
      ipAddress,
      deviceFingerprint,
      vpnDetected: vpnCheck.isVPN,
      vpnDetails: vpnCheck,
      multipleAccountsBlocked: !multiAccountCheck.allowed,
      multipleAccountsReason: multiAccountCheck.reason,
      timestamp: new Date().toISOString(),
    }

    // Determine if request should be blocked
    const shouldBlock = vpnCheck.isVPN || !multiAccountCheck.allowed

    return {
      allowed: !shouldBlock,
      reason: shouldBlock ? (vpnCheck.isVPN ? "VPN/Proxy detected" : multiAccountCheck.reason) : null,
      details: securityResult,
    }
  }

  async addDeviceFingerprint(userId, req) {
    try {
      const user = await User.findById(userId)
      if (!user) return

      const deviceFingerprint = this.generateDeviceFingerprint(req)
      const ipAddress = this.getClientIP(req)

      // Check if fingerprint already exists
      const existingFingerprint = user.deviceFingerprints.find((fp) => fp.fingerprint === deviceFingerprint)

      if (!existingFingerprint) {
        user.deviceFingerprints.push({
          fingerprint: deviceFingerprint,
          ipAddress,
          userAgent: req.headers["user-agent"] || "",
        })

        // Keep only last 5 fingerprints
        if (user.deviceFingerprints.length > 5) {
          user.deviceFingerprints = user.deviceFingerprints.slice(-5)
        }

        await user.save()
      }
    } catch (error) {
      console.error("Error adding device fingerprint:", error)
    }
  }
}

module.exports = SecurityService

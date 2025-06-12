// Security and fraud detection utilities
class SecurityChecker {
  constructor() {
    this.deviceFingerprint = this.generateDeviceFingerprint()
    this.ipAddress = null
    this.vpnDetected = false
    this.adblockDetected = false
  }

  // Generate unique device fingerprint
  generateDeviceFingerprint() {
    const canvas = document.createElement("canvas")
    const ctx = canvas.getContext("2d")
    ctx.textBaseline = "top"
    ctx.font = "14px Arial"
    ctx.fillText("Device fingerprint", 2, 2)

    const fingerprint = {
      screen: `${screen.width}x${screen.height}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      language: navigator.language,
      platform: navigator.platform,
      userAgent: navigator.userAgent,
      canvas: canvas.toDataURL(),
      webgl: this.getWebGLFingerprint(),
      plugins: Array.from(navigator.plugins)
        .map((p) => p.name)
        .join(","),
    }

    return btoa(JSON.stringify(fingerprint))
  }

  // Get WebGL fingerprint
  getWebGLFingerprint() {
    const canvas = document.createElement("canvas")
    const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl")

    if (!gl) return "no-webgl"

    const debugInfo = gl.getExtension("WEBGL_debug_renderer_info")
    return debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : "unknown"
  }

  // Detect VPN usage
  async detectVPN() {
    try {
      // Check for common VPN indicators
      const response = await fetch("https://ipapi.co/json/")
      const data = await response.json()

      this.ipAddress = data.ip

      // Check for VPN/proxy indicators
      const vpnIndicators = [
        data.org?.toLowerCase().includes("vpn"),
        data.org?.toLowerCase().includes("proxy"),
        data.org?.toLowerCase().includes("hosting"),
        data.asn && this.isKnownVPNASN(data.asn),
      ]

      this.vpnDetected = vpnIndicators.some((indicator) => indicator)
      return this.vpnDetected
    } catch (error) {
      console.warn("VPN detection failed:", error)
      return false
    }
  }

  // Check known VPN ASNs
  isKnownVPNASN(asn) {
    const knownVPNASNs = [
      "AS13335", // Cloudflare
      "AS15169", // Google (some VPN services)
      "AS16509", // Amazon (some VPN services)
      // Add more known VPN ASNs
    ]
    return knownVPNASNs.includes(asn)
  }

  // Detect ad blockers
  detectAdblock() {
    // Create a fake ad element
    const adElement = document.createElement("div")
    adElement.innerHTML = "&nbsp;"
    adElement.className = "adsbox"
    adElement.style.position = "absolute"
    adElement.style.left = "-10000px"

    document.body.appendChild(adElement)

    setTimeout(() => {
      const isBlocked = adElement.offsetHeight === 0
      this.adblockDetected = isBlocked
      document.body.removeChild(adElement)
    }, 100)

    return this.adblockDetected
  }

  // Check for multiple accounts from same device/IP
  async checkMultipleAccounts() {
    const storageKey = "sipaling_device_accounts"
    const existingAccounts = JSON.parse(localStorage.getItem(storageKey) || "[]")

    // Check if current fingerprint already exists
    const duplicateFound = existingAccounts.some(
      (account) => account.fingerprint === this.deviceFingerprint || account.ip === this.ipAddress,
    )

    if (duplicateFound) {
      return {
        blocked: true,
        reason: "Multiple accounts detected from same device/IP",
      }
    }

    // Add current session to storage
    existingAccounts.push({
      fingerprint: this.deviceFingerprint,
      ip: this.ipAddress,
      timestamp: Date.now(),
    })

    // Keep only last 5 accounts
    if (existingAccounts.length > 5) {
      existingAccounts.splice(0, existingAccounts.length - 5)
    }

    localStorage.setItem(storageKey, JSON.stringify(existingAccounts))

    return { blocked: false }
  }

  // Comprehensive security check
  async performSecurityCheck() {
    const results = {
      deviceFingerprint: this.deviceFingerprint,
      vpnDetected: await this.detectVPN(),
      adblockDetected: this.detectAdblock(),
      multipleAccounts: await this.checkMultipleAccounts(),
      timestamp: new Date().toISOString(),
    }

    // Determine if user should be blocked
    const shouldBlock = results.vpnDetected || results.adblockDetected || results.multipleAccounts.blocked

    if (shouldBlock) {
      console.warn("Security check failed:", results)
      return {
        allowed: false,
        reason: this.getBlockReason(results),
        details: results,
      }
    }

    return {
      allowed: true,
      details: results,
    }
  }

  // Get human-readable block reason
  getBlockReason(results) {
    if (results.vpnDetected) return "VPN/Proxy detected"
    if (results.adblockDetected) return "Ad blocker detected"
    if (results.multipleAccounts.blocked) return results.multipleAccounts.reason
    return "Security check failed"
  }
}

// Usage example
const securityChecker = new SecurityChecker()

// Run security check on page load
document.addEventListener("DOMContentLoaded", async () => {
  const securityResult = await securityChecker.performSecurityCheck()

  if (!securityResult.allowed) {
    // Block user access
    document.body.innerHTML = `
      <div style="display: flex; justify-content: center; align-items: center; height: 100vh; background: #f3f4f6;">
        <div style="text-align: center; padding: 2rem; background: white; border-radius: 1rem; box-shadow: 0 10px 25px rgba(0,0,0,0.1);">
          <h1 style="color: #dc2626; margin-bottom: 1rem;">Akses Ditolak</h1>
          <p style="color: #6b7280; margin-bottom: 1rem;">Alasan: ${securityResult.reason}</p>
          <p style="color: #6b7280; font-size: 0.875rem;">Silakan hubungi support jika Anda merasa ini adalah kesalahan.</p>
        </div>
      </div>
    `
    return
  }

  console.log("Security check passed:", securityResult.details)
})

// Export for use in other scripts
if (typeof module !== "undefined" && module.exports) {
  module.exports = SecurityChecker
}

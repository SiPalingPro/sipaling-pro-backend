const mongoose = require("mongoose")
const User = require("../models/User")
const Stream = require("../models/Stream")

async function setupDatabase() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/sipaling-pro")
    console.log("✅ Connected to MongoDB")

    // Create indexes
    console.log("📊 Creating database indexes...")

    // User indexes
    await User.collection.createIndex({ email: 1 }, { unique: true })
    await User.collection.createIndex({ username: 1 }, { unique: true })
    await User.collection.createIndex({ googleId: 1 }, { sparse: true })
    await User.collection.createIndex({ "deviceFingerprints.fingerprint": 1 })
    await User.collection.createIndex({ "deviceFingerprints.ipAddress": 1 })

    // Stream indexes
    await Stream.collection.createIndex({ userId: 1, status: 1 })
    await Stream.collection.createIndex({ status: 1 })
    await Stream.collection.createIndex({ userId: 1, createdAt: -1 })
    await Stream.collection.createIndex({ isActive: 1 })

    console.log("✅ Database indexes created successfully")

    // Create admin user if not exists
    const adminEmail = "admin@gmail.com"
    const existingAdmin = await User.findOne({ email: adminEmail })

    if (!existingAdmin) {
      const adminUser = new User({
        username: "admin",
        email: adminEmail,
        password: "admin123456",
        isPremium: true,
        maxStreams: 999,
        maxResolution: "4K",
      })

      await adminUser.save()
      console.log("✅ Admin user created")
      console.log("   Email: admin@gmail.com")
      console.log("   Password: admin123456")
      console.log("   ⚠️  Please change the password after first login!")
    }

    console.log("🎉 Database setup completed successfully!")
  } catch (error) {
    console.error("❌ Database setup failed:", error)
  } finally {
    await mongoose.disconnect()
  }
}

// Run setup if called directly
if (require.main === module) {
  require("dotenv").config()
  setupDatabase()
}

module.exports = setupDatabase

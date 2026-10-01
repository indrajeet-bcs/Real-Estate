import mongoose from 'mongoose'
import dotenv from 'dotenv'
import User from './src/models/User.js'

dotenv.config()

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/real-estate-crm')
    console.log('Connected to MongoDB')

    const email = 'bestore@mail.com'
    const existing = await User.findOne({ email })
    if (existing) {
      // Ensure the role/name are correct and reset the password (pre-save hashes it).
      existing.name = 'Besto RE'
      existing.role = 'super_admin'
      existing.firm = null
      existing.isActive = true
      existing.password = 'Test@123'
      await existing.save()
      console.log(`Updated existing user ${email} → super_admin, password reset.`)
    } else {
      await User.create({
        name: 'Besto RE',
        email,
        password: 'Test@123', // hashed by the User pre-save hook
        role: 'super_admin',
        firm: null,
        isActive: true,
      })
      console.log(`Created super admin: ${email}`)
    }

    process.exit(0)
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
}

seed()

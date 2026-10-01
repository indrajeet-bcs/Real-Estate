// Seeds the initial Super Admin (platform owner). Run: npm run seed
import mongoose from 'mongoose'
import { connectDB } from '../config/db.js'
import { env } from '../config/env.js'
import User from '../models/User.js'
import { ROLES } from '../config/constants.js'

async function seed() {
  await connectDB()

  const existing = await User.findOne({ role: ROLES.SUPER_ADMIN })
  if (existing) {
    // eslint-disable-next-line no-console
    console.log(`[seed] Super Admin already exists: ${existing.email}`)
  } else {
    const superAdmin = await User.create({
      name: env.seed.name,
      email: env.seed.email,
      password: env.seed.password,
      role: ROLES.SUPER_ADMIN,
      firm: null,
      isActive: true,
    })
    // eslint-disable-next-line no-console
    console.log('[seed] Super Admin created:')
    // eslint-disable-next-line no-console
    console.log(`       email:    ${superAdmin.email}`)
    // eslint-disable-next-line no-console
    console.log(`       password: ${env.seed.password}`)
  }

  await mongoose.connection.close()
  process.exit(0)
}

seed().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[seed] failed:', err)
  process.exit(1)
})

// One-time migration: promote the string-based `User.branch` / `Firm.branches[]`
// data into first-class Branch documents (Admin-flow Phase 1). Idempotent — skips
// branches that already exist. Does NOT wipe anything. Run: npm run seed:branches
import mongoose from 'mongoose'
import { connectDB } from '../config/db.js'
import Firm from '../models/Firm.js'
import User from '../models/User.js'
import Branch from '../models/Branch.js'
import { ROLES } from '../config/constants.js'

async function seed() {
  await connectDB()
  console.log('[seed:branches] Promoting branch strings → Branch collection (no data wiped)\n')

  const firms = await Firm.find({}).lean()
  let createdTotal = 0

  for (const firm of firms) {
    // Collect candidate branch names from users + the firm's branches[] array.
    const users = await User.find({ firm: firm._id }, 'branch role').lean()
    const names = new Set()
    for (const u of users) if (u.branch && u.branch.trim()) names.add(u.branch.trim())
    for (const b of firm.branches || []) if (b && b.trim()) names.add(b.trim())

    if (names.size === 0) continue

    const admin = await User.findOne({ firm: firm._id, role: ROLES.ADMIN }).lean()

    for (const name of names) {
      const exists = await Branch.findOne({ firm: firm._id, name })
      if (exists) {
        console.log(`  = exists  ${firm.name} → ${name}`)
        continue
      }
      // Prefer a sub-admin sitting in this branch as its Branch Admin.
      const branchAdmin = await User.findOne({ firm: firm._id, role: ROLES.SUB_ADMIN, branch: name }).lean()
      await Branch.create({
        firm: firm._id,
        name,
        adminUser: branchAdmin?._id || null,
        monthlyTarget: 0,
        status: 'active',
        createdBy: admin?._id || null,
      })
      createdTotal += 1
      console.log(`  + created ${firm.name} → ${name}${branchAdmin ? ` (admin: ${branchAdmin.name})` : ''}`)
    }
  }

  const total = await Branch.countDocuments()
  console.log(`\n[seed:branches] Done. Created ${createdTotal} new branch(es). Collection now has ${total}.`)
  await mongoose.connection.close()
  process.exit(0)
}

seed().catch(async (err) => {
  console.error('[seed:branches] failed:', err)
  await mongoose.connection.close().catch(() => {})
  process.exit(1)
})

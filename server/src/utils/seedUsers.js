// Users-only seed: creates exactly the accounts listed in CREDENTIALS.md and
// nothing else. Unlike seed:demo, this does NOT wipe any data — it is idempotent
// (re-running skips accounts that already exist) and only creates the 3 named
// firms if they are missing. Run: npm run seed:users
import mongoose from 'mongoose'
import { connectDB } from '../config/db.js'
import Firm from '../models/Firm.js'
import User from '../models/User.js'
import { ROLES } from '../config/constants.js'

const PASSWORD = 'Password@123' // shared password for every account (per CREDENTIALS.md)
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '')

// Firms exactly as named in CREDENTIALS.md (domain = slug(name) + '.com').
const FIRMS = [
  { name: 'Skyline Realty', region: 'West', city: 'Mumbai' },
  { name: 'Metro Homes', region: 'North', city: 'Delhi' },
  { name: 'Coastal Estates', region: 'South', city: 'Goa' },
]

// Find a user by email or create it (hashing happens via the pre-save hook).
async function ensureUser(spec) {
  const existing = await User.findOne({ email: spec.email })
  if (existing) {
    console.log(`  = exists  ${spec.role.padEnd(15)} ${spec.email}`)
    return existing
  }
  const user = await User.create({ ...spec, password: PASSWORD, isActive: true })
  console.log(`  + created ${spec.role.padEnd(15)} ${spec.email}`)
  return user
}

async function ensureFirm(f, createdBy) {
  const existing = await Firm.findOne({ name: f.name })
  if (existing) {
    console.log(`Firm "${f.name}" → using existing`)
    return existing
  }
  const firm = await Firm.create({
    name: f.name, region: f.region, city: f.city, plan: 'standard',
    companyId: `CMP-${slug(f.name).toUpperCase()}`, // unique per firm; avoids null-collision on the unique index
    contactEmail: `contact@${slug(f.name)}.com`, status: 'active', isActive: true, createdBy,
  })
  console.log(`Firm "${f.name}" → created`)
  return firm
}

async function seed() {
  await connectDB()
  console.log('[seed:users] Seeding accounts from CREDENTIALS.md (no data is wiped)\n')

  // 1. Super Admin (platform level, firm = null)
  const superAdmin = await ensureUser({
    name: 'Platform Owner', email: 'superadmin@crm.local', role: ROLES.SUPER_ADMIN, firm: null,
  })

  // 2. Each firm's hierarchy: 1 admin, 2 sub-admins, 4 executives.
  for (const f of FIRMS) {
    const domain = slug(f.name) + '.com'
    const firm = await ensureFirm(f, superAdmin._id)

    const admin = await ensureUser({
      name: `${f.name} Admin`, email: `admin@${domain}`, role: ROLES.ADMIN,
      firm: firm._id, manager: null, createdBy: superAdmin._id,
    })

    const subAdmins = []
    for (let i = 1; i <= 2; i++) {
      const sa = await ensureUser({
        name: `${f.name} Sub-Admin ${i}`, email: `subadmin${i}@${domain}`, role: ROLES.SUB_ADMIN,
        firm: firm._id, manager: admin._id, createdBy: admin._id,
      })
      subAdmins.push(sa)
    }

    for (let i = 1; i <= 4; i++) {
      const manager = subAdmins[i % subAdmins.length]
      await ensureUser({
        name: `${f.name} Executive ${i}`, email: `exec${i}@${domain}`, role: ROLES.SALES_EXECUTIVE,
        firm: firm._id, manager: manager._id, createdBy: manager._id,
      })
    }
  }

  const total = await User.countDocuments()
  console.log(`\n[seed:users] Done. Users collection now has ${total} accounts. Password for all: ${PASSWORD}`)
  await mongoose.connection.close()
  process.exit(0)
}

seed().catch(async (err) => {
  console.error('[seed:users] failed:', err)
  await mongoose.connection.close().catch(() => {})
  process.exit(1)
})

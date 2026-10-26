/**
 * startupSeed.js — Idempotent startup seed.
 *
 * Runs automatically every time the server boots (called from server.js after
 * connectDB). It is completely safe to run repeatedly:
 *   • Skips any user / firm that already exists (matched by email / name).
 *   • Never deletes or overwrites existing data.
 *   • Only creates the default Super Admin + the 3 demo firm hierarchies if
 *     they are missing.
 *
 * This ensures the production database always has the baseline accounts
 * listed in CREDENTIALS.md, regardless of which MongoDB cluster is attached.
 */
import Firm from '../models/Firm.js'
import User from '../models/User.js'
import { ROLES } from '../config/constants.js'

const PASSWORD = 'Password@123'  // shared password for ALL demo accounts
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '')

// ── Firm blueprints ──────────────────────────────────────────────────────────
const FIRMS = [
  { name: 'Skyline Realty',  region: 'West',  city: 'Mumbai' },
  { name: 'Metro Homes',     region: 'North', city: 'Delhi'  },
  { name: 'Coastal Estates', region: 'South', city: 'Goa'    },
]

// ── Helpers ──────────────────────────────────────────────────────────────────
async function ensureFirm(spec, createdBy) {
  const existing = await Firm.findOne({ name: spec.name })
  if (existing) return existing
  const firm = await Firm.create({
    name:         spec.name,
    region:       spec.region,
    city:         spec.city,
    plan:         'standard',
    companyId:    `CMP-${slug(spec.name).toUpperCase()}`,
    contactEmail: `contact@${slug(spec.name)}.com`,
    status:       'active',
    isActive:     true,
    createdBy,
  })
  console.log(`[startupSeed] + firm   "${firm.name}"`)
  return firm
}

async function ensureUser(spec) {
  const existing = await User.findOne({ email: spec.email })
  if (existing) return existing          // skip — account already in DB
  const user = await User.create({ ...spec, password: PASSWORD, isActive: true })
  console.log(`[startupSeed] + user   ${user.role.padEnd(17)} ${user.email}`)
  return user
}

// ── Main entry-point ─────────────────────────────────────────────────────────
export async function runStartupSeed() {
  try {
    // 1. Super Admin (platform-level, no firm)
    const superAdmin = await ensureUser({
      name:  'Platform Owner',
      email: 'superadmin@crm.local',
      role:  ROLES.SUPER_ADMIN,
      firm:  null,
    })

    // 2. Also seed bestore@mail.com Super Admin (confirmed working in CREDENTIALS.md)
    await ensureUser({
      name:  'Besto RE',
      email: 'bestore@mail.com',
      role:  ROLES.SUPER_ADMIN,
      firm:  null,
    })

    // 3. Three demo firms — each with admin, 2 sub-admins, 4 executives
    for (const f of FIRMS) {
      const domain = slug(f.name) + '.com'
      const firm   = await ensureFirm(f, superAdmin._id)

      const admin = await ensureUser({
        name: `${f.name} Admin`, email: `admin@${domain}`,
        role: ROLES.ADMIN, firm: firm._id, createdBy: superAdmin._id,
      })

      const subAdmins = []
      for (let i = 1; i <= 2; i++) {
        const sa = await ensureUser({
          name: `${f.name} Sub-Admin ${i}`, email: `subadmin${i}@${domain}`,
          role: ROLES.SUB_ADMIN, firm: firm._id, manager: admin._id, createdBy: admin._id,
        })
        subAdmins.push(sa)
      }

      for (let i = 1; i <= 4; i++) {
        const manager = subAdmins[i % subAdmins.length]
        await ensureUser({
          name: `${f.name} Executive ${i}`, email: `exec${i}@${domain}`,
          role: ROLES.SALES_EXECUTIVE, firm: firm._id, manager: manager._id, createdBy: manager._id,
        })
      }
    }

    console.log('[startupSeed] ✓ Baseline accounts verified / created.')
  } catch (err) {
    // Never crash the server — just log and move on.
    console.error('[startupSeed] ✗ Error during startup seed:', err.message)
  }
}

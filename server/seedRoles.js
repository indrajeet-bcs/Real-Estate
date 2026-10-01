// Seeds the 9 system roles per active firm (idempotent). Run: node seedRoles.js
import mongoose from 'mongoose'
import dotenv from 'dotenv'
import Firm from './src/models/Firm.js'
import Role from './src/models/Role.js'
import { ROLES } from './src/config/constants.js'

dotenv.config()

// Every UI designer module id (MOD_02..MOD_21) that maps to enforcement.
const ALL_MODS = ['MOD_02', 'MOD_03', 'MOD_04', 'MOD_05', 'MOD_06', 'MOD_08', 'MOD_09', 'MOD_10', 'MOD_11', 'MOD_12', 'MOD_13', 'MOD_14', 'MOD_15', 'MOD_16', 'MOD_17', 'MOD_18', 'MOD_20', 'MOD_21']
const manageAll = () => Object.fromEntries(ALL_MODS.map((m) => [m, 'manage']))
const viewAll = () => Object.fromEntries(ALL_MODS.map((m) => [m, 'view']))
const only = (mods, rest = 'none') => Object.fromEntries(ALL_MODS.map((m) => [m, mods.includes(m) ? 'manage' : rest]))

// name, category, baseRole, dataScope, moduleAccess
const SYSTEM_ROLES = [
  { name: 'Company Owner', category: 'Company', baseRole: ROLES.ADMIN, dataScope: 'all', moduleAccess: manageAll() },
  { name: 'Branch Admin', category: 'Branch', baseRole: ROLES.SUB_ADMIN, dataScope: 'branch', moduleAccess: manageAll() },
  { name: 'Finance', category: 'Department', baseRole: ROLES.SUB_ADMIN, dataScope: 'all', moduleAccess: only(['MOD_09', 'MOD_10', 'MOD_11', 'MOD_08'], 'view') },
  { name: 'Marketing', category: 'Department', baseRole: ROLES.SUB_ADMIN, dataScope: 'all', moduleAccess: only(['MOD_20', 'MOD_02'], 'view') },
  { name: 'Legal', category: 'Department', baseRole: ROLES.SUB_ADMIN, dataScope: 'all', moduleAccess: only(['MOD_15', 'MOD_17'], 'view') },
  { name: 'Team Leader', category: 'Team', baseRole: ROLES.SUB_ADMIN, dataScope: 'team', moduleAccess: only(['MOD_02', 'MOD_03', 'MOD_04', 'MOD_08'], 'view') },
  { name: 'CRM Executive', category: 'Operational', baseRole: ROLES.SALES_EXECUTIVE, dataScope: 'own', moduleAccess: only(['MOD_02', 'MOD_03', 'MOD_04'], 'view') },
  { name: 'Sales Executive', category: 'Operational', baseRole: ROLES.SALES_EXECUTIVE, dataScope: 'own', moduleAccess: only(['MOD_02', 'MOD_03', 'MOD_04', 'MOD_08'], 'view') },
  { name: 'Telecaller', category: 'Operational', baseRole: ROLES.SALES_EXECUTIVE, dataScope: 'own', moduleAccess: only(['MOD_02'], 'view') },
]

const MOD_MAP = {
  MOD_02: ['lead', 'customer'], MOD_03: ['customer'], MOD_04: ['visit'], MOD_05: ['builder'],
  MOD_06: ['project', 'unit'], MOD_08: ['booking'], MOD_09: ['payment'], MOD_10: ['expense'],
  MOD_11: ['commission'], MOD_12: ['branch'], MOD_13: ['user'], MOD_14: ['attendance', 'leave'],
  MOD_15: ['legal'], MOD_16: ['loan'], MOD_17: ['registration'], MOD_18: ['possession'],
  MOD_20: ['marketing'], MOD_21: ['report'],
}
function derive(moduleAccess) {
  const perms = {}
  for (const [modId, level] of Object.entries(moduleAccess)) {
    if (!level || level === 'none') continue
    const keys = MOD_MAP[modId]; if (!keys) continue
    const actions = level === 'manage' ? ['*'] : ['view']
    for (const k of keys) perms[k] = actions
  }
  return perms
}

async function run() {
  await mongoose.connect(process.env.MONGO_URI)
  console.log('Connected. Seeding system roles…')
  const firms = await Firm.find({ isDeleted: { $ne: true } }).lean()
  let created = 0
  for (const firm of firms) {
    let n = 0
    for (const spec of SYSTEM_ROLES) {
      const exists = await Role.findOne({ firm: firm._id, name: spec.name })
      if (exists) continue
      await Role.create({
        firm: firm._id, name: spec.name, description: `${spec.name} (system role)`,
        category: spec.category, baseRole: spec.baseRole, type: 'system', isSystem: true, status: 'active',
        designer: { moduleAccess: spec.moduleAccess, pageAccess: {}, actions: {}, approvals: {}, dataScope: spec.dataScope },
        permissions: derive(spec.moduleAccess),
      })
      n++; created++
    }
    console.log(`  ${n > 0 ? '+' : '='} ${firm.name}: ${n} new system roles`)
  }
  console.log(`Done. ${created} system roles created.`)
  await mongoose.connection.close(); process.exit(0)
}
run().catch(async (e) => { console.error(e); await mongoose.connection.close().catch(() => {}); process.exit(1) })

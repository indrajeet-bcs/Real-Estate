import mongoose from 'mongoose'
import dotenv from 'dotenv'
import Firm from './src/models/Firm.js'
import User from './src/models/User.js'
import Project from './src/models/Project.js'
import Builder from './src/models/Builder.js'
import AuditLog from './src/models/AuditLog.js'
import MarketingTask from './src/models/MarketingTask.js'
import MarketingCampaign from './src/models/MarketingCampaign.js'
import { ROLES, MODULES, AUDIT_ACTIONS } from './src/config/constants.js'
import {
  ONLINE_MARKETING_TYPES, OFFLINE_MARKETING_TYPES, CHANNEL_BY_TYPE,
  MARKETING_PRIORITY,
} from './src/config/marketing.js'

dotenv.config()

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
const randInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1))
const daysFromNow = (d) => new Date(Date.now() + d * 86400000)
const title = (s) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

const CAMPAIGN_DEFS = [
  { name: 'Diwali Property Expo', status: 'active', budget: 250000, offset: [-20, 25] },
  { name: 'Q3 Digital Lead Push', status: 'active', budget: 180000, offset: [-15, 30] },
  { name: 'Weekend Site-Visit Drive', status: 'planned', budget: 60000, offset: [5, 40] },
  { name: 'New Launch — Green Enclave', status: 'completed', budget: 320000, offset: [-60, -5] },
]

const STATUS_WEIGHTS = [
  ['completed', 30], ['in_progress', 22], ['pending', 22], ['on_hold', 8], ['draft', 8], ['cancelled', 10],
]
function weightedStatus() {
  const total = STATUS_WEIGHTS.reduce((s, [, w]) => s + w, 0)
  let r = Math.random() * total
  for (const [st, w] of STATUS_WEIGHTS) { if ((r -= w) <= 0) return st }
  return 'pending'
}

async function seedFirm(firm) {
  const existing = await MarketingTask.countDocuments({ firm: firm._id })
  if (existing > 0) { console.log(`  · ${firm.name}: already has ${existing} tasks — skipped`); return { tasks: 0, campaigns: 0 } }

  const managers = await User.find({ firm: firm._id, role: { $in: [ROLES.ADMIN, ROLES.SUB_ADMIN] }, isActive: true }).lean()
  const execs = await User.find({ firm: firm._id, role: ROLES.SALES_EXECUTIVE, isActive: true }).lean()
  if (managers.length === 0 && execs.length === 0) { console.log(`  · ${firm.name}: no users — skipped`); return { tasks: 0, campaigns: 0 } }
  const manager = managers[0] || execs[0]

  const projects = await Project.find({ firm: firm._id }).select('_id name').lean()
  const builders = await Builder.find({ firm: firm._id }).select('_id name').lean()

  // Campaigns
  const campaigns = []
  for (const def of CAMPAIGN_DEFS) {
    const c = await MarketingCampaign.create({
      firm: firm._id, name: def.name, description: `${def.name} — auto-seeded demo campaign.`,
      budget: def.budget, status: def.status,
      startDate: daysFromNow(def.offset[0]), endDate: daysFromNow(def.offset[1]),
      branch: manager.branch || '', createdBy: manager._id, createdByName: manager.name,
    })
    campaigns.push(c)
  }

  // Tasks
  const owners = execs.length ? execs : managers
  const COUNT = randInt(22, 30)
  let seq = 0
  let made = 0
  for (let i = 0; i < COUNT; i++) {
    const marketingType = Math.random() < 0.55 ? pick(ONLINE_MARKETING_TYPES) : pick(OFFLINE_MARKETING_TYPES)
    const channel = CHANNEL_BY_TYPE[marketingType]
    const owner = pick(owners)
    const isSelfTask = Math.random() < 0.4 || managers.length === 0
    const createdByUser = isSelfTask ? owner : manager
    const status = weightedStatus()
    const dueOffset = randInt(-10, 16)
    const dueDate = daysFromNow(dueOffset)
    const campaign = Math.random() < 0.55 ? pick(campaigns) : null
    const progress = status === 'completed' ? 100 : status === 'in_progress' ? randInt(25, 80) : status === 'on_hold' ? randInt(10, 50) : 0
    seq += 1
    const code = `MKT-${String(seq).padStart(4, '0')}`

    const activity = [{ type: 'created', note: `Task created (${isSelfTask ? 'self task' : 'assigned task'})`, actor: createdByUser._id, actorName: createdByUser.name, at: daysFromNow(dueOffset - randInt(2, 8)) }]
    let completedAt, startedAt, completionRemarks
    if (['in_progress', 'on_hold', 'completed'].includes(status)) { startedAt = daysFromNow(dueOffset - randInt(1, 5)); activity.push({ type: 'started', note: 'Work started', actor: owner._id, actorName: owner.name, at: startedAt }) }
    if (status === 'completed') { completedAt = daysFromNow(dueOffset + (Math.random() < 0.7 ? -1 : 2)); completionRemarks = 'Delivered and verified.'; activity.push({ type: 'completed', note: completionRemarks, actor: owner._id, actorName: owner.name, at: completedAt }) }

    const task = await MarketingTask.create({
      firm: firm._id, code,
      owner: owner._id, ownerName: owner.name,
      createdBy: createdByUser._id, createdByName: createdByUser.name, createdByRole: createdByUser.role,
      isSelfTask,
      title: `${title(marketingType)}${campaign ? ` — ${campaign.name}` : ''}`,
      description: `${title(marketingType)} activity for ${firm.name}.`,
      channel, marketingType,
      campaign: campaign?._id || null,
      relatedProject: projects.length && Math.random() < 0.5 ? pick(projects)._id : null,
      relatedBuilder: builders.length && Math.random() < 0.35 ? pick(builders)._id : null,
      branch: owner.branch || manager.branch || '',
      priority: pick(MARKETING_PRIORITY),
      dueDate, estimatedBudget: Math.random() < 0.6 ? randInt(2, 60) * 1000 : 0,
      status, progress, startedAt, completedAt, completionRemarks,
      activity,
    })

    // Audit trail so Activity History + dashboard "recent" have data.
    await AuditLog.create({ firm: firm._id, actor: createdByUser._id, actorRole: createdByUser.role, action: AUDIT_ACTIONS.CREATE, module: MODULES.MARKETING, targetId: task._id, targetLabel: task.title, description: `Created marketing task "${task.title}"${isSelfTask ? '' : ` and assigned it to ${owner.name}`}`, createdAt: activity[0].at })
    if (status === 'completed') await AuditLog.create({ firm: firm._id, actor: owner._id, actorRole: owner.role, action: AUDIT_ACTIONS.STATUS_CHANGE, module: MODULES.MARKETING, targetId: task._id, targetLabel: task.title, description: `Completed marketing task "${task.title}"`, createdAt: completedAt })
    made += 1
  }

  console.log(`  ✓ ${firm.name}: ${campaigns.length} campaigns, ${made} tasks`)
  return { tasks: made, campaigns: campaigns.length }
}

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/real-estate-crm')
    console.log('Connected to MongoDB')

    // Only firms that actually have users (so tasks have real owners).
    const firmIds = await User.distinct('firm', { firm: { $ne: null } })
    const firms = await Firm.find({ _id: { $in: firmIds }, isDeleted: { $ne: true } })
    if (firms.length === 0) { console.log('No firms with users found — run seedDemo first.'); return }

    let totalT = 0, totalC = 0
    for (const firm of firms) {
      const r = await seedFirm(firm)
      totalT += r.tasks; totalC += r.campaigns
    }
    console.log(`\nDone. Seeded ${totalC} campaigns and ${totalT} marketing tasks across ${firms.length} firm(s).`)
  } catch (err) {
    console.error('Seed failed:', err)
    process.exitCode = 1
  } finally {
    await mongoose.disconnect()
  }
}

seed()

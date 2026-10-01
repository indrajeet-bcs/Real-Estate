import mongoose from 'mongoose'
import dotenv from 'dotenv'
import Firm from './src/models/Firm.js'
import User from './src/models/User.js'
import Customer from './src/models/Customer.js'
import Project from './src/models/Project.js'
import LeadTransferRequest from './src/models/LeadTransferRequest.js'

dotenv.config()

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
const randInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1))

// Spread leads across the My Leads pipeline so filters / stages / Convert are all
// demonstrable. Weighted toward mid-funnel; guarantees some 'qualified'.
const STAGE_POOL = [
  'new', 'new', 'in_progress', 'in_progress', 'follow_up_due', 'interested',
  'interested', 'site_visit_scheduled', 'site_visit_completed', 'negotiation',
  'qualified', 'qualified',
]
const PROPERTY_TYPES = ['apartment', 'villa', 'plot', 'commercial', 'penthouse']
const CONFIGS = ['1 BHK', '2 BHK', '3 BHK', '4 BHK']
const LOCATIONS = ['Baner', 'Wakad', 'Hinjewadi', 'Kharadi', 'Viman Nagar', 'Andheri', 'Powai', 'Whitefield']
const TRANSFER_REASONS = ['Not my territory', 'Workload / capacity', 'Customer requested another executive']
const SOURCES = ['walk_in', 'website', 'referral', 'social_media', 'call', 'portal']

const FIRST = ['Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Reyansh', 'Kabir', 'Anaya', 'Diya', 'Ira', 'Myra', 'Sara', 'Rohan', 'Kunal', 'Neha', 'Pooja', 'Rahul', 'Sneha', 'Karan', 'Meera', 'Nikhil', 'Priya', 'Tanvi', 'Yash']
const LAST = ['Sharma', 'Verma', 'Patel', 'Gupta', 'Mehta', 'Shah', 'Nair', 'Iyer', 'Reddy', 'Rao', 'Kulkarni', 'Joshi', 'Desai', 'Kapoor', 'Malhotra', 'Chopra']

const LEADS_TARGET = 10 // desired leads per executive for a populated demo

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/real-estate-crm')
    console.log('Connected to MongoDB')

    const firms = await Firm.find({ isDeleted: { $ne: true } })
    let created = 0, enriched = 0, qualified = 0, requests = 0

    for (const firm of firms) {
      const [execs, projects] = await Promise.all([
        User.find({ firm: firm._id, role: 'sales_executive', isActive: true }).select('_id name manager').lean(),
        Project.find({ firm: firm._id, isArchived: { $ne: true } }).select('_id').lean(),
      ])
      if (!execs.length) { console.log(`- ${firm.name}: skipped (no executives)`); continue }

      // Existing mobiles in the firm, to keep generated numbers unique.
      const existingMobiles = new Set((await Customer.find({ firm: firm._id }).select('mobile').lean()).map((c) => String(c.mobile)))
      const nextMobile = () => { let m; do { m = `9${randInt(100000000, 999999999)}` } while (existingMobiles.has(m)); existingMobiles.add(m); return m }

      // Top up each executive to LEADS_TARGET so the My Leads tab is populated.
      for (const exec of execs) {
        const have = await Customer.countDocuments({ firm: firm._id, assignedTo: exec._id })
        const toCreate = Math.max(0, LEADS_TARGET - have)
        const docs = []
        for (let i = 0; i < toCreate; i++) {
          const stage = pick(STAGE_POOL)
          const bMin = randInt(30, 60) * 100000
          docs.push({
            firm: firm._id,
            name: `${pick(FIRST)} ${pick(LAST)}`,
            mobile: nextMobile(),
            email: undefined,
            budgetMin: bMin,
            budgetMax: bMin + randInt(10, 60) * 100000,
            propertyType: pick(PROPERTY_TYPES),
            configuration: pick(CONFIGS),
            preferredLocation: pick(LOCATIONS),
            source: pick(SOURCES),
            status: stage,
            priority: pick(['low', 'medium', 'high']),
            assignedTo: exec._id,
            assignedAt: new Date(),
            interestedProjects: projects.length ? [{ project: pick(projects)._id }] : [],
            createdBy: exec._id,
          })
        }
        if (docs.length) { await Customer.insertMany(docs, { ordered: false }).catch(() => {}); created += docs.length }
      }

      for (const exec of execs) {
        // Only touch leads that haven't been enriched yet (idempotency marker:
        // propertyType unset) and are still in an open/early state.
        const leads = await Customer.find({
          firm: firm._id,
          assignedTo: exec._id,
          propertyType: { $in: [null, ''] },
          status: { $nin: ['booked', 'converted', 'lost'] },
        })
        let qCount = 0
        for (let i = 0; i < leads.length; i++) {
          const c = leads[i]
          c.propertyType = pick(PROPERTY_TYPES)
          c.configuration = pick(CONFIGS)
          c.preferredLocation = pick(LOCATIONS)
          if (!c.priority) c.priority = pick(['low', 'medium', 'high'])
          if (!c.budgetMax) { c.budgetMin = randInt(30, 60) * 100000; c.budgetMax = c.budgetMin + randInt(10, 60) * 100000 }
          const stage = pick(STAGE_POOL)
          c.status = stage
          if (stage === 'qualified') qCount++
          c.logActivity('seeded', `Demo lead staged as ${stage}`, exec._id)
          await c.save()
          enriched++
        }
        // Guarantee at least one qualified lead so Convert is testable.
        if (qCount === 0 && leads.length) {
          const c = leads[0]
          c.status = 'qualified'
          await c.save()
          qCount = 1
        }
        qualified += qCount
      }

      // A couple of pending transfer requests per firm (from the first exec) so
      // the Sub-Admin approval queue isn't empty.
      const requester = execs[0]
      const reqLeads = await Customer.find({ firm: firm._id, assignedTo: requester._id }).select('_id name').limit(2).lean()
      for (const lead of reqLeads) {
        const exists = await LeadTransferRequest.findOne({ customer: lead._id, status: 'pending' })
        if (exists) continue
        await LeadTransferRequest.create({
          firm: firm._id,
          customer: lead._id,
          requestedBy: requester._id,
          requestedByName: requester.name,
          reason: pick(TRANSFER_REASONS),
          remarks: 'Auto-seeded demo transfer request.',
          status: 'pending',
        })
        requests++
      }

      console.log(`- ${firm.name}: enriched leads + transfer requests where empty`)
    }

    console.log(`\nDone. Leads created: ${created} · Enriched: ${enriched} · Qualified: ${qualified} · Transfer requests: ${requests}.`)
    process.exit(0)
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
}

seed()

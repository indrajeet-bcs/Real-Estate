import mongoose from 'mongoose'
import dotenv from 'dotenv'
import Firm from './src/models/Firm.js'
import User from './src/models/User.js'
import Customer from './src/models/Customer.js'
import Project from './src/models/Project.js'
import SiteVisit from './src/models/SiteVisit.js'

dotenv.config()

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
const randInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1))
// A date `days` from now (negative = past), at a given hour.
const at = (days, hour = randInt(9, 18)) => {
  const d = new Date()
  d.setDate(d.getDate() + days)
  d.setHours(hour, pick([0, 15, 30, 45]), 0, 0)
  return d
}

const OUTCOMES = ['interested', 'follow_up_required', 'booking_discussion', 'booked', 'not_interested', 'site_closed', 'no_response']
const REMARKS = {
  interested: 'Client liked the layout, wants a price sheet.',
  follow_up_required: 'Needs to consult family; follow up next week.',
  booking_discussion: 'Discussed token amount and payment plan.',
  booked: 'Client confirmed booking on the spot.',
  not_interested: 'Budget mismatch, not proceeding.',
  site_closed: 'Inventory sold out for preferred configuration.',
  no_response: 'Client did not turn up for the visit.',
}

// A spread of visits per firm: past (completed/missed), today, and upcoming.
function buildPlan() {
  return [
    { days: -12, status: 'conducted' },
    { days: -9, status: 'conducted' },
    { days: -7, status: 'missed' },
    { days: -5, status: 'cancelled' },
    { days: -3, status: 'conducted' },
    { days: -1, status: 'rescheduled' },
    { days: 0, status: 'in_progress' },
    { days: 0, status: 'scheduled' },
    { days: 1, status: 'confirmed' },
    { days: 2, status: 'scheduled' },
    { days: 4, status: 'scheduled' },
    { days: 6, status: 'confirmed' },
  ]
}

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/real-estate-crm')
    console.log('Connected to MongoDB')

    const firms = await Firm.find({ isDeleted: { $ne: true } })
    if (!firms.length) { console.log('No firms found. Run npm run seed:demo first.'); process.exit(1) }

    let total = 0
    for (const firm of firms) {
      const [execs, subAdmins, customers, projects] = await Promise.all([
        User.find({ firm: firm._id, role: 'sales_executive', isActive: true }).select('_id manager name').lean(),
        User.find({ firm: firm._id, role: 'sub_admin', isActive: true }).select('_id').lean(),
        Customer.find({ firm: firm._id }).select('_id assignedTo status name').lean(),
        Project.find({ firm: firm._id, isArchived: { $ne: true } }).select('_id').lean(),
      ])

      if (!execs.length || !customers.length || !projects.length) {
        console.log(`- ${firm.name}: skipped (needs executives, customers and projects)`)
        continue
      }

      const existing = await SiteVisit.countDocuments({ firm: firm._id })
      if (existing >= 6) { console.log(`- ${firm.name}: already has ${existing} visits, skipping`); continue }

      const plan = buildPlan()
      const docs = plan.map((p) => {
        // Prefer a customer that has an assigned executive so the visit owner is realistic.
        const cust = pick(customers)
        const exec = cust.assignedTo
          ? (execs.find((e) => String(e._id) === String(cust.assignedTo)) || pick(execs))
          : pick(execs)
        const assignedBy = exec.manager || (subAdmins[0]?._id) || exec._id
        const scheduledAt = at(p.days)
        const doc = {
          firm: firm._id,
          customer: cust._id,
          project: pick(projects)._id,
          assignedTo: exec._id,
          createdBy: assignedBy,
          scheduledAt,
          status: p.status,
        }
        if (p.status === 'conducted') {
          const outcome = pick(OUTCOMES)
          doc.outcome = outcome
          doc.remarks = REMARKS[outcome]
        } else if (p.status === 'cancelled' || p.status === 'rescheduled') {
          doc.reason = p.status === 'cancelled' ? 'Client requested to cancel.' : 'Client asked to move to a later date.'
        }
        return doc
      })

      await SiteVisit.insertMany(docs)
      total += docs.length
      console.log(`- ${firm.name}: seeded ${docs.length} site visits`)
    }

    console.log(`\nDone. Seeded ${total} site visit(s) across ${firms.length} firm(s).`)
    process.exit(0)
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
}

seed()

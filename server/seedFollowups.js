import mongoose from 'mongoose'
import dotenv from 'dotenv'
import Firm from './src/models/Firm.js'
import User from './src/models/User.js'
import Customer from './src/models/Customer.js'
import Project from './src/models/Project.js'
import FollowUp from './src/models/FollowUp.js'

dotenv.config()

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
const randInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1))
// A date `days` from now (negative = past) at a business hour.
const at = (days, hour = randInt(10, 18)) => {
  const d = new Date()
  d.setDate(d.getDate() + days)
  d.setHours(hour, pick([0, 15, 30, 45]), 0, 0)
  return d
}

const TYPES = ['call', 'whatsapp', 'email', 'meeting', 'visit', 'callback']
const OUTCOMES = ['interested', 'follow_up_required', 'site_visit_scheduled', 'booking_discussion', 'booked', 'not_interested', 'no_response']
const PURPOSES = [
  'Discuss pricing and payment plan',
  'Share brochure and floor plans',
  'Confirm site visit slot',
  'Negotiate final discount',
  'Collect KYC documents',
  'Follow up on booking decision',
]

// A spread of follow-ups: past (completed / missed), overdue, today and upcoming.
function buildPlan() {
  return [
    { days: -10, status: 'completed' },
    { days: -8, status: 'completed' },
    { days: -6, status: 'missed' },
    { days: -4, status: 'rescheduled' },
    { days: -2, status: 'scheduled' }, // overdue (past + still scheduled)
    { days: -1, status: 'completed' },
    { days: 0, status: 'scheduled' }, // today
    { days: 0, status: 'pending' },
    { days: 1, status: 'scheduled' },
    { days: 2, status: 'scheduled' },
    { days: 4, status: 'pending' },
    { days: 6, status: 'scheduled' },
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
      const [execs, customers, projects] = await Promise.all([
        User.find({ firm: firm._id, role: 'sales_executive', isActive: true }).select('_id manager').lean(),
        Customer.find({ firm: firm._id }).select('_id assignedTo').lean(),
        Project.find({ firm: firm._id, isArchived: { $ne: true } }).select('_id').lean(),
      ])
      if (!execs.length || !customers.length) { console.log(`- ${firm.name}: skipped (needs executives and customers)`); continue }

      const existing = await FollowUp.countDocuments({ firm: firm._id })
      if (existing >= 6) { console.log(`- ${firm.name}: already has ${existing} follow-ups, skipping`); continue }

      const docs = buildPlan().map((p) => {
        const cust = pick(customers)
        const exec = cust.assignedTo
          ? (execs.find((e) => String(e._id) === String(cust.assignedTo)) || pick(execs))
          : pick(execs)
        const doc = {
          firm: firm._id,
          customer: cust._id,
          assignedTo: exec._id,
          project: projects.length ? pick(projects)._id : null,
          scheduledAt: at(p.days),
          type: pick(TYPES),
          priority: pick(['low', 'medium', 'high']),
          purpose: pick(PURPOSES),
          notes: pick(PURPOSES),
          status: p.status,
          createdBy: exec.manager || exec._id,
        }
        if (p.status === 'completed') {
          const outcome = pick(OUTCOMES)
          doc.outcomeNotes = `${outcome}${Math.random() > 0.5 ? ' — customer responded positively' : ''}`
          doc.completedAt = doc.scheduledAt
        } else if (p.status === 'missed') {
          doc.outcomeNotes = 'Missed: customer did not answer'
        } else if (p.status === 'rescheduled') {
          doc.outcomeNotes = 'Rescheduled: customer asked for a later slot'
        }
        return doc
      })

      await FollowUp.insertMany(docs)
      total += docs.length
      console.log(`- ${firm.name}: seeded ${docs.length} follow-ups`)
    }

    console.log(`\nDone. Seeded ${total} follow-up(s).`)
    process.exit(0)
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
}

seed()

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
const at = (days, hour = randInt(9, 18)) => { const d = new Date(); d.setDate(d.getDate() + days); d.setHours(hour, pick([0, 15, 30, 45]), 0, 0); return d }

const TYPES = ['call', 'whatsapp', 'email', 'meeting', 'callback']
const OUTCOMES = ['interested', 'need_more_info', 'site_visit_scheduled', 'negotiation', 'not_interested', 'call_later', 'converted']
const SUMMARIES = {
  interested: 'Customer is keen; wants a detailed cost sheet.',
  need_more_info: 'Asked for floor plans and amenities details.',
  site_visit_scheduled: 'Agreed to visit the site this weekend.',
  negotiation: 'Discussing price and payment plan.',
  not_interested: 'Budget mismatch; not proceeding for now.',
  call_later: 'Busy — asked to call back next week.',
  converted: 'Ready to book; moving to booking stage.',
}
const TARGET_PER_EXEC = 8

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/real-estate-crm')
    console.log('Connected to MongoDB')

    const firms = await Firm.find({ isDeleted: { $ne: true } })
    let created = 0, enriched = 0

    for (const firm of firms) {
      const [execs, projects] = await Promise.all([
        User.find({ firm: firm._id, role: 'sales_executive', isActive: true }).select('_id').lean(),
        Project.find({ firm: firm._id, isArchived: { $ne: true } }).select('_id').lean(),
      ])
      if (!execs.length) { console.log(`- ${firm.name}: skipped`); continue }

      // Enrich existing follow-ups (idempotent per-field).
      const stale = await FollowUp.find({ firm: firm._id, $or: [{ timeline: { $size: 0 } }, { status: 'completed', outcome: { $in: [null, undefined] } }] })
      for (const f of stale) {
        if (!f.timeline || !f.timeline.length) f.timeline = [{ type: 'created', note: 'Follow-up created', at: new Date(f.createdAt || f.scheduledAt) }]
        if (f.status === 'completed' && !f.outcome) {
          const o = pick(OUTCOMES)
          f.outcome = o
          f.conversationSummary = SUMMARIES[o]
          f.nextAction = o === 'site_visit_scheduled' ? 'Confirm the site visit' : 'Follow up as discussed'
          f.timeline.push({ type: 'completed', note: `Outcome: ${o}`, at: new Date(f.completedAt || f.updatedAt || f.scheduledAt) })
          f.timeline.push({ type: 'notes_added', note: SUMMARIES[o] })
        }
        await f.save()
        enriched++
      }

      for (const exec of execs) {
        const have = await FollowUp.countDocuments({ firm: firm._id, assignedTo: exec._id })
        const need = Math.max(0, TARGET_PER_EXEC - have)
        if (!need) continue
        const custs = await Customer.find({ firm: firm._id, assignedTo: exec._id }).select('_id').lean()
        if (!custs.length) continue

        const plan = [
          { days: 0, status: 'scheduled' },
          { days: 0, status: 'scheduled' },
          { days: 2, status: 'scheduled' },
          { days: 4, status: 'scheduled' },
          { days: -2, status: 'scheduled' }, // overdue
          { days: -5, status: 'completed', done: true },
          { days: -8, status: 'completed', done: true },
          { days: -1, status: 'rescheduled' },
        ].slice(0, need)

        for (const p of plan) {
          const scheduledAt = at(p.days)
          const doc = {
            firm: firm._id, customer: pick(custs)._id, assignedTo: exec._id,
            scheduledAt, type: pick(TYPES), priority: pick(['low', 'medium', 'high']),
            purpose: 'Auto-seeded follow-up', notes: 'Auto-seeded follow-up',
            project: projects.length ? pick(projects)._id : undefined,
            status: p.status,
            timeline: [{ type: 'created', note: 'Follow-up created', at: at(p.days - 1) }],
          }
          if (p.done) {
            const o = pick(OUTCOMES)
            doc.outcome = o
            doc.conversationSummary = SUMMARIES[o]
            doc.nextAction = 'Follow up as discussed'
            doc.outcomeNotes = `${o}: ${SUMMARIES[o]}`
            doc.completedAt = scheduledAt
            doc.timeline.push({ type: 'completed', note: `Outcome: ${o}`, at: scheduledAt }, { type: 'notes_added', note: SUMMARIES[o], at: scheduledAt })
          }
          if (p.status === 'rescheduled') doc.timeline.push({ type: 'rescheduled', note: 'Rescheduled to a later date', at: scheduledAt })
          await FollowUp.create(doc)
          created++
        }
      }

      console.log(`- ${firm.name}: follow-ups enriched + topped up`)
    }

    console.log(`\nDone. Created: ${created} · Enriched: ${enriched}.`)
    process.exit(0)
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
}

seed()

import mongoose from 'mongoose'
import dotenv from 'dotenv'
import Firm from './src/models/Firm.js'
import User from './src/models/User.js'
import Customer from './src/models/Customer.js'
import Project from './src/models/Project.js'
import Builder from './src/models/Builder.js'
import Unit from './src/models/Unit.js'
import SiteVisit from './src/models/SiteVisit.js'

dotenv.config()

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
const randInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1))
const at = (days, hour = randInt(9, 18)) => { const d = new Date(); d.setDate(d.getDate() + days); d.setHours(hour, pick([0, 15, 30, 45]), 0, 0); return d }

const MEETING_POINTS = ['Project site gate', 'Sales office', 'Sample flat block', 'Main reception', 'Tower A lobby']
const VISIT_TYPES = ['first_visit', 'revisit', 'final_visit']
const INTEREST = ['highly_interested', 'interested', 'needs_follow_up', 'not_interested']
const FEEDBACK = {
  highly_interested: 'Loved the layout and amenities; ready to discuss booking.',
  interested: 'Liked the project, wants a detailed cost sheet.',
  needs_follow_up: 'Needs to consult family before deciding.',
  not_interested: 'Budget/location mismatch, not proceeding.',
}
const TARGET_PER_EXEC = 8

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/real-estate-crm')
    console.log('Connected to MongoDB')

    const firms = await Firm.find({ isDeleted: { $ne: true } })
    let created = 0, enriched = 0

    for (const firm of firms) {
      const [execs, projects, builders] = await Promise.all([
        User.find({ firm: firm._id, role: 'sales_executive', isActive: true }).select('_id manager').lean(),
        Project.find({ firm: firm._id, isArchived: { $ne: true } }).select('_id builder location').lean(),
        Builder.find({ firm: firm._id, isArchived: { $ne: true } }).select('_id').lean(),
      ])
      if (!execs.length || !projects.length) { console.log(`- ${firm.name}: skipped`); continue }

      // Enrich existing visits that predate the new fields (idempotent per-field:
      // only fills gaps, so it is safe to re-run).
      const stale = await SiteVisit.find({
        firm: firm._id,
        $or: [
          { visitType: { $in: [null, undefined] } },
          { status: 'conducted', 'checkOut.at': { $in: [null, undefined] } },
          { status: 'in_progress', 'checkIn.at': { $in: [null, undefined] } },
        ],
      })
      for (const v of stale) {
        let touched = false
        if (!v.visitType) { v.visitType = pick(VISIT_TYPES); touched = true }
        if (!v.meetingPoint) { v.meetingPoint = pick(MEETING_POINTS); touched = true }
        if (!v.builder) { const proj = projects.find((p) => String(p._id) === String(v.project)); v.builder = proj?.builder || (builders.length ? pick(builders)._id : null); touched = true }
        if (!v.timeline || !v.timeline.length) { v.timeline = [{ type: 'scheduled', note: 'Visit scheduled', at: new Date(v.scheduledAt) }]; touched = true }

        const day = Math.round((new Date(v.scheduledAt) - new Date()) / 86400000)
        if (v.status === 'in_progress' && !v.checkIn?.at) {
          const ci = at(day, randInt(10, 12))
          v.checkIn = { at: ci, location: { lat: 18.5, lng: 73.8, address: v.meetingPoint } }
          v.timeline.push({ type: 'check_in', note: 'Checked in at site', at: ci })
          touched = true
        }
        if (v.status === 'conducted') {
          if (!v.interestLevel) { const lvl = pick(INTEREST); v.interestLevel = lvl; v.feedback = v.remarks || FEEDBACK[lvl]; touched = true }
          if (!v.checkOut?.at) {
            const ci = at(day, 11), co = at(day, 12)
            v.checkIn = { at: ci, location: { lat: 18.5, lng: 73.8, address: v.meetingPoint } }
            v.checkOut = { at: co, location: { lat: 18.5, lng: 73.8 }, summary: 'Site walk-through completed.' }
            v.durationMinutes = Math.round((co - ci) / 60000)
            v.timeline.push(
              { type: 'check_in', note: 'Checked in at site', at: ci },
              { type: 'check_out', note: `Checked out · ${v.durationMinutes} min`, at: co },
              { type: 'completed', note: 'Visit completed', at: co },
              { type: 'feedback', note: v.feedback, at: co },
            )
            touched = true
          }
        }
        if (touched) { await v.save(); enriched++ }
      }

      for (const exec of execs) {
        const have = await SiteVisit.countDocuments({ firm: firm._id, assignedTo: exec._id })
        const need = Math.max(0, TARGET_PER_EXEC - have)
        if (!need) continue
        const custs = await Customer.find({ firm: firm._id, assignedTo: exec._id }).select('_id').lean()
        if (!custs.length) continue

        const plan = [
          { days: 0, status: 'scheduled' },
          { days: 0, status: 'in_progress', checkedIn: true },
          { days: 1, status: 'confirmed' },
          { days: 3, status: 'scheduled' },
          { days: 5, status: 'confirmed' },
          { days: -2, status: 'conducted', done: true },
          { days: -6, status: 'conducted', done: true },
          { days: -4, status: 'cancelled' },
        ].slice(0, need)

        for (const p of plan) {
          const project = pick(projects)
          const scheduledAt = at(p.days)
          const builderId = project.builder || (builders.length ? pick(builders)._id : null)
          let unitId = null
          const unit = await Unit.findOne({ firm: firm._id, project: project._id }).select('_id').lean()
          if (unit && Math.random() > 0.4) unitId = unit._id

          const doc = {
            firm: firm._id,
            customer: pick(custs)._id,
            project: project._id,
            builder: builderId,
            unit: unitId,
            assignedTo: exec._id,
            createdBy: exec.manager || exec._id,
            scheduledAt,
            visitType: pick(VISIT_TYPES),
            meetingPoint: pick(MEETING_POINTS),
            notes: 'Auto-seeded demo visit.',
            status: p.status,
            timeline: [{ type: 'scheduled', note: 'Visit scheduled', at: at(p.days - 1) }],
          }
          if (p.checkedIn) {
            const ci = at(p.days, randInt(10, 12))
            doc.checkIn = { at: ci, location: { lat: 18.5 + Math.random() * 0.2, lng: 73.8 + Math.random() * 0.2, address: pick(MEETING_POINTS) } }
            doc.timeline.push({ type: 'check_in', note: 'Checked in at site', at: ci })
          }
          if (p.done) {
            const lvl = pick(INTEREST)
            const ci = at(p.days, 11), co = at(p.days, 12)
            doc.checkIn = { at: ci, location: { lat: 18.5, lng: 73.8, address: pick(MEETING_POINTS) } }
            doc.checkOut = { at: co, location: { lat: 18.5, lng: 73.8 }, summary: 'Site walk-through completed.' }
            doc.durationMinutes = Math.round((co - ci) / 60000)
            doc.interestLevel = lvl
            doc.feedback = FEEDBACK[lvl]
            doc.outcome = FEEDBACK[lvl]
            doc.timeline.push(
              { type: 'check_in', note: 'Checked in at site', at: ci },
              { type: 'check_out', note: `Checked out · ${doc.durationMinutes} min`, at: co },
              { type: 'completed', note: 'Visit completed', at: co },
              { type: 'feedback', note: doc.feedback, at: co },
            )
          }
          if (p.status === 'cancelled') doc.reason = 'Client requested to cancel.'
          await SiteVisit.create(doc)
          created++
        }
      }

      console.log(`- ${firm.name}: visits enriched + topped up`)
    }

    console.log(`\nDone. Created: ${created} · Enriched: ${enriched}.`)
    process.exit(0)
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
}

seed()

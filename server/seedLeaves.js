import mongoose from 'mongoose'
import dotenv from 'dotenv'
import Firm from './src/models/Firm.js'
import User from './src/models/User.js'
import LeaveRequest from './src/models/LeaveRequest.js'
import Attendance from './src/models/Attendance.js'

dotenv.config()

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
const dayKey = (d) => { const x = new Date(d); const y = x.getFullYear(); const m = String(x.getMonth() + 1).padStart(2, '0'); const dd = String(x.getDate()).padStart(2, '0'); return `${y}-${m}-${dd}` }
const at = (days) => { const d = new Date(); d.setDate(d.getDate() + days); d.setHours(0, 0, 0, 0); return d }
const daysBetween = (a, b) => Math.floor((b - a) / 86400000) + 1

const REASONS = {
  casual: 'Personal work at home.',
  sick: 'Fever and rest advised by doctor.',
  earned: 'Family function out of town.',
  half_day: 'Bank and documentation work.',
  work_from_home: 'Working remotely due to commute.',
  other: 'Personal reasons.',
}
const TARGET_PER_EXEC = 5

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/real-estate-crm')
    console.log('Connected to MongoDB')

    const firms = await Firm.find({ isDeleted: { $ne: true } })
    let created = 0, attMarked = 0

    for (const firm of firms) {
      const execs = await User.find({ firm: firm._id, role: 'sales_executive', isActive: true }).select('_id branch').lean()
      if (!execs.length) { console.log(`- ${firm.name}: skipped`); continue }
      const approver = await User.findOne({ firm: firm._id, role: { $in: ['sub_admin', 'admin'] }, isActive: true }).select('_id name').lean()

      for (const exec of execs) {
        // Existing (type|status) combos so the seed is additive + idempotent.
        const existing = new Set((await LeaveRequest.find({ employee: exec._id }).select('type status').lean()).map((r) => `${r.type}|${r.status}`))

        // [type, startOffset, endOffset, status]
        const plan = [
          ['casual', 6, 7, 'pending'],
          ['half_day', 3, 3, 'pending'],
          ['sick', -4, -4, 'approved'],
          ['earned', -10, -8, 'approved'],
          ['work_from_home', -2, -2, 'cancelled'],
          ['casual', -15, -15, 'rejected'],
        ].filter(([type, , , status]) => !existing.has(`${type}|${status}`))

        for (const [type, so, eo, status] of plan) {
          const startDate = at(so)
          const endDate = at(eo)
          const days = type === 'half_day' ? 0.5 : daysBetween(startDate, endDate)
          const doc = {
            firm: firm._id, employee: exec._id, branch: exec.branch,
            type, startDate, endDate, days, reason: REASONS[type],
            status,
          }
          if (status === 'approved' || status === 'rejected') {
            doc.decidedBy = approver?._id || null
            doc.decidedByName = approver?.name
            doc.decidedAt = at(so - 1)
            if (status === 'rejected') doc.decisionNote = 'Insufficient balance / staffing constraints.'
          }
          await LeaveRequest.create(doc)
          created++

          // Approved leave reflects in the attendance module.
          if (status === 'approved') {
            const ops = []
            for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
              ops.push({ updateOne: { filter: { user: exec._id, date: dayKey(d) }, update: { $set: { firm: firm._id, user: exec._id, status: 'leave', checkOutRemarks: `${type} leave (approved)` } }, upsert: true } })
            }
            if (ops.length) { await Attendance.bulkWrite(ops, { ordered: false }).catch(() => {}); attMarked += ops.length }
          }
        }
      }
      console.log(`- ${firm.name}: leave requests seeded`)
    }

    console.log(`\nDone. Leave requests created: ${created} · Attendance days marked on-leave: ${attMarked}.`)
    process.exit(0)
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
}

seed()

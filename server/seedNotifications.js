import mongoose from 'mongoose'
import dotenv from 'dotenv'
import Firm from './src/models/Firm.js'
import User from './src/models/User.js'
import Customer from './src/models/Customer.js'
import Booking from './src/models/Booking.js'
import Notification from './src/models/Notification.js'

dotenv.config()

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
const randInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1))
const at = (daysAgo) => { const d = new Date(); d.setDate(d.getDate() - daysAgo); d.setHours(randInt(9, 18), randInt(0, 59), 0, 0); return d }

const PRIORITY_BY_TYPE = {
  followup_missed: 'high', unauthorized_attempt: 'high', booking_completed: 'high',
  lead_transfer_request: 'high', lead_transfer_decision: 'high', leave_request: 'high', leave_decision: 'high',
  lead_assigned: 'medium', followup_due: 'medium', visit_reminder: 'medium', task_assigned: 'medium', task_update: 'medium',
  attendance_log: 'low',
}

// [type, title, message, entityType, priority?]
const TEMPLATES = [
  ['lead_assigned', 'New lead assigned', 'A new lead has been assigned to you. Reach out today.', 'customer'],
  ['lead_transfer_decision', 'Lead transfer approved', 'Your lead transfer request was approved.', 'customer'],
  ['followup_due', 'Follow-up reminder', 'You have a follow-up scheduled today.', 'followup'],
  ['followup_missed', 'Follow-up overdue', 'A follow-up is overdue — please act on it.', 'followup'],
  ['visit_reminder', 'Site visit scheduled', 'A site visit is scheduled with your customer.', 'visit'],
  ['booking_completed', 'Booking approved', 'Your booking was approved by the branch admin.', 'booking'],
  ['booking_completed', 'Payment reminder', 'A payment milestone is due on a booking.', 'booking'],
  ['leave_decision', 'Leave approved', 'Your leave request has been approved.', 'leave'],
  ['task_assigned', 'New task assigned', 'Your Sub-Admin assigned you a new task.', 'task'],
  ['task_update', 'Task updated', 'There is an update on one of your tasks.', 'task'],
  ['attendance_log', 'Check-in reminder', "Don't forget to check in for today.", 'attendance'],
]

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/real-estate-crm')
    console.log('Connected to MongoDB')

    // Backfill priority on any existing notifications that predate the field.
    let backfilled = 0
    for (const [type, pri] of Object.entries(PRIORITY_BY_TYPE)) {
      const r = await Notification.updateMany({ type, priority: { $in: [null, undefined] } }, { $set: { priority: pri } })
      backfilled += r.modifiedCount || 0
    }
    await Notification.updateMany({ priority: { $in: [null, undefined] } }, { $set: { priority: 'medium' } })

    const firms = await Firm.find({ isDeleted: { $ne: true } })
    let created = 0
    const TARGET = 10

    for (const firm of firms) {
      const execs = await User.find({ firm: firm._id, role: 'sales_executive', isActive: true }).select('_id').lean()
      if (!execs.length) { console.log(`- ${firm.name}: skipped`); continue }

      for (const exec of execs) {
        const have = await Notification.countDocuments({ recipient: exec._id })
        const need = Math.max(0, TARGET - have)
        if (!need) continue
        const [cust, booking] = await Promise.all([
          Customer.findOne({ firm: firm._id, assignedTo: exec._id }).select('_id').lean(),
          Booking.findOne({ firm: firm._id, bookedBy: exec._id }).select('_id').lean(),
        ])
        const entityFor = (t) => (t === 'booking' ? booking?._id : ['customer', 'followup', 'visit'].includes(t) ? cust?._id : null)

        const docs = []
        for (let i = 0; i < need; i++) {
          const [type, title, message, entityType] = pick(TEMPLATES)
          docs.push({
            firm: firm._id, recipient: exec._id, type, title, message, entityType,
            entityId: entityFor(entityType) || undefined,
            priority: PRIORITY_BY_TYPE[type] || 'medium',
            read: Math.random() > 0.55,
            createdAt: at(randInt(0, 7)),
          })
        }
        if (docs.length) { await Notification.insertMany(docs, { ordered: false }).catch(() => {}); created += docs.length }
      }
      console.log(`- ${firm.name}: notifications seeded`)
    }

    console.log(`\nDone. Priority backfilled: ${backfilled} · Notifications created: ${created}.`)
    process.exit(0)
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
}

seed()

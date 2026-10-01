import mongoose from 'mongoose'
import dotenv from 'dotenv'
import Firm from './src/models/Firm.js'
import User from './src/models/User.js'
import Customer from './src/models/Customer.js'
import Task from './src/models/Task.js'

dotenv.config()

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
const randInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1))
const at = (days, hour = randInt(9, 18)) => { const d = new Date(); d.setDate(d.getDate() + days); d.setHours(hour, 0, 0, 0); return d }

const TITLES = [
  'Follow up with high-value lead', 'Complete KYC verification for buyer', 'Prepare weekly sales report',
  'Update customer records in CRM', 'Coordinate site visit logistics', 'Collect pending payment documents',
  'Call back interested prospects', 'Verify booking documents', 'Share project brochure with new leads',
  'Reconcile token payments',
]
const DESCS = [
  'Please prioritise this and update the progress by end of day.',
  'Ensure all documents are collected and uploaded to the CRM.',
  'Coordinate with the customer and confirm timelines.',
  'Complete and mark done once finished; add remarks.',
]
const TARGET_PER_EXEC = 6

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/real-estate-crm')
    console.log('Connected to MongoDB')

    const firms = await Firm.find({ isDeleted: { $ne: true } })
    let created = 0

    for (const firm of firms) {
      const execs = await User.find({ firm: firm._id, role: 'sales_executive', isActive: true }).select('_id name').lean()
      if (!execs.length) { console.log(`- ${firm.name}: skipped (no executives)`); continue }
      const assigners = await User.find({ firm: firm._id, role: { $in: ['sub_admin', 'admin'] }, isActive: true }).select('_id name role').lean()
      if (!assigners.length) { console.log(`- ${firm.name}: skipped (no assigner)`); continue }

      for (const exec of execs) {
        const have = await Task.countDocuments({ owner: exec._id, official: true })
        const need = Math.max(0, TARGET_PER_EXEC - have)
        if (!need) continue
        const custs = await Customer.find({ firm: firm._id, assignedTo: exec._id }).select('_id').lean()

        const plan = [
          { days: 1, status: 'pending', priority: 'high' },
          { days: 0, status: 'pending', priority: 'medium' },
          { days: 2, status: 'in_progress', priority: 'high' },
          { days: -1, status: 'on_hold', priority: 'medium' }, // overdue-ish
          { days: -3, status: 'completed', priority: 'low', done: true },
          { days: -5, status: 'completed', priority: 'medium', done: true },
        ].slice(0, need)

        for (const p of plan) {
          const assigner = pick(assigners)
          const useRelated = custs.length && Math.random() > 0.4
          const activity = [{ type: 'assigned', note: `Assigned by ${assigner.name}`, actor: assigner._id, actorName: assigner.name, at: at(p.days - 3) }]
          const comments = []
          if (Math.random() > 0.5) {
            comments.push({ text: 'Please keep me posted on the progress.', author: assigner._id, authorName: assigner.name, authorRole: assigner.role, at: at(p.days - 2) })
            activity.push({ type: 'comment_added', note: 'Please keep me posted on the progress.', actor: assigner._id, actorName: assigner.name, at: at(p.days - 2) })
          }
          if (p.status === 'in_progress' || p.done) {
            activity.push({ type: 'progress_updated', note: 'in_progress: Started working on this.', actor: exec._id, actorName: exec.name, at: at(p.days - 1) })
          }
          const doc = {
            firm: firm._id, owner: exec._id,
            assignedBy: assigner._id, assignedByName: assigner.name, assignedByRole: assigner.role, official: true,
            title: pick(TITLES), description: pick(DESCS),
            dueDate: at(p.days, 17), dueTime: '17:00', priority: p.priority,
            relatedType: useRelated ? 'customer' : 'none', relatedId: useRelated ? pick(custs)._id : null,
            status: p.status, comments, activity,
          }
          if (p.done) {
            doc.completedAt = at(p.days, 16)
            doc.completionRemarks = 'Completed and documents updated in CRM.'
            doc.activity.push({ type: 'completed', note: 'Completed and documents updated in CRM.', actor: exec._id, actorName: exec.name, at: doc.completedAt })
          }
          await Task.create(doc)
          created++
        }
      }

      console.log(`- ${firm.name}: official tasks seeded`)
    }

    console.log(`\nDone. Official tasks created: ${created}.`)
    process.exit(0)
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
}

seed()

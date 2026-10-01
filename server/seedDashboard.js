import mongoose from 'mongoose'
import dotenv from 'dotenv'
import Firm from './src/models/Firm.js'
import User from './src/models/User.js'
import Customer from './src/models/Customer.js'
import Project from './src/models/Project.js'
import Unit from './src/models/Unit.js'
import Booking from './src/models/Booking.js'
import Task from './src/models/Task.js'
import Notification from './src/models/Notification.js'

dotenv.config()

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
const randInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1))
const at = (days, hour = randInt(9, 18)) => { const d = new Date(); d.setDate(d.getDate() + days); d.setHours(hour, pick([0, 15, 30, 45]), 0, 0); return d }

const TASK_TITLES = ['Call back interested lead', 'Prepare cost sheet', 'Follow up on site visit', 'Send project brochure', 'Confirm booking documents', 'Collect KYC papers', 'Schedule demo call', 'Update lead status in CRM']

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/real-estate-crm')
    console.log('Connected to MongoDB')

    const firms = await Firm.find({ isDeleted: { $ne: true } })
    let tCount = 0, bCount = 0, nCount = 0, targeted = 0

    for (const firm of firms) {
      const [execs, customers, projects] = await Promise.all([
        User.find({ firm: firm._id, role: 'sales_executive', isActive: true }).select('_id name targetRevenue').lean(),
        Customer.find({ firm: firm._id }).select('_id assignedTo name').lean(),
        Project.find({ firm: firm._id, isArchived: { $ne: true } }).select('_id commissionRate').lean(),
      ])
      if (!execs.length) { console.log(`- ${firm.name}: skipped (no executives)`); continue }

      // --- Monthly targets on executives ---
      for (const e of execs) {
        if (!e.targetRevenue) { await User.updateOne({ _id: e._id }, { $set: { targetRevenue: randInt(60, 120) * 100000 } }); targeted++ }
      }

      // --- Work-planner tasks per executive ---
      for (const e of execs) {
        const existing = await Task.countDocuments({ owner: e._id })
        if (existing >= 3) continue
        const plan = [
          { days: 0, status: 'pending', priority: 'high' },
          { days: 0, status: 'pending', priority: 'medium' },
          { days: -1, status: 'pending', priority: 'high' }, // overdue
          { days: 2, status: 'pending', priority: 'low' },
          { days: -2, status: 'completed', priority: 'medium' },
        ]
        const docs = plan.map((p) => ({
          owner: e._id, firm: firm._id, title: pick(TASK_TITLES),
          description: 'Auto-seeded planner task.',
          dueDate: at(p.days), dueTime: `${randInt(9, 17)}:00`, priority: p.priority,
          relatedType: pick(['lead', 'customer', 'booking', 'none']),
          status: p.status, ...(p.status === 'completed' ? { completedAt: at(-1) } : {}),
        }))
        await Task.insertMany(docs)
        tCount += docs.length
      }

      // --- Ensure some available units exist (so bookings can be created) ---
      if (projects.length) {
        const availNow = await Unit.countDocuments({ firm: firm._id, status: 'available' })
        if (availNow < 6) {
          const configs = ['1 BHK', '2 BHK', '3 BHK']
          const newUnits = []
          for (let i = 0; i < 10; i++) {
            const project = pick(projects)
            const cfg = pick(configs)
            newUnits.push({
              firm: firm._id, project: project._id, unitNumber: `B-${randInt(1, 20)}0${randInt(1, 9)}`,
              unitType: cfg, configuration: cfg, propertyType: 'apartment',
              tower: pick(['A', 'B', 'C']), floor: String(randInt(1, 15)),
              areaSqft: randInt(650, 1800), basePrice: randInt(45, 130) * 100000,
              currentPrice: randInt(45, 130) * 100000, status: 'available',
            })
          }
          await Unit.insertMany(newUnits, { ordered: false }).catch((e) => e.insertedDocs || [])
        }
      }

      // --- Bookings (this month) from available units ---
      if (customers.length && projects.length) {
        const existingBk = await Booking.countDocuments({ firm: firm._id })
        if (existingBk < 4) {
          const units = await Unit.find({ firm: firm._id, status: 'available' }).limit(8)
          let made = 0
          for (const unit of units.slice(0, 6)) {
            const cust = pick(customers)
            const exec = cust.assignedTo ? (execs.find((e) => String(e._id) === String(cust.assignedTo)) || pick(execs)) : pick(execs)
            const project = projects.find((p) => String(p._id) === String(unit.project)) || pick(projects)
            const value = unit.currentPrice || unit.basePrice || unit.price || randInt(40, 120) * 100000
            const confirmed = made < 4 // first few confirmed, rest reserved
            try {
              const booking = await Booking.create({
                firm: firm._id, customer: cust._id, project: unit.project, unit: unit._id,
                bookingAmount: Math.round(value * 0.1), amountReceived: Math.round(value * 0.1),
                totalValue: value, appliedDiscount: 0,
                commissionEarned: Math.round(value * ((project.commissionRate || 2) / 100)),
                paymentStatus: confirmed ? 'partial' : 'pending',
                status: confirmed ? 'confirmed' : 'reserved',
                bookedBy: exec._id,
              })
              unit.status = confirmed ? 'booked' : 'reserved'
              unit.bookedFor = cust._id
              unit.reservedBy = exec._id
              await unit.save()
              if (confirmed) await Customer.updateOne({ _id: cust._id }, { $set: { status: 'booked' } })
              made++; bCount++
              void booking
            } catch { /* unit race / dup — skip */ }
          }
        }
      }

      // --- A few notifications per executive ---
      for (const e of execs) {
        const existingN = await Notification.countDocuments({ recipient: e._id })
        if (existingN >= 3) continue
        const notes = [
          { type: 'lead_assigned', title: 'New lead assigned', message: 'A new lead was assigned to you', entityType: 'customer' },
          { type: 'followup_due', title: 'Follow-up reminder', message: 'You have a follow-up due today', entityType: 'followup' },
          { type: 'visit_reminder', title: 'Site visit reminder', message: 'A site visit is scheduled today', entityType: 'visit' },
          { type: 'booking_completed', title: 'Booking confirmed', message: 'Your booking was confirmed', entityType: 'booking' },
        ]
        await Notification.insertMany(notes.map((n) => ({ ...n, firm: firm._id, recipient: e._id, read: Math.random() > 0.6 })))
        nCount += notes.length
      }

      console.log(`- ${firm.name}: tasks/bookings/notifications seeded where empty`)
    }

    console.log(`\nDone. Targets set: ${targeted} · Tasks: ${tCount} · Bookings: ${bCount} · Notifications: ${nCount}.`)
    process.exit(0)
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
}

seed()

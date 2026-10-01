import mongoose from 'mongoose'
import dotenv from 'dotenv'
import Firm from './src/models/Firm.js'
import User from './src/models/User.js'
import Customer from './src/models/Customer.js'
import Project from './src/models/Project.js'
import Unit from './src/models/Unit.js'
import Booking from './src/models/Booking.js'

dotenv.config()

const randInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1))
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]

// Ensure each demo firm shows both "Booking In Progress" (reserved) and
// "Booked Customers" (confirmed) on the Employee Customers tab.
const WANT_RESERVED = 4
const WANT_CONFIRMED = 6

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/real-estate-crm')
    console.log('Connected to MongoDB')

    const firms = await Firm.find({ isDeleted: { $ne: true } })
    let reservedMade = 0, confirmedMade = 0

    for (const firm of firms) {
      const [execs, projects] = await Promise.all([
        User.find({ firm: firm._id, role: 'sales_executive', isActive: true }).select('_id').lean(),
        Project.find({ firm: firm._id, isArchived: { $ne: true } }).select('_id commissionRate').lean(),
      ])
      if (!execs.length || !projects.length) { console.log(`- ${firm.name}: skipped`); continue }

      // Customers that belong to execs and don't already have a booking.
      const bookedCustomerIds = new Set((await Booking.find({ firm: firm._id }).select('customer').lean()).map((b) => String(b.customer)))
      const execIds = execs.map((e) => e._id)
      const candidates = (await Customer.find({
        firm: firm._id,
        assignedTo: { $in: execIds },
        status: { $nin: ['lost'] },
      }).select('_id assignedTo').lean()).filter((c) => !bookedCustomerIds.has(String(c._id)))

      const [haveReserved, haveConfirmed] = await Promise.all([
        Booking.countDocuments({ firm: firm._id, status: 'reserved' }),
        Booking.countDocuments({ firm: firm._id, status: 'confirmed' }),
      ])
      const needReserved = Math.max(0, WANT_RESERVED - haveReserved)
      const needConfirmed = Math.max(0, WANT_CONFIRMED - haveConfirmed)

      const units = await Unit.find({ firm: firm._id, status: 'available' }).limit(needReserved + needConfirmed + 4)
      let ui = 0
      const plan = [
        ...Array(needConfirmed).fill('confirmed'),
        ...Array(needReserved).fill('reserved'),
      ]

      for (const wantStatus of plan) {
        if (ui >= units.length || !candidates.length) break
        const unit = units[ui++]
        const cust = candidates.shift()
        const project = projects.find((p) => String(p._id) === String(unit.project)) || pick(projects)
        const value = unit.currentPrice || unit.basePrice || unit.price || randInt(40, 120) * 100000
        try {
          await Booking.create({
            firm: firm._id,
            customer: cust._id,
            project: unit.project,
            unit: unit._id,
            bookingAmount: Math.round(value * 0.1),
            amountReceived: wantStatus === 'confirmed' ? Math.round(value * 0.1) : 0,
            totalValue: value,
            appliedDiscount: 0,
            commissionEarned: Math.round(value * ((project.commissionRate || 2) / 100)),
            paymentStatus: wantStatus === 'confirmed' ? 'partial' : 'pending',
            status: wantStatus,
            bookedBy: cust.assignedTo,
          })
          unit.status = wantStatus === 'confirmed' ? 'booked' : 'reserved'
          unit.bookedFor = cust._id
          unit.reservedBy = cust.assignedTo
          await unit.save()
          await Customer.updateOne({ _id: cust._id }, { $set: { status: wantStatus === 'confirmed' ? 'booked' : 'negotiation' } })
          if (wantStatus === 'confirmed') confirmedMade++; else reservedMade++
        } catch { /* unit race / dup — skip */ }
      }

      console.log(`- ${firm.name}: bookings topped up`)
    }

    console.log(`\nDone. Reserved created: ${reservedMade} · Confirmed created: ${confirmedMade}.`)
    process.exit(0)
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
}

seed()

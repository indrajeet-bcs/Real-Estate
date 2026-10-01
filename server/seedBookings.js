import mongoose from 'mongoose'
import dotenv from 'dotenv'
import Firm from './src/models/Firm.js'
import User from './src/models/User.js'
import Customer from './src/models/Customer.js'
import Project from './src/models/Project.js'
import Unit from './src/models/Unit.js'
import Booking from './src/models/Booking.js'

dotenv.config()

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
const randInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1))
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d }

const CANCEL_REASONS = ['Customer backed out', 'Payment default', 'Found another property']
const WANT_DRAFTS = 3
const WANT_DISCOUNT_REQS = 3
const WANT_CANCEL_REQS = 2

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/real-estate-crm')
    console.log('Connected to MongoDB')

    const firms = await Firm.find({ isDeleted: { $ne: true } })
    let drafts = 0, discReqs = 0, cancelReqs = 0, enriched = 0

    for (const firm of firms) {
      const [execs, projects] = await Promise.all([
        User.find({ firm: firm._id, role: 'sales_executive', isActive: true }).select('_id name manager').lean(),
        Project.find({ firm: firm._id, isArchived: { $ne: true } }).select('_id builder commissionRate').lean(),
      ])
      if (!execs.length || !projects.length) { console.log(`- ${firm.name}: skipped`); continue }

      // Enrich existing bookings that predate bookingDate/builder/timeline.
      const stale = await Booking.find({ firm: firm._id, $or: [{ bookingDate: { $in: [null, undefined] } }, { timeline: { $size: 0 } }] })
      for (const bk of stale) {
        if (!bk.bookingDate) bk.bookingDate = bk.createdAt || new Date()
        if (!bk.builder) { const p = projects.find((x) => String(x._id) === String(bk.project)); if (p?.builder) bk.builder = p.builder }
        if (!bk.timeline || !bk.timeline.length) bk.timeline = [{ type: 'created', note: 'Booking created', at: bk.createdAt || new Date() }]
        await bk.save()
        enriched++
      }

      // --- Draft bookings (unit NOT reserved) ---
      const haveDrafts = await Booking.countDocuments({ firm: firm._id, status: 'draft' })
      const custs = await Customer.find({ firm: firm._id, assignedTo: { $in: execs.map((e) => e._id) } }).select('_id assignedTo').lean()
      const usedUnits = new Set((await Booking.find({ firm: firm._id }).select('unit').lean()).map((b) => String(b.unit)))
      const freeUnits = (await Unit.find({ firm: firm._id, status: 'available' }).select('_id project price basePrice currentPrice').lean()).filter((u) => !usedUnits.has(String(u._id)))

      for (let i = haveDrafts; i < WANT_DRAFTS && i - haveDrafts < freeUnits.length && custs.length; i++) {
        const unit = freeUnits[i - haveDrafts]
        const cust = pick(custs.filter((c) => c.assignedTo)) || pick(custs)
        const value = unit.currentPrice || unit.price || unit.basePrice || randInt(40, 120) * 100000
        const project = projects.find((p) => String(p._id) === String(unit.project)) || pick(projects)
        await Booking.create({
          firm: firm._id, customer: cust._id, project: unit.project, builder: project.builder || undefined, unit: unit._id,
          bookingAmount: Math.round(value * 0.1), amountReceived: 0, totalValue: value,
          bookingDate: daysAgo(randInt(0, 3)), notes: 'Auto-seeded draft booking.',
          paymentStatus: 'pending', status: 'draft', bookedBy: cust.assignedTo || pick(execs)._id,
          timeline: [{ type: 'created', note: 'Draft booking created' }],
        })
        drafts++
      }

      // --- Pending discount requests on reserved/confirmed bookings ---
      const discCandidates = await Booking.find({ firm: firm._id, status: { $in: ['reserved', 'confirmed'] }, 'discountRequest.status': { $ne: 'pending' }, discount: { $exists: false } }).limit(WANT_DISCOUNT_REQS)
      const havePendingDisc = await Booking.countDocuments({ firm: firm._id, 'discountRequest.status': 'pending' })
      for (let i = havePendingDisc; i < WANT_DISCOUNT_REQS && i - havePendingDisc < discCandidates.length; i++) {
        const bk = discCandidates[i - havePendingDisc]
        const exec = execs.find((e) => String(e._id) === String(bk.bookedBy)) || pick(execs)
        const saleAmount = bk.totalValue || randInt(40, 120) * 100000
        const firmDiscount = Math.round(saleAmount * 0.02)
        const builderDiscount = Math.round(saleAmount * 0.01)
        const totalDiscount = firmDiscount + builderDiscount
        bk.discountRequest = {
          status: 'pending', saleAmount, givenBy: pick(['admin', 'sub_admin', 'builder_sales_executive']),
          source: 'combined', firmDiscount, builderDiscount, totalDiscount, finalSaleAmount: saleAmount - totalDiscount,
          remarks: 'Negotiated discount to close the deal.', requestedBy: exec._id, requestedByName: exec.name,
        }
        bk.timeline.push({ type: 'discount_requested', note: `Discount of ₹${totalDiscount} requested` })
        await bk.save()
        discReqs++
      }

      // --- Pending cancellation requests on confirmed bookings ---
      const cancelCandidates = await Booking.find({ firm: firm._id, status: { $in: ['reserved', 'confirmed'] }, 'cancellationRequest.status': { $ne: 'pending' } }).limit(WANT_CANCEL_REQS + 2)
      const havePendingCancel = await Booking.countDocuments({ firm: firm._id, 'cancellationRequest.status': 'pending' })
      let made = 0
      for (const bk of cancelCandidates) {
        if (havePendingCancel + made >= WANT_CANCEL_REQS) break
        if (bk.discountRequest?.status === 'pending') continue // keep the two request types on different bookings
        const exec = execs.find((e) => String(e._id) === String(bk.bookedBy)) || pick(execs)
        bk.cancellationRequest = { status: 'pending', reason: pick(CANCEL_REASONS), remarks: 'Auto-seeded cancellation request.', requestedBy: exec._id, requestedByName: exec.name }
        bk.timeline.push({ type: 'cancellation_requested', note: bk.cancellationRequest.reason })
        await bk.save()
        cancelReqs++; made++
      }

      console.log(`- ${firm.name}: bookings enriched + requests seeded`)
    }

    console.log(`\nDone. Drafts: ${drafts} · Discount requests: ${discReqs} · Cancellation requests: ${cancelReqs} · Enriched: ${enriched}.`)
    process.exit(0)
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
}

seed()

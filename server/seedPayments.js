import mongoose from 'mongoose'
import dotenv from 'dotenv'
import Firm from './src/models/Firm.js'
import User from './src/models/User.js'
import Booking from './src/models/Booking.js'
import Customer from './src/models/Customer.js'
import Unit from './src/models/Unit.js'
import Project from './src/models/Project.js'
import AuditLog from './src/models/AuditLog.js'
import Payment from './src/models/Payment.js'
import { MODULES, AUDIT_ACTIONS } from './src/config/constants.js'
import { PAYMENT_METHODS, COLLECTED_STATUSES } from './src/config/payment.js'

dotenv.config()

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
const randInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1))
const daysAgo = (d) => new Date(Date.now() - d * 86400000)

// Weighted status: mostly collected, some pending, few cancelled/refunded.
function weightedStatus() {
  const r = Math.random()
  if (r < 0.45) return 'received'
  if (r < 0.70) return 'verified'
  if (r < 0.85) return 'pending'
  if (r < 0.95) return 'cancelled'
  return 'refunded'
}

async function syncBooking(bookingId) {
  const agg = await Payment.aggregate([
    { $match: { booking: bookingId, isDeleted: { $ne: true }, status: { $in: COLLECTED_STATUSES } } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ])
  const received = agg[0]?.total || 0
  const booking = await Booking.findById(bookingId)
  if (!booking) return
  booking.amountReceived = received
  const due = booking.totalValue || booking.bookingAmount || 0
  booking.paymentStatus = received <= 0 ? 'pending' : due && received >= due ? 'completed' : 'partial'
  await booking.save()
}

// A payment needs a booking. Firms that have customers + available units but no
// bookings get a few demo bookings so the Payment module has something to attach
// to (the module is booking-driven).
async function ensureBookings(firm) {
  if (await Booking.countDocuments({ firm: firm._id }) > 0) return
  const customers = await Customer.find({ firm: firm._id }).select('name assignedTo').limit(12).lean()
  const units = await Unit.find({ firm: firm._id, status: 'available' }).select('unitNumber project basePrice price').limit(10).lean()
  const admin = await User.findOne({ firm: firm._id, role: 'admin' }).select('_id').lean()
  if (customers.length === 0 || units.length === 0) return
  const n = Math.min(customers.length, units.length, 8)
  let made = 0
  for (let i = 0; i < n; i++) {
    const cust = customers[i]
    const unit = units[i]
    const amount = unit.basePrice || unit.price || randInt(2500000, 9000000)
    try {
      await Booking.create({
        firm: firm._id, customer: cust._id, project: unit.project, unit: unit._id,
        bookingAmount: Math.round(amount * 0.1), totalValue: amount,
        status: 'confirmed', paymentStatus: 'pending',
        bookedBy: cust.assignedTo || admin?._id, bookingDate: daysAgo(randInt(30, 150)),
      })
      await Unit.updateOne({ _id: unit._id }, { $set: { status: 'booked' } })
      made += 1
    } catch { /* skip unit-already-booked conflicts */ }
  }
  if (made) console.log(`  + ${firm.name}: created ${made} demo bookings`)
}

async function seedFirm(firm) {
  if (await Payment.countDocuments({ firm: firm._id }) > 0) { console.log(`  · ${firm.name}: already has payments — skipped`); return 0 }
  const bookings = await Booking.find({ firm: firm._id, status: { $ne: 'cancelled' } })
    .populate({ path: 'customer', select: 'name assignedTo', populate: { path: 'assignedTo', select: 'name branch' } })
    .populate('project', 'name').populate('unit', 'unitNumber').lean()
  if (bookings.length === 0) { console.log(`  · ${firm.name}: no bookings — skipped`); return 0 }

  const admin = await User.findOne({ firm: firm._id, role: 'admin' }).lean()
  let seq = 0, receiptSeq = 0, made = 0

  for (const bk of bookings) {
    const due = bk.totalValue || bk.bookingAmount || randInt(2000000, 9000000)
    const exec = bk.customer?.assignedTo
    const enteredBy = admin || exec
    if (!enteredBy) continue
    const nEntries = randInt(1, 3)
    let remaining = Math.round(due * (0.3 + Math.random() * 0.7))

    for (let i = 0; i < nEntries; i++) {
      const isLast = i === nEntries - 1
      const amount = isLast ? Math.max(50000, remaining) : Math.max(50000, Math.round(remaining / (nEntries - i) * (0.6 + Math.random() * 0.6)))
      remaining = Math.max(0, remaining - amount)
      const status = i === 0 ? (Math.random() < 0.8 ? pick(['received', 'verified']) : weightedStatus()) : weightedStatus()
      const method = pick(PAYMENT_METHODS)
      const when = daysAgo(randInt(0, 120))
      seq += 1
      const hasReceipt = Math.random() < 0.4
      if (hasReceipt) receiptSeq += 1

      const activity = [{ type: 'created', note: `Payment recorded (${method})`, actor: enteredBy._id, actorName: enteredBy.name, at: when }]
      if (status === 'verified') activity.push({ type: 'verified', note: 'Verified', actor: enteredBy._id, actorName: enteredBy.name, at: when })

      const payment = await Payment.create({
        firm: firm._id,
        paymentCode: `PAY-${String(seq).padStart(4, '0')}`,
        booking: bk._id,
        customer: bk.customer?._id, customerName: bk.customer?.name,
        project: bk.project?._id || null, projectName: bk.project?.name || '',
        unit: bk.unit?._id || null, unitNumber: bk.unit?.unitNumber || '',
        branch: exec?.branch || '',
        assignedTo: exec?._id || null,
        amount, paymentDate: when, method, status,
        transactionId: ['bank_transfer', 'upi', 'debit_card', 'credit_card'].includes(method) ? `TXN${randInt(100000, 999999)}${seq}` : '',
        chequeNumber: method === 'cheque' ? `${randInt(100000, 999999)}` : '',
        bankName: ['cheque', 'bank_transfer', 'demand_draft'].includes(method) ? pick(['HDFC', 'ICICI', 'SBI', 'Axis', 'Kotak']) : '',
        upiId: method === 'upi' ? `cust${randInt(10, 99)}@okhdfc` : '',
        receivedBy: enteredBy._id, receivedByName: enteredBy.name,
        enteredBy: enteredBy._id, enteredByName: enteredBy.name,
        verifiedBy: status === 'verified' ? enteredBy._id : null, verifiedByName: status === 'verified' ? enteredBy.name : '', verifiedAt: status === 'verified' ? when : undefined,
        refundAmount: status === 'refunded' ? amount : 0, refundedAt: status === 'refunded' ? when : undefined,
        remarks: '',
        receipt: hasReceipt ? { receiptNumber: `RCPT-${String(receiptSeq).padStart(4, '0')}`, fileName: 'receipt.pdf', fileUrl: '/uploads/demo-receipt.pdf', mimeType: 'application/pdf', uploadedBy: enteredBy._id, uploadedByName: enteredBy.name, uploadedAt: when } : undefined,
        activity,
      })
      await AuditLog.create({ firm: firm._id, actor: enteredBy._id, actorRole: enteredBy.role, action: AUDIT_ACTIONS.CREATE, module: MODULES.PAYMENT, targetId: payment._id, targetLabel: payment.paymentCode, description: `Recorded payment ${payment.paymentCode} of ₹${amount} for ${payment.customerName}`, createdAt: when })
      if (status === 'verified') await AuditLog.create({ firm: firm._id, actor: enteredBy._id, actorRole: enteredBy.role, action: AUDIT_ACTIONS.STATUS_CHANGE, module: MODULES.PAYMENT, targetId: payment._id, targetLabel: payment.paymentCode, description: `Payment ${payment.paymentCode} → verified`, createdAt: when })
      made += 1
    }
    await syncBooking(bk._id)
  }
  console.log(`  ✓ ${firm.name}: ${made} payments across ${bookings.length} bookings`)
  return made
}

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/real-estate-crm')
    console.log('Connected to MongoDB')
    // Seed for live firms that have users (the ones a user can actually log into).
    const firmIds = await User.distinct('firm', { firm: { $ne: null } })
    const firms = await Firm.find({ _id: { $in: firmIds }, isDeleted: { $ne: true } })
    if (firms.length === 0) { console.log('No live firms with users found — run seedDemo first.'); return }
    let total = 0
    for (const firm of firms) { await ensureBookings(firm); total += await seedFirm(firm) }
    console.log(`\nDone. Seeded ${total} payments across ${firms.length} firm(s).`)
  } catch (err) {
    console.error('Seed failed:', err)
    process.exitCode = 1
  } finally {
    await mongoose.disconnect()
  }
}

seed()

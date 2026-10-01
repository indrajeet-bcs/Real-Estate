// Seeds demo Loan cases for each active firm (idempotent per firm). Run:
//   node seedLoans.js
import mongoose from 'mongoose'
import dotenv from 'dotenv'
import Firm from './src/models/Firm.js'
import User from './src/models/User.js'
import Booking from './src/models/Booking.js'
import Customer from './src/models/Customer.js'
import Project from './src/models/Project.js'
import Unit from './src/models/Unit.js'
import LoanCase from './src/models/LoanCase.js'
import { ROLES } from './src/config/constants.js'

dotenv.config()

const BANKS = ['HDFC Bank', 'SBI Home Loans', 'ICICI Bank', 'Axis Bank', 'LIC Housing Finance']
const TYPES = ['Home Loan', 'Property Loan', 'Construction Loan']
const STATUSES = ['Documents Pending', 'Under Review', 'Submitted', 'Sanctioned', 'Partially Disbursed', 'Fully Disbursed']
const pick = (a, i) => a[i % a.length]

async function run() {
  await mongoose.connect(process.env.MONGO_URI)
  console.log('Connected. Seeding loan cases…')

  const firms = await Firm.find({ isDeleted: { $ne: true } }).lean()
  let created = 0

  for (const firm of firms) {
    const existing = await LoanCase.countDocuments({ firm: firm._id })
    if (existing > 0) { console.log(`  = ${firm.name}: ${existing} loan cases exist — skipping`); continue }

    const execs = await User.find({ firm: firm._id, role: ROLES.SALES_EXECUTIVE }).lean()
    const bookings = await Booking.find({ firm: firm._id }).populate('customer', 'name').populate('project', 'name').populate('unit', 'unitNumber').limit(8).lean()
    const customers = await Customer.find({ firm: firm._id }).limit(8).lean()

    const sources = bookings.length ? bookings : customers.map((c) => ({ customer: c, _id: null }))
    if (sources.length === 0) { console.log(`  - ${firm.name}: no bookings/customers — skipping`); continue }

    let n = 0
    for (let i = 0; i < Math.min(6, sources.length); i++) {
      const s = sources[i]
      const exec = execs.length ? pick(execs, i) : null
      const amount = 2500000 + (i % 5) * 750000
      const status = pick(STATUSES, i)
      const sanctioned = ['Sanctioned', 'Partially Disbursed', 'Fully Disbursed'].includes(status) ? amount - 200000 : null
      const disbursed = status === 'Fully Disbursed' ? sanctioned : status === 'Partially Disbursed' ? Math.round(sanctioned / 2) : 0
      await LoanCase.create({
        firm: firm._id,
        branch: exec?.branch,
        customer: s.customer?._id || null,
        customerName: s.customer?.name || `Customer ${i + 1}`,
        booking: s._id || null,
        bookingLabel: s.bookingId || s.bookingCode || (s._id ? String(s._id).slice(-6).toUpperCase() : ''),
        project: s.project?.name || 'Demo Project',
        unitNumber: s.unit?.unitNumber || `U-${100 + i}`,
        loanRequired: true,
        loanAmount: amount,
        bank: pick(BANKS, i),
        loanType: pick(TYPES, i),
        applicationNumber: status === 'Documents Pending' ? '' : `APP/${firm.companyId || 'X'}/${1000 + i}`,
        assignedExecutive: exec?._id || null,
        assignedExecutiveName: exec?.name,
        status,
        sanctionedAmount: sanctioned,
        disbursedAmount: disbursed,
        timeline: [{ user: 'Seed', activity: 'Loan Case Created', remarks: 'Seeded demo case' }],
      })
      n++; created++
    }
    console.log(`  + ${firm.name}: created ${n} loan cases`)
  }

  console.log(`Done. ${created} loan cases created.`)
  await mongoose.connection.close()
  process.exit(0)
}

run().catch(async (err) => { console.error(err); await mongoose.connection.close().catch(() => {}); process.exit(1) })

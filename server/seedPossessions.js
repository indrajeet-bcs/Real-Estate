// Seeds demo Possession cases per active firm (idempotent). Run: node seedPossessions.js
import mongoose from 'mongoose'
import dotenv from 'dotenv'
import Firm from './src/models/Firm.js'
import User from './src/models/User.js'
import Customer from './src/models/Customer.js'
import PossessionCase, { READINESS_CHECKLIST_ITEMS } from './src/models/PossessionCase.js'
import { ROLES } from './src/config/constants.js'

dotenv.config()

const STATUSES = ['Readiness Check', 'Ready for Possession', 'Scheduled', 'Handover Completed', 'Completed']
const pick = (a, i) => a[i % a.length]

async function run() {
  await mongoose.connect(process.env.MONGO_URI)
  console.log('Connected. Seeding possession cases…')
  const firms = await Firm.find({ isDeleted: { $ne: true } }).lean()
  let created = 0
  for (const firm of firms) {
    if (await PossessionCase.countDocuments({ firm: firm._id }) > 0) { console.log(`  = ${firm.name}: exists — skipping`); continue }
    const execs = await User.find({ firm: firm._id, role: ROLES.SALES_EXECUTIVE }).lean()
    const customers = await Customer.find({ firm: firm._id }).limit(6).lean()
    if (customers.length === 0) { console.log(`  - ${firm.name}: no customers — skipping`); continue }
    let n = 0
    for (let i = 0; i < Math.min(5, customers.length); i++) {
      const c = customers[i]
      const exec = execs.length ? pick(execs, i) : null
      const status = pick(STATUSES, i)
      const advanced = ['Scheduled', 'Handover Completed', 'Completed'].includes(status)
      const done = ['Handover Completed', 'Completed'].includes(status)
      // Complete some checklist items proportional to progress.
      const completeUpto = done ? READINESS_CHECKLIST_ITEMS.length : advanced ? 6 : 3
      const checklist = READINESS_CHECKLIST_ITEMS.map((item, idx) => ({
        item, status: idx < completeUpto ? 'Completed' : 'Pending',
        date: idx < completeUpto ? new Date() : null, user: idx < completeUpto ? (exec?.name || 'Seed') : '',
      }))
      await PossessionCase.create({
        firm: firm._id, branch: exec?.branch, customer: c._id, customerName: c.name,
        bookingLabel: `BK-${1000 + i}`, registrationLabel: `REG/${firm.companyId || 'X'}/${8000 + i}`,
        project: 'Demo Project', unitNumber: `U-${300 + i}`,
        assignedEmployee: exec?._id || null, assignedEmployeeName: exec?.name,
        expectedPossessionDate: new Date(Date.now() + 10 * 864e5),
        scheduledDate: advanced ? new Date(Date.now() + 3 * 864e5) : null,
        scheduledTime: advanced ? '02:00 PM' : '',
        actualPossessionDate: done ? new Date(Date.now() - 2 * 864e5) : null,
        customerConfirmation: done ? 'Confirmed' : 'Pending',
        status, checklist,
        timeline: [{ user: 'Seed', activity: 'Possession Case Created', remarks: 'Seeded demo case' }],
      })
      n++; created++
    }
    console.log(`  + ${firm.name}: created ${n}`)
  }
  console.log(`Done. ${created} possession cases created.`)
  await mongoose.connection.close(); process.exit(0)
}
run().catch(async (e) => { console.error(e); await mongoose.connection.close().catch(() => {}); process.exit(1) })

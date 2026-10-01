// Seeds demo Registration cases per active firm (idempotent). Run: node seedRegistrations.js
import mongoose from 'mongoose'
import dotenv from 'dotenv'
import Firm from './src/models/Firm.js'
import User from './src/models/User.js'
import Customer from './src/models/Customer.js'
import RegistrationCase from './src/models/RegistrationCase.js'
import { ROLES } from './src/config/constants.js'

dotenv.config()

const TYPES = ['Sale Deed Registration', 'Agreement Registration', 'Property Registration']
const STATUSES = ['Documents Pending', 'Ready for Registration', 'Appointment Scheduled', 'Registered', 'Completed']
const OFFICES = ['Sub-Registrar Office, Andheri', 'Sub-Registrar Office, Haveli', 'Sub-Registrar Office, Hinjewadi']
const pick = (a, i) => a[i % a.length]

async function run() {
  await mongoose.connect(process.env.MONGO_URI)
  console.log('Connected. Seeding registration cases…')
  const firms = await Firm.find({ isDeleted: { $ne: true } }).lean()
  let created = 0
  for (const firm of firms) {
    if (await RegistrationCase.countDocuments({ firm: firm._id }) > 0) { console.log(`  = ${firm.name}: exists — skipping`); continue }
    const execs = await User.find({ firm: firm._id, role: ROLES.SALES_EXECUTIVE }).lean()
    const customers = await Customer.find({ firm: firm._id }).limit(6).lean()
    if (customers.length === 0) { console.log(`  - ${firm.name}: no customers — skipping`); continue }
    let n = 0
    for (let i = 0; i < Math.min(5, customers.length); i++) {
      const c = customers[i]
      const exec = execs.length ? pick(execs, i) : null
      const status = pick(STATUSES, i)
      const scheduled = ['Appointment Scheduled'].includes(status)
      const done = ['Registered', 'Completed'].includes(status)
      await RegistrationCase.create({
        firm: firm._id, branch: exec?.branch, customer: c._id, customerName: c.name,
        bookingLabel: `BK-${1000 + i}`, project: 'Demo Project', unitNumber: `U-${200 + i}`,
        registrationType: pick(TYPES, i), assignedEmployee: exec?._id || null, assignedEmployeeName: exec?.name,
        registrationAuthority: pick(OFFICES, i), status,
        appointmentDate: scheduled ? new Date(Date.now() + 5 * 864e5) : (done ? new Date(Date.now() - 5 * 864e5) : null),
        appointmentTime: scheduled || done ? '11:00 AM' : '',
        registrationNumber: done ? `REG/${firm.companyId || 'X'}/${8000 + i}` : '',
        registrationDate: done ? new Date(Date.now() - 5 * 864e5) : null,
        timeline: [{ user: 'Seed', activity: 'Registration Case Created', remarks: 'Seeded demo case' }],
      })
      n++; created++
    }
    console.log(`  + ${firm.name}: created ${n}`)
  }
  console.log(`Done. ${created} registration cases created.`)
  await mongoose.connection.close(); process.exit(0)
}
run().catch(async (e) => { console.error(e); await mongoose.connection.close().catch(() => {}); process.exit(1) })

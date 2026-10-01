// Rich demo seed: populates the whole hierarchy so every dashboard/report has
// data. Run: npm run seed:demo
//
// WARNING: this WIPES all existing CRM data and rebuilds a fresh demo dataset.
import mongoose from 'mongoose'
import { connectDB } from '../config/db.js'
import Firm from '../models/Firm.js'
import User from '../models/User.js'
import Builder from '../models/Builder.js'
import Project from '../models/Project.js'
import Unit from '../models/Unit.js'
import Customer from '../models/Customer.js'
import FollowUp from '../models/FollowUp.js'
import Booking from '../models/Booking.js'
import Attendance from '../models/Attendance.js'
import Notification from '../models/Notification.js'
import AuditLog from '../models/AuditLog.js'
import ImportBatch from '../models/ImportBatch.js'
import SystemSetting from '../models/SystemSetting.js'
import {
  ROLES, CUSTOMER_STATUS, LEAD_SOURCES, UNIT_STATUS, BOOKING_STATUS, FOLLOWUP_STATUS,
} from '../config/constants.js'

const PASSWORD = 'Password@123' // shared demo password for every generated account

// --- tiny helpers (plain node script — Math.random/Date are fine here) ---
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
const rint = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min
const daysFromNow = (d) => new Date(Date.now() + d * 24 * 60 * 60 * 1000)
let mobileSeq = 9000000000

function nextMobile() {
  mobileSeq += rint(137, 991)
  return String(mobileSeq)
}

const FIRST = ['Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Sai', 'Reyansh', 'Ayaan', 'Krishna', 'Ishaan', 'Diya', 'Ananya', 'Priya', 'Aadhya', 'Anika', 'Navya', 'Riya', 'Kavya', 'Neha', 'Pooja']
const LAST = ['Sharma', 'Verma', 'Patel', 'Nair', 'Reddy', 'Iyer', 'Gupta', 'Mehta', 'Shah', 'Rao', 'Kapoor', 'Singh', 'Desai', 'Joshi', 'Malhotra']
const personName = () => `${pick(FIRST)} ${pick(LAST)}`
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '')

// --- firm blueprints ---
const FIRMS = [
  {
    name: 'Skyline Realty', region: 'West', city: 'Mumbai', branches: ['Andheri', 'Bandra'],
    builders: ['Lodha Group', 'Godrej Properties']
  },
  {
    name: 'Metro Homes', region: 'North', city: 'Delhi', branches: ['Dwarka', 'Rohini'],
    builders: ['DLF', 'Unitech']
  },
  {
    name: 'Coastal Estates', region: 'South', city: 'Goa', branches: ['Panaji'],
    builders: ['Prestige Group', 'Sobha Ltd']
  },
]

const PROPERTY_TYPES = ['apartment', 'villa', 'plot', 'commercial']
const UNIT_TYPES = ['1BHK', '2BHK', '3BHK', '4BHK', 'Penthouse']

async function wipe() {
  await Promise.all([
    Firm.deleteMany({}), User.deleteMany({}), Builder.deleteMany({}), Project.deleteMany({}),
    Unit.deleteMany({}), Customer.deleteMany({}), FollowUp.deleteMany({}), Booking.deleteMany({}),
    Attendance.deleteMany({}), Notification.deleteMany({}), AuditLog.deleteMany({}),
    ImportBatch.deleteMany({}), SystemSetting.deleteMany({}),
  ])
}

async function seed() {
  await connectDB()
  console.log('[seed:demo] Wiping existing data…')
  await wipe()

  // 1. Super Admin
  const superAdmin = await User.create({
    name: 'Platform Owner', email: 'superadmin@crm.local', password: PASSWORD,
    role: ROLES.SUPER_ADMIN, firm: null, isActive: true,
  })
  console.log('[seed:demo] Super Admin created')

  await SystemSetting.create({ key: 'global', updatedBy: superAdmin._id })

  const credentials = [['Super Admin', 'superadmin@crm.local']]

  // 2. Firms and their full hierarchies
  for (const f of FIRMS) {
    const domain = slug(f.name) + '.com'

    const firm = await Firm.create({
      name: f.name, region: f.region, plan: 'standard', branches: f.branches,
      contactEmail: `contact@${domain}`, isActive: true, createdBy: superAdmin._id,
    })

    // Admin (firm owner)
    const admin = await User.create({
      name: `${personName()}`, email: `admin@${domain}`, password: PASSWORD,
      role: ROLES.ADMIN, firm: firm._id, isActive: true, createdBy: superAdmin._id,
    })
    credentials.push([`Admin · ${f.name}`, `admin@${domain}`])

    // 2 Sub-Admins
    const subAdmins = []
    for (let i = 1; i <= 2; i++) {
      const sa = await User.create({
        name: personName(), email: `subadmin${i}@${domain}`, password: PASSWORD,
        role: ROLES.SUB_ADMIN, firm: firm._id, branch: pick(f.branches), manager: admin._id,
        isActive: true, createdBy: admin._id,
      })
      subAdmins.push(sa)
      credentials.push([`Sub-Admin · ${f.name}`, `subadmin${i}@${domain}`])
    }

    // 4 Sales Executives (split under the sub-admins)
    const execs = []
    for (let i = 1; i <= 4; i++) {
      const manager = subAdmins[i % subAdmins.length]
      const ex = await User.create({
        name: personName(), email: `exec${i}@${domain}`, password: PASSWORD,
        role: ROLES.SALES_EXECUTIVE, firm: firm._id, branch: manager.branch, manager: manager._id,
        isActive: true, createdBy: manager._id,
      })
      execs.push(ex)
      credentials.push([`Executive · ${f.name}`, `exec${i}@${domain}`])
    }

    // 2 Builders
    const builders = []
    for (const bname of f.builders) {
      const b = await Builder.create({
        name: bname, firm: firm._id, contactPerson: personName(),
        phone: nextMobile(), email: `sales@${slug(bname)}.com`, createdBy: admin._id,
      })
      builders.push(b)
    }

    // 3 Projects across the builders, each with units
    const projects = []
    const allUnits = []
    for (let p = 1; p <= 3; p++) {
      const builder = pick(builders)
      const proj = await Project.create({
        name: `${f.city} ${pick(['Heights', 'Residency', 'Gardens', 'Towers', 'Enclave'])} ${p}`,
        firm: firm._id, builder: builder._id, location: pick(f.branches), city: f.city,
        propertyType: pick(PROPERTY_TYPES), createdBy: admin._id,
      })
      projects.push(proj)

      // 6–8 units per project
      const unitDocs = []
      const count = rint(6, 8)
      for (let u = 1; u <= count; u++) {
        unitDocs.push({
          firm: firm._id, project: proj._id,
          unitNumber: `${String.fromCharCode(65 + (u % 4))}-${100 + u}`,
          unitType: pick(UNIT_TYPES), floor: String(rint(1, 20)),
          areaSqft: rint(600, 2500), price: rint(40, 250) * 100000,
          status: UNIT_STATUS.AVAILABLE, createdBy: admin._id,
        })
      }
      const created = await Unit.insertMany(unitDocs)
      allUnits.push(...created)
    }

    // ~12 Customers/leads, assigned round-robin to execs, varied statuses
    const statuses = [
      CUSTOMER_STATUS.NEW, CUSTOMER_STATUS.NEW, CUSTOMER_STATUS.IN_PROGRESS,
      CUSTOMER_STATUS.IN_PROGRESS, CUSTOMER_STATUS.FOLLOW_UP_DUE, CUSTOMER_STATUS.BOOKED,
      CUSTOMER_STATUS.LOST,
    ]
    const customers = []
    for (let c = 0; c < 12; c++) {
      const exec = execs[c % execs.length]
      const status = pick(statuses)
      const cust = await Customer.create({
        firm: firm._id, name: personName(), mobile: nextMobile(),
        email: `lead${c}@example.com`, source: pick(LEAD_SOURCES),
        status, assignedTo: exec._id, assignedAt: new Date(),
        budgetMin: rint(30, 60) * 100000, budgetMax: rint(70, 200) * 100000,
        interestedProjects: [{ project: pick(projects)._id, interestLevel: pick(['cold', 'warm', 'hot']) }],
        createdBy: exec._id,
        lostReason: status === CUSTOMER_STATUS.LOST ? 'Budget mismatch' : undefined,
      })
      cust.notes.push({ type: 'call', text: 'Initial contact made, shared brochure.', createdBy: exec._id })
      cust.logActivity('created', 'Lead created during demo seed', exec._id)
      await cust.save()
      customers.push({ cust, exec })
    }

    // Follow-ups: schedule for in-progress / follow-up-due customers
    for (const { cust, exec } of customers) {
      if ([CUSTOMER_STATUS.IN_PROGRESS, CUSTOMER_STATUS.FOLLOW_UP_DUE].includes(cust.status)) {
        const associatedProject = (cust.interestedProjects && cust.interestedProjects[0]?.project) || pick(projects)._id
        await FollowUp.create({
          firm: firm._id, customer: cust._id, assignedTo: exec._id,
          scheduledAt: daysFromNow(rint(-3, 5)), priority: pick(['low', 'medium', 'high']),
          status: FOLLOWUP_STATUS.SCHEDULED, notes: 'Discuss pricing and site visit.', createdBy: exec._id,
          type: pick(['call', 'whatsapp', 'email', 'meeting', 'visit', 'document', 'payment', 'negotiation', 'booking_discussion', 'loan_assistance', 'callback']),
          purpose: pick(['Discuss booking amount', 'Follow up on site visit interest', 'Collect documents', 'Pricing negotiation']),
          project: associatedProject,
          customerStage: cust.status,
          lastFollowupSummary: 'Initial contact made, shared brochure and property details.'
        })
      }
    }

    // Bookings: for each "booked" customer, reserve+confirm an available unit
    for (const { cust, exec } of customers) {
      if (cust.status !== CUSTOMER_STATUS.BOOKED) continue
      const unit = allUnits.find((u) => u.status === UNIT_STATUS.AVAILABLE)
      if (!unit) continue
      unit.status = UNIT_STATUS.BOOKED
      await unit.save()
      const amount = rint(2, 10) * 100000
      await Booking.create({
        firm: firm._id, customer: cust._id, project: unit.project, unit: unit._id,
        bookingAmount: amount, paymentMode: pick(['cheque', 'bank_transfer', 'loan']),
        totalValue: unit.price, status: BOOKING_STATUS.CONFIRMED, bookedBy: exec._id,
        paymentMilestones: [
          { label: 'Token', amount: Math.round(amount * 0.3), paid: true, paidDate: new Date() },
          { label: 'On agreement', amount: Math.round(amount * 0.7), paid: false, dueDate: daysFromNow(30) },
        ],
      })
    }

    // Attendance: today's records for executives
    const today = new Date().toISOString().slice(0, 10)
    for (const ex of execs) {
      const checkIn = new Date(); checkIn.setHours(rint(9, 11), rint(0, 59), 0, 0)
      await Attendance.create({
        firm: firm._id, user: ex._id, date: today,
        checkInAt: checkIn, checkInLocation: { lat: 19.07, lng: 72.87, address: firm.name },
        status: checkIn.getHours() >= 11 ? 'late' : 'on_time',
      })
    }

    console.log(`[seed:demo] ${f.name}: 1 admin, ${subAdmins.length} sub-admins, ${execs.length} execs, ${builders.length} builders, ${projects.length} projects, ${customers.length} customers`)
  }

  // Summary
  console.log('\n=====================================================')
  console.log(' DEMO DATA READY — all accounts use password:', PASSWORD)
  console.log('=====================================================')
  for (const [role, email] of credentials) {
    console.log(`  ${role.padEnd(26)} ${email}`)
  }
  console.log('=====================================================\n')

  await mongoose.connection.close()
  process.exit(0)
}

seed().catch(async (err) => {
  console.error('[seed:demo] failed:', err)
  await mongoose.connection.close().catch(() => { })
  process.exit(1)
})

import mongoose from 'mongoose'
import dotenv from 'dotenv'
import Firm from './src/models/Firm.js'
import User from './src/models/User.js'

dotenv.config()

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
const randInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1))
const yearsAgo = (y) => { const d = new Date(); d.setFullYear(d.getFullYear() - y); d.setMonth(randInt(0, 11), randInt(1, 28)); return d }

const BLOOD = ['O+', 'O-', 'A+', 'B+', 'AB+', 'A-']
const GENDER = ['male', 'female']
const MARITAL = ['single', 'married']
const DEPTS = ['Sales', 'Sales & Leasing', 'Residential Sales']
const AREAS = ['Baner', 'Wakad', 'Kharadi', 'Viman Nagar', 'Hinjewadi', 'Andheri', 'Powai']
const FIRST = ['Rahul', 'Priya', 'Amit', 'Sneha', 'Karan', 'Neha', 'Vikram', 'Pooja', 'Rohit', 'Anjali']
const LAST = ['Sharma', 'Verma', 'Patel', 'Gupta', 'Mehta', 'Nair', 'Reddy', 'Joshi']

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/real-estate-crm')
    console.log('Connected to MongoDB')

    const firms = await Firm.find({ isDeleted: { $ne: true } })
    let updated = 0

    for (const firm of firms) {
      const execs = await User.find({ firm: firm._id, role: 'sales_executive', isActive: true })
      let n = 0
      for (const e of execs) {
        let touched = false
        const setIf = (field, val) => { if (e[field] === undefined || e[field] === null || e[field] === '' || (typeof e[field] === 'number' && !e[field] && field !== 'targetRevenue')) { e[field] = val; touched = true } }

        if (!e.employeeId) { e.employeeId = `EMP-${String(randInt(1000, 9999))}`; touched = true }
        if (!e.employeeCode) { e.employeeCode = `EC-${String(randInt(10000, 99999))}`; touched = true }
        setIf('department', pick(DEPTS))
        setIf('designation', 'Sales Executive')
        if (!e.joiningDate) { e.joiningDate = yearsAgo(randInt(1, 4)); touched = true }
        if (!e.dob) { e.dob = yearsAgo(randInt(24, 40)); touched = true }
        if (!e.gender) { e.gender = pick(GENDER); touched = true }
        if (!e.bloodGroup) { e.bloodGroup = pick(BLOOD); touched = true }
        if (!e.maritalStatus) { e.maritalStatus = pick(MARITAL); touched = true }
        if (!e.address) { e.address = `${randInt(1, 200)}, ${pick(AREAS)}, ${firm.name.split(' ')[0]} City`; touched = true }
        if (!e.emergencyContactName) { e.emergencyContactName = `${pick(FIRST)} ${pick(LAST)}`; touched = true }
        if (!e.emergencyContactNumber) { e.emergencyContactNumber = `9${randInt(100000000, 999999999)}`; touched = true }
        if (!e.phone) { e.phone = `9${randInt(100000000, 999999999)}`; touched = true }
        if (!e.passwordChangedAt) { e.passwordChangedAt = e.joiningDate; touched = true }
        if (!e.lastLoginDevice) { e.lastLoginDevice = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120'; touched = true }
        if (!e.preferences || !e.preferences.language) { e.preferences = { language: 'en', timeFormat: pick(['12h', '24h']), dateFormat: 'DD MMM YYYY' }; touched = true }

        if (touched) { await e.save(); updated++; n++ }
      }
      console.log(`- ${firm.name}: ${n} executive profile(s) enriched`)
    }

    console.log(`\nDone. Profiles enriched: ${updated}.`)
    process.exit(0)
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
}

seed()

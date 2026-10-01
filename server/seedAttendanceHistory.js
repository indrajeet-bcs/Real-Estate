import mongoose from 'mongoose'
import dotenv from 'dotenv'
import Firm from './src/models/Firm.js'
import User from './src/models/User.js'
import Attendance from './src/models/Attendance.js'

dotenv.config()

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
const randInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1))
const dayKey = (d) => { const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, '0'); const dd = String(d.getDate()).padStart(2, '0'); return `${y}-${m}-${dd}` }

const OFFICE = { lat: 18.5204, lng: 73.8567, address: 'Office HQ, Baner' }
const jitter = () => ({ lat: OFFICE.lat + (Math.random() - 0.5) * 0.02, lng: OFFICE.lng + (Math.random() - 0.5) * 0.02, address: OFFICE.address })
const REMARKS = ['', '', '', 'Client meeting in the morning', 'WFH first half', 'Field visit', 'Late due to traffic']

// Weekday dates from `start` up to (and including) `end`.
function weekdays(start, end) {
  const out = []
  const d = new Date(start)
  while (d <= end) {
    const day = d.getDay()
    if (day !== 0 && day !== 6) out.push(new Date(d))
    d.setDate(d.getDate() + 1)
  }
  return out
}

function buildRecord(firm, user, date) {
  const key = dayKey(date)
  // ~7% fully absent.
  if (Math.random() < 0.07) return { firm, user, date: key, status: 'absent', workedMinutes: 0 }

  const inH = randInt(9, 10)
  const inM = inH === 10 ? randInt(0, 55) : randInt(30, 59)
  const checkInAt = new Date(date); checkInAt.setHours(inH, inM, 0, 0)
  // Late if after 10:30.
  const late = inH === 10 && inM > 30
  // ~12% half day.
  const half = Math.random() < 0.12
  const workMin = half ? randInt(150, 235) : randInt(490, 570)
  const checkOutAt = new Date(checkInAt.getTime() + workMin * 60000)
  const status = half ? 'half_day' : late ? 'late' : 'on_time'
  return {
    firm, user, date: key, status,
    checkInAt, checkInLocation: jitter(), checkInRemarks: pick(REMARKS) || undefined,
    checkOutAt, checkOutLocation: jitter(), checkOutRemarks: undefined,
    workedMinutes: workMin,
  }
}

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/real-estate-crm')
    console.log('Connected to MongoDB')

    const now = new Date()
    const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1); yesterday.setHours(23, 59, 59, 999)
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)
    // Current month up to yesterday + all of previous month (leave today open for a live check-in).
    const dates = [...weekdays(prevMonthStart, prevMonthEnd), ...weekdays(thisMonthStart, yesterday)]

    const firms = await Firm.find({ isDeleted: { $ne: true } })
    let created = 0

    for (const firm of firms) {
      const execs = await User.find({ firm: firm._id, role: 'sales_executive', isActive: true }).select('_id').lean()
      if (!execs.length) { console.log(`- ${firm.name}: skipped`); continue }

      for (const exec of execs) {
        const existing = new Set((await Attendance.find({ user: exec._id }).select('date').lean()).map((r) => r.date))
        const docs = dates.filter((d) => !existing.has(dayKey(d))).map((d) => buildRecord(firm._id, exec._id, d))
        if (docs.length) { await Attendance.insertMany(docs, { ordered: false }).catch(() => {}); created += docs.length }
      }
      console.log(`- ${firm.name}: attendance history seeded`)
    }

    console.log(`\nDone. Attendance records created: ${created}.`)
    process.exit(0)
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
}

seed()

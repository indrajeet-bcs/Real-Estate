import mongoose from 'mongoose'
import dotenv from 'dotenv'
import Firm from './src/models/Firm.js'
import User from './src/models/User.js'
import Attendance from './src/models/Attendance.js'
import LeaveRequest from './src/models/LeaveRequest.js'
import AttendanceCorrection from './src/models/AttendanceCorrection.js'

dotenv.config()

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
const randInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1))
const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// A few realistic GPS points with addresses (Pune area).
const LOCATIONS = [
  { lat: 18.5589, lng: 73.7869, accuracy: 12, address: 'Baner Road, Pune' },
  { lat: 18.5204, lng: 73.8567, accuracy: 15, address: 'FC Road, Shivajinagar, Pune' },
  { lat: 18.5679, lng: 73.9143, accuracy: 10, address: 'Viman Nagar, Pune' },
  { lat: 18.5089, lng: 73.9260, accuracy: 18, address: 'Magarpatta City, Hadapsar, Pune' },
]

// Build the last N weekdays (skip Sat/Sun).
function recentWeekdays(n) {
  const days = []
  const d = new Date()
  while (days.length < n) {
    if (d.getDay() !== 0 && d.getDay() !== 6) days.push(new Date(d))
    d.setDate(d.getDate() - 1)
  }
  return days
}

function buildAttendance(firmId, user, date) {
  const status = pick(['on_time', 'on_time', 'on_time', 'late', 'half_day', 'absent'])
  const base = { firm: firmId, user: user._id, date: dayKey(date) }
  if (status === 'absent') return { ...base, status: 'absent', workedMinutes: 0 }

  const inHour = status === 'late' ? 11 : 9
  const inMin = status === 'late' ? randInt(0, 45) : randInt(0, 25)
  const checkInAt = new Date(date); checkInAt.setHours(inHour, inMin, 0, 0)
  const workMinutes = status === 'half_day' ? randInt(120, 230) : randInt(480, 540)
  const checkOutAt = new Date(checkInAt.getTime() + workMinutes * 60000)

  return {
    ...base,
    status,
    checkInAt,
    checkOutAt,
    workedMinutes: workMinutes,
    checkInLocation: pick(LOCATIONS),
    checkOutLocation: pick(LOCATIONS),
  }
}

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/real-estate-crm')
    console.log('Connected to MongoDB')

    const firms = await Firm.find({ isDeleted: { $ne: true } })
    if (!firms.length) { console.log('No firms found. Run npm run seed:demo first.'); process.exit(1) }

    let att = 0, lv = 0, corr = 0
    for (const firm of firms) {
      const execs = await User.find({ firm: firm._id, role: 'sales_executive', isActive: true }).select('_id name branch manager').lean()
      const subAdmin = await User.findOne({ firm: firm._id, role: 'sub_admin', isActive: true }).select('_id').lean()
      if (!execs.length) { console.log(`- ${firm.name}: skipped (no executives)`); continue }

      // --- Attendance (last 10 weekdays per executive) — upsert avoids dup (user,date). ---
      const weekdays = recentWeekdays(10)
      const ops = []
      for (const exec of execs) {
        for (const day of weekdays) {
          const doc = buildAttendance(firm._id, exec, day)
          ops.push({ updateOne: { filter: { user: exec._id, date: doc.date }, update: { $setOnInsert: doc }, upsert: true } })
        }
      }
      const attRes = await Attendance.bulkWrite(ops, { ordered: false })
      const attInserted = attRes.upsertedCount || 0
      att += attInserted

      // --- Leave requests ---
      const existingLeaves = await LeaveRequest.countDocuments({ firm: firm._id })
      if (existingLeaves < 4) {
        const types = ['casual', 'sick', 'privilege', 'maternity']
        const reasons = ['Family function', 'Fever and rest advised', 'Personal work', 'Travel plans', 'Medical appointment']
        const leaves = []
        for (let i = 0; i < 6; i++) {
          const exec = pick(execs)
          const start = new Date(); start.setDate(start.getDate() + randInt(-8, 12))
          const days = randInt(1, 4)
          const end = new Date(start); end.setDate(end.getDate() + days - 1)
          const status = pick(['pending', 'pending', 'approved', 'rejected'])
          leaves.push({
            firm: firm._id, employee: exec._id, branch: exec.branch,
            type: pick(types), startDate: start, endDate: end, days,
            reason: pick(reasons), status,
            ...(status !== 'pending' ? { decidedBy: subAdmin?._id || null, decidedAt: new Date(), decisionNote: status === 'rejected' ? 'Insufficient coverage that week.' : 'Approved.' } : {}),
          })
        }
        await LeaveRequest.insertMany(leaves)
        lv += leaves.length
      }

      // --- Attendance correction requests ---
      const existingCorr = await AttendanceCorrection.countDocuments({ firm: firm._id })
      if (existingCorr < 2) {
        const corrections = []
        for (let i = 0; i < 3; i++) {
          const exec = pick(execs)
          const day = pick(weekdays)
          const inAt = new Date(day); inAt.setHours(9, randInt(0, 20), 0, 0)
          const outAt = new Date(day); outAt.setHours(18, randInt(0, 30), 0, 0)
          const status = pick(['pending', 'pending', 'approved', 'rejected'])
          corrections.push({
            firm: firm._id, employee: exec._id, branch: exec.branch, date: dayKey(day),
            requestedCheckInAt: inAt, requestedCheckOutAt: outAt,
            reason: pick(['Forgot to check in, was at site visit', 'GPS failed to capture check-out', 'Marked absent by mistake, was on field']),
            status,
            ...(status !== 'pending' ? { decidedBy: subAdmin?._id || null, decidedAt: new Date(), decisionNote: status === 'rejected' ? 'No supporting evidence.' : 'Verified with site logs.' } : {}),
          })
        }
        await AttendanceCorrection.insertMany(corrections)
        corr += corrections.length
      }

      console.log(`- ${firm.name}: +${attInserted} attendance, leaves/corrections seeded where empty`)
    }

    console.log(`\nDone. Seeded ${att} attendance record(s), ${lv} leave request(s), ${corr} correction request(s).`)
    process.exit(0)
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
}

seed()

import mongoose from 'mongoose'
import { ATTENDANCE_STATUS } from '../config/constants.js'

const { Schema, model } = mongoose

const geoSchema = new Schema(
  {
    lat: { type: Number },
    lng: { type: Number },
    accuracy: { type: Number },
    address: { type: String, trim: true },
  },
  { _id: false }
)

// One attendance record per user per day. Login/logout capture time + GPS,
// system computes duration and auto-classifies the day (§9).
const attendanceSchema = new Schema(
  {
    firm: { type: Schema.Types.ObjectId, ref: 'Firm', required: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    date: { type: String, required: true }, // YYYY-MM-DD (day bucket)

    checkInAt: { type: Date },
    checkInLocation: geoSchema,
    checkInRemarks: { type: String, trim: true },
    checkInPhoto: { type: String }, // optional check-in selfie (data URL) — §E4
    checkOutAt: { type: Date },
    checkOutLocation: geoSchema,
    checkOutRemarks: { type: String, trim: true },

    workedMinutes: { type: Number, default: 0 },
    status: {
      type: String,
      enum: Object.values(ATTENDANCE_STATUS),
      default: ATTENDANCE_STATUS.ABSENT,
    },
  },
  { timestamps: true }
)

attendanceSchema.index({ user: 1, date: 1 }, { unique: true })
attendanceSchema.index({ firm: 1, date: 1 })

export default model('Attendance', attendanceSchema)

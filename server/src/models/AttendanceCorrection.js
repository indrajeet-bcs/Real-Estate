import mongoose from 'mongoose'

const { Schema, model } = mongoose

// An attendance-correction request (spec §Attendance Correction). An employee
// requests corrected check-in/out times for a day; the branch Sub-Admin (or
// Admin) approves or rejects. On approval the day's attendance record is updated.
const attendanceCorrectionSchema = new Schema(
  {
    firm: { type: Schema.Types.ObjectId, ref: 'Firm', required: true, index: true },
    employee: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    branch: { type: String, trim: true },

    date: { type: String, required: true }, // YYYY-MM-DD (the day being corrected)
    requestedCheckInAt: { type: Date },
    requestedCheckOutAt: { type: Date },
    reason: { type: String, trim: true, required: true },

    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
    decisionNote: { type: String, trim: true },
    decidedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    decidedAt: { type: Date },
  },
  { timestamps: true }
)

export default model('AttendanceCorrection', attendanceCorrectionSchema)

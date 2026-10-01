import mongoose from 'mongoose'

const { Schema, model } = mongoose

export const POSSESSION_STATUSES = [
  'Pending', 'Readiness Check', 'Ready for Possession', 'Scheduled', 'Handover In Progress',
  'Handover Completed', 'Customer Confirmation Pending', 'Completed', 'Cancelled',
]
export const READINESS_CHECKLIST_ITEMS = [
  'Registration Completed', 'Property Ready', 'Unit Inspection Completed', 'Keys Available',
  'Required Documents Ready', 'Utility / Meter Details Ready', 'Final Dues Check', 'Handover Documents Ready',
]
export const POSSESSION_DOC_STATUSES = ['Pending', 'Received', 'Verified', 'Rejected']

const timelineSchema = new Schema(
  { date: { type: Date, default: () => new Date() }, user: String, activity: String, remarks: String },
  { _id: true }
)
const documentSchema = new Schema(
  {
    name: String, type: String, status: { type: String, enum: POSSESSION_DOC_STATUSES, default: 'Pending' }, fileUrl: String,
    uploadedBy: String, uploadDate: Date, verifiedBy: String, verificationDate: Date, remarks: String,
  },
  { _id: true }
)
const checklistSchema = new Schema(
  { item: String, status: { type: String, enum: ['Pending', 'Completed'], default: 'Pending' }, date: Date, user: String },
  { _id: true }
)

// Post-registration handover / possession case (Possession module).
const possessionCaseSchema = new Schema(
  {
    caseCode: { type: String, unique: true }, // POS-2026-0001
    firm: { type: Schema.Types.ObjectId, ref: 'Firm', required: true, index: true },
    branch: { type: String, trim: true },

    customer: { type: Schema.Types.ObjectId, ref: 'Customer', default: null },
    customerName: { type: String, trim: true },
    booking: { type: Schema.Types.ObjectId, ref: 'Booking', default: null },
    bookingLabel: { type: String, trim: true },
    registrationLabel: { type: String, trim: true },
    project: { type: String, trim: true },
    unitNumber: { type: String, trim: true },

    assignedEmployee: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    assignedEmployeeName: { type: String, trim: true },

    expectedPossessionDate: { type: Date },
    scheduledDate: { type: Date },
    scheduledTime: { type: String, trim: true },
    actualPossessionDate: { type: Date },
    location: { type: String, trim: true },
    customerConfirmation: { type: String, enum: ['Pending', 'Confirmed'], default: 'Pending' },

    status: { type: String, enum: POSSESSION_STATUSES, default: 'Pending', index: true },

    checklist: { type: [checklistSchema], default: () => READINESS_CHECKLIST_ITEMS.map((item) => ({ item, status: 'Pending' })) },
    documents: { type: [documentSchema], default: [] },
    timeline: { type: [timelineSchema], default: [] },
    remarks: { type: String, trim: true },

    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
)

possessionCaseSchema.index({ firm: 1, status: 1 })

possessionCaseSchema.pre('save', async function assignCode(next) {
  if (!this.isNew || this.caseCode) return next()
  try {
    const year = new Date().getFullYear()
    const prefix = `POS-${year}-`
    const last = await this.constructor.findOne({ caseCode: new RegExp(`^${prefix}`) }).sort({ caseCode: -1 }).lean()
    const n = last?.caseCode ? parseInt(last.caseCode.split('-')[2], 10) + 1 : 1
    this.caseCode = `${prefix}${String(n).padStart(4, '0')}`
    next()
  } catch (err) { next(err) }
})

export default model('PossessionCase', possessionCaseSchema)

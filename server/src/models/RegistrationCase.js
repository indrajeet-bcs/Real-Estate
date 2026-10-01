import mongoose from 'mongoose'

const { Schema, model } = mongoose

export const REGISTRATION_STATUSES = [
  'Pending', 'Documents Pending', 'Ready for Registration', 'Appointment Scheduled',
  'Registration In Progress', 'Registered', 'Document Pending', 'Completed', 'Cancelled',
]
export const REGISTRATION_TYPES = ['Sale Deed Registration', 'Agreement Registration', 'Property Registration', 'Other']
export const REG_DOC_STATUSES = ['Pending', 'Received', 'Verified', 'Rejected']

const timelineSchema = new Schema(
  { date: { type: Date, default: () => new Date() }, user: String, activity: String, remarks: String },
  { _id: true }
)
const documentSchema = new Schema(
  {
    name: String, type: String, status: { type: String, enum: REG_DOC_STATUSES, default: 'Pending' }, fileUrl: String,
    uploadedBy: String, uploadDate: Date, verifiedBy: String, verificationDate: Date, remarks: String,
  },
  { _id: true }
)

// Post-booking sale-deed / agreement registration case (Registration module).
const registrationCaseSchema = new Schema(
  {
    caseCode: { type: String, unique: true }, // REG-2026-0001
    firm: { type: Schema.Types.ObjectId, ref: 'Firm', required: true, index: true },
    branch: { type: String, trim: true },

    customer: { type: Schema.Types.ObjectId, ref: 'Customer', default: null },
    customerName: { type: String, trim: true },
    booking: { type: Schema.Types.ObjectId, ref: 'Booking', default: null },
    bookingLabel: { type: String, trim: true },
    project: { type: String, trim: true },
    unitNumber: { type: String, trim: true },

    registrationType: { type: String, enum: REGISTRATION_TYPES, default: 'Sale Deed Registration' },
    assignedEmployee: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    assignedEmployeeName: { type: String, trim: true },
    expectedRegistrationDate: { type: Date },
    registrationAuthority: { type: String, trim: true },

    status: { type: String, enum: REGISTRATION_STATUSES, default: 'Pending', index: true },

    appointmentDate: { type: Date },
    appointmentTime: { type: String, trim: true },
    appointmentReference: { type: String, trim: true },

    registrationNumber: { type: String, trim: true },
    registrationDate: { type: Date },

    documents: { type: [documentSchema], default: [] },
    timeline: { type: [timelineSchema], default: [] },
    remarks: { type: String, trim: true },

    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
)

registrationCaseSchema.index({ firm: 1, status: 1 })

registrationCaseSchema.pre('save', async function assignCode(next) {
  if (!this.isNew || this.caseCode) return next()
  try {
    const year = new Date().getFullYear()
    const prefix = `REG-${year}-`
    const last = await this.constructor.findOne({ caseCode: new RegExp(`^${prefix}`) }).sort({ caseCode: -1 }).lean()
    const n = last?.caseCode ? parseInt(last.caseCode.split('-')[2], 10) + 1 : 1
    this.caseCode = `${prefix}${String(n).padStart(4, '0')}`
    next()
  } catch (err) { next(err) }
})

export default model('RegistrationCase', registrationCaseSchema)

import mongoose from 'mongoose'

const { Schema, model } = mongoose

export const LOAN_STATUSES = [
  'Not Required', 'Required', 'Documents Pending', 'Application Prepared', 'Submitted',
  'Under Review', 'Query Raised', 'Sanctioned', 'Partially Disbursed', 'Fully Disbursed',
  'Rejected', 'Cancelled', 'Completed',
]
export const LOAN_TYPES = ['Home Loan', 'Property Loan', 'Construction Loan', 'Other']
export const LOAN_DOC_STATUSES = ['Pending', 'Received', 'Verified', 'Rejected']

const timelineSchema = new Schema(
  {
    date: { type: Date, default: () => new Date() },
    user: { type: String, trim: true },
    activity: { type: String, trim: true },
    remarks: { type: String, trim: true },
  },
  { _id: true }
)

const documentSchema = new Schema(
  {
    name: { type: String, trim: true },
    type: { type: String, trim: true },
    status: { type: String, enum: LOAN_DOC_STATUSES, default: 'Pending' },
    fileUrl: { type: String, trim: true },
    uploadedBy: { type: String, trim: true },
    uploadDate: { type: Date },
    verifiedBy: { type: String, trim: true },
    verificationDate: { type: Date },
    remarks: { type: String, trim: true },
  },
  { _id: true }
)

// Post-booking home-loan case (Loans module). Firm-scoped; optionally linked to a
// Booking/Customer. Denormalized labels keep the list fast and resilient.
const loanCaseSchema = new Schema(
  {
    caseCode: { type: String, unique: true }, // LC-2026-0001
    firm: { type: Schema.Types.ObjectId, ref: 'Firm', required: true, index: true },
    branch: { type: String, trim: true },

    customer: { type: Schema.Types.ObjectId, ref: 'Customer', default: null },
    customerName: { type: String, trim: true },
    booking: { type: Schema.Types.ObjectId, ref: 'Booking', default: null },
    bookingLabel: { type: String, trim: true },
    project: { type: String, trim: true },
    unitNumber: { type: String, trim: true },

    loanRequired: { type: Boolean, default: true },
    loanAmount: { type: Number, default: 0, min: 0 },
    bank: { type: String, trim: true },
    loanType: { type: String, enum: LOAN_TYPES, default: 'Home Loan' },
    applicationNumber: { type: String, trim: true },
    applicationDate: { type: Date },
    expectedSanctionDate: { type: Date },

    assignedExecutive: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    assignedExecutiveName: { type: String, trim: true },

    status: { type: String, enum: LOAN_STATUSES, default: 'Required', index: true },
    sanctionedAmount: { type: Number, default: null },
    disbursedAmount: { type: Number, default: 0 },

    documents: { type: [documentSchema], default: [] },
    timeline: { type: [timelineSchema], default: [] },

    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
)

loanCaseSchema.index({ firm: 1, status: 1 })

// Sequential per-year case code: LC-YYYY-0001.
loanCaseSchema.pre('save', async function assignCode(next) {
  if (!this.isNew || this.caseCode) return next()
  try {
    const year = new Date().getFullYear()
    const prefix = `LC-${year}-`
    const last = await this.constructor.findOne({ caseCode: new RegExp(`^${prefix}`) }).sort({ caseCode: -1 }).lean()
    const n = last?.caseCode ? parseInt(last.caseCode.split('-')[2], 10) + 1 : 1
    this.caseCode = `${prefix}${String(n).padStart(4, '0')}`
    next()
  } catch (err) {
    next(err)
  }
})

export default model('LoanCase', loanCaseSchema)

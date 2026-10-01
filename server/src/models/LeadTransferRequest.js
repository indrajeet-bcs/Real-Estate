import mongoose from 'mongoose'

const { Schema } = mongoose

// Lead transfer *request* (Employee spec §Request Lead Transfer).
// Employees cannot reassign leads directly — they submit a request that a
// Sub-Admin (or Admin, for cross-branch moves) approves or rejects. On approval
// the customer's ownership is reassigned and the decision is recorded here.
const leadTransferRequestSchema = new Schema(
  {
    firm: { type: Schema.Types.ObjectId, ref: 'Firm', required: true, index: true },
    customer: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },

    // Who raised the request (the current owner) — denormalised name for history.
    requestedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    requestedByName: { type: String, trim: true },

    reason: { type: String, required: true, trim: true },
    remarks: { type: String, trim: true },

    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'cancelled'],
      default: 'pending',
      index: true,
    },

    // Filled on decision.
    decidedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    decidedByName: { type: String, trim: true },
    decidedAt: { type: Date },
    decisionNote: { type: String, trim: true },
    // The employee the lead was reassigned to on approval (null = returned to pool).
    newEmployee: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    newEmployeeName: { type: String, trim: true },
  },
  { timestamps: true }
)

export default mongoose.model('LeadTransferRequest', leadTransferRequestSchema)

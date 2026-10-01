import mongoose from 'mongoose'
import { PAYMENT_METHODS, PAYMENT_STATUS } from '../config/payment.js'

const { Schema, model } = mongoose

// The current receipt attached to a payment (§Receipts). Replacing a receipt
// swaps this object; prior files are noted in the activity timeline.
const receiptSchema = new Schema(
  {
    receiptNumber: { type: String, trim: true }, // RCPT-000N
    fileName: String,
    fileUrl: String,
    mimeType: String,
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    uploadedByName: { type: String, trim: true },
    uploadedAt: { type: Date, default: () => new Date() },
  },
  { _id: false }
)

// Timeline entry powering the Payment Timeline + Audit History (§Payment Details).
const activitySchema = new Schema(
  {
    type: { type: String, trim: true }, // created | edited | receipt_uploaded | receipt_replaced | receipt_downloaded | verified | cancelled | refunded | status_changed
    note: { type: String, trim: true },
    actor: { type: Schema.Types.ObjectId, ref: 'User' },
    actorName: { type: String, trim: true },
    at: { type: Date, default: () => new Date() },
  },
  { _id: true }
)

// A company-side payment received from a customer against a confirmed booking
// (§Payment Module). Always linked to a booking. Booking/customer/project/unit
// context is denormalized so lists + executive scoping don't need joins.
const paymentSchema = new Schema(
  {
    firm: { type: Schema.Types.ObjectId, ref: 'Firm', required: true, index: true },
    paymentCode: { type: String, trim: true, index: true }, // PAY-000N

    booking: { type: Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },
    customer: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    customerName: { type: String, trim: true },
    project: { type: Schema.Types.ObjectId, ref: 'Project', default: null },
    projectName: { type: String, trim: true },
    unit: { type: Schema.Types.ObjectId, ref: 'Unit', default: null },
    unitNumber: { type: String, trim: true },
    branch: { type: String, trim: true, index: true },
    // The customer's owning executive at time of entry — drives executive scoping.
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },

    amount: { type: Number, required: true, min: [1, 'Amount must be greater than zero'] },
    paymentDate: { type: Date, required: true, index: true },
    method: { type: String, enum: PAYMENT_METHODS, required: true, index: true },
    status: { type: String, enum: PAYMENT_STATUS, default: 'received', index: true },

    // Method-specific references (all optional; validated lightly by method).
    referenceNumber: { type: String, trim: true },
    bankName: { type: String, trim: true },
    transactionId: { type: String, trim: true, index: true },
    chequeNumber: { type: String, trim: true },
    chequeDate: { type: Date },
    upiId: { type: String, trim: true },

    // Who physically received the money (may differ from the data-entry user).
    receivedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    receivedByName: { type: String, trim: true },
    // Who created the record (data-entry user).
    enteredBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    enteredByName: { type: String, trim: true },

    remarks: { type: String, trim: true },
    receipt: { type: receiptSchema, default: undefined },

    verifiedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    verifiedByName: { type: String, trim: true },
    verifiedAt: { type: Date },
    cancelReason: { type: String, trim: true },
    refundAmount: { type: Number, default: 0 },
    refundedAt: { type: Date },

    // Soft delete (§Validations: deleted payments should be soft deleted).
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date },
    deletedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },

    activity: { type: [activitySchema], default: [] },
  },
  { timestamps: true }
)

paymentSchema.index({ firm: 1, status: 1 })
paymentSchema.index({ firm: 1, paymentDate: -1 })
paymentSchema.index({ booking: 1, isDeleted: 1 })

export default model('Payment', paymentSchema)

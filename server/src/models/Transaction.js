import mongoose from 'mongoose'

const { Schema, model } = mongoose

// A payment-gateway transaction against an invoice (Super Admin §Transactions).
const transactionSchema = new Schema(
  {
    firm: { type: Schema.Types.ObjectId, ref: 'Firm', required: true, index: true },
    invoice: { type: Schema.Types.ObjectId, ref: 'Invoice', default: null },
    invoiceNumber: { type: String, trim: true }, // snapshot
    transactionId: { type: String, required: true, unique: true, trim: true },
    gateway: { type: String, trim: true, default: 'Razorpay' },
    amount: { type: Number, default: 0 }, // gross paid (incl. tax)
    status: { type: String, enum: ['paid', 'pending', 'failed', 'refunded'], default: 'pending', index: true },
    reference: { type: String, trim: true },
    date: { type: Date, default: () => new Date() },
  },
  { timestamps: true }
)

transactionSchema.index({ firm: 1, date: -1 })

export default model('Transaction', transactionSchema)

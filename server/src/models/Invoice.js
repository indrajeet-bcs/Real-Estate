import mongoose from 'mongoose'

const { Schema, model } = mongoose

// A billing invoice for a firm's subscription period (Super Admin §Invoices).
const invoiceSchema = new Schema(
  {
    firm: { type: Schema.Types.ObjectId, ref: 'Firm', required: true, index: true },
    subscription: { type: Schema.Types.ObjectId, ref: 'Subscription', default: null },
    invoiceNumber: { type: String, required: true, unique: true, trim: true },
    planName: { type: String, trim: true },
    cycle: { type: String, enum: ['monthly', 'yearly'], default: 'monthly' },
    amount: { type: Number, default: 0 }, // subtotal (pre-tax)
    gst: { type: Number, default: 0 }, // tax amount
    total: { type: Number, default: 0 }, // amount + gst
    status: { type: String, enum: ['paid', 'pending', 'failed', 'refunded', 'cancelled'], default: 'pending', index: true },
    invoiceDate: { type: Date, default: () => new Date() },
    dueDate: { type: Date },
    paidOn: { type: Date, default: null },
    paymentMethod: { type: String, trim: true }, // gateway
    gstNo: { type: String, trim: true },
    billingAddress: { type: String, trim: true },
  },
  { timestamps: true }
)

invoiceSchema.index({ firm: 1, createdAt: -1 })

export default model('Invoice', invoiceSchema)

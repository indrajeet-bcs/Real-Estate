import mongoose from 'mongoose'

const { Schema, model } = mongoose

// A firm's subscription to a plan (Super Admin §Billing records).
const subscriptionSchema = new Schema(
  {
    firm: { type: Schema.Types.ObjectId, ref: 'Firm', required: true, index: true },
    plan: { type: Schema.Types.ObjectId, ref: 'Plan', required: true, index: true },
    planName: { type: String, trim: true }, // snapshot for history
    cycle: { type: String, enum: ['monthly', 'yearly'], default: 'monthly' },
    amount: { type: Number, default: 0 }, // recurring amount for the cycle
    status: { type: String, enum: ['active', 'trial', 'expired', 'suspended', 'cancelled'], default: 'active', index: true },
    startDate: { type: Date, default: () => new Date() },
    renewalDate: { type: Date },
    gateway: { type: String, trim: true, default: 'Razorpay' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
)

export default model('Subscription', subscriptionSchema)

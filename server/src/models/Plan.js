import mongoose from 'mongoose'

const { Schema, model } = mongoose

// A subscription plan (Super Admin §Subscription & Billing · Plans).
const planSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    color: { type: String, default: '#3b82f6', trim: true },
    icon: { type: String, default: '◈', trim: true },
    monthlyPrice: { type: Number, default: 0 },
    yearlyPrice: { type: Number, default: 0 },
    trialDays: { type: Number, default: 0 },
    status: { type: String, enum: ['active', 'archived'], default: 'active' },
    description: { type: String, trim: true },
    displayOrder: { type: Number, default: 0 },
    features: {
      maxEmployees: { type: Number, default: 10 }, // -1 = unlimited
      maxProjects: { type: Number, default: 5 },
      maxLeads: { type: Number, default: 500 },
      maxStorage: { type: Number, default: 10 }, // GB
      attendance: { type: Boolean, default: false },
      reports: { type: Boolean, default: false },
      analytics: { type: Boolean, default: false },
      mobile: { type: Boolean, default: false },
      whatsapp: { type: Boolean, default: false },
      api: { type: Boolean, default: false },
      prioritySupport: { type: Boolean, default: false },
      customBranding: { type: Boolean, default: false },
      whiteLabel: { type: Boolean, default: false },
      customDomain: { type: Boolean, default: false },
      backupFrequency: { type: String, default: 'none' }, // none | weekly | daily | realtime
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
)

export default model('Plan', planSchema)

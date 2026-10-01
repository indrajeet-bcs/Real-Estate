import mongoose from 'mongoose'

const { Schema, model } = mongoose

// Platform-wide billing configuration (Super Admin §Billing Settings). Singleton.
const billingSettingsSchema = new Schema(
  {
    key: { type: String, default: 'global', unique: true },
    currency: { type: String, default: 'INR' },
    gstPercent: { type: Number, default: 18 },
    invoicePrefix: { type: String, default: 'INV' },
    companyName: { type: String, default: 'RealEstate CRM' },
    companyGstNo: { type: String, default: '' },
    billingEmail: { type: String, default: '' },
    gateways: {
      razorpay: { type: Boolean, default: true },
      stripe: { type: Boolean, default: true },
      payu: { type: Boolean, default: false },
      cashfree: { type: Boolean, default: false },
    },
    autoCharge: { type: Boolean, default: true },
    sendReminders: { type: Boolean, default: true },
    reminderDaysBefore: { type: Number, default: 3 },
  },
  { timestamps: true }
)

export default model('BillingSettings', billingSettingsSchema)

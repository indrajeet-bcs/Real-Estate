import mongoose from 'mongoose'

const { Schema, model } = mongoose

// A Firm is a tenant on the platform, onboarded by the Super Admin and
// represented by an Admin account. All firm-scoped data references this.
const firmSchema = new Schema(
  {
    companyId: { type: String, unique: true, sparse: true }, // sparse: firms without a companyId don't collide
    name: { type: String, required: true, trim: true },
    plan: { type: String, default: 'standard', trim: true },
    region: { type: String, trim: true },
    branches: [{ type: String, trim: true }],
    contactEmail: { type: String, trim: true, lowercase: true },
    contactPhone: { type: String, trim: true },
    
    // Step 1: Extra Info
    logo: { type: String, trim: true },
    website: { type: String, trim: true },
    gstNumber: { type: String, trim: true },
    address: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    country: { type: String, trim: true },
    timeZone: { type: String, trim: true, default: 'UTC' },
    currency: { type: String, trim: true, default: 'USD' },
    
    // SaaS / Tenant Fields
    status: { type: String, enum: ['active', 'trial', 'suspended', 'deleted'], default: 'trial' },
    subscriptionStatus: { type: String, enum: ['active', 'trial', 'expired', 'cancelled'], default: 'trial' },
    billingCycle: { type: String, enum: ['monthly', 'yearly'], default: 'monthly' },
    enableTrial: { type: Boolean, default: false },
    trialDays: { type: Number, default: 0 },
    storageUsed: { type: Number, default: 0 }, // in GB
    storageLimit: { type: Number, default: 10 }, // in GB
    allowedUsers: { type: Number, default: 25 },
    isDeleted: { type: Boolean, default: false },

    // Admin-flow port: firm-level operational settings (Office Settings, Phase 8).
    // §1 Sales & Inventory
    inventoryLockHours: { type: Number, default: 48 }, // temporary unit-lock window
    discountCapPercent: { type: Number, default: 2 }, // standard executive discount cap
    commissionSplit: {
      office: { type: Number, default: 60 },
      executive: { type: Number, default: 25 },
      branch: { type: Number, default: 15 },
    },

    // §2 Booking settings
    bookingValidityDays: { type: Number, default: 7 }, // days a booking stays valid
    autoCancelUnconfirmed: { type: Boolean, default: false }, // auto-cancel after validity

    // §3 Lead allocation settings
    autoLeadAssignment: { type: Boolean, default: false },
    leadAssignmentMethod: { type: String, enum: ['manual', 'round_robin'], default: 'manual' },

    // §4 Attendance settings (used for attendance calculations)
    officeStartTime: { type: String, default: '09:00', trim: true },
    officeEndTime: { type: String, default: '18:00', trim: true },
    halfDayThresholdHours: { type: Number, default: 4 },

    // §5 Company-wide notification preferences
    notifications: {
      newLeadAssignment: { type: Boolean, default: true },
      discountRequests: { type: Boolean, default: true },
      bookingConfirmation: { type: Boolean, default: true },
      employeeTransfer: { type: Boolean, default: true },
      attendanceAlerts: { type: Boolean, default: true },
    },

    // Maintained for backwards compatibility with auth middleware
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' }, // super admin
  },
  { timestamps: true }
)

firmSchema.index({ name: 1 })

export default model('Firm', firmSchema)

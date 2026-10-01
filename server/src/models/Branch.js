import mongoose from 'mongoose'

const { Schema, model } = mongoose

// A Branch is a regional sales hub within a Firm (Admin-flow port). Users are
// linked to a branch by the `User.branch` string (its `name`); metrics
// (active agents, sales, revenue, attendance) are computed at read time.
const branchSchema = new Schema(
  {
    firm: { type: Schema.Types.ObjectId, ref: 'Firm', required: true, index: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, trim: true, uppercase: true }, // short branch code, e.g. BLR-01
    region: { type: String, trim: true },
    city: { type: String, trim: true },
    address: { type: String, trim: true },
    contactNumber: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },

    // The Branch Admin (a sub-admin). Optional until assigned.
    adminUser: { type: Schema.Types.ObjectId, ref: 'User', default: null },

    // Target Management (correction spec): revenue is tracked in ₹, sales &
    // bookings as counts, all for the configured period.
    monthlyTarget: { type: Number, default: 0 }, // revenue target, INR
    salesTarget: { type: Number, default: 0 }, // count of completed sales
    bookingTarget: { type: Number, default: 0 }, // count of bookings
    targetPeriod: { type: String, enum: ['monthly', 'quarterly', 'yearly'], default: 'monthly' },
    targetStartDate: { type: Date, default: null },
    targetEndDate: { type: Date, default: null },
    targetRemarks: { type: String, trim: true, default: '' },

    status: { type: String, enum: ['active', 'disabled'], default: 'active' },

    // Branch-admin port: operational preferences (Reports & Settings).
    geofenceRadius: { type: Number, default: 200 }, // metres
    workingHours: { type: String, trim: true, default: '09:00 - 18:00' },
    autoRouteLeads: { type: Boolean, default: false },

    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
)

// A branch name is unique within a firm (names double as the User.branch key).
branchSchema.index({ firm: 1, name: 1 }, { unique: true })

export default model('Branch', branchSchema)

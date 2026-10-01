import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import { ROLE_VALUES, ROLES } from '../config/constants.js'

const { Schema } = mongoose

// Immutable snapshot of one branch transfer (Admin Employee spec §8). Names are
// denormalised so history stays readable even if a manager is later renamed.
const transferHistorySchema = new Schema(
  {
    date: { type: Date, default: () => new Date() },
    fromBranch: { type: String, trim: true },
    toBranch: { type: String, trim: true },
    previousManager: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    newManager: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    previousManagerName: { type: String, trim: true },
    newManagerName: { type: String, trim: true },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    approvedByName: { type: String, trim: true },
    reason: { type: String, trim: true },
  },
  { _id: true, timestamps: false }
)

// Users across all four roles live in one collection, discriminated by `role`.
// Super Admin has firm = null (platform level); all other roles are firm-scoped.
const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true, unique: true },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ROLE_VALUES, required: true },

    firm: { type: Schema.Types.ObjectId, ref: 'Firm', default: null, index: true },
    branch: { type: String, trim: true },
    team: { type: String, trim: true },

    // HR profile (Admin Employee spec): identity, role title, tenure & targets.
    employeeId: { type: String, trim: true },
    employeeCode: { type: String, trim: true }, // separate HR code (read-only to employee)
    department: { type: String, trim: true },
    designation: { type: String, trim: true },
    joiningDate: { type: Date },
    targetRevenue: { type: Number, default: 0 }, // assigned revenue target, INR
    targetSales: { type: Number, default: 0 }, // assigned sales target, count

    // Personal information (Employee Profile spec §2). Editable by the employee.
    dob: { type: Date },
    gender: { type: String, enum: ['male', 'female', 'other', ''], default: '' },
    bloodGroup: { type: String, trim: true },
    maritalStatus: { type: String, enum: ['single', 'married', 'other', ''], default: '' },
    address: { type: String, trim: true },
    emergencyContactName: { type: String, trim: true },
    emergencyContactNumber: { type: String, trim: true },

    // Preferences (Employee Profile spec §6).
    preferences: {
      language: { type: String, default: 'en' },
      timeFormat: { type: String, enum: ['12h', '24h'], default: '12h' },
      dateFormat: { type: String, default: 'DD MMM YYYY' },
    },

    // Uploaded profile documents (Employee Profile spec §5).
    documents: {
      type: [new Schema({
        type: { type: String, trim: true }, // id_proof | address_proof | pan | aadhaar | driving_license | other
        label: { type: String, trim: true },
        fileName: String,
        fileUrl: String,
        uploadedAt: { type: Date, default: () => new Date() },
      }, { _id: true })],
      default: [],
    },

    // Branch-transfer log (previous branch/sub-admin retained on transfer).
    transferHistory: { type: [transferHistorySchema], default: [] },

    // Reporting hierarchy: executive -> sub-admin -> admin.
    manager: { type: Schema.Types.ObjectId, ref: 'User', default: null },

    // Per-user permission overrides (module -> allowed actions). Empty = use role defaults.
    permissions: { type: Map, of: [String], default: undefined },
    // Custom-role engine: optional fine-grained role layered on top of the enum
    // `role` tier (which still governs requireRole gates).
    customRole: { type: mongoose.Schema.Types.ObjectId, ref: 'Role', default: null },

    phone: { type: String, trim: true },
    altMobile: { type: String, trim: true }, // optional alternate number (Profile §2)
    avatar: { type: String, trim: true }, // profile photo URL
    passwordChangedAt: { type: Date }, // shown on the Security section
    lastLoginDevice: { type: String, trim: true }, // user-agent snapshot at last login
    // Personal notification preferences (Profile §Notification Preferences).
    notificationPrefs: {
      inApp: { type: Boolean, default: true },
      email: { type: Boolean, default: false },
    },
    isActive: { type: Boolean, default: true },

    // Password reset (OTP/email) — Section 2 "Forgot Password" flow.
    resetOtpHash: { type: String, select: false },
    resetOtpExpires: { type: Date, select: false },

    // Refresh-token rotation: store hashes of currently valid refresh tokens.
    refreshTokens: { type: [String], select: false, default: [] },

    lastLoginAt: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
)

userSchema.index({ firm: 1, role: 1 })

userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next()
  const salt = await bcrypt.genSalt(10)
  this.password = await bcrypt.hash(this.password, salt)
  next()
})

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password)
}

userSchema.methods.isSuperAdmin = function isSuperAdmin() {
  return this.role === ROLES.SUPER_ADMIN
}

// Strip sensitive fields from any JSON output.
userSchema.set('toJSON', {
  transform(_doc, ret) {
    delete ret.password
    delete ret.refreshTokens
    delete ret.resetOtpHash
    delete ret.resetOtpExpires
    return ret
  },
})

export default mongoose.model('User', userSchema)

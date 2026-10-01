import mongoose from 'mongoose'

const { Schema, model } = mongoose

// Builders are added by Admins (scoped to their firm). Super Admin sees them
// view-only across firms. Archived instead of hard-deleted (Edge Case §15).
const builderSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    firm: { type: Schema.Types.ObjectId, ref: 'Firm', required: true, index: true },
    logo: { type: String, trim: true }, // image URL
    about: { type: String, trim: true }, // short profile (Employee Property spec §Builder Info)
    contactPerson: { type: String, trim: true },
    phone: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    address: { type: String, trim: true },
    city: { type: String, trim: true },
    gstNumber: { type: String, trim: true },
    // Admin-flow port (RERA): builder RERA certificate + compliance state.
    reraCert: { type: String, trim: true },
    reraExpiry: { type: Date },
    commissionAgreement: { type: String, trim: true }, // e.g. "2.5% flat + accelerators"
    complianceStatus: { type: String, enum: ['compliant', 'pending_review', 'non_compliant'], default: 'compliant' },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    isArchived: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
)

builderSchema.index({ firm: 1, name: 1 })

export default model('Builder', builderSchema)

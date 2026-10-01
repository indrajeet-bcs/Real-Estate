import mongoose from 'mongoose'
import {
  CUSTOMER_STATUS,
  LEAD_SOURCES,
  INTEREST_LEVEL,
} from '../config/constants.js'

const { Schema } = mongoose

// --- Embedded sub-documents for the Customer 360° profile (§6) ---

const noteSchema = new Schema(
  {
    type: { type: String, enum: ['call', 'meeting', 'general'], default: 'general' },
    text: { type: String, required: true, trim: true },
    outcome: { type: String, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, _id: true }
)

const interestedProjectSchema = new Schema(
  {
    project: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    interestLevel: { type: String, enum: INTEREST_LEVEL, default: 'warm' },
    notes: { type: String, trim: true },
    taggedAt: { type: Date, default: () => new Date() },
  },
  { _id: true }
)

const documentSchema = new Schema(
  {
    label: { type: String, trim: true },
    fileName: { type: String },
    fileUrl: { type: String },
    mimeType: { type: String },
    size: { type: Number },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    uploadedAt: { type: Date, default: () => new Date() },
  },
  { _id: true }
)

// Auto-generated activity log entry (§6 "Activity Timeline").
const activitySchema = new Schema(
  {
    action: { type: String, required: true }, // e.g. "note_added", "status_changed"
    description: { type: String, trim: true },
    meta: { type: Schema.Types.Mixed },
    actor: { type: Schema.Types.ObjectId, ref: 'User' },
    at: { type: Date, default: () => new Date() },
  },
  { _id: true }
)

// Immutable ownership-transfer record (spec §Lead Transfer · Transfer History).
// Names are denormalised so history stays readable if a user is later renamed.
const leadTransferSchema = new Schema(
  {
    at: { type: Date, default: () => new Date() },
    previousEmployee: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    previousEmployeeName: { type: String, trim: true },
    newEmployee: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    newEmployeeName: { type: String, trim: true },
    transferredBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    transferredByName: { type: String, trim: true },
    reason: { type: String, trim: true },
    remarks: { type: String, trim: true },
  },
  { _id: true }
)

// The Customer is the lead/customer entity that travels the full lifecycle
// (§11). Leads are simply customers in early statuses. Deduplicated on mobile
// within a firm (Edge Case §15).
const customerSchema = new Schema(
  {
    firm: { type: Schema.Types.ObjectId, ref: 'Firm', required: true, index: true },

    // Personal info
    name: { type: String, required: true, trim: true },
    mobile: { type: String, required: true, trim: true, index: true },
    altMobile: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    address: { type: String, trim: true },
    occupation: { type: String, trim: true },
    budgetMin: { type: Number },
    budgetMax: { type: Number },

    // Property requirement (Employee spec §Lead Details · Property Requirement).
    propertyType: { type: String, trim: true }, // apartment, villa, plot, commercial…
    configuration: { type: String, trim: true }, // 1 BHK, 2 BHK, 3 BHK…
    preferredLocation: { type: String, trim: true },

    source: { type: String, enum: LEAD_SOURCES, default: 'other' },
    status: {
      type: String,
      enum: Object.values(CUSTOMER_STATUS),
      default: CUSTOMER_STATUS.NEW,
      index: true,
    },

    assignedTo: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    assignedAt: { type: Date },
    convertedAt: { type: Date }, // set when a qualified lead is converted (§Convert to Customer)
    priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },

    // Complete ownership-transfer history (never deleted).
    transferHistory: { type: [leadTransferSchema], default: [] },

    // Admin-flow port (RERA/KYC): buyer compliance tracking.
    kycStatus: { type: String, enum: ['pending', 'complete', 'rejected'], default: 'pending' },
    reraDocSigned: { type: Boolean, default: false }, // RERA Form-6 signed

    interestedProjects: [interestedProjectSchema],
    notes: [noteSchema],
    documents: [documentSchema],
    activity: [activitySchema],

    // Re-engagement: a "Lost" customer reopened as a new opportunity links back
    // to the original, preserving history (Edge Case §15).
    reopenedFrom: { type: Schema.Types.ObjectId, ref: 'Customer', default: null },
    lostReason: { type: String, trim: true },

    importBatch: { type: Schema.Types.ObjectId, ref: 'ImportBatch', default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
)

// Dedup key: one active mobile per firm.
customerSchema.index({ firm: 1, mobile: 1 })

// Helper to append an activity entry.
customerSchema.methods.logActivity = function logActivity(action, description, actor, meta) {
  this.activity.push({ action, description, actor, meta })
}

export default mongoose.model('Customer', customerSchema)

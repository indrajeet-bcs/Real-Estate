import mongoose from 'mongoose'
import { AGREEMENT_TYPES, AGREEMENT_STATUS, LEGAL_STATUS, DOCUMENT_STATUS } from '../config/legal.js'

const { Schema, model } = mongoose

// One document checklist item on a legal case (§Document Checklist). Each item
// carries its own verification status + (optionally) an uploaded file.
const documentSchema = new Schema(
  {
    type: { type: String, trim: true, required: true }, // e.g. "PAN Card"
    mandatory: { type: Boolean, default: false },
    status: { type: String, enum: DOCUMENT_STATUS, default: 'pending', index: true },
    fileName: String,
    fileUrl: String,
    mimeType: String,
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    uploadedByName: { type: String, trim: true },
    uploadedAt: { type: Date },
    verifiedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    verifiedByName: { type: String, trim: true },
    verifiedAt: { type: Date },
    remarks: { type: String, trim: true },
  },
  { _id: true }
)

// Timeline entry powering the Legal Timeline + Audit History (§Legal Details).
const activitySchema = new Schema(
  {
    type: { type: String, trim: true }, // created | assigned | document_uploaded | document_replaced | document_verified | document_rejected | agreement_updated | status_changed | completed | cancelled
    note: { type: String, trim: true },
    actor: { type: Schema.Types.ObjectId, ref: 'User' },
    actorName: { type: String, trim: true },
    at: { type: Date, default: () => new Date() },
  },
  { _id: true }
)

// A post-booking legal case tracking document collection, verification and
// agreement preparation until ready for registration (§Legal Management). Always
// linked to a booking; customer/project/unit context is denormalized.
const legalCaseSchema = new Schema(
  {
    firm: { type: Schema.Types.ObjectId, ref: 'Firm', required: true, index: true },
    caseCode: { type: String, trim: true, index: true }, // LEG-000N

    booking: { type: Schema.Types.ObjectId, ref: 'Booking', required: true, unique: true, index: true },
    customer: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    customerName: { type: String, trim: true },
    project: { type: Schema.Types.ObjectId, ref: 'Project', default: null },
    projectName: { type: String, trim: true },
    unit: { type: Schema.Types.ObjectId, ref: 'Unit', default: null },
    unitNumber: { type: String, trim: true },
    branch: { type: String, trim: true, index: true },
    // The customer's owning executive at time of entry — drives executive scoping.
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },

    // Assigned legal executive (the doer for this case).
    legalExecutive: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    legalExecutiveName: { type: String, trim: true },

    agreementType: { type: String, enum: AGREEMENT_TYPES, default: 'sale_agreement' },
    agreementStatus: { type: String, enum: AGREEMENT_STATUS, default: 'not_started' },
    agreementNumber: { type: String, trim: true },
    agreementDate: { type: Date },

    status: { type: String, enum: LEGAL_STATUS, default: 'new', index: true },
    expectedCompletionDate: { type: Date, index: true },
    completedAt: { type: Date },
    remarks: { type: String, trim: true },
    cancelReason: { type: String, trim: true },

    documents: { type: [documentSchema], default: [] },

    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    createdByName: { type: String, trim: true },

    // Soft delete (§Validations: soft delete should be used).
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date },
    deletedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },

    activity: { type: [activitySchema], default: [] },
  },
  { timestamps: true }
)

legalCaseSchema.index({ firm: 1, status: 1 })
legalCaseSchema.index({ firm: 1, legalExecutive: 1 })

export default model('LegalCase', legalCaseSchema)

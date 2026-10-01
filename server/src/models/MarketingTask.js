import mongoose from 'mongoose'
import { MARKETING_TYPES, MARKETING_CHANNEL, MARKETING_TASK_STATUS, MARKETING_PRIORITY } from '../config/marketing.js'

const { Schema, model } = mongoose

// An uploaded proof / creative / invoice (§Attachments).
const attachmentSchema = new Schema(
  {
    label: { type: String, trim: true },
    fileName: String,
    fileUrl: String,
    kind: { type: String, trim: true }, // creative | invoice | proof | screenshot | photo | other
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    uploadedByName: { type: String, trim: true },
    uploadedAt: { type: Date, default: () => new Date() },
  },
  { _id: true }
)

// A social-media / external reference link (§Attachments · Social Media Links).
const linkSchema = new Schema(
  {
    label: { type: String, trim: true },
    url: { type: String, trim: true, required: true },
    addedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    at: { type: Date, default: () => new Date() },
  },
  { _id: true }
)

// A free-text remark on the task (§My Tasks · Add Remarks).
const remarkSchema = new Schema(
  {
    text: { type: String, trim: true, required: true },
    author: { type: Schema.Types.ObjectId, ref: 'User' },
    authorName: { type: String, trim: true },
    authorRole: { type: String, trim: true },
    at: { type: Date, default: () => new Date() },
  },
  { _id: true }
)

// A timeline entry powering the per-task Activity view (§Activity History).
const activitySchema = new Schema(
  {
    type: { type: String, trim: true }, // created | assigned | started | progress_updated | attachment_uploaded | completed | reassigned | due_date_changed | cancelled | remark_added
    note: { type: String, trim: true },
    actor: { type: Schema.Types.ObjectId, ref: 'User' },
    actorName: { type: String, trim: true },
    at: { type: Date, default: () => new Date() },
  },
  { _id: true }
)

// A Marketing Task is either an Assigned Task (created by management for an
// employee) or a Self Task (created by an employee for themselves — owner is
// auto-set to the creator). See §Task Types.
const marketingTaskSchema = new Schema(
  {
    firm: { type: Schema.Types.ObjectId, ref: 'Firm', default: null, index: true },
    code: { type: String, trim: true, index: true }, // human id: MKT-0001

    // The doer/owner. Self tasks: owner === createdBy.
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    ownerName: { type: String, trim: true },

    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    createdByName: { type: String, trim: true },
    createdByRole: { type: String, trim: true },

    // true = created by management and assigned to someone else (§Assigned Task).
    // false = employee self task (§Self Task).
    isSelfTask: { type: Boolean, default: true, index: true },

    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },

    channel: { type: String, enum: Object.values(MARKETING_CHANNEL), required: true, index: true },
    marketingType: { type: String, enum: MARKETING_TYPES, required: true, index: true },

    campaign: { type: Schema.Types.ObjectId, ref: 'MarketingCampaign', default: null, index: true },
    relatedProject: { type: Schema.Types.ObjectId, ref: 'Project', default: null },
    relatedBuilder: { type: Schema.Types.ObjectId, ref: 'Builder', default: null },
    branch: { type: String, trim: true, index: true },

    priority: { type: String, enum: MARKETING_PRIORITY, default: 'medium', index: true },
    dueDate: { type: Date, index: true },
    estimatedBudget: { type: Number, default: 0, min: 0 },

    status: { type: String, enum: MARKETING_TASK_STATUS, default: 'pending', index: true },
    progress: { type: Number, default: 0, min: 0, max: 100 }, // % complete (optional)
    startedAt: { type: Date },
    completedAt: { type: Date },
    completionRemarks: { type: String, trim: true },
    cancelReason: { type: String, trim: true },

    attachments: { type: [attachmentSchema], default: [] },
    links: { type: [linkSchema], default: [] },
    remarks: { type: [remarkSchema], default: [] },
    activity: { type: [activitySchema], default: [] },
  },
  { timestamps: true }
)

marketingTaskSchema.index({ firm: 1, status: 1 })
marketingTaskSchema.index({ firm: 1, owner: 1 })
marketingTaskSchema.index({ firm: 1, campaign: 1 })

export default model('MarketingTask', marketingTaskSchema)

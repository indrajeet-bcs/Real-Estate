import mongoose from 'mongoose'

const { Schema, model } = mongoose

// A comment thread entry (Employee spec §Comments — Add / Reply).
const taskCommentSchema = new Schema(
  {
    text: { type: String, required: true, trim: true },
    author: { type: Schema.Types.ObjectId, ref: 'User' },
    authorName: { type: String, trim: true },
    authorRole: { type: String, trim: true },
    parent: { type: Schema.Types.ObjectId, default: null }, // reply-to comment id
    at: { type: Date, default: () => new Date() },
  },
  { _id: true }
)

// An uploaded task attachment (spec §Upload Attachments / §Documents).
const taskAttachmentSchema = new Schema(
  {
    label: { type: String, trim: true },
    fileName: String,
    fileUrl: String,
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    uploadedAt: { type: Date, default: () => new Date() },
  },
  { _id: true }
)

// A Task is either a personal work-planner item (owner-created) or an official
// task assigned by an Admin/Sub-Admin (Employee spec §Tasks). Official tasks are
// read-only to the employee except for progress/comments/attachments/completion.
const taskSchema = new Schema(
  {
    firm: { type: Schema.Types.ObjectId, ref: 'Firm', default: null, index: true },
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true }, // the doer/employee

    // Assignment (official tasks). For planner tasks these stay unset.
    assignedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    assignedByName: { type: String, trim: true },
    assignedByRole: { type: String, trim: true },
    official: { type: Boolean, default: false, index: true }, // assigned by admin/sub-admin

    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    dueDate: { type: Date },
    dueTime: { type: String, trim: true }, // HH:MM
    priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },

    // Optional link to another record.
    relatedType: { type: String, enum: ['lead', 'customer', 'booking', 'site_visit', 'none'], default: 'none' },
    relatedId: { type: Schema.Types.ObjectId, default: null },

    status: { type: String, enum: ['pending', 'in_progress', 'on_hold', 'completed'], default: 'pending', index: true },
    completionRemarks: { type: String, trim: true },
    completedAt: { type: Date },

    comments: { type: [taskCommentSchema], default: [] },
    attachments: { type: [taskAttachmentSchema], default: [] },
    // Activity timeline (spec §Activity Timeline).
    activity: {
      type: [new Schema({ type: { type: String, trim: true }, note: { type: String, trim: true }, actor: { type: Schema.Types.ObjectId, ref: 'User' }, actorName: { type: String, trim: true }, at: { type: Date, default: () => new Date() } }, { _id: true })],
      default: [],
    },
  },
  { timestamps: true }
)

export default model('Task', taskSchema)

import mongoose from 'mongoose'
import { FOLLOWUP_STATUS, PRIORITY, INTEREST_LEVEL } from '../config/constants.js'

const { Schema, model } = mongoose

// Follow-up scheduled by an executive against a customer (§6). Drives the
// "due / overdue" dashboard surfacing and the missed-follow-up escalation (§9).
const followUpSchema = new Schema(
  {
    firm: { type: Schema.Types.ObjectId, ref: 'Firm', required: true, index: true },
    customer: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    scheduledAt: { type: Date, required: true, index: true },
    priority: { type: String, enum: PRIORITY, default: 'medium' },
    interestLevel: { type: String, enum: INTEREST_LEVEL, default: 'warm' },
    notes: { type: String, trim: true },

    type: { type: String, default: 'call' },
    purpose: { type: String, trim: true },
    project: { type: Schema.Types.ObjectId, ref: 'Project', default: null },
    customerStage: { type: String, trim: true },
    lastFollowupSummary: { type: String, trim: true },

    // Outcome capture on completion (Employee spec §Mark Follow-up Completed / §Outcome).
    outcome: { type: String, trim: true }, // interested | need_more_info | site_visit_scheduled | negotiation | not_interested | call_later | converted
    conversationSummary: { type: String, trim: true },
    nextAction: { type: String, trim: true },

    // Self-contained follow-up timeline (spec §Timeline).
    timeline: {
      type: [new Schema({ type: { type: String, trim: true }, note: { type: String, trim: true }, at: { type: Date, default: () => new Date() } }, { _id: true })],
      default: [],
    },

    status: {
      type: String,
      enum: Object.values(FOLLOWUP_STATUS),
      default: FOLLOWUP_STATUS.SCHEDULED,
      index: true,
    },
    outcomeNotes: { type: String, trim: true },
    completedAt: { type: Date },

    // Set when rescheduled — points to the newly created follow-up.
    rescheduledTo: { type: Schema.Types.ObjectId, ref: 'FollowUp', default: null },

    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
)

followUpSchema.index({ assignedTo: 1, status: 1, scheduledAt: 1 })

export default model('FollowUp', followUpSchema)

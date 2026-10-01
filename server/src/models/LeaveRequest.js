import mongoose from 'mongoose'
import { LEAVE_TYPES } from '../config/constants.js'

const { Schema, model } = mongoose

const leaveAttachmentSchema = new Schema(
  {
    label: { type: String, trim: true },
    fileName: String,
    fileUrl: String,
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    uploadedAt: { type: Date, default: () => new Date() },
  },
  { _id: true }
)

// A leave request (Branch-admin port). An executive requests leave; the branch
// Sub-Admin (or Admin) approves or rejects it.
const leaveRequestSchema = new Schema(
  {
    firm: { type: Schema.Types.ObjectId, ref: 'Firm', required: true, index: true },
    employee: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    branch: { type: String, trim: true }, // employee's branch at request time

    type: { type: String, enum: LEAVE_TYPES, default: 'casual' },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    days: { type: Number, required: true },
    reason: { type: String, trim: true },
    attachments: { type: [leaveAttachmentSchema], default: [] },

    status: { type: String, enum: ['pending', 'approved', 'rejected', 'cancelled'], default: 'pending', index: true },
    decisionNote: { type: String, trim: true },
    decidedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    decidedByName: { type: String, trim: true },
    decidedAt: { type: Date },
  },
  { timestamps: true }
)

export default model('LeaveRequest', leaveRequestSchema)

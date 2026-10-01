import mongoose from 'mongoose'
import { VISIT_STATUS, VISIT_TYPES, VISIT_INTEREST } from '../config/constants.js'

const { Schema, model } = mongoose

// Captured GPS point for check-in/out (Employee spec §Check-In / Check-Out).
const geoPointSchema = new Schema(
  { lat: Number, lng: Number, address: { type: String, trim: true } },
  { _id: false }
)

// Micro-timeline entry for a single visit (Visit Scheduled, Reminder Sent,
// Check-In, Visit Completed, Feedback Added — spec §Visit Timeline).
const visitEventSchema = new Schema(
  { type: { type: String, trim: true }, note: { type: String, trim: true }, at: { type: Date, default: () => new Date() } },
  { _id: true }
)

// Site visit for a customer to a project (§6). Sub-Admins oversee across the
// team and flag missed visits (§5).
const siteVisitSchema = new Schema(
  {
    firm: { type: Schema.Types.ObjectId, ref: 'Firm', required: true, index: true },
    customer: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    project: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    builder: { type: Schema.Types.ObjectId, ref: 'Builder', default: null },
    unit: { type: Schema.Types.ObjectId, ref: 'Unit', default: null }, // Property Unit (optional)
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    scheduledAt: { type: Date, required: true, index: true },
    visitType: { type: String, enum: VISIT_TYPES, default: 'first_visit' },
    meetingPoint: { type: String, trim: true }, // Meeting Location
    notes: { type: String, trim: true }, // scheduling notes
    status: {
      type: String,
      enum: Object.values(VISIT_STATUS),
      default: VISIT_STATUS.SCHEDULED,
      index: true,
    },

    // Check-in / check-out (spec §Check-In / §Check-Out).
    checkIn: { at: Date, location: geoPointSchema, photo: { type: String } },
    checkOut: { at: Date, location: geoPointSchema, summary: { type: String, trim: true } },
    durationMinutes: { type: Number }, // auto-calculated at check-out

    // Outcome capture on completion (spec §Complete Site Visit / §Visit Outcome).
    outcome: { type: String, trim: true },
    interestLevel: { type: String, enum: VISIT_INTEREST },
    feedback: { type: String, trim: true }, // customer feedback
    nextAction: { type: String, trim: true },
    remarks: { type: String, trim: true },
    photos: [{ type: String }], // file URLs

    // Self-contained visit timeline.
    timeline: { type: [visitEventSchema], default: [] },

    // Reschedule / cancel reason.
    reason: { type: String, trim: true },
    rescheduledTo: { type: Schema.Types.ObjectId, ref: 'SiteVisit', default: null },

    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
)

siteVisitSchema.index({ assignedTo: 1, status: 1, scheduledAt: 1 })

export default model('SiteVisit', siteVisitSchema)

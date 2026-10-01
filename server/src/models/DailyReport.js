import mongoose from 'mongoose'

const { Schema, model } = mongoose

// A Sales Executive's End-of-Day (EOD) report (Sales-Exec flow §E3). One report
// per user per day (`date` is a YYYY-MM-DD key so upserts are idempotent). The
// activity counts are pre-filled from the day's real records at load time, but
// the executive can adjust them before submitting. Sub-Admins/Admins read their
// team's reports (firm-scoped) for review.
const dailyReportSchema = new Schema(
  {
    firm: { type: Schema.Types.ObjectId, ref: 'Firm', default: null, index: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    userName: { type: String, trim: true },
    branch: { type: String, trim: true },

    date: { type: String, required: true, index: true }, // YYYY-MM-DD (local day)

    // Activity counts for the day (prefilled from real data, editable by the exec).
    callsCount: { type: Number, default: 0, min: 0 },
    meetingsCount: { type: Number, default: 0, min: 0 },
    visitsCount: { type: Number, default: 0, min: 0 },
    bookingsCount: { type: Number, default: 0, min: 0 },
    newLeadsCount: { type: Number, default: 0, min: 0 },

    // Auto-computed snapshot captured at submit time (for comparison/audit).
    autoStats: {
      followupsCompleted: { type: Number, default: 0 },
      visitsConducted: { type: Number, default: 0 },
      bookingsCreated: { type: Number, default: 0 },
      leadsAssigned: { type: Number, default: 0 },
    },

    // Free-text reflection (spec §EOD Report).
    summary: { type: String, trim: true }, // what got done today
    challenges: { type: String, trim: true }, // blockers / issues faced
    tomorrowPlan: { type: String, trim: true }, // plan for the next day

    submittedAt: { type: Date, default: () => new Date() },
  },
  { timestamps: true }
)

// One report per executive per day.
dailyReportSchema.index({ user: 1, date: 1 }, { unique: true })

export default model('DailyReport', dailyReportSchema)

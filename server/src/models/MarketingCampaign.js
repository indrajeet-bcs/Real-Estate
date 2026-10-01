import mongoose from 'mongoose'
import { CAMPAIGN_STATUS } from '../config/marketing.js'

const { Schema, model } = mongoose

// A Campaign groups related marketing tasks under a budget + date window
// (§Campaigns). Campaigns are OPTIONAL — tasks work without one — so this is a
// light container. ROI / spend tracking is intentionally deferred to a later
// version (V1 keeps only an estimated budget).
const marketingCampaignSchema = new Schema(
  {
    firm: { type: Schema.Types.ObjectId, ref: 'Firm', default: null, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    budget: { type: Number, default: 0, min: 0 },
    startDate: { type: Date },
    endDate: { type: Date },
    status: { type: String, enum: CAMPAIGN_STATUS, default: 'planned', index: true },
    branch: { type: String, trim: true },
    // Optional builder + project the campaign targets (project must belong to the
    // chosen builder — enforced on the client + validated server-side).
    builder: { type: Schema.Types.ObjectId, ref: 'Builder', default: null },
    project: { type: Schema.Types.ObjectId, ref: 'Project', default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    createdByName: { type: String, trim: true },
  },
  { timestamps: true }
)

marketingCampaignSchema.index({ firm: 1, status: 1 })

export default model('MarketingCampaign', marketingCampaignSchema)

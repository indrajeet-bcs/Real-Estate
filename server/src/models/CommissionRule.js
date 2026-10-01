import mongoose from 'mongoose'

const { Schema, model } = mongoose

// A firm's brokerage rule (Admin-flow port). A base rate applies up to a target
// threshold of sales; above it, an accelerator rate kicks in. Scope narrows from
// all builders → a specific builder → a specific project (most specific wins).
const commissionRuleSchema = new Schema(
  {
    firm: { type: Schema.Types.ObjectId, ref: 'Firm', required: true, index: true },
    name: { type: String, required: true, trim: true },
    builder: { type: Schema.Types.ObjectId, ref: 'Builder', default: null },
    project: { type: Schema.Types.ObjectId, ref: 'Project', default: null }, // most-specific scope
    baseRate: { type: Number, required: true }, // percentage
    targetThreshold: { type: Number, default: 0 }, // sales value (INR) to unlock accelerator
    acceleratorRate: { type: Number, default: 0 }, // percentage above threshold
    active: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
)

// A rule's scope label — "project" beats "builder" beats "all builders".
commissionRuleSchema.virtual('scope').get(function scope() {
  if (this.project) return 'project'
  if (this.builder) return 'builder'
  return 'all'
})

export default model('CommissionRule', commissionRuleSchema)

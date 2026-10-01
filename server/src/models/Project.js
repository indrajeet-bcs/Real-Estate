import mongoose from 'mongoose'

const { Schema, model } = mongoose

// A project belongs to a builder and a firm. Archiving keeps it as a read-only
// reference when historical customers are linked (Edge Case §15).
const projectSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    firm: { type: Schema.Types.ObjectId, ref: 'Firm', required: true, index: true },
    builder: { type: Schema.Types.ObjectId, ref: 'Builder', required: true },
    location: { type: String, trim: true },
    city: { type: String, trim: true },
    description: { type: String, trim: true },
    propertyType: { type: String, trim: true }, // apartment, villa, plot, commercial...
    image: { type: String, trim: true }, // project cover image URL
    launchDate: { type: Date },
    possessionDate: { type: Date },
    amenities: { type: [String], default: [] },
    // Admin-flow port (RERA): registration number, brokerage rate, build stage.
    reraNumber: { type: String, trim: true },
    commissionRate: { type: Number, default: 0 }, // percentage, e.g. 2.5
    constructionStatus: { type: String, enum: ['pre_launch', 'under_construction', 'ready_to_move'], default: 'under_construction' },
    status: { type: String, enum: ['active', 'archived'], default: 'active' },
    isArchived: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
)

projectSchema.index({ firm: 1, name: 1 })
projectSchema.index({ builder: 1 })

export default model('Project', projectSchema)

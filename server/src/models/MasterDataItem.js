import mongoose from 'mongoose'

const { Schema, model } = mongoose

// A configurable master-data value (lead source, property type, payment mode, …).
// Firm-scoped and grouped by `category` (matches the UI's category ids).
const masterDataItemSchema = new Schema(
  {
    firm: { type: Schema.Types.ObjectId, ref: 'Firm', required: true, index: true },
    category: { type: String, required: true, trim: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: '' },
    active: { type: Boolean, default: true },
    usage: { type: Number, default: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
)

masterDataItemSchema.index({ firm: 1, category: 1, name: 1 }, { unique: true })

export default model('MasterDataItem', masterDataItemSchema)

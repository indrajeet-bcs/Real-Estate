import mongoose from 'mongoose'

const { Schema, model } = mongoose

// One settings document per firm holding the Office-Settings sections. Sections
// are flexible (Mixed) because the UI tabs own their own field shapes and merge
// against their own defaults — the backend just persists and returns them.
const companySettingsSchema = new Schema(
  {
    firm: { type: Schema.Types.ObjectId, ref: 'Firm', required: true, unique: true, index: true },
    preferences: { type: Schema.Types.Mixed, default: {} },
    businessConfig: { type: Schema.Types.Mixed, default: {} },
    notifications: { type: Schema.Types.Mixed, default: {} },
    security: { type: Schema.Types.Mixed, default: {} },
    branding: { type: Schema.Types.Mixed, default: {} },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, minimize: false }
)

export default model('CompanySettings', companySettingsSchema)

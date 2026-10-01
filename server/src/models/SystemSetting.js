import mongoose from 'mongoose'

const { Schema, model } = mongoose

// Singleton platform configuration managed by the Super Admin (§3.2 System
// Settings). One document; `key` pins it.
const systemSettingSchema = new Schema(
  {
    key: { type: String, default: 'global', unique: true },
    sessionTimeoutMin: { type: Number, default: 30 },
    lateThreshold: { type: String, default: '10:30' },
    halfDayMinutes: { type: Number, default: 240 },
    notificationTemplates: { type: Schema.Types.Mixed, default: {} },
    general: { type: Schema.Types.Mixed, default: {} },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
)

export default model('SystemSetting', systemSettingSchema)

import mongoose from 'mongoose'
import { NOTIFICATION_TYPES } from '../config/constants.js'

const { Schema, model } = mongoose

// System-triggered notifications (§9). Delivered to a recipient user and
// surfaced on their dashboard; `read` tracks acknowledgement.
const notificationSchema = new Schema(
  {
    firm: { type: Schema.Types.ObjectId, ref: 'Firm', default: null, index: true },
    recipient: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: Object.values(NOTIFICATION_TYPES), required: true },
    title: { type: String, required: true, trim: true },
    message: { type: String, trim: true },

    // Link back to the entity that triggered this (customer, booking, visit...).
    entityType: { type: String },
    entityId: { type: Schema.Types.ObjectId },

    // Priority (Employee spec §Notification Panel). Auto-derived from the type.
    priority: { type: String, enum: ['high', 'medium', 'low'], default: 'medium', index: true },

    read: { type: Boolean, default: false, index: true },
    readAt: { type: Date },
  },
  { timestamps: true }
)

notificationSchema.index({ recipient: 1, read: 1, createdAt: -1 })

export default model('Notification', notificationSchema)

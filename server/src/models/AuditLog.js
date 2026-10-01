import mongoose from 'mongoose'
import { AUDIT_ACTIONS, MODULES } from '../config/constants.js'

const { Schema, model } = mongoose

// Every critical action (create/edit/delete/status change), login/logout, and
// unauthorized attempt is written here (§10). Super Admin sees all; Admin sees
// their firm. Filterable by user / module / date (§3.2).
const auditLogSchema = new Schema(
  {
    firm: { type: Schema.Types.ObjectId, ref: 'Firm', default: null, index: true },
    actor: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    actorRole: { type: String },
    action: { type: String, enum: Object.values(AUDIT_ACTIONS), required: true },
    module: { type: String, enum: Object.values(MODULES), required: true, index: true },

    targetId: { type: Schema.Types.ObjectId, default: null },
    targetLabel: { type: String, trim: true },
    description: { type: String, trim: true },
    meta: { type: Schema.Types.Mixed },

    ip: { type: String },
    userAgent: { type: String },
    success: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
)

auditLogSchema.index({ createdAt: -1 })
auditLogSchema.index({ firm: 1, module: 1, createdAt: -1 })

export default model('AuditLog', auditLogSchema)

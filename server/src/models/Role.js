import mongoose from 'mongoose'
import { ROLE_VALUES } from '../config/constants.js'

const { Schema, model } = mongoose

export const ROLE_CATEGORIES = ['Company', 'Branch', 'Department', 'Team', 'Operational']

// A firm-scoped role in the custom-role engine. `baseRole` is the hard
// enforcement tier (one of the four system roles) that drives requireRole()
// checks; `permissions` is the fine-grained module→actions map that `can()`
// consults (derived from the UI designer selections). `designer` stores the
// permission-builder UI's own selection blobs opaquely so the wizard round-trips.
const roleSchema = new Schema(
  {
    firm: { type: Schema.Types.ObjectId, ref: 'Firm', required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: '' },
    category: { type: String, enum: ROLE_CATEGORIES, default: 'Operational' },
    type: { type: String, enum: ['system', 'custom'], default: 'custom' },
    baseRole: { type: String, enum: ROLE_VALUES, required: true },
    reportsTo: { type: Schema.Types.ObjectId, ref: 'Role', default: null },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    isSystem: { type: Boolean, default: false }, // system roles can't be deleted

    // Enforcement map consulted by can(): { [backendModule]: [actions] }.
    permissions: { type: Schema.Types.Mixed, default: {} },

    // UI permission-designer selections (module access levels, page/tab access,
    // per-action toggles, approvals, data scope). Persisted opaquely.
    designer: {
      moduleAccess: { type: Schema.Types.Mixed, default: {} }, // { MOD_id: 'none'|'view'|'manage' }
      pageAccess: { type: Schema.Types.Mixed, default: {} }, // { pages: [], tabs: [] }
      actions: { type: Schema.Types.Mixed, default: {} }, // { ACT_id: true }
      approvals: { type: Schema.Types.Mixed, default: {} },
      dataScope: { type: String, default: 'all' }, // all | branch | team | own
    },

    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, minimize: false }
)

roleSchema.index({ firm: 1, name: 1 }, { unique: true })

export default model('Role', roleSchema)

import SystemSetting from '../models/SystemSetting.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ok } from '../utils/apiResponse.js'
import { writeAudit } from '../middleware/audit.js'
import { AUDIT_ACTIONS, MODULES } from '../config/constants.js'
import { ROLE_PERMISSIONS } from '../config/permissions.js'

// GET /api/settings — Super Admin system settings (§3.2).
export const getSettings = asyncHandler(async (_req, res) => {
  let settings = await SystemSetting.findOne({ key: 'global' })
  if (!settings) settings = await SystemSetting.create({ key: 'global' })
  return ok(res, settings)
})

// PATCH /api/settings
export const updateSettings = asyncHandler(async (req, res) => {
  const settings = await SystemSetting.findOneAndUpdate(
    { key: 'global' },
    { ...req.body, updatedBy: req.user._id },
    { new: true, upsert: true, runValidators: true }
  )
  writeAudit({ req, action: AUDIT_ACTIONS.UPDATE, module: MODULES.SETTINGS, description: 'Updated system settings' })
  return ok(res, settings, 'Settings updated')
})

// GET /api/settings/permissions — the default role→module→action matrix (§14),
// exposed for the Permissions & Role Settings screen.
export const getPermissionMatrix = asyncHandler(async (_req, res) => {
  return ok(res, ROLE_PERMISSIONS, 'Role permission matrix')
})

import Branch from '../models/Branch.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from '../utils/ApiError.js'
import { ok } from '../utils/apiResponse.js'
import { writeAudit } from '../middleware/audit.js'
import { AUDIT_ACTIONS, MODULES } from '../config/constants.js'
import { firmScope } from '../middleware/tenantScope.js'

// Resolve the acting Sub-Admin's own branch (matched by their branch name).
async function myBranch(user) {
  if (!user.branch) throw ApiError.badRequest('You are not assigned to a branch')
  const branch = await Branch.findOne({ ...firmScope(user), name: user.branch })
  if (!branch) throw ApiError.notFound('Your branch has no settings record yet')
  return branch
}

// GET /api/branch-settings — the Sub-Admin's own branch preferences.
export const getMyBranchSettings = asyncHandler(async (req, res) => {
  const branch = await myBranch(req.user)
  return ok(res, branch, 'Branch settings fetched')
})

// PATCH /api/branch-settings — geofence radius, working hours, auto-routing.
export const updateMyBranchSettings = asyncHandler(async (req, res) => {
  const branch = await myBranch(req.user)
  const { geofenceRadius, workingHours, autoRouteLeads } = req.body
  if (geofenceRadius !== undefined) branch.geofenceRadius = geofenceRadius
  if (workingHours !== undefined) branch.workingHours = workingHours
  if (autoRouteLeads !== undefined) branch.autoRouteLeads = autoRouteLeads
  await branch.save()
  writeAudit({ req, action: AUDIT_ACTIONS.UPDATE, module: MODULES.SETTINGS, targetId: branch._id, targetLabel: branch.name, description: `Updated branch settings for ${branch.name}` })
  return ok(res, branch, 'Branch settings updated')
})

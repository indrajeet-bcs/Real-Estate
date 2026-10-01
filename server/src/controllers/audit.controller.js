import AuditLog from '../models/AuditLog.js'
import User from '../models/User.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ok } from '../utils/apiResponse.js'
import { paginate } from '../utils/paginate.js'
import { ROLES } from '../config/constants.js'

// GET /api/audit-logs — Super Admin: all; Admin: own firm; Sub-Admin: own branch
// (their team's actions) only (§3.2, §10). Filterable by user / module / action /
// date range / keyword.
export const listAuditLogs = asyncHandler(async (req, res) => {
  const { page, limit, module, action, actor, from, to, search } = req.query
  const filter = {}
  if (req.user.role !== ROLES.SUPER_ADMIN) filter.firm = req.user.firm

  // Sub-Admin is scoped to their branch team (direct reports + self).
  if (req.user.role === ROLES.SUB_ADMIN) {
    const team = await User.find({ firm: req.user.firm, manager: req.user._id }).select('_id').lean()
    const teamIds = team.map((t) => String(t._id))
    teamIds.push(String(req.user._id))
    filter.actor = actor && teamIds.includes(String(actor)) ? actor : { $in: teamIds }
  } else if (actor) {
    filter.actor = actor
  }

  if (module) filter.module = module
  if (action) filter.action = action
  if (search) {
    filter.$or = [
      { description: { $regex: search, $options: 'i' } },
      { targetLabel: { $regex: search, $options: 'i' } },
    ]
  }
  if (from || to) {
    filter.createdAt = {}
    if (from) filter.createdAt.$gte = new Date(from)
    if (to) filter.createdAt.$lte = new Date(to)
  }

  const { data, meta } = await paginate(AuditLog, filter, {
    page,
    limit,
    sort: { createdAt: -1 },
    populate: { path: 'actor', select: 'name email role branch' },
  })
  return ok(res, data, 'Audit logs fetched', meta)
})

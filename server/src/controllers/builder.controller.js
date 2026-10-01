import Builder from '../models/Builder.js'
import Project from '../models/Project.js'
import Booking from '../models/Booking.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from '../utils/ApiError.js'
import { ok, created } from '../utils/apiResponse.js'
import { paginate } from '../utils/paginate.js'
import { writeAudit } from '../middleware/audit.js'
import { AUDIT_ACTIONS, MODULES, ROLES, BOOKING_STATUS } from '../config/constants.js'
import { firmScope } from '../middleware/tenantScope.js'

// GET /api/builders — firm-scoped for Admin/Sub-Admin/Exec; all firms for Super
// Admin (view-only, name-focused per §3).
export const listBuilders = asyncHandler(async (req, res) => {
  const { page, limit, search } = req.query
  const filter = { ...firmScope(req.user) }
  if (search) filter.name = { $regex: search, $options: 'i' }
  if (req.query.includeArchived !== 'true') filter.isArchived = { $ne: true }

  // Super Admin sees only names across firms (view-only).
  const select = req.user.role === ROLES.SUPER_ADMIN ? 'name firm isArchived createdAt' : undefined

  const { data, meta } = await paginate(Builder, filter, { page, limit, select })
  return ok(res, data, 'Builders fetched', meta)
})

// GET /api/builders/:id — builder profile with projects, business performance
// and activity timeline (spec §View Builder Page).
export const getBuilder = asyncHandler(async (req, res) => {
  const builder = await Builder.findOne({ _id: req.params.id, ...firmScope(req.user) }).lean()
  if (!builder) throw ApiError.notFound('Builder not found')

  const projects = await Project.find({ builder: builder._id, firm: req.user.firm })
    .select('name propertyType constructionStatus reraNumber commissionRate isArchived createdAt').lean()
  const projectIds = projects.map((p) => p._id)

  const [perfAgg] = await Booking.aggregate([
    { $match: { firm: req.user.firm, project: { $in: projectIds }, status: BOOKING_STATUS.CONFIRMED } },
    { $group: {
      _id: null,
      revenue: { $sum: { $ifNull: ['$totalValue', '$bookingAmount'] } },
      sales: { $sum: 1 },
      customers: { $addToSet: '$customer' },
    } },
  ])
  const totalBookings = await Booking.countDocuments({ firm: req.user.firm, project: { $in: projectIds } })

  const performance = {
    totalRevenue: perfAgg?.revenue || 0,
    totalSales: perfAgg?.sales || 0,
    bookings: totalBookings,
    customers: (perfAgg?.customers || []).length,
  }

  const timeline = [
    { label: 'Builder onboarded', at: builder.createdAt },
    ...projects.map((p) => ({ label: `Project registered — ${p.name}`, at: p.createdAt })),
  ].filter((t) => t.at).sort((a, b) => new Date(a.at) - new Date(b.at))

  return ok(res, { builder, projects, performance, timeline }, 'Builder details')
})

export const createBuilder = asyncHandler(async (req, res) => {
  const builder = await Builder.create({ ...req.body, firm: req.user.firm, createdBy: req.user._id })
  writeAudit({ req, action: AUDIT_ACTIONS.CREATE, module: MODULES.BUILDER, targetId: builder._id, targetLabel: builder.name, description: `Created builder ${builder.name}` })
  return created(res, builder, 'Builder created')
})

export const updateBuilder = asyncHandler(async (req, res) => {
  const builder = await Builder.findOneAndUpdate(
    { _id: req.params.id, ...firmScope(req.user) },
    req.body,
    { new: true, runValidators: true }
  )
  if (!builder) throw ApiError.notFound('Builder not found')
  writeAudit({ req, action: AUDIT_ACTIONS.UPDATE, module: MODULES.BUILDER, targetId: builder._id, targetLabel: builder.name, description: `Updated builder ${builder.name}` })
  return ok(res, builder, 'Builder updated')
})

// DELETE /api/builders/:id — archive, not hard-delete (Edge Case §15). Archives
// its projects too so historical customer links stay intact as read-only.
export const archiveBuilder = asyncHandler(async (req, res) => {
  const builder = await Builder.findOne({ _id: req.params.id, ...firmScope(req.user) })
  if (!builder) throw ApiError.notFound('Builder not found')
  builder.isArchived = true
  await builder.save()
  await Project.updateMany({ builder: builder._id }, { $set: { isArchived: true, status: 'archived' } })
  writeAudit({ req, action: AUDIT_ACTIONS.STATUS_CHANGE, module: MODULES.BUILDER, targetId: builder._id, targetLabel: builder.name, description: `Archived builder ${builder.name} and its projects` })
  return ok(res, builder, 'Builder archived (kept as read-only reference)')
})

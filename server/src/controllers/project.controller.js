import Project from '../models/Project.js'
import Builder from '../models/Builder.js'
import Customer from '../models/Customer.js'
import Unit from '../models/Unit.js'
import Booking from '../models/Booking.js'
import User from '../models/User.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from '../utils/ApiError.js'
import { ok, created } from '../utils/apiResponse.js'
import { paginate } from '../utils/paginate.js'
import { writeAudit } from '../middleware/audit.js'
import { AUDIT_ACTIONS, MODULES, ROLES, BOOKING_STATUS } from '../config/constants.js'
import { firmScope } from '../middleware/tenantScope.js'

// GET /api/projects
export const listProjects = asyncHandler(async (req, res) => {
  const { page, limit, search, builder } = req.query
  const filter = { ...firmScope(req.user) }
  if (search) filter.name = { $regex: search, $options: 'i' }
  if (builder) filter.builder = builder
  if (req.query.includeArchived !== 'true') filter.isArchived = { $ne: true }

  const select = req.user.role === ROLES.SUPER_ADMIN ? 'name firm builder isArchived createdAt' : undefined
  const populate = req.user.role === ROLES.SUPER_ADMIN ? undefined : { path: 'builder', select: 'name' }

  const { data, meta } = await paginate(Project, filter, { page, limit, select, populate })
  return ok(res, data, 'Projects fetched', meta)
})

// GET /api/projects/:id — project overview with inventory/pricing/config/sales
// summaries, assigned employees and timeline (spec §View Project Page).
export const getProject = asyncHandler(async (req, res) => {
  const project = await Project.findOne({ _id: req.params.id, ...firmScope(req.user) })
    .populate('builder', 'name')
    .lean()
  if (!project) throw ApiError.notFound('Project not found')

  const [statusAgg, priceAgg, configAgg, salesAgg, bookingsCount, registrations] = await Promise.all([
    Unit.aggregate([{ $match: { project: project._id } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Unit.aggregate([
      { $match: { project: project._id } },
      { $group: { _id: null,
        min: { $min: { $ifNull: ['$currentPrice', { $ifNull: ['$basePrice', '$price'] }] } },
        max: { $max: { $ifNull: ['$currentPrice', { $ifNull: ['$basePrice', '$price'] }] } },
        avg: { $avg: { $ifNull: ['$currentPrice', { $ifNull: ['$basePrice', '$price'] }] } },
      } },
    ]),
    Unit.aggregate([{ $match: { project: project._id } }, { $group: { _id: { $ifNull: ['$configuration', '$unitType'] }, count: { $sum: 1 } } }]),
    Booking.aggregate([
      { $match: { project: project._id, status: BOOKING_STATUS.CONFIRMED } },
      { $group: { _id: null, revenue: { $sum: { $ifNull: ['$totalValue', '$bookingAmount'] } }, sales: { $sum: 1 } } },
    ]),
    Booking.countDocuments({ project: project._id }),
    Booking.countDocuments({ project: project._id, status: BOOKING_STATUS.CONFIRMED, reraVerified: true }),
  ])

  const sm = Object.fromEntries(statusAgg.map((r) => [r._id, r.count]))
  const totalUnits = statusAgg.reduce((s, r) => s + r.count, 0)
  const inventory = {
    total: totalUnits,
    available: sm.available || 0,
    reserved: (sm.reserved || 0) + (sm.locked || 0),
    booked: sm.booked || 0,
    sold: sm.booked || 0,
  }
  const pricing = { min: priceAgg[0]?.min || 0, max: priceAgg[0]?.max || 0, avg: Math.round(priceAgg[0]?.avg || 0) }
  const configuration = configAgg.filter((r) => r._id).map((r) => ({ type: r._id, count: r.count }))
  const salesRevenue = salesAgg[0]?.revenue || 0

  // Assigned employees: executives with bookings on this project.
  const execIds = await Booking.distinct('bookedBy', { project: project._id })
  const assignedEmployees = await User.find({ _id: { $in: execIds } }).select('name role branch').lean()

  const sales = {
    revenue: salesRevenue,
    bookings: bookingsCount,
    registrations,
    conversionRate: totalUnits > 0 ? Math.round(((sm.booked || 0) / totalUnits) * 100) : 0,
  }

  const timeline = [
    { label: 'Project registered', at: project.createdAt },
    ...(totalUnits > 0 ? [{ label: 'Inventory uploaded', at: project.createdAt }] : []),
    ...(bookingsCount > 0 ? [{ label: 'Bookings started', at: null }] : []),
    ...(registrations > 0 ? [{ label: 'Registrations', at: null }] : []),
    ...(project.constructionStatus === 'ready_to_move' ? [{ label: 'Project completed', at: project.possessionDate }] : []),
  ]

  return ok(res, {
    project,
    unitCount: totalUnits,
    inventory,
    pricing,
    configuration,
    sales,
    assignedEmployees,
    timeline,
  }, 'Project details')
})

export const createProject = asyncHandler(async (req, res) => {
  // Builder must belong to the same firm.
  const builder = await Builder.findOne({ _id: req.body.builder, ...firmScope(req.user) })
  if (!builder) throw ApiError.badRequest('Builder not found in your firm')

  const project = await Project.create({ ...req.body, firm: req.user.firm, createdBy: req.user._id })
  writeAudit({ req, action: AUDIT_ACTIONS.CREATE, module: MODULES.PROJECT, targetId: project._id, targetLabel: project.name, description: `Created project ${project.name}` })
  return created(res, project, 'Project created')
})

export const updateProject = asyncHandler(async (req, res) => {
  const project = await Project.findOneAndUpdate(
    { _id: req.params.id, ...firmScope(req.user) },
    req.body,
    { new: true, runValidators: true }
  )
  if (!project) throw ApiError.notFound('Project not found')
  writeAudit({ req, action: AUDIT_ACTIONS.UPDATE, module: MODULES.PROJECT, targetId: project._id, targetLabel: project.name, description: `Updated project ${project.name}` })
  return ok(res, project, 'Project updated')
})

// DELETE /api/projects/:id — archive if historical customers are linked;
// otherwise still soft-archive (never hard-delete, §15).
export const archiveProject = asyncHandler(async (req, res) => {
  const project = await Project.findOne({ _id: req.params.id, ...firmScope(req.user) })
  if (!project) throw ApiError.notFound('Project not found')

  const linkedCustomers = await Customer.countDocuments({ 'interestedProjects.project': project._id })
  project.isArchived = true
  project.status = 'archived'
  await project.save()

  writeAudit({
    req,
    action: AUDIT_ACTIONS.STATUS_CHANGE,
    module: MODULES.PROJECT,
    targetId: project._id,
    targetLabel: project.name,
    description: `Archived project ${project.name} (${linkedCustomers} linked customers preserved)`,
  })
  return ok(res, { project, linkedCustomers }, 'Project archived (kept as read-only reference)')
})

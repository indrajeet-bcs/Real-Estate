import PossessionCase, { POSSESSION_STATUSES } from '../models/PossessionCase.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from '../utils/ApiError.js'
import { ok, created } from '../utils/apiResponse.js'
import { paginate } from '../utils/paginate.js'
import { ROLES } from '../config/constants.js'

function scopeFor(req) {
  const scope = {}
  if (req.user.role !== ROLES.SUPER_ADMIN) scope.firm = req.user.firm
  if (req.user.role === ROLES.SALES_EXECUTIVE) scope.$or = [{ assignedEmployee: req.user._id }, { createdBy: req.user._id }]
  return scope
}

export const listPossessions = asyncHandler(async (req, res) => {
  const { page, limit, status, search } = req.query
  const filter = { ...scopeFor(req) }
  if (status && status !== 'all') filter.status = status
  if (search) {
    filter.$and = [{
      $or: [
        { caseCode: { $regex: search, $options: 'i' } },
        { customerName: { $regex: search, $options: 'i' } },
        { bookingLabel: { $regex: search, $options: 'i' } },
        { project: { $regex: search, $options: 'i' } },
        { unitNumber: { $regex: search, $options: 'i' } },
      ],
    }]
  }
  const { data, meta } = await paginate(PossessionCase, filter, {
    page, limit, sort: { createdAt: -1 }, populate: { path: 'assignedEmployee', select: 'name email' },
  })
  return ok(res, data, 'Possession cases fetched', meta)
})

export const possessionDashboard = asyncHandler(async (req, res) => {
  const scope = scopeFor(req)
  const [total, byStatus, recent] = await Promise.all([
    PossessionCase.countDocuments(scope),
    PossessionCase.aggregate([{ $match: scope }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
    PossessionCase.find(scope).sort({ updatedAt: -1 }).limit(5).lean(),
  ])
  const statusCounts = Object.fromEntries(byStatus.map((s) => [s._id, s.n]))
  return ok(res, {
    total, statusCounts,
    readinessCheck: statusCounts['Readiness Check'] || 0,
    readyForPossession: statusCounts['Ready for Possession'] || 0,
    scheduled: statusCounts['Scheduled'] || 0,
    completed: (statusCounts['Completed'] || 0) + (statusCounts['Handover Completed'] || 0),
    recent,
  }, 'Possession dashboard')
})

export const possessionReports = asyncHandler(async (req, res) => {
  const scope = scopeFor(req)
  const [byStatus, byEmployee, byProject] = await Promise.all([
    PossessionCase.aggregate([{ $match: scope }, { $group: { _id: '$status', cases: { $sum: 1 } } }, { $sort: { cases: -1 } }]),
    PossessionCase.aggregate([{ $match: scope }, { $group: { _id: '$assignedEmployeeName', cases: { $sum: 1 }, completed: { $sum: { $cond: [{ $in: ['$status', ['Completed', 'Handover Completed']] }, 1, 0] } } } }, { $sort: { cases: -1 } }]),
    PossessionCase.aggregate([{ $match: scope }, { $group: { _id: '$project', cases: { $sum: 1 } } }, { $sort: { cases: -1 } }]),
  ])
  return ok(res, { byStatus, byEmployee, byProject }, 'Possession reports')
})

async function findScoped(req) {
  const doc = await PossessionCase.findOne({ _id: req.params.id, ...scopeFor(req) })
  if (!doc) throw ApiError.notFound('Possession case not found')
  return doc
}

export const getPossession = asyncHandler(async (req, res) => {
  const doc = await PossessionCase.findOne({ _id: req.params.id, ...scopeFor(req) })
    .populate('assignedEmployee', 'name email').populate('customer', 'name mobile').lean()
  if (!doc) throw ApiError.notFound('Possession case not found')
  return ok(res, doc)
})

export const createPossession = asyncHandler(async (req, res) => {
  const firm = req.user.role === ROLES.SUPER_ADMIN ? req.body.firm : req.user.firm
  if (!firm) throw ApiError.badRequest('A firm is required')
  const body = { ...req.body }
  delete body.firm
  const doc = await PossessionCase.create({
    ...body, firm, branch: body.branch || req.user.branch,
    assignedEmployee: body.assignedEmployee || (req.user.role === ROLES.SALES_EXECUTIVE ? req.user._id : undefined),
    assignedEmployeeName: body.assignedEmployeeName || (req.user.role === ROLES.SALES_EXECUTIVE ? req.user.name : undefined),
    createdBy: req.user._id,
    timeline: [{ user: req.user.name, activity: 'Possession Case Created', remarks: body.remarks || '' }],
  })
  return created(res, doc, 'Possession case created')
})

export const updatePossession = asyncHandler(async (req, res) => {
  const doc = await findScoped(req)
  const editable = ['assignedEmployeeName', 'expectedPossessionDate', 'scheduledDate', 'scheduledTime', 'actualPossessionDate', 'location', 'customerConfirmation', 'remarks', 'customerName', 'project', 'unitNumber', 'branch', 'registrationLabel']
  for (const k of editable) if (k in req.body) doc[k] = req.body[k]
  doc.timeline.push({ user: req.user.name, activity: 'Case Updated', remarks: req.body.remarks || '' })
  await doc.save()
  return ok(res, doc, 'Possession case updated')
})

export const updatePossessionStatus = asyncHandler(async (req, res) => {
  const { status, remarks } = req.body
  if (!POSSESSION_STATUSES.includes(status)) throw ApiError.badRequest('Invalid status')
  const doc = await findScoped(req)
  doc.status = status
  doc.timeline.push({ user: req.user.name, activity: `Status → ${status}`, remarks: remarks || '' })
  await doc.save()
  return ok(res, doc, 'Status updated')
})

// PATCH /:id/checklist/:itemId — toggle a readiness checklist item.
export const updateChecklistItem = asyncHandler(async (req, res) => {
  const doc = await findScoped(req)
  const item = doc.checklist.id(req.params.itemId)
  if (!item) throw ApiError.notFound('Checklist item not found')
  const status = req.body.status === 'Completed' ? 'Completed' : 'Pending'
  item.status = status
  item.date = status === 'Completed' ? new Date() : null
  item.user = status === 'Completed' ? req.user.name : ''
  await doc.save()
  return ok(res, doc, 'Checklist updated')
})

export const addPossessionDocument = asyncHandler(async (req, res) => {
  const doc = await findScoped(req)
  const { name, type, status, remarks } = req.body
  if (!name || !type) throw ApiError.badRequest('Document name and type are required')
  doc.documents.push({ name, type, status: status || 'Received', remarks, uploadedBy: req.user.name, uploadDate: new Date() })
  doc.timeline.push({ user: req.user.name, activity: 'Document Added', remarks: `${type}: ${name}` })
  await doc.save()
  return created(res, doc, 'Document added')
})

export const deletePossession = asyncHandler(async (req, res) => {
  const doc = await PossessionCase.findOneAndDelete({ _id: req.params.id, ...scopeFor(req) })
  if (!doc) throw ApiError.notFound('Possession case not found')
  return ok(res, { _id: doc._id }, 'Possession case deleted')
})

import RegistrationCase, { REGISTRATION_STATUSES } from '../models/RegistrationCase.js'
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

export const listRegistrations = asyncHandler(async (req, res) => {
  const { page, limit, status, type, search } = req.query
  const filter = { ...scopeFor(req) }
  if (status && status !== 'all') filter.status = status
  if (type && type !== 'all') filter.registrationType = type
  if (search) {
    filter.$and = [{
      $or: [
        { caseCode: { $regex: search, $options: 'i' } },
        { customerName: { $regex: search, $options: 'i' } },
        { bookingLabel: { $regex: search, $options: 'i' } },
        { project: { $regex: search, $options: 'i' } },
        { registrationNumber: { $regex: search, $options: 'i' } },
      ],
    }]
  }
  const { data, meta } = await paginate(RegistrationCase, filter, {
    page, limit, sort: { createdAt: -1 }, populate: { path: 'assignedEmployee', select: 'name email' },
  })
  return ok(res, data, 'Registration cases fetched', meta)
})

export const registrationDashboard = asyncHandler(async (req, res) => {
  const scope = scopeFor(req)
  const [total, byStatus, recent] = await Promise.all([
    RegistrationCase.countDocuments(scope),
    RegistrationCase.aggregate([{ $match: scope }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
    RegistrationCase.find(scope).sort({ updatedAt: -1 }).limit(5).lean(),
  ])
  const statusCounts = Object.fromEntries(byStatus.map((s) => [s._id, s.n]))
  return ok(res, {
    total, statusCounts,
    documentsPending: statusCounts['Documents Pending'] || 0,
    readyForRegistration: statusCounts['Ready for Registration'] || 0,
    appointmentScheduled: statusCounts['Appointment Scheduled'] || 0,
    completed: (statusCounts['Completed'] || 0) + (statusCounts['Registered'] || 0),
    recent,
  }, 'Registration dashboard')
})

export const registrationReports = asyncHandler(async (req, res) => {
  const scope = scopeFor(req)
  const [byStatus, byType, byEmployee] = await Promise.all([
    RegistrationCase.aggregate([{ $match: scope }, { $group: { _id: '$status', cases: { $sum: 1 } } }, { $sort: { cases: -1 } }]),
    RegistrationCase.aggregate([{ $match: scope }, { $group: { _id: '$registrationType', cases: { $sum: 1 } } }, { $sort: { cases: -1 } }]),
    RegistrationCase.aggregate([{ $match: scope }, { $group: { _id: '$assignedEmployeeName', cases: { $sum: 1 }, completed: { $sum: { $cond: [{ $in: ['$status', ['Completed', 'Registered']] }, 1, 0] } } } }, { $sort: { cases: -1 } }]),
  ])
  return ok(res, { byStatus, byType, byEmployee }, 'Registration reports')
})

async function findScoped(req) {
  const doc = await RegistrationCase.findOne({ _id: req.params.id, ...scopeFor(req) })
  if (!doc) throw ApiError.notFound('Registration case not found')
  return doc
}

export const getRegistration = asyncHandler(async (req, res) => {
  const doc = await RegistrationCase.findOne({ _id: req.params.id, ...scopeFor(req) })
    .populate('assignedEmployee', 'name email').populate('customer', 'name mobile').lean()
  if (!doc) throw ApiError.notFound('Registration case not found')
  return ok(res, doc)
})

export const createRegistration = asyncHandler(async (req, res) => {
  const firm = req.user.role === ROLES.SUPER_ADMIN ? req.body.firm : req.user.firm
  if (!firm) throw ApiError.badRequest('A firm is required')
  const body = { ...req.body }
  delete body.firm
  const doc = await RegistrationCase.create({
    ...body, firm, branch: body.branch || req.user.branch,
    assignedEmployee: body.assignedEmployee || (req.user.role === ROLES.SALES_EXECUTIVE ? req.user._id : undefined),
    assignedEmployeeName: body.assignedEmployeeName || (req.user.role === ROLES.SALES_EXECUTIVE ? req.user.name : undefined),
    createdBy: req.user._id,
    timeline: [{ user: req.user.name, activity: 'Registration Case Created', remarks: body.remarks || '' }],
  })
  return created(res, doc, 'Registration case created')
})

export const updateRegistration = asyncHandler(async (req, res) => {
  const doc = await findScoped(req)
  const editable = ['registrationType', 'assignedEmployeeName', 'expectedRegistrationDate', 'registrationAuthority', 'appointmentDate', 'appointmentTime', 'appointmentReference', 'registrationNumber', 'registrationDate', 'remarks', 'customerName', 'project', 'unitNumber', 'branch']
  for (const k of editable) if (k in req.body) doc[k] = req.body[k]
  doc.timeline.push({ user: req.user.name, activity: 'Case Updated', remarks: req.body.remarks || '' })
  await doc.save()
  return ok(res, doc, 'Registration case updated')
})

export const updateRegistrationStatus = asyncHandler(async (req, res) => {
  const { status, remarks } = req.body
  if (!REGISTRATION_STATUSES.includes(status)) throw ApiError.badRequest('Invalid status')
  const doc = await findScoped(req)
  doc.status = status
  doc.timeline.push({ user: req.user.name, activity: `Status → ${status}`, remarks: remarks || '' })
  await doc.save()
  return ok(res, doc, 'Status updated')
})

export const addRegistrationDocument = asyncHandler(async (req, res) => {
  const doc = await findScoped(req)
  const { name, type, status, remarks } = req.body
  if (!name || !type) throw ApiError.badRequest('Document name and type are required')
  doc.documents.push({ name, type, status: status || 'Received', remarks, uploadedBy: req.user.name, uploadDate: new Date() })
  doc.timeline.push({ user: req.user.name, activity: 'Document Added', remarks: `${type}: ${name}` })
  await doc.save()
  return created(res, doc, 'Document added')
})

export const updateRegistrationDocument = asyncHandler(async (req, res) => {
  const doc = await findScoped(req)
  const sub = doc.documents.id(req.params.docId)
  if (!sub) throw ApiError.notFound('Document not found')
  const { status, remarks } = req.body
  if (status) sub.status = status
  if (remarks !== undefined) sub.remarks = remarks
  if (status === 'Verified') { sub.verifiedBy = req.user.name; sub.verificationDate = new Date() }
  await doc.save()
  return ok(res, doc, 'Document updated')
})

export const deleteRegistration = asyncHandler(async (req, res) => {
  const doc = await RegistrationCase.findOneAndDelete({ _id: req.params.id, ...scopeFor(req) })
  if (!doc) throw ApiError.notFound('Registration case not found')
  return ok(res, { _id: doc._id }, 'Registration case deleted')
})

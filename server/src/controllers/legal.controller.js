import mongoose from 'mongoose'
import LegalCase from '../models/LegalCase.js'
import Booking from '../models/Booking.js'
import User from '../models/User.js'
import AuditLog from '../models/AuditLog.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from '../utils/ApiError.js'
import { ok, created } from '../utils/apiResponse.js'
import { paginate } from '../utils/paginate.js'
import { writeAudit } from '../middleware/audit.js'
import { notify, notifyMany } from '../services/notification.service.js'
import { can } from '../config/permissions.js'
import { firmScope } from '../middleware/tenantScope.js'
import { AUDIT_ACTIONS, MODULES, ROLES, NOTIFICATION_TYPES } from '../config/constants.js'
import {
  AGREEMENT_TYPES, AGREEMENT_STATUS, LEGAL_STATUS, DOCUMENT_STATUS, OPEN_LEGAL_STATUSES,
  DEFAULT_DOCUMENT_TYPES, isOverdue,
} from '../config/legal.js'

// ── Helpers ──────────────────────────────────────────────────────────────────
const canAssign = (u) => can(u, MODULES.LEGAL, 'assign')
const canVerify = (u) => can(u, MODULES.LEGAL, 'verify')
const canEdit = (u) => can(u, MODULES.LEGAL, 'edit')
const canDelete = (u) => can(u, MODULES.LEGAL, 'delete')

const baseFilter = (user) => ({ firm: user.firm, isDeleted: { $ne: true } })
// Executives (Sales/CRM) see only cases for customers they own (§Visibility Rules).
const scopeClause = (user) => (user.role === ROLES.SALES_EXECUTIVE ? [{ assignedTo: user._id }] : [])

const withDerived = (c) => ({
  ...c,
  overdue: isOverdue(c),
  docTotal: c.documents?.length || 0,
  docVerified: (c.documents || []).filter((d) => d.status === 'verified').length,
  docPending: (c.documents || []).filter((d) => ['pending', 'missing', 'rejected'].includes(d.status)).length,
})

async function notifyManagers(firm, payload, excludeId) {
  if (!firm) return
  const managers = await User.find({ firm, role: { $in: [ROLES.ADMIN, ROLES.SUB_ADMIN] }, isActive: true }).select('_id').lean()
  await notifyMany(managers.map((m) => m._id).filter((id) => String(id) !== String(excludeId)), payload)
}
function logActivity(c, type, note, user) {
  c.activity.push({ type, note, actor: user._id, actorName: user.name })
}

// Load a case the caller may READ (managers → firm; execs → own customers).
async function loadVisible(req) {
  const filter = { _id: req.params.id, ...baseFilter(req.user) }
  const and = scopeClause(req.user)
  if (and.length) filter.$and = and
  const legalCase = await LegalCase.findOne(filter)
  if (!legalCase) throw ApiError.notFound('Legal case not found')
  return legalCase
}
// Load a case the caller may WRITE (legal team / managers only).
async function loadWritable(req) {
  if (!canEdit(req.user)) throw ApiError.forbidden('You are not permitted to modify legal cases')
  const legalCase = await LegalCase.findOne({ _id: req.params.id, firm: req.user.firm, isDeleted: { $ne: true } })
  if (!legalCase) throw ApiError.notFound('Legal case not found')
  return legalCase
}

// ── Config ───────────────────────────────────────────────────────────────────
export const getConfig = asyncHandler(async (_req, res) =>
  ok(res, { agreementTypes: AGREEMENT_TYPES, agreementStatuses: AGREEMENT_STATUS, statuses: LEGAL_STATUS, documentStatuses: DOCUMENT_STATUS, documentTypes: DEFAULT_DOCUMENT_TYPES })
)

// Bookings eligible for a legal case: confirmed / sale-completed, no case yet.
export const listBookings = asyncHandler(async (req, res) => {
  const existing = await LegalCase.find({ firm: req.user.firm, isDeleted: { $ne: true } }).select('booking').lean()
  const taken = new Set(existing.map((c) => String(c.booking)))
  const bookings = await Booking.find({ ...firmScope(req.user), status: { $in: ['confirmed', 'sale_completed', 'reserved'] } })
    .populate('customer', 'name').populate('project', 'name').populate('unit', 'unitNumber').sort({ createdAt: -1 }).limit(300).lean()
  const data = bookings.filter((b) => !taken.has(String(b._id))).map((b) => ({ _id: b._id, customerName: b.customer?.name, projectName: b.project?.name, unitNumber: b.unit?.unitNumber, status: b.status }))
  return ok(res, data)
})

export const getBookingContext = asyncHandler(async (req, res) => {
  const booking = await Booking.findOne({ _id: req.params.bookingId, ...firmScope(req.user) })
    .populate({ path: 'customer', select: 'name mobile assignedTo', populate: { path: 'assignedTo', select: 'name branch' } })
    .populate('project', 'name').populate('unit', 'unitNumber').lean()
  if (!booking) throw ApiError.notFound('Booking not found')
  return ok(res, {
    _id: booking._id, customer: booking.customer?._id, customerName: booking.customer?.name, mobile: booking.customer?.mobile,
    project: booking.project?._id, projectName: booking.project?.name,
    unit: booking.unit?._id, unitNumber: booking.unit?.unitNumber,
    assignedTo: booking.customer?.assignedTo?._id, branch: booking.customer?.assignedTo?.branch || '',
  })
})

// ── List ─────────────────────────────────────────────────────────────────────
export const listCases = asyncHandler(async (req, res) => {
  const q = req.query
  const filter = baseFilter(req.user)
  const and = scopeClause(req.user)
  if (q.status && q.status !== 'all') {
    if (q.status === 'overdue') { filter.status = { $in: OPEN_LEGAL_STATUSES }; filter.expectedCompletionDate = { $lt: new Date() } }
    else filter.status = q.status
  }
  if (q.branch) filter.branch = q.branch
  if (q.project) filter.project = q.project
  if (q.legalExecutive) filter.legalExecutive = q.legalExecutive
  if (q.agreementType && q.agreementType !== 'all') filter.agreementType = q.agreementType
  if (q.dateFrom || q.dateTo) {
    filter.createdAt = {}
    if (q.dateFrom) filter.createdAt.$gte = new Date(q.dateFrom)
    if (q.dateTo) filter.createdAt.$lte = new Date(q.dateTo)
  }
  if (q.search) {
    const rx = { $regex: q.search, $options: 'i' }
    and.push({ $or: [{ caseCode: rx }, { customerName: rx }, { projectName: rx }, { unitNumber: rx }, { agreementType: rx }] })
  }
  if (and.length) filter.$and = and

  const sort = q.sortBy === 'oldest' ? { createdAt: 1 } : q.sortBy === 'due' ? { expectedCompletionDate: 1 } : { createdAt: -1 }
  const { data, meta } = await paginate(LegalCase, filter, {
    page: q.page, limit: q.limit, sort, select: '-activity',
    populate: [{ path: 'legalExecutive', select: 'name' }],
  })
  return ok(res, data.map(withDerived), 'Legal cases fetched', meta)
})

// ── Details ──────────────────────────────────────────────────────────────────
export const getCase = asyncHandler(async (req, res) => {
  const filter = { _id: req.params.id, ...baseFilter(req.user) }
  const and = scopeClause(req.user)
  if (and.length) filter.$and = and
  const legalCase = await LegalCase.findOne(filter)
    .populate('legalExecutive', 'name email role').populate('createdBy', 'name role')
    .populate('customer', 'name mobile email').populate('project', 'name').populate('unit', 'unitNumber')
    .populate('booking', 'bookingAmount status bookingDate paymentStatus registrationStatus')
    .populate('activity.actor', 'name role').lean()
  if (!legalCase) throw ApiError.notFound('Legal case not found')
  return ok(res, withDerived(legalCase))
})

// ── Create ───────────────────────────────────────────────────────────────────
export const createCase = asyncHandler(async (req, res) => {
  const b = req.body
  const booking = await Booking.findOne({ _id: b.booking, ...firmScope(req.user) })
    .populate({ path: 'customer', select: 'name assignedTo', populate: { path: 'assignedTo', select: 'name branch' } })
    .populate('project', 'name').populate('unit', 'unitNumber')
  if (!booking) throw ApiError.badRequest('Booking not found — a legal case must be linked to an existing booking')
  const dup = await LegalCase.findOne({ booking: booking._id, isDeleted: { $ne: true } }).select('_id').lean()
  if (dup) throw ApiError.conflict('A legal case already exists for this booking')

  let legalExecutive = null, legalExecutiveName = ''
  if (b.legalExecutive) {
    const u = await User.findOne({ _id: b.legalExecutive, firm: req.user.firm }).select('name').lean()
    if (!u) throw ApiError.badRequest('Legal executive not found in your organization')
    legalExecutive = u._id; legalExecutiveName = u.name
  }

  const assignedExec = booking.customer?.assignedTo
  const seq = (await LegalCase.countDocuments({ firm: req.user.firm })) + 1
  const documents = DEFAULT_DOCUMENT_TYPES.map((d) => ({ type: d.name, mandatory: d.mandatory, status: 'pending' }))

  const legalCase = await LegalCase.create({
    firm: req.user.firm,
    caseCode: `LEG-${String(seq).padStart(4, '0')}`,
    booking: booking._id,
    customer: booking.customer?._id, customerName: booking.customer?.name,
    project: booking.project?._id || null, projectName: booking.project?.name || '',
    unit: booking.unit?._id || null, unitNumber: booking.unit?.unitNumber || '',
    branch: assignedExec?.branch || '',
    assignedTo: assignedExec?._id || null,
    legalExecutive, legalExecutiveName,
    agreementType: b.agreementType || 'sale_agreement',
    expectedCompletionDate: b.expectedCompletionDate || undefined,
    remarks: b.remarks || '',
    status: legalExecutive ? 'documents_pending' : 'new',
    documents,
    createdBy: req.user._id, createdByName: req.user.name,
    activity: [
      { type: 'created', note: 'Legal case created', actor: req.user._id, actorName: req.user.name },
      ...(legalExecutive ? [{ type: 'assigned', note: `Assigned to ${legalExecutiveName}`, actor: req.user._id, actorName: req.user.name }] : []),
    ],
  })

  if (legalExecutive) {
    notify({ firm: req.user.firm, recipient: legalExecutive, type: NOTIFICATION_TYPES.LEGAL_CASE_ASSIGNED, title: 'New legal case assigned', message: `${legalCase.caseCode} · ${legalCase.customerName}`, entityType: 'legal_case', entityId: legalCase._id })
  } else {
    notifyManagers(req.user.firm, { type: NOTIFICATION_TYPES.LEGAL_CASE_ASSIGNED, title: 'New legal case created', message: `${legalCase.caseCode} · ${legalCase.customerName} — awaiting assignment`, entityType: 'legal_case', entityId: legalCase._id }, req.user._id)
  }
  writeAudit({ req, action: AUDIT_ACTIONS.CREATE, module: MODULES.LEGAL, targetId: legalCase._id, targetLabel: legalCase.caseCode, description: `Created legal case ${legalCase.caseCode} for ${legalCase.customerName}` })
  return created(res, withDerived(legalCase.toObject()), 'Legal case created')
})

// ── Edit ─────────────────────────────────────────────────────────────────────
export const updateCase = asyncHandler(async (req, res) => {
  const legalCase = await loadWritable(req)
  const b = req.body
  if (b.legalExecutive !== undefined) {
    if (b.legalExecutive) { const u = await User.findOne({ _id: b.legalExecutive, firm: req.user.firm }).select('name').lean(); if (u) { legalCase.legalExecutive = u._id; legalCase.legalExecutiveName = u.name } }
    else { legalCase.legalExecutive = null; legalCase.legalExecutiveName = '' }
  }
  const agreementChanged = ['agreementType', 'agreementStatus', 'agreementNumber', 'agreementDate'].some((f) => b[f] !== undefined)
  for (const f of ['agreementType', 'agreementStatus', 'agreementNumber', 'agreementDate', 'expectedCompletionDate', 'remarks']) {
    if (b[f] !== undefined) legalCase[f] = b[f] === '' ? undefined : b[f]
  }
  logActivity(legalCase, agreementChanged ? 'agreement_updated' : 'status_changed', 'Case details updated', req.user)
  await legalCase.save()
  writeAudit({ req, action: AUDIT_ACTIONS.UPDATE, module: MODULES.LEGAL, targetId: legalCase._id, targetLabel: legalCase.caseCode, description: `Updated legal case ${legalCase.caseCode}` })
  return ok(res, withDerived(legalCase.toObject()), 'Legal case updated')
})

// ── Assign legal executive ───────────────────────────────────────────────────
export const assignCase = asyncHandler(async (req, res) => {
  if (!canAssign(req.user)) throw ApiError.forbidden('You are not permitted to assign legal cases')
  const legalCase = await LegalCase.findOne({ _id: req.params.id, firm: req.user.firm, isDeleted: { $ne: true } })
  if (!legalCase) throw ApiError.notFound('Legal case not found')
  const u = await User.findOne({ _id: req.body.legalExecutive, firm: req.user.firm }).select('name').lean()
  if (!u) throw ApiError.badRequest('Legal executive not found')
  legalCase.legalExecutive = u._id; legalCase.legalExecutiveName = u.name
  if (legalCase.status === 'new') legalCase.status = 'documents_pending'
  logActivity(legalCase, 'assigned', `Assigned to ${u.name}${req.body.note ? ` · ${req.body.note}` : ''}`, req.user)
  await legalCase.save()
  notify({ firm: req.user.firm, recipient: u._id, type: NOTIFICATION_TYPES.LEGAL_CASE_ASSIGNED, title: 'Legal case assigned to you', message: `${legalCase.caseCode} · ${legalCase.customerName}`, entityType: 'legal_case', entityId: legalCase._id })
  writeAudit({ req, action: AUDIT_ACTIONS.ASSIGN, module: MODULES.LEGAL, targetId: legalCase._id, targetLabel: legalCase.caseCode, description: `Assigned legal case ${legalCase.caseCode} to ${u.name}` })
  return ok(res, withDerived(legalCase.toObject()), 'Legal executive assigned')
})

// ── Status change (§Legal Status) ────────────────────────────────────────────
export const changeStatus = asyncHandler(async (req, res) => {
  const legalCase = await loadWritable(req)
  const { status, note } = req.body

  // Completing / marking ready requires mandatory documents to be verified.
  if (['ready_for_registration', 'completed'].includes(status)) {
    const missing = (legalCase.documents || []).filter((d) => d.mandatory && d.status !== 'verified')
    if (missing.length) throw ApiError.badRequest(`Verify all mandatory documents first (${missing.map((d) => d.type).join(', ')})`)
  }
  legalCase.status = status
  if (status === 'completed') legalCase.completedAt = new Date()
  if (status === 'cancelled') legalCase.cancelReason = note || ''
  if (status === 'agreement_preparation' && legalCase.agreementStatus === 'not_started') legalCase.agreementStatus = 'in_preparation'
  if (status === 'ready_for_registration') legalCase.agreementStatus = 'ready'
  const type = status === 'completed' ? 'completed' : status === 'cancelled' ? 'cancelled' : 'status_changed'
  logActivity(legalCase, type, note || `Status set to ${status.replace(/_/g, ' ')}`, req.user)
  await legalCase.save()

  // Integration: mark the booking's registration in progress once legally ready.
  if (status === 'ready_for_registration') {
    await Booking.updateOne({ _id: legalCase.booking, registrationStatus: 'pending' }, { $set: { registrationStatus: 'in_progress' } })
  }

  // Notify the owning executive of legal status changes (§Notifications).
  if (legalCase.assignedTo && String(legalCase.assignedTo) !== String(req.user._id)) {
    notify({ firm: req.user.firm, recipient: legalCase.assignedTo, type: NOTIFICATION_TYPES.LEGAL_STATUS_UPDATED, title: 'Customer legal status updated', message: `${legalCase.customerName}: ${status.replace(/_/g, ' ')}`, entityType: 'legal_case', entityId: legalCase._id })
  }
  if (status === 'completed') {
    notifyManagers(req.user.firm, { type: NOTIFICATION_TYPES.LEGAL_CASE_COMPLETED, title: 'Legal case completed', message: `${legalCase.caseCode} · ${legalCase.customerName}`, entityType: 'legal_case', entityId: legalCase._id }, req.user._id)
  }
  writeAudit({ req, action: AUDIT_ACTIONS.STATUS_CHANGE, module: MODULES.LEGAL, targetId: legalCase._id, targetLabel: legalCase.caseCode, description: `Legal case ${legalCase.caseCode} → ${status}` })
  return ok(res, withDerived(legalCase.toObject()), `Case marked ${status.replace(/_/g, ' ')}`)
})

// ── Documents ────────────────────────────────────────────────────────────────
export const addDocument = asyncHandler(async (req, res) => {
  const legalCase = await loadWritable(req)
  legalCase.documents.push({ type: req.body.type, mandatory: Boolean(req.body.mandatory), status: 'pending' })
  logActivity(legalCase, 'status_changed', `Added checklist item: ${req.body.type}`, req.user)
  await legalCase.save()
  writeAudit({ req, action: AUDIT_ACTIONS.UPDATE, module: MODULES.LEGAL, targetId: legalCase._id, targetLabel: legalCase.caseCode, description: `Added document "${req.body.type}" to ${legalCase.caseCode}` })
  return created(res, legalCase.documents.at(-1), 'Document added')
})

// Update a checklist item's status (received / verified / rejected / missing).
export const updateDocument = asyncHandler(async (req, res) => {
  const legalCase = await loadWritable(req)
  const doc = legalCase.documents.id(req.params.docId)
  if (!doc) throw ApiError.notFound('Document not found')
  const { status, remarks } = req.body
  if (['verified', 'rejected'].includes(status) && !canVerify(req.user)) throw ApiError.forbidden('You are not permitted to verify documents')
  if (status) {
    doc.status = status
    if (status === 'verified') { doc.verifiedBy = req.user._id; doc.verifiedByName = req.user.name; doc.verifiedAt = new Date() }
  }
  if (remarks !== undefined) doc.remarks = remarks
  logActivity(legalCase, status === 'verified' ? 'document_verified' : status === 'rejected' ? 'document_rejected' : 'status_changed', `${doc.type}: ${status || 'updated'}`, req.user)
  await legalCase.save()
  writeAudit({ req, action: AUDIT_ACTIONS.UPDATE, module: MODULES.LEGAL, targetId: legalCase._id, targetLabel: legalCase.caseCode, description: `Document "${doc.type}" → ${status || 'updated'} on ${legalCase.caseCode}` })
  return ok(res, doc, 'Document updated')
})

export const uploadDocument = asyncHandler(async (req, res) => {
  const legalCase = await loadWritable(req)
  const doc = legalCase.documents.id(req.params.docId)
  if (!doc) throw ApiError.notFound('Document not found')
  if (!req.file) throw ApiError.badRequest('No file uploaded')
  const replacing = Boolean(doc.fileUrl)
  doc.fileName = req.file.originalname
  doc.fileUrl = `/uploads/${req.file.filename}`
  doc.mimeType = req.file.mimetype
  doc.uploadedBy = req.user._id
  doc.uploadedByName = req.user.name
  doc.uploadedAt = new Date()
  if (doc.status === 'pending' || doc.status === 'missing') doc.status = 'received'
  logActivity(legalCase, replacing ? 'document_replaced' : 'document_uploaded', doc.type, req.user)
  await legalCase.save()
  if (legalCase.legalExecutive && String(legalCase.legalExecutive) !== String(req.user._id)) {
    notify({ firm: req.user.firm, recipient: legalCase.legalExecutive, type: NOTIFICATION_TYPES.LEGAL_DOCUMENT_UPLOADED, title: 'Legal document uploaded', message: `${doc.type} · ${legalCase.caseCode}`, entityType: 'legal_case', entityId: legalCase._id })
  }
  writeAudit({ req, action: AUDIT_ACTIONS.UPDATE, module: MODULES.LEGAL, targetId: legalCase._id, targetLabel: legalCase.caseCode, description: `${replacing ? 'Replaced' : 'Uploaded'} document "${doc.type}" on ${legalCase.caseCode}` })
  return created(res, doc, replacing ? 'Document replaced' : 'Document uploaded')
})

export const downloadDocument = asyncHandler(async (req, res) => {
  const legalCase = await loadVisible(req)
  const doc = legalCase.documents.id(req.params.docId)
  if (!doc?.fileUrl) throw ApiError.badRequest('No file attached to this document')
  writeAudit({ req, action: AUDIT_ACTIONS.UPDATE, module: MODULES.LEGAL, targetId: legalCase._id, targetLabel: legalCase.caseCode, description: `Downloaded document "${doc.type}" from ${legalCase.caseCode}` })
  return ok(res, { fileUrl: doc.fileUrl, fileName: doc.fileName })
})

// ── Soft delete ──────────────────────────────────────────────────────────────
export const deleteCase = asyncHandler(async (req, res) => {
  if (!canDelete(req.user)) throw ApiError.forbidden('You are not permitted to delete legal cases')
  const legalCase = await LegalCase.findOne({ _id: req.params.id, firm: req.user.firm, isDeleted: { $ne: true } })
  if (!legalCase) throw ApiError.notFound('Legal case not found')
  legalCase.isDeleted = true; legalCase.deletedAt = new Date(); legalCase.deletedBy = req.user._id
  logActivity(legalCase, 'cancelled', req.body?.reason || 'Legal case deleted', req.user)
  await legalCase.save()
  writeAudit({ req, action: AUDIT_ACTIONS.DELETE, module: MODULES.LEGAL, targetId: legalCase._id, targetLabel: legalCase.caseCode, description: `Deleted legal case ${legalCase.caseCode}` })
  return ok(res, { _id: legalCase._id }, 'Legal case deleted')
})

// ── Shared analytics filter (Dashboard + Reports) ────────────────────────────
function analyticsFilter(req) {
  const q = req.query
  const filter = baseFilter(req.user)
  const and = scopeClause(req.user)
  if (q.branch) filter.branch = q.branch
  if (q.project) filter.project = new mongoose.Types.ObjectId(q.project)
  if (q.legalExecutive) filter.legalExecutive = new mongoose.Types.ObjectId(q.legalExecutive)
  if (q.status && q.status !== 'all') filter.status = q.status
  if (q.dateFrom || q.dateTo) {
    filter.createdAt = {}
    if (q.dateFrom) filter.createdAt.$gte = new Date(q.dateFrom)
    if (q.dateTo) filter.createdAt.$lte = new Date(q.dateTo)
  }
  if (and.length) filter.$and = and
  return filter
}

// ── Dashboard ────────────────────────────────────────────────────────────────
export const dashboard = asyncHandler(async (req, res) => {
  const filter = analyticsFilter(req)
  const now = new Date()
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const soon = new Date(now.getTime() + 7 * 86400000)

  const [byStatus, byBranch, monthly, docAgg, thisMonth, overdue, recent, pendingDocs, upcoming, activity] = await Promise.all([
    LegalCase.aggregate([{ $match: filter }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
    LegalCase.aggregate([{ $match: filter }, { $group: { _id: { $ifNull: ['$branch', '—'] }, n: { $sum: 1 } } }, { $sort: { n: -1 } }, { $limit: 8 }]),
    LegalCase.aggregate([{ $match: filter }, { $group: { _id: { y: { $year: '$createdAt' }, m: { $month: '$createdAt' } }, created: { $sum: 1 }, completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } } } }, { $sort: { '_id.y': 1, '_id.m': 1 } }]),
    LegalCase.aggregate([
      { $match: filter }, { $unwind: '$documents' },
      { $group: { _id: '$documents.status', n: { $sum: 1 } } },
    ]),
    LegalCase.countDocuments({ ...filter, createdAt: { $gte: startMonth } }),
    LegalCase.countDocuments({ ...filter, status: { $in: OPEN_LEGAL_STATUSES }, expectedCompletionDate: { $lt: now } }),
    LegalCase.find(filter).sort({ createdAt: -1 }).limit(8).populate('legalExecutive', 'name').select('caseCode customerName status projectName branch legalExecutive expectedCompletionDate').lean(),
    LegalCase.find({ ...filter, status: { $in: ['documents_pending', 'verification_in_progress'] } }).sort({ updatedAt: -1 }).limit(8).select('caseCode customerName status documents').lean(),
    LegalCase.find({ ...filter, status: { $in: OPEN_LEGAL_STATUSES }, expectedCompletionDate: { $gte: now, $lte: soon } }).sort({ expectedCompletionDate: 1 }).limit(8).populate('legalExecutive', 'name').select('caseCode customerName status expectedCompletionDate legalExecutive').lean(),
    AuditLog.find({ module: MODULES.LEGAL, ...firmScope(req.user), ...(req.user.role === ROLES.SALES_EXECUTIVE ? { actor: req.user._id } : {}) }).populate('actor', 'name role').sort({ createdAt: -1 }).limit(10).lean(),
  ])

  const statusMap = Object.fromEntries(byStatus.map((s) => [s._id, s.n]))
  const docMap = Object.fromEntries(docAgg.map((d) => [d._id, d.n]))
  const total = byStatus.reduce((s, x) => s + x.n, 0)
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

  return ok(res, {
    kpis: {
      totalCases: total,
      pendingVerification: statusMap.verification_in_progress || 0,
      documentsPending: statusMap.documents_pending || 0,
      agreementsReady: statusMap.agreement_preparation || 0,
      readyForRegistration: statusMap.ready_for_registration || 0,
      completed: statusMap.completed || 0,
      overdue,
      thisMonth,
    },
    statusDistribution: LEGAL_STATUS.map((s) => ({ status: s, count: statusMap[s] || 0 })),
    branchDistribution: byBranch.map((b) => ({ branch: b._id, count: b.n })),
    monthlyProgress: monthly.map((m) => ({ label: `${monthNames[m._id.m - 1]} ${String(m._id.y).slice(2)}`, created: m.created, completed: m.completed })),
    documentCompletion: DOCUMENT_STATUS.map((s) => ({ status: s, count: docMap[s] || 0 })),
    recentCases: recent.map(withDerived),
    pendingDocuments: pendingDocs.map((c) => ({ _id: c._id, caseCode: c.caseCode, customerName: c.customerName, status: c.status, pending: (c.documents || []).filter((d) => ['pending', 'missing', 'rejected'].includes(d.status)).length })),
    upcomingDeadlines: upcoming.map(withDerived),
    recentActivity: activity.map((a) => ({ _id: a._id, action: a.action, description: a.description, actorName: a.actor?.name || 'System', at: a.createdAt })),
  }, 'Legal dashboard')
})

// ── Reports ──────────────────────────────────────────────────────────────────
export const reports = asyncHandler(async (req, res) => {
  const filter = analyticsFilter(req)

  const [progress, byBranch, byExec, agreements, pendingDocs, customers] = await Promise.all([
    LegalCase.aggregate([{ $match: filter }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
    LegalCase.aggregate([{ $match: filter }, { $group: { _id: { $ifNull: ['$branch', '—'] }, total: { $sum: 1 }, completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } } } }, { $sort: { total: -1 } }]),
    LegalCase.aggregate([{ $match: { ...filter, legalExecutive: { $ne: null } } }, { $group: { _id: '$legalExecutive', name: { $first: '$legalExecutiveName' }, total: { $sum: 1 }, completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } }, ready: { $sum: { $cond: [{ $eq: ['$status', 'ready_for_registration'] }, 1, 0] } } } }, { $sort: { total: -1 } }]),
    LegalCase.aggregate([{ $match: filter }, { $group: { _id: '$agreementType', total: { $sum: 1 }, ready: { $sum: { $cond: [{ $eq: ['$agreementStatus', 'ready'] }, 1, 0] } } } }, { $sort: { total: -1 } }]),
    LegalCase.aggregate([{ $match: filter }, { $unwind: '$documents' }, { $match: { 'documents.status': { $in: ['pending', 'missing', 'rejected'] } } }, { $group: { _id: '$documents.type', n: { $sum: 1 } } }, { $sort: { n: -1 } }]),
    LegalCase.find(filter).sort({ createdAt: -1 }).limit(200).select('caseCode customerName projectName status agreementStatus expectedCompletionDate').lean(),
  ])

  const statusMap = Object.fromEntries(progress.map((s) => [s._id, s.n]))
  return ok(res, {
    progressSummary: LEGAL_STATUS.map((s) => ({ status: s, count: statusMap[s] || 0 })),
    branch: byBranch.map((b) => ({ branch: b._id, total: b.total, completed: b.completed })),
    executive: byExec.map((e) => ({ executive: e.name || 'Unassigned', total: e.total, completed: e.completed, ready: e.ready, completionRate: e.total ? Math.round((e.completed / e.total) * 100) : 0 })),
    agreements: agreements.map((a) => ({ type: a._id, total: a.total, ready: a.ready })),
    pendingDocuments: pendingDocs.map((d) => ({ document: d._id, pending: d.n })),
    customers: customers.map((c) => ({ caseCode: c.caseCode, customer: c.customerName, project: c.projectName, status: c.status, agreement: c.agreementStatus, due: c.expectedCompletionDate })),
  }, 'Legal reports')
})

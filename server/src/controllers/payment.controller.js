import mongoose from 'mongoose'
import Payment from '../models/Payment.js'
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
import { PAYMENT_METHODS, PAYMENT_STATUS, COLLECTED_STATUSES, METHOD_FIELDS, RECEIPT_MIME_TYPES } from '../config/payment.js'

const LARGE_PAYMENT_THRESHOLD = 1000000 // ₹10L — "Large payment received" notification

// ── Helpers ──────────────────────────────────────────────────────────────────
const canVerify = (u) => can(u, MODULES.PAYMENT, 'verify')
const canDelete = (u) => can(u, MODULES.PAYMENT, 'delete')

// Executive visibility: only payments for their assigned customers, or ones they
// entered (§Visibility Rules). Managers/Finance/Owner see the whole firm.
function scopeClause(user) {
  if (user.role === ROLES.SALES_EXECUTIVE) {
    return [{ $or: [{ assignedTo: user._id }, { enteredBy: user._id }] }]
  }
  return []
}
const baseFilter = (user) => ({ firm: user.firm, isDeleted: { $ne: true } })

async function notifyManagers(firm, payload, excludeId) {
  if (!firm) return
  const managers = await User.find({ firm, role: { $in: [ROLES.ADMIN, ROLES.SUB_ADMIN] }, isActive: true }).select('_id').lean()
  await notifyMany(managers.map((m) => m._id).filter((id) => String(id) !== String(excludeId)), payload)
}

function logActivity(payment, type, note, user) {
  payment.activity.push({ type, note, actor: user._id, actorName: user.name })
}

// Recompute a booking's payment summary from the Payment collection (§workflow:
// "Booking Payment Summary Updated"). Kept in sync on create/edit/status/delete.
async function syncBooking(bookingId) {
  const agg = await Payment.aggregate([
    { $match: { booking: new mongoose.Types.ObjectId(bookingId), isDeleted: { $ne: true }, status: { $in: COLLECTED_STATUSES } } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ])
  const received = agg[0]?.total || 0
  const booking = await Booking.findById(bookingId)
  if (!booking) return
  booking.amountReceived = received
  const due = booking.totalValue || booking.bookingAmount || 0
  booking.paymentStatus = received <= 0 ? 'pending' : due && received >= due ? 'completed' : 'partial'
  await booking.save()
}

async function assertUniqueTxn(firm, transactionId, exceptId) {
  if (!transactionId) return
  const clash = await Payment.findOne({ firm, transactionId, isDeleted: { $ne: true }, ...(exceptId ? { _id: { $ne: exceptId } } : {}) }).select('_id').lean()
  if (clash) throw ApiError.conflict('A payment with this transaction ID already exists')
}

async function nextCode(firm, field, prefix) {
  const seq = (await Payment.countDocuments({ firm })) + 1
  return `${prefix}-${String(seq).padStart(4, '0')}`
}

// ── Config ───────────────────────────────────────────────────────────────────
export const getConfig = asyncHandler(async (_req, res) =>
  ok(res, { methods: PAYMENT_METHODS, statuses: PAYMENT_STATUS, methodFields: METHOD_FIELDS, receiptMimeTypes: RECEIPT_MIME_TYPES })
)

// ── Booking context for the Add Payment form ─────────────────────────────────
export const getBookingContext = asyncHandler(async (req, res) => {
  const booking = await Booking.findOne({ _id: req.params.bookingId, ...firmScope(req.user) })
    .populate({ path: 'customer', select: 'name mobile assignedTo', populate: { path: 'assignedTo', select: 'name branch' } })
    .populate('project', 'name').populate('unit', 'unitNumber').lean()
  if (!booking) throw ApiError.notFound('Booking not found')
  const agg = await Payment.aggregate([
    { $match: { booking: booking._id, isDeleted: { $ne: true }, status: { $in: COLLECTED_STATUSES } } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ])
  const received = agg[0]?.total || 0
  const due = booking.totalValue || booking.bookingAmount || 0
  return ok(res, {
    booking: {
      _id: booking._id, customer: booking.customer?._id, customerName: booking.customer?.name,
      project: booking.project?._id, projectName: booking.project?.name,
      unit: booking.unit?._id, unitNumber: booking.unit?.unitNumber,
      assignedTo: booking.customer?.assignedTo?._id, branch: booking.customer?.assignedTo?.branch || '',
      bookingAmount: booking.bookingAmount, totalValue: due,
    },
    received, balance: Math.max(0, due - received),
  })
})

// Bookings available to attach a payment to (confirmed / reserved / sale-completed).
export const listBookings = asyncHandler(async (req, res) => {
  const filter = { ...firmScope(req.user), status: { $ne: 'cancelled' } }
  if (req.user.role === ROLES.SALES_EXECUTIVE) filter.bookedBy = req.user._id
  const bookings = await Booking.find(filter).populate('customer', 'name').populate('project', 'name').populate('unit', 'unitNumber').sort({ createdAt: -1 }).limit(300).lean()
  return ok(res, bookings.map((b) => ({ _id: b._id, customerName: b.customer?.name, projectName: b.project?.name, unitNumber: b.unit?.unitNumber, bookingAmount: b.bookingAmount })))
})

// ── List ─────────────────────────────────────────────────────────────────────
export const listPayments = asyncHandler(async (req, res) => {
  const q = req.query
  const filter = baseFilter(req.user)
  const and = scopeClause(req.user)

  if (q.status && q.status !== 'all') filter.status = q.status
  if (q.method && q.method !== 'all') filter.method = q.method
  if (q.branch) filter.branch = q.branch
  if (q.project) filter.project = q.project
  if (q.employee) filter.assignedTo = q.employee
  if (q.booking) filter.booking = q.booking
  if (q.hasReceipt === 'true') filter['receipt.fileUrl'] = { $exists: true, $ne: null }
  if (q.hasReceipt === 'false') filter['receipt.fileUrl'] = { $in: [null, undefined] }
  if (q.dateFrom || q.dateTo) {
    filter.paymentDate = {}
    if (q.dateFrom) filter.paymentDate.$gte = new Date(q.dateFrom)
    if (q.dateTo) filter.paymentDate.$lte = new Date(q.dateTo)
  }
  if (q.search) {
    const rx = { $regex: q.search, $options: 'i' }
    and.push({ $or: [{ paymentCode: rx }, { customerName: rx }, { projectName: rx }, { unitNumber: rx }, { transactionId: rx }, { referenceNumber: rx }] })
  }
  if (and.length) filter.$and = and

  const sort = q.sortBy === 'oldest' ? { paymentDate: 1 } : q.sortBy === 'amount_high' ? { amount: -1 } : q.sortBy === 'amount_low' ? { amount: 1 } : { paymentDate: -1, createdAt: -1 }

  const { data, meta } = await paginate(Payment, filter, {
    page: q.page, limit: q.limit, sort, select: '-activity',
    populate: [{ path: 'enteredBy', select: 'name' }, { path: 'assignedTo', select: 'name' }],
  })
  return ok(res, data, 'Payments fetched', meta)
})

// ── Details ──────────────────────────────────────────────────────────────────
export const getPayment = asyncHandler(async (req, res) => {
  const filter = { _id: req.params.id, ...baseFilter(req.user) }
  const and = scopeClause(req.user)
  if (and.length) filter.$and = and
  const payment = await Payment.findOne(filter)
    .populate('enteredBy', 'name role').populate('receivedBy', 'name').populate('assignedTo', 'name')
    .populate('verifiedBy', 'name').populate('activity.actor', 'name role')
    .populate({ path: 'booking', select: 'bookingAmount totalValue paymentStatus bookingDate status' })
    .populate('customer', 'name mobile email').populate('project', 'name').populate('unit', 'unitNumber')
    .lean()
  if (!payment) throw ApiError.notFound('Payment not found')
  return ok(res, payment)
})

// ── Create ───────────────────────────────────────────────────────────────────
export const createPayment = asyncHandler(async (req, res) => {
  const b = req.body
  const booking = await Booking.findOne({ _id: b.booking, ...firmScope(req.user) })
    .populate({ path: 'customer', select: 'name assignedTo', populate: { path: 'assignedTo', select: 'name branch' } })
    .populate('project', 'name').populate('unit', 'unitNumber')
  if (!booking) throw ApiError.badRequest('Booking not found — a payment must be linked to an existing booking')

  await assertUniqueTxn(req.user.firm, b.transactionId)

  let receivedBy = null, receivedByName = req.user.name
  if (b.receivedBy) {
    const u = await User.findOne({ _id: b.receivedBy, firm: req.user.firm }).select('name').lean()
    if (u) { receivedBy = u._id; receivedByName = u.name }
  }

  const assignedExec = booking.customer?.assignedTo
  const payment = await Payment.create({
    firm: req.user.firm,
    paymentCode: await nextCode(req.user.firm, 'paymentCode', 'PAY'),
    booking: booking._id,
    customer: booking.customer?._id, customerName: booking.customer?.name,
    project: booking.project?._id || null, projectName: booking.project?.name || '',
    unit: booking.unit?._id || null, unitNumber: booking.unit?.unitNumber || '',
    branch: assignedExec?.branch || '',
    assignedTo: assignedExec?._id || null,
    amount: b.amount,
    paymentDate: b.paymentDate,
    method: b.method,
    status: b.status || 'received',
    referenceNumber: b.referenceNumber || '', bankName: b.bankName || '',
    transactionId: b.transactionId || '', chequeNumber: b.chequeNumber || '',
    chequeDate: b.chequeDate || undefined, upiId: b.upiId || '',
    receivedBy, receivedByName,
    enteredBy: req.user._id, enteredByName: req.user.name,
    remarks: b.remarks || '',
    activity: [{ type: 'created', note: `Payment recorded (${b.method})`, actor: req.user._id, actorName: req.user.name }],
  })

  await syncBooking(booking._id)

  // Notifications (§Notifications): finance/managers, the owning executive, large payment.
  notifyManagers(req.user.firm, { type: NOTIFICATION_TYPES.PAYMENT_RECORDED, title: 'New payment recorded', message: `${payment.customerName} · ₹${payment.amount.toLocaleString('en-IN')} (${payment.method})`, entityType: 'payment', entityId: payment._id }, req.user._id)
  if (assignedExec?._id && String(assignedExec._id) !== String(req.user._id)) {
    notify({ firm: req.user.firm, recipient: assignedExec._id, type: NOTIFICATION_TYPES.PAYMENT_RECORDED, title: 'Customer payment recorded', message: `Payment of ₹${payment.amount.toLocaleString('en-IN')} recorded for ${payment.customerName}`, entityType: 'payment', entityId: payment._id })
  }
  if (payment.amount >= LARGE_PAYMENT_THRESHOLD) {
    notifyManagers(req.user.firm, { type: NOTIFICATION_TYPES.LARGE_PAYMENT_RECEIVED, title: 'Large payment received', message: `₹${payment.amount.toLocaleString('en-IN')} from ${payment.customerName}`, entityType: 'payment', entityId: payment._id }, null)
  }

  writeAudit({ req, action: AUDIT_ACTIONS.CREATE, module: MODULES.PAYMENT, targetId: payment._id, targetLabel: payment.paymentCode, description: `Recorded payment ${payment.paymentCode} of ₹${payment.amount} for ${payment.customerName}` })
  return created(res, payment, 'Payment recorded')
})

// ── Edit ─────────────────────────────────────────────────────────────────────
export const updatePayment = asyncHandler(async (req, res) => {
  const payment = await Payment.findOne({ _id: req.params.id, ...firmScope(req.user), isDeleted: { $ne: true } })
  if (!payment) throw ApiError.notFound('Payment not found')
  if (['cancelled', 'refunded'].includes(payment.status)) throw ApiError.badRequest('Cancelled or refunded payments cannot be edited')
  const b = req.body
  if (b.transactionId !== undefined && b.transactionId !== payment.transactionId) await assertUniqueTxn(req.user.firm, b.transactionId, payment._id)
  const amountChanged = b.amount !== undefined && Number(b.amount) !== payment.amount

  for (const f of ['amount', 'paymentDate', 'method', 'referenceNumber', 'bankName', 'transactionId', 'chequeNumber', 'chequeDate', 'upiId', 'remarks']) {
    if (b[f] !== undefined) payment[f] = b[f] === '' ? undefined : b[f]
  }
  if (b.receivedBy !== undefined) {
    if (b.receivedBy) { const u = await User.findOne({ _id: b.receivedBy, firm: req.user.firm }).select('name').lean(); if (u) { payment.receivedBy = u._id; payment.receivedByName = u.name } }
    else { payment.receivedBy = null; payment.receivedByName = '' }
  }
  logActivity(payment, 'edited', 'Payment details updated', req.user)
  await payment.save()
  if (amountChanged) await syncBooking(payment.booking)

  notifyManagers(req.user.firm, { type: NOTIFICATION_TYPES.PAYMENT_EDITED, title: 'Payment edited', message: `${payment.paymentCode} updated by ${req.user.name}`, entityType: 'payment', entityId: payment._id }, req.user._id)
  writeAudit({ req, action: AUDIT_ACTIONS.UPDATE, module: MODULES.PAYMENT, targetId: payment._id, targetLabel: payment.paymentCode, description: `Edited payment ${payment.paymentCode}` })
  return ok(res, payment, 'Payment updated')
})

// ── Status: verify / cancel / refund / received / pending ────────────────────
export const changeStatus = asyncHandler(async (req, res) => {
  const { status, note, refundAmount } = req.body
  const payment = await Payment.findOne({ _id: req.params.id, ...firmScope(req.user), isDeleted: { $ne: true } })
  if (!payment) throw ApiError.notFound('Payment not found')
  if (status === 'verified' && !canVerify(req.user)) throw ApiError.forbidden('You are not permitted to verify payments')

  payment.status = status
  if (status === 'verified') { payment.verifiedBy = req.user._id; payment.verifiedByName = req.user.name; payment.verifiedAt = new Date() }
  if (status === 'cancelled') payment.cancelReason = note || ''
  if (status === 'refunded') { payment.refundAmount = refundAmount || payment.amount; payment.refundedAt = new Date() }
  const type = status === 'verified' ? 'verified' : status === 'cancelled' ? 'cancelled' : status === 'refunded' ? 'refunded' : 'status_changed'
  logActivity(payment, type, note || `Status set to ${status}`, req.user)
  await payment.save()
  await syncBooking(payment.booking)

  if (status === 'verified') {
    notifyManagers(req.user.firm, { type: NOTIFICATION_TYPES.PAYMENT_VERIFIED, title: 'Payment verified', message: `${payment.paymentCode} verified by ${req.user.name}`, entityType: 'payment', entityId: payment._id }, req.user._id)
  }
  writeAudit({ req, action: AUDIT_ACTIONS.STATUS_CHANGE, module: MODULES.PAYMENT, targetId: payment._id, targetLabel: payment.paymentCode, description: `Payment ${payment.paymentCode} → ${status}` })
  return ok(res, payment, `Payment ${status}`)
})

// ── Receipt upload / replace ─────────────────────────────────────────────────
export const uploadReceipt = asyncHandler(async (req, res) => {
  const payment = await Payment.findOne({ _id: req.params.id, ...firmScope(req.user), isDeleted: { $ne: true } })
  if (!payment) throw ApiError.notFound('Payment not found')
  if (!req.file) throw ApiError.badRequest('No receipt file uploaded')
  const replacing = Boolean(payment.receipt?.fileUrl)
  const seq = await Payment.countDocuments({ firm: req.user.firm, 'receipt.fileUrl': { $exists: true, $ne: null } })
  payment.receipt = {
    receiptNumber: payment.receipt?.receiptNumber || `RCPT-${String(seq + 1).padStart(4, '0')}`,
    fileName: req.file.originalname, fileUrl: `/uploads/${req.file.filename}`, mimeType: req.file.mimetype,
    uploadedBy: req.user._id, uploadedByName: req.user.name, uploadedAt: new Date(),
  }
  logActivity(payment, replacing ? 'receipt_replaced' : 'receipt_uploaded', payment.receipt.fileName, req.user)
  await payment.save()
  notifyManagers(req.user.firm, { type: NOTIFICATION_TYPES.PAYMENT_RECEIPT_UPLOADED, title: replacing ? 'Receipt replaced' : 'Receipt uploaded', message: `${payment.paymentCode} · ${payment.customerName}`, entityType: 'payment', entityId: payment._id }, req.user._id)
  writeAudit({ req, action: AUDIT_ACTIONS.UPDATE, module: MODULES.PAYMENT, targetId: payment._id, targetLabel: payment.paymentCode, description: `${replacing ? 'Replaced' : 'Uploaded'} receipt on ${payment.paymentCode}` })
  return created(res, payment.receipt, replacing ? 'Receipt replaced' : 'Receipt uploaded')
})

// Log a receipt download (§Audit Logs · Receipt Downloaded) and return its URL.
export const downloadReceipt = asyncHandler(async (req, res) => {
  const filter = { _id: req.params.id, ...baseFilter(req.user) }
  const and = scopeClause(req.user)
  if (and.length) filter.$and = and
  const payment = await Payment.findOne(filter).select('receipt paymentCode').lean()
  if (!payment) throw ApiError.notFound('Payment not found')
  if (!payment.receipt?.fileUrl) throw ApiError.badRequest('No receipt attached to this payment')
  writeAudit({ req, action: AUDIT_ACTIONS.UPDATE, module: MODULES.PAYMENT, targetId: payment._id, targetLabel: payment.paymentCode, description: `Downloaded receipt for ${payment.paymentCode}` })
  return ok(res, { fileUrl: payment.receipt.fileUrl, fileName: payment.receipt.fileName })
})

// ── Soft delete ──────────────────────────────────────────────────────────────
export const deletePayment = asyncHandler(async (req, res) => {
  if (!canDelete(req.user)) throw ApiError.forbidden('You are not permitted to delete payments')
  const payment = await Payment.findOne({ _id: req.params.id, ...firmScope(req.user), isDeleted: { $ne: true } })
  if (!payment) throw ApiError.notFound('Payment not found')
  payment.isDeleted = true
  payment.deletedAt = new Date()
  payment.deletedBy = req.user._id
  logActivity(payment, 'deleted', req.body?.reason || 'Payment deleted', req.user)
  await payment.save()
  await syncBooking(payment.booking)
  writeAudit({ req, action: AUDIT_ACTIONS.DELETE, module: MODULES.PAYMENT, targetId: payment._id, targetLabel: payment.paymentCode, description: `Deleted payment ${payment.paymentCode}` })
  return ok(res, { _id: payment._id }, 'Payment deleted')
})

// ── Shared analytics filter (Dashboard + Reports) ────────────────────────────
function analyticsFilter(req) {
  const q = req.query
  const filter = baseFilter(req.user)
  const and = scopeClause(req.user)
  if (q.branch) filter.branch = q.branch
  if (q.project) filter.project = new mongoose.Types.ObjectId(q.project)
  if (q.employee) filter.assignedTo = new mongoose.Types.ObjectId(q.employee)
  if (q.method && q.method !== 'all') filter.method = q.method
  if (q.status && q.status !== 'all') filter.status = q.status
  if (q.dateFrom || q.dateTo) {
    filter.paymentDate = {}
    if (q.dateFrom) filter.paymentDate.$gte = new Date(q.dateFrom)
    if (q.dateTo) filter.paymentDate.$lte = new Date(q.dateTo)
  }
  if (and.length) filter.$and = and
  return filter
}

// ── Dashboard ────────────────────────────────────────────────────────────────
export const dashboard = asyncHandler(async (req, res) => {
  const filter = analyticsFilter(req)
  const collected = { ...filter, status: { $in: COLLECTED_STATUSES } }
  const now = new Date()
  const startToday = new Date(now); startToday.setHours(0, 0, 0, 0)
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const [totals, todayAgg, monthAgg, pending, verified, receipts, byMethod, byBranch, byProject, monthly, recent, pendingVerify, activity] = await Promise.all([
    Payment.aggregate([{ $match: collected }, { $group: { _id: null, amount: { $sum: '$amount' }, count: { $sum: 1 } } }]),
    Payment.aggregate([{ $match: { ...collected, paymentDate: { $gte: startToday } } }, { $group: { _id: null, amount: { $sum: '$amount' } } }]),
    Payment.aggregate([{ $match: { ...collected, paymentDate: { $gte: startMonth } } }, { $group: { _id: null, amount: { $sum: '$amount' } } }]),
    Payment.countDocuments({ ...filter, status: 'pending' }),
    Payment.countDocuments({ ...filter, status: 'verified' }),
    Payment.countDocuments({ ...filter, 'receipt.fileUrl': { $exists: true, $ne: null } }),
    Payment.aggregate([{ $match: collected }, { $group: { _id: '$method', amount: { $sum: '$amount' }, count: { $sum: 1 } } }, { $sort: { amount: -1 } }]),
    Payment.aggregate([{ $match: collected }, { $group: { _id: { $ifNull: ['$branch', '—'] }, amount: { $sum: '$amount' } } }, { $sort: { amount: -1 } }, { $limit: 8 }]),
    Payment.aggregate([{ $match: collected }, { $group: { _id: { $ifNull: ['$projectName', '—'] }, amount: { $sum: '$amount' } } }, { $sort: { amount: -1 } }, { $limit: 8 }]),
    Payment.aggregate([{ $match: collected }, { $group: { _id: { y: { $year: '$paymentDate' }, m: { $month: '$paymentDate' } }, amount: { $sum: '$amount' } } }, { $sort: { '_id.y': 1, '_id.m': 1 } }]),
    Payment.find(filter).sort({ createdAt: -1 }).limit(8).select('paymentCode customerName amount method status paymentDate projectName').lean(),
    Payment.find({ ...filter, status: { $in: ['pending', 'received'] } }).sort({ paymentDate: -1 }).limit(8).select('paymentCode customerName amount method status paymentDate').lean(),
    AuditLog.find({ module: MODULES.PAYMENT, ...firmScope(req.user), ...(req.user.role === ROLES.SALES_EXECUTIVE ? { actor: req.user._id } : {}) }).populate('actor', 'name role').sort({ createdAt: -1 }).limit(10).lean(),
  ])

  const t = totals[0] || { amount: 0, count: 0 }
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

  return ok(res, {
    kpis: {
      totalPayments: t.count,
      totalAmount: t.amount,
      todayCollection: todayAgg[0]?.amount || 0,
      monthCollection: monthAgg[0]?.amount || 0,
      pending, verified, receiptsUploaded: receipts,
      averageCollection: t.count ? Math.round(t.amount / t.count) : 0,
    },
    monthlyCollection: monthly.map((m) => ({ label: `${monthNames[m._id.m - 1]} ${String(m._id.y).slice(2)}`, amount: m.amount })),
    methodDistribution: byMethod.map((m) => ({ method: m._id, amount: m.amount, count: m.count })),
    branchCollection: byBranch.map((b) => ({ branch: b._id, amount: b.amount })),
    projectCollection: byProject.map((p) => ({ project: p._id, amount: p.amount })),
    recentPayments: recent,
    pendingVerification: pendingVerify,
    recentActivity: activity.map((a) => ({ _id: a._id, action: a.action, description: a.description, actorName: a.actor?.name || 'System', at: a.createdAt })),
  }, 'Payment dashboard')
})

// ── Reports ──────────────────────────────────────────────────────────────────
export const reports = asyncHandler(async (req, res) => {
  const filter = analyticsFilter(req)
  const collected = { ...filter, status: { $in: COLLECTED_STATUSES } }

  const [byStatus, daily, monthly, branch, project, executive, customer] = await Promise.all([
    Payment.aggregate([{ $match: filter }, { $group: { _id: '$status', amount: { $sum: '$amount' }, count: { $sum: 1 } } }]),
    Payment.aggregate([{ $match: collected }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$paymentDate' } }, amount: { $sum: '$amount' }, count: { $sum: 1 } } }, { $sort: { _id: -1 } }, { $limit: 60 }]),
    Payment.aggregate([{ $match: collected }, { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$paymentDate' } }, amount: { $sum: '$amount' }, count: { $sum: 1 } } }, { $sort: { _id: -1 } }, { $limit: 24 }]),
    Payment.aggregate([{ $match: collected }, { $group: { _id: { $ifNull: ['$branch', '—'] }, amount: { $sum: '$amount' }, count: { $sum: 1 } } }, { $sort: { amount: -1 } }]),
    Payment.aggregate([{ $match: collected }, { $group: { _id: { $ifNull: ['$projectName', '—'] }, amount: { $sum: '$amount' }, count: { $sum: 1 } } }, { $sort: { amount: -1 } }]),
    Payment.aggregate([{ $match: collected }, { $group: { _id: '$assignedTo', name: { $first: '$branch' }, amount: { $sum: '$amount' }, count: { $sum: 1 } } }, { $sort: { amount: -1 } }]),
    Payment.aggregate([{ $match: collected }, { $group: { _id: '$customer', name: { $first: '$customerName' }, amount: { $sum: '$amount' }, count: { $sum: 1 } } }, { $sort: { amount: -1 } }, { $limit: 100 }]),
  ])

  // Resolve executive names.
  const execIds = executive.map((e) => e._id).filter(Boolean)
  const execUsers = await User.find({ _id: { $in: execIds } }).select('name').lean()
  const execName = Object.fromEntries(execUsers.map((u) => [String(u._id), u.name]))

  const statusMap = Object.fromEntries(byStatus.map((s) => [s._id, s]))
  return ok(res, {
    collectionSummary: PAYMENT_STATUS.map((s) => ({ status: s, amount: statusMap[s]?.amount || 0, count: statusMap[s]?.count || 0 })),
    daily: daily.map((d) => ({ date: d._id, amount: d.amount, count: d.count })),
    monthly: monthly.map((m) => ({ month: m._id, amount: m.amount, count: m.count })),
    branch: branch.map((b) => ({ branch: b._id, amount: b.amount, count: b.count })),
    project: project.map((p) => ({ project: p._id, amount: p.amount, count: p.count })),
    executive: executive.map((e) => ({ executive: execName[String(e._id)] || 'Unassigned', amount: e.amount, count: e.count })),
    customer: customer.map((c) => ({ customer: c.name || 'Customer', amount: c.amount, count: c.count })),
  }, 'Payment reports')
})

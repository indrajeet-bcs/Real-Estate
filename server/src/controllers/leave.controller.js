import LeaveRequest from '../models/LeaveRequest.js'
import User from '../models/User.js'
import Attendance from '../models/Attendance.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from '../utils/ApiError.js'
import { ok, created } from '../utils/apiResponse.js'
import { writeAudit } from '../middleware/audit.js'
import { notify, notifyMany } from '../services/notification.service.js'
import { AUDIT_ACTIONS, MODULES, ROLES, NOTIFICATION_TYPES, ATTENDANCE_STATUS } from '../config/constants.js'
import { ownershipScope, firmScope } from '../middleware/tenantScope.js'

const DAY_MS = 24 * 60 * 60 * 1000
const dayKey = (d) => { const x = new Date(d); const y = x.getFullYear(); const m = String(x.getMonth() + 1).padStart(2, '0'); const dd = String(x.getDate()).padStart(2, '0'); return `${y}-${m}-${dd}` }

// GET /api/leaves — executives see their own; sub-admin/admin see the team.
export const listLeaves = asyncHandler(async (req, res) => {
  const filter = { ...ownershipScope(req.user, 'employee') }
  if (req.query.status) filter.status = req.query.status
  const data = await LeaveRequest.find(filter)
    .populate('employee', 'name email branch')
    .populate('decidedBy', 'name role')
    .sort({ createdAt: -1 })
    .lean()
  return ok(res, data, 'Leave requests fetched')
})

// POST /api/leaves — an executive requests leave for themselves.
export const createLeave = asyncHandler(async (req, res) => {
  const { type, startDate, endDate, reason } = req.body
  const start = new Date(startDate)
  const end = new Date(endDate)
  if (end < start) throw ApiError.badRequest('End date cannot be before start date')
  // Half-day leave counts as 0.5; everything else is inclusive whole days.
  const days = type === 'half_day' ? 0.5 : Math.floor((end - start) / DAY_MS) + 1

  const leave = await LeaveRequest.create({
    firm: req.user.firm,
    employee: req.user._id,
    branch: req.user.branch,
    type, startDate: start, endDate: end, days, reason,
    status: 'pending',
  })

  // Notify the requester's manager, else all sub-admins in the firm.
  let recipients = req.user.manager ? [req.user.manager] : []
  if (!recipients.length) {
    const subAdmins = await User.find({ firm: req.user.firm, role: ROLES.SUB_ADMIN, isActive: true }).select('_id')
    recipients = subAdmins.map((s) => s._id)
  }
  notifyMany(recipients, {
    firm: req.user.firm,
    type: NOTIFICATION_TYPES.LEAVE_REQUEST,
    title: 'Leave request',
    message: `${req.user.name} requested ${days} day(s) ${type} leave`,
    entityType: 'leave',
    entityId: leave._id,
  })

  writeAudit({ req, action: AUDIT_ACTIONS.CREATE, module: MODULES.LEAVE, targetId: leave._id, targetLabel: req.user.name, description: `Requested ${days}-day ${type} leave` })
  return created(res, leave, 'Leave requested')
})

async function decide(req, status) {
  const leave = await LeaveRequest.findOne({ _id: req.params.id, ...firmScope(req.user) })
  if (!leave) throw ApiError.notFound('Leave request not found')
  if (leave.status !== 'pending') throw ApiError.badRequest(`Request is already ${leave.status}`)

  leave.status = status
  leave.decisionNote = req.body.note
  leave.decidedBy = req.user._id
  leave.decidedByName = req.user.name
  leave.decidedAt = new Date()
  await leave.save()

  // Approved leave automatically reflects in the Attendance module (spec rule):
  // mark each covered day as 'leave' for the employee.
  if (status === 'approved') {
    const ops = []
    for (let d = new Date(leave.startDate); d <= leave.endDate; d.setDate(d.getDate() + 1)) {
      ops.push({
        updateOne: {
          filter: { user: leave.employee, date: dayKey(d) },
          update: { $set: { firm: leave.firm, user: leave.employee, status: ATTENDANCE_STATUS.LEAVE, checkOutRemarks: `${leave.type} leave (approved)` } },
          upsert: true,
        },
      })
    }
    if (ops.length) await Attendance.bulkWrite(ops, { ordered: false }).catch(() => {})
  }

  notify({
    firm: req.user.firm,
    recipient: leave.employee,
    type: NOTIFICATION_TYPES.LEAVE_DECISION,
    title: `Leave ${status}`,
    message: `Your ${leave.days}-day leave request was ${status}`,
    entityType: 'leave',
    entityId: leave._id,
  })
  writeAudit({ req, action: AUDIT_ACTIONS.STATUS_CHANGE, module: MODULES.LEAVE, targetId: leave._id, description: `Leave ${status}` })
  return leave
}

// PATCH /api/leaves/:id/approve
export const approveLeave = asyncHandler(async (req, res) => {
  const leave = await decide(req, 'approved')
  return ok(res, leave, 'Leave approved')
})

// PATCH /api/leaves/:id/reject
export const rejectLeave = asyncHandler(async (req, res) => {
  const leave = await decide(req, 'rejected')
  return ok(res, leave, 'Leave rejected')
})

// PATCH /api/leaves/:id/cancel — employee cancels their own still-pending request
// (spec §Cancel Leave Request).
export const cancelLeave = asyncHandler(async (req, res) => {
  const leave = await LeaveRequest.findOne({ _id: req.params.id, firm: req.user.firm, employee: req.user._id })
  if (!leave) throw ApiError.notFound('Leave request not found')
  if (leave.status !== 'pending') throw ApiError.badRequest('Only a pending request can be cancelled')
  leave.status = 'cancelled'
  await leave.save()
  writeAudit({ req, action: AUDIT_ACTIONS.STATUS_CHANGE, module: MODULES.LEAVE, targetId: leave._id, description: 'Leave request cancelled' })
  return ok(res, leave, 'Leave request cancelled')
})

// POST /api/leaves/:id/attachments — upload a supporting document
// (spec §Upload Supporting Documents).
export const addLeaveAttachment = asyncHandler(async (req, res) => {
  const leave = await LeaveRequest.findOne({ _id: req.params.id, firm: req.user.firm, employee: req.user._id })
  if (!leave) throw ApiError.notFound('Leave request not found')
  if (!req.file) throw ApiError.badRequest('No file uploaded')
  const doc = { label: req.body.label || req.file.originalname, fileName: req.file.originalname, fileUrl: `/uploads/${req.file.filename}`, uploadedBy: req.user._id }
  leave.attachments.push(doc)
  await leave.save()
  return created(res, leave.attachments.at(-1), 'Document uploaded')
})

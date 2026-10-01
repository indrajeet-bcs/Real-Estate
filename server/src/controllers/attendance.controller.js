import Attendance from '../models/Attendance.js'
import AttendanceCorrection from '../models/AttendanceCorrection.js'
import User from '../models/User.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from '../utils/ApiError.js'
import { ok, created } from '../utils/apiResponse.js'
import { paginate } from '../utils/paginate.js'
import { writeAudit } from '../middleware/audit.js'
import { notify, notifyMany } from '../services/notification.service.js'
import { AUDIT_ACTIONS, MODULES, ROLES, ATTENDANCE_STATUS, NOTIFICATION_TYPES } from '../config/constants.js'
import { firmScope } from '../middleware/tenantScope.js'

// Classification thresholds (would live in System Settings in a full build).
const ON_TIME_HOUR = 10 // arrival by 10:00 is on-time
const LATE_GRACE_MIN = 30 // up to 10:30 counts as on-time
const HALF_DAY_MINUTES = 240 // < 4h worked → half day
const FULL_DAY_MINUTES = 480 // >= 8h → full day

function dayKey(date) {
  // YYYY-MM-DD in local time.
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// POST /api/attendance/check-in — day start with optional GPS (§9).
export const checkIn = asyncHandler(async (req, res) => {
  const now = new Date()
  const date = dayKey(now)
  const existing = await Attendance.findOne({ user: req.user._id, date })
  if (existing?.checkInAt) throw ApiError.conflict('Already checked in today')

  // Classify lateness by arrival time.
  const lateCutoff = new Date(now)
  lateCutoff.setHours(ON_TIME_HOUR, LATE_GRACE_MIN, 0, 0)
  const status = now > lateCutoff ? ATTENDANCE_STATUS.LATE : ATTENDANCE_STATUS.ON_TIME

  const record = await Attendance.findOneAndUpdate(
    { user: req.user._id, date },
    {
      $set: {
        firm: req.user.firm,
        checkInAt: now,
        checkInLocation: req.body.location,
        checkInRemarks: req.body.remarks,
        ...(req.body.photo ? { checkInPhoto: req.body.photo } : {}),
        status,
      },
    },
    { new: true, upsert: true }
  )

  writeAudit({ req, action: AUDIT_ACTIONS.LOGIN, module: MODULES.ATTENDANCE, targetId: record._id, description: `Checked in (${status})` })
  return ok(res, record, `Checked in (${status})`)
})

// POST /api/attendance/check-out — day end; computes duration + final class.
export const checkOut = asyncHandler(async (req, res) => {
  const now = new Date()
  const date = dayKey(now)
  const record = await Attendance.findOne({ user: req.user._id, date })
  if (!record?.checkInAt) throw ApiError.badRequest('No check-in recorded for today')
  if (record.checkOutAt) throw ApiError.conflict('Already checked out today')

  record.checkOutAt = now
  record.checkOutLocation = req.body.location
  record.checkOutRemarks = req.body.remarks
  record.workedMinutes = Math.round((now - record.checkInAt) / 60000)

  // Final classification: keep "late" flavour but downgrade short days.
  if (record.workedMinutes < HALF_DAY_MINUTES) {
    record.status = ATTENDANCE_STATUS.HALF_DAY
  } else if (record.status !== ATTENDANCE_STATUS.LATE && record.workedMinutes >= FULL_DAY_MINUTES) {
    record.status = ATTENDANCE_STATUS.ON_TIME
  }
  await record.save()

  writeAudit({ req, action: AUDIT_ACTIONS.LOGOUT, module: MODULES.ATTENDANCE, targetId: record._id, description: `Checked out — ${record.workedMinutes} min (${record.status})` })
  return ok(res, record, 'Checked out')
})

// GET /api/attendance/me — the executive's own history.
export const myAttendance = asyncHandler(async (req, res) => {
  const { page, limit } = req.query
  const { data, meta } = await paginate(
    Attendance,
    { user: req.user._id },
    { page, limit, sort: { date: -1 } }
  )
  return ok(res, data, 'Attendance fetched', meta)
})

// GET /api/attendance — team review for Sub-Admin/Admin (§5). Filter by date.
export const reviewAttendance = asyncHandler(async (req, res) => {
  const { page, limit, date, status } = req.query
  const filter = { ...firmScope(req.user) }
  if (date) filter.date = date
  if (status) filter.status = status
  if (req.query.user) filter.user = req.query.user
  const { data, meta } = await paginate(Attendance, filter, {
    page,
    limit,
    sort: { date: -1 },
    populate: { path: 'user', select: 'name email role employeeId branch' },
  })
  return ok(res, data, 'Team attendance fetched', meta)
})

// ---------------- Attendance corrections (spec §Attendance Correction) ----------------

// POST /api/attendance/corrections — an employee submits a correction request.
export const submitCorrection = asyncHandler(async (req, res) => {
  const { date, requestedCheckInAt, requestedCheckOutAt, reason } = req.body
  const request = await AttendanceCorrection.create({
    firm: req.user.firm,
    employee: req.user._id,
    branch: req.user.branch,
    date,
    requestedCheckInAt: requestedCheckInAt || undefined,
    requestedCheckOutAt: requestedCheckOutAt || undefined,
    reason,
  })

  // Notify the requester's manager, else all sub-admins in the firm.
  let recipients = req.user.manager ? [req.user.manager] : []
  if (!recipients.length) {
    const subs = await User.find({ firm: req.user.firm, role: ROLES.SUB_ADMIN, isActive: true }).select('_id')
    recipients = subs.map((s) => s._id)
  }
  if (recipients.length) {
    notifyMany(recipients, {
      firm: req.user.firm,
      type: NOTIFICATION_TYPES.ATTENDANCE_LOG,
      title: 'Attendance correction request',
      message: `${req.user.name} requested an attendance correction for ${date}`,
      entityType: 'attendance_correction',
      entityId: request._id,
    })
  }

  writeAudit({ req, action: AUDIT_ACTIONS.CREATE, module: MODULES.ATTENDANCE, targetId: request._id, description: `Attendance correction requested for ${date}` })
  return created(res, request, 'Correction request submitted')
})

// GET /api/attendance/corrections — employee: own; sub-admin/admin: firm-wide.
export const listCorrections = asyncHandler(async (req, res) => {
  const filter = { ...firmScope(req.user) }
  if (req.user.role === ROLES.SALES_EXECUTIVE) filter.employee = req.user._id
  if (req.query.status) filter.status = req.query.status
  const { data, meta } = await paginate(AttendanceCorrection, filter, {
    page: req.query.page,
    limit: req.query.limit,
    sort: { createdAt: -1 },
    populate: { path: 'employee', select: 'name employeeId branch' },
  })
  return ok(res, data, 'Correction requests fetched', meta)
})

// PATCH /api/attendance/corrections/:id — Sub-Admin/Admin approve or reject.
// Approval applies the requested times to the day's attendance record.
export const decideCorrection = asyncHandler(async (req, res) => {
  const { decision, note } = req.body
  const request = await AttendanceCorrection.findOne({ _id: req.params.id, ...firmScope(req.user) })
  if (!request) throw ApiError.notFound('Correction request not found')
  if (request.status !== 'pending') throw ApiError.badRequest('This request has already been decided')
  if (decision === 'reject' && !note?.trim()) throw ApiError.badRequest('Rejection remarks are required')

  request.status = decision === 'approve' ? 'approved' : 'rejected'
  request.decisionNote = note
  request.decidedBy = req.user._id
  request.decidedAt = new Date()
  await request.save()

  if (decision === 'approve') {
    // Apply the corrected times to the attendance record for that day.
    const set = {}
    if (request.requestedCheckInAt) set.checkInAt = request.requestedCheckInAt
    if (request.requestedCheckOutAt) set.checkOutAt = request.requestedCheckOutAt
    if (set.checkInAt && set.checkOutAt) {
      set.workedMinutes = Math.max(0, Math.round((new Date(set.checkOutAt) - new Date(set.checkInAt)) / 60000))
      set.status = set.workedMinutes < HALF_DAY_MINUTES ? ATTENDANCE_STATUS.HALF_DAY : ATTENDANCE_STATUS.ON_TIME
    }
    await Attendance.findOneAndUpdate(
      { firm: request.firm, user: request.employee, date: request.date },
      { $set: { firm: request.firm, user: request.employee, ...set } },
      { upsert: true, new: true }
    )
  }

  notify({
    firm: request.firm,
    recipient: request.employee,
    type: NOTIFICATION_TYPES.ATTENDANCE_LOG,
    title: `Attendance correction ${request.status}`,
    message: `Your correction for ${request.date} was ${request.status}`,
    entityType: 'attendance_correction',
    entityId: request._id,
  })

  writeAudit({ req, action: AUDIT_ACTIONS.STATUS_CHANGE, module: MODULES.ATTENDANCE, targetId: request._id, description: `Attendance correction ${request.status}` })
  return ok(res, request, `Correction ${request.status}`)
})

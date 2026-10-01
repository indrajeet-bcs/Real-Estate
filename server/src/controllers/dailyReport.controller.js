import DailyReport from '../models/DailyReport.js'
import FollowUp from '../models/FollowUp.js'
import SiteVisit from '../models/SiteVisit.js'
import Booking from '../models/Booking.js'
import Customer from '../models/Customer.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from '../utils/ApiError.js'
import { ok, created } from '../utils/apiResponse.js'
import { ROLES } from '../config/constants.js'

// Local YYYY-MM-DD for "today".
const todayKey = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const isDateKey = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)

// [start, end] Date window for a YYYY-MM-DD key.
const dayWindow = (key) => {
  const start = new Date(`${key}T00:00:00.000`)
  const end = new Date(`${key}T23:59:59.999`)
  return { start, end }
}

// Compute the day's real activity for a user — used to pre-fill the EOD form and
// snapshot at submit time.
async function computeAuto(userId, key) {
  const { start, end } = dayWindow(key)
  const range = { $gte: start, $lte: end }
  const [followupsCompleted, visitsConducted, bookingsCreated, leadsAssigned] = await Promise.all([
    FollowUp.countDocuments({ assignedTo: userId, status: 'completed', completedAt: range }),
    SiteVisit.countDocuments({ assignedTo: userId, 'checkIn.at': range }),
    Booking.countDocuments({ bookedBy: userId, createdAt: range }),
    Customer.countDocuments({ assignedTo: userId, assignedAt: range }),
  ])
  return { followupsCompleted, visitsConducted, bookingsCreated, leadsAssigned }
}

// GET /api/daily-reports/today — the exec's report for today (if submitted) plus
// pre-fill counts computed from today's real activity.
export const getToday = asyncHandler(async (req, res) => {
  const key = isDateKey(req.query.date) ? req.query.date : todayKey()
  const [report, auto] = await Promise.all([
    DailyReport.findOne({ user: req.user._id, date: key }).lean(),
    computeAuto(req.user._id, key),
  ])
  const prefill = {
    callsCount: auto.followupsCompleted,
    meetingsCount: 0,
    visitsCount: auto.visitsConducted,
    bookingsCount: auto.bookingsCreated,
    newLeadsCount: auto.leadsAssigned,
  }
  return ok(res, { date: key, report: report || null, prefill, autoStats: auto }, 'Daily report context')
})

// GET /api/daily-reports — own reports (exec) or team reports (sub-admin/admin),
// firm-scoped. Filters: ?user, ?date, ?from, ?to.
export const listReports = asyncHandler(async (req, res) => {
  const filter = {}
  if (req.user.role === ROLES.SALES_EXECUTIVE) {
    filter.user = req.user._id
  } else {
    // Managers see their firm's reports.
    if (req.user.firm) filter.firm = req.user.firm
    if (req.query.user) filter.user = req.query.user
  }
  if (isDateKey(req.query.date)) filter.date = req.query.date
  else if (isDateKey(req.query.from) || isDateKey(req.query.to)) {
    filter.date = {}
    if (isDateKey(req.query.from)) filter.date.$gte = req.query.from
    if (isDateKey(req.query.to)) filter.date.$lte = req.query.to
  }
  const reports = await DailyReport.find(filter)
    .populate('user', 'name email branch')
    .sort({ date: -1, createdAt: -1 })
    .limit(200)
    .lean()
  return ok(res, reports, 'Daily reports fetched')
})

// GET /api/daily-reports/:id — a single report (own, or team within firm).
export const getReport = asyncHandler(async (req, res) => {
  const report = await DailyReport.findById(req.params.id).populate('user', 'name email branch').lean()
  if (!report) throw ApiError.notFound('Report not found')
  const isOwner = String(report.user?._id || report.user) === String(req.user._id)
  const sameFirm = req.user.firm && String(report.firm) === String(req.user.firm)
  if (req.user.role === ROLES.SALES_EXECUTIVE ? !isOwner : !(isOwner || sameFirm)) {
    throw ApiError.forbidden('You cannot view this report')
  }
  return ok(res, report)
})

// POST /api/daily-reports — create or update the exec's report for a day
// (idempotent per user+date). Snapshots the auto counts at submit time.
export const submitReport = asyncHandler(async (req, res) => {
  const key = isDateKey(req.body.date) ? req.body.date : todayKey()
  const auto = await computeAuto(req.user._id, key)
  const num = (v, fallback = 0) => {
    const n = Number(v)
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback
  }
  const payload = {
    firm: req.user.firm || null,
    user: req.user._id,
    userName: req.user.name,
    branch: req.user.branch || undefined,
    date: key,
    callsCount: num(req.body.callsCount),
    meetingsCount: num(req.body.meetingsCount),
    visitsCount: num(req.body.visitsCount, auto.visitsConducted),
    bookingsCount: num(req.body.bookingsCount, auto.bookingsCreated),
    newLeadsCount: num(req.body.newLeadsCount, auto.leadsAssigned),
    autoStats: auto,
    summary: (req.body.summary || '').trim(),
    challenges: (req.body.challenges || '').trim(),
    tomorrowPlan: (req.body.tomorrowPlan || '').trim(),
    submittedAt: new Date(),
  }
  const existing = await DailyReport.findOne({ user: req.user._id, date: key })
  if (existing) {
    Object.assign(existing, payload)
    await existing.save()
    return ok(res, existing, 'Daily report updated')
  }
  const report = await DailyReport.create(payload)
  return created(res, report, 'Daily report submitted')
})

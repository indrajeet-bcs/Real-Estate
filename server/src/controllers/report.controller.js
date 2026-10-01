import Customer from '../models/Customer.js'
import Booking from '../models/Booking.js'
import SiteVisit from '../models/SiteVisit.js'
import Attendance from '../models/Attendance.js'
import User from '../models/User.js'
import FollowUp from '../models/FollowUp.js'
import Task from '../models/Task.js'
import Project from '../models/Project.js'
import Unit from '../models/Unit.js'
import Branch from '../models/Branch.js'
import Firm from '../models/Firm.js'
import Builder from '../models/Builder.js'
import Subscription from '../models/Subscription.js'
import LeaveRequest from '../models/LeaveRequest.js'
import AuditLog from '../models/AuditLog.js'
import mongoose from 'mongoose'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ok } from '../utils/apiResponse.js'
import { ROLES, BOOKING_STATUS, CUSTOMER_STATUS, FOLLOWUP_STATUS, ATTENDANCE_STATUS, VISIT_STATUS, UNIT_STATUS } from '../config/constants.js'

// Report scope by role (§8): executive = self, sub-admin/admin = firm,
// super admin = all firms. Optional date range applied to createdAt.
function reportScope(user, { field = 'firm', dateField = 'createdAt', from, to } = {}) {
  const match = {}
  if (user.role === ROLES.SALES_EXECUTIVE) {
    match.assignedTo = user._id
  } else if (user.role !== ROLES.SUPER_ADMIN) {
    match.firm = user.firm
  }
  if (from || to) {
    match[dateField] = {}
    if (from) match[dateField].$gte = new Date(from)
    if (to) match[dateField].$lte = new Date(to)
  }
  return match
}

// GET /api/reports/my-performance — the requesting executive's computed
// performance (Employee spec §My Performance). Everything is derived from
// completed CRM activity; nothing is editable.
const CLOSED = [BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.SALE_COMPLETED]
const CONVERTED_STATES = [CUSTOMER_STATUS.CONVERTED, CUSTOMER_STATUS.BOOKED]
const QUALIFIED_PLUS = [CUSTOMER_STATUS.QUALIFIED, CUSTOMER_STATUS.CONVERTED, CUSTOMER_STATUS.BOOKED]
const finalSaleExpr = { $ifNull: ['$discount.finalSaleAmount', { $ifNull: ['$totalValue', '$bookingAmount'] }] }

function resolvePeriod(q) {
  const now = new Date()
  if (q.from || q.to) {
    return { start: q.from ? new Date(q.from) : new Date(0), end: q.to ? new Date(`${q.to}T23:59:59.999`) : now, label: 'custom' }
  }
  if (q.period === 'previous_month') {
    return { start: new Date(now.getFullYear(), now.getMonth() - 1, 1), end: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999), label: 'previous_month' }
  }
  return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: now, label: 'current_month' }
}

export const myPerformance = asyncHandler(async (req, res) => {
  const uid = req.user._id
  const { start, end, label } = resolvePeriod(req.query)
  const inPeriod = (field) => ({ [field]: { $gte: start, $lte: end } })

  const [
    totalLeads, qualifiedLeads, customersConverted,
    closedAgg, followupsCompleted, visitsCompleted, tasksCompleted,
    attendanceAgg, latestBookingArr, revenueByDayArr, followupResp, monthlyRaw,
  ] = await Promise.all([
    Customer.countDocuments({ assignedTo: uid, ...inPeriod('createdAt') }),
    Customer.countDocuments({ assignedTo: uid, status: { $in: QUALIFIED_PLUS } }),
    Customer.countDocuments({ assignedTo: uid, status: { $in: CONVERTED_STATES } }),
    Booking.aggregate([
      { $match: { bookedBy: uid, status: { $in: CLOSED }, createdAt: { $gte: start, $lte: end } } },
      { $group: { _id: null, count: { $sum: 1 }, revenue: { $sum: finalSaleExpr } } },
    ]),
    FollowUp.countDocuments({ assignedTo: uid, status: FOLLOWUP_STATUS.COMPLETED, ...inPeriod('completedAt') }),
    SiteVisit.countDocuments({ assignedTo: uid, status: VISIT_STATUS.CONDUCTED, ...inPeriod('updatedAt') }),
    Task.countDocuments({ owner: uid, status: 'completed', ...inPeriod('completedAt') }),
    Attendance.aggregate([
      { $match: { user: uid, date: { $gte: dayStr(start), $lte: dayStr(end) } } },
      { $group: { _id: '$status', n: { $sum: 1 } } },
    ]),
    Booking.find({ bookedBy: uid, status: { $in: CLOSED } }).sort({ createdAt: -1 }).limit(1)
      .populate('customer', 'name').populate('unit', 'unitNumber').populate('project', 'name').lean(),
    Booking.aggregate([
      { $match: { bookedBy: uid, status: { $in: CLOSED }, createdAt: { $gte: start, $lte: end } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, revenue: { $sum: finalSaleExpr }, count: { $sum: 1 } } },
      { $sort: { revenue: -1 } }, { $limit: 3 },
    ]),
    FollowUp.aggregate([
      { $match: { assignedTo: uid, status: FOLLOWUP_STATUS.COMPLETED, completedAt: { $gte: start, $lte: end } } },
      { $project: { hours: { $divide: [{ $subtract: ['$completedAt', '$createdAt'] }, 3600000] } } },
      { $group: { _id: null, avgHours: { $avg: '$hours' } } },
    ]),
    // 6-month trend.
    Booking.aggregate([
      { $match: { bookedBy: uid, status: { $in: CLOSED }, createdAt: { $gte: new Date(new Date().getFullYear(), new Date().getMonth() - 5, 1) } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, revenue: { $sum: finalSaleExpr }, bookings: { $sum: 1 } } },
    ]),
  ])

  const closed = closedAgg[0] || { count: 0, revenue: 0 }
  const target = req.user.targetRevenue || 0
  const achieved = closed.revenue
  const remaining = Math.max(0, target - achieved)
  const achievementPct = target > 0 ? Math.round((achieved / target) * 100) : 0

  // Attendance %.
  const att = Object.fromEntries(attendanceAgg.map((a) => [a._id, a.n]))
  const present = (att.on_time || 0) + (att.late || 0) + (att.half_day || 0)
  const attTotal = present + (att.absent || 0)
  const attendancePct = attTotal > 0 ? Math.round((present / attTotal) * 100) : 0

  // Leads created per month (for conversion in the trend).
  const leadsByMonth = await Customer.aggregate([
    { $match: { assignedTo: uid, createdAt: { $gte: new Date(new Date().getFullYear(), new Date().getMonth() - 5, 1) } } },
    { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, leads: { $sum: 1 } } },
  ])
  const revByMonth = Object.fromEntries(monthlyRaw.map((m) => [m._id, m]))
  const leadMap = Object.fromEntries(leadsByMonth.map((m) => [m._id, m.leads]))
  const trend = []
  const now = new Date()
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const r = revByMonth[key] || { revenue: 0, bookings: 0 }
    const leads = leadMap[key] || 0
    trend.push({
      month: d.toLocaleString('en-IN', { month: 'short' }),
      revenue: r.revenue, bookings: r.bookings,
      conversion: leads > 0 ? Math.round((r.bookings / leads) * 100) : 0,
    })
  }

  // Conversion + breakdown.
  const conversionRate = totalLeads > 0 ? Math.round((customersConverted / totalLeads) * 100) : 0
  const breakdown = {
    leadToCustomerRate: totalLeads > 0 ? Math.round((customersConverted / totalLeads) * 100) : 0,
    customerToBookingRate: customersConverted > 0 ? Math.round((closed.count / customersConverted) * 100) : 0,
    avgFollowupResponseHours: followupResp[0]?.avgHours ? Math.round(followupResp[0].avgHours * 10) / 10 : 0,
    avgBookingValue: closed.count > 0 ? Math.round(closed.revenue / closed.count) : 0,
  }

  // Recent achievements.
  const milestones = [25, 50, 75, 100].filter((m) => achievementPct >= m)
  const latest = latestBookingArr[0] || null

  return ok(res, {
    period: label,
    range: { from: start, to: end },
    cards: { monthlyTarget: target, achievement: achievementPct, conversionRate, revenueGenerated: achieved },
    targetProgress: { monthlyTarget: target, achieved, remaining, achievementPct },
    sales: { totalLeads, qualifiedLeads, customersConverted, bookingsClosed: closed.count, revenue: closed.revenue },
    activity: { followupsCompleted, visitsCompleted, tasksCompleted, attendancePct },
    trend,
    achievements: {
      latestBooking: latest ? { customer: latest.customer?.name, unit: latest.unit?.unitNumber, project: latest.project?.name, value: finalOf(latest), date: latest.createdAt } : null,
      milestones,
      bestDays: revenueByDayArr.map((d) => ({ date: d._id, revenue: d.revenue, bookings: d.count })),
    },
    breakdown,
  })
})

function dayStr(d) { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}` }
function finalOf(b) { return b.discount?.finalSaleAmount || b.totalValue || b.bookingAmount || 0 }

// GET /api/reports/platform-overview — Super Admin platform metrics, computed
// live from the database (no mock data). Platform-wide across every firm.
export const platformOverview = asyncHandler(async (req, res) => {
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)
  const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1)
  const last30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const firmFilter = { isDeleted: { $ne: true } }

  const [
    total, active, trial, suspended, paid, newThisMonth, newPrevMonth,
    users, activeUsers, customers, bookings, projects, units, builders,
    growthAgg, planAgg, storageAgg, recent,
  ] = await Promise.all([
    Firm.countDocuments(firmFilter),
    Firm.countDocuments({ ...firmFilter, status: 'active' }),
    Firm.countDocuments({ ...firmFilter, status: 'trial' }),
    Firm.countDocuments({ ...firmFilter, status: 'suspended' }),
    Firm.countDocuments({ ...firmFilter, subscriptionStatus: 'active' }),
    Firm.countDocuments({ ...firmFilter, createdAt: { $gte: monthStart } }),
    Firm.countDocuments({ ...firmFilter, createdAt: { $gte: prevMonthStart, $lte: prevMonthEnd } }),
    User.countDocuments({ role: { $ne: ROLES.SUPER_ADMIN } }),
    User.countDocuments({ role: { $ne: ROLES.SUPER_ADMIN }, lastLoginAt: { $gte: last30 } }),
    Customer.countDocuments({}),
    Booking.countDocuments({ status: { $in: [BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.SALE_COMPLETED] } }),
    Project.countDocuments({ isArchived: { $ne: true } }),
    Unit.countDocuments({}),
    Builder.countDocuments({ isArchived: { $ne: true } }),
    Firm.aggregate([
      { $match: { ...firmFilter, createdAt: { $gte: twelveMonthsAgo } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, n: { $sum: 1 } } },
    ]),
    Firm.aggregate([
      { $match: firmFilter },
      { $group: { _id: { $ifNull: ['$plan', 'standard'] }, n: { $sum: 1 } } },
      { $sort: { n: -1 } },
    ]),
    Firm.aggregate([
      { $match: firmFilter },
      { $group: { _id: null, used: { $sum: { $ifNull: ['$storageUsed', 0] } }, limit: { $sum: { $ifNull: ['$storageLimit', 0] } } } },
    ]),
    AuditLog.find({}).sort({ createdAt: -1 }).limit(10)
      .populate('actor', 'name').populate('firm', 'name').lean(),
  ])

  // Live MRR from active subscriptions (yearly normalised to monthly).
  const mrrAgg = await Subscription.aggregate([
    { $match: { status: 'active' } },
    { $group: { _id: null, mrr: { $sum: { $cond: [{ $eq: ['$cycle', 'yearly'] }, { $divide: ['$amount', 12] }, '$amount'] } } } },
  ])
  const mrr = Math.round(mrrAgg[0]?.mrr || 0)

  // 12-month company-growth series (fill gaps with 0).
  const growthMap = Object.fromEntries(growthAgg.map((g) => [g._id, g.n]))
  const companyGrowth = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    companyGrowth.push({ month: d.toLocaleString('en-IN', { month: 'short' }), value: growthMap[key] || 0 })
  }

  const storage = storageAgg[0] || { used: 0, limit: 0 }
  const growthPct = newPrevMonth > 0 ? Math.round(((newThisMonth - newPrevMonth) / newPrevMonth) * 100) : null

  return res.json({
    success: true,
    message: 'Platform overview',
    data: {
      companies: { total, active, trial, suspended, paid, newThisMonth, newPrevMonth, growthPct },
      platform: { users, activeUsers, customers, bookings, projects, units, builders },
      revenue: { mrr, arr: mrr * 12 },
      subscriptionDistribution: planAgg.map((p) => ({ label: p._id, value: p.n })),
      companyGrowth,
      storage,
      recentActivity: recent.map((a) => ({
        id: String(a._id), action: a.action, module: a.module,
        description: a.description || `${a.action} on ${a.module}`,
        actor: a.actor?.name || 'System', firm: a.firm?.name || null,
        at: a.createdAt, success: a.success,
      })),
    },
  })
})

// GET /api/reports/lead-source — customers grouped by source.
export const leadSourceReport = asyncHandler(async (req, res) => {
  const match = reportScope(req.user, { from: req.query.from, to: req.query.to })
  const rows = await Customer.aggregate([
    { $match: match },
    { $group: { _id: '$source', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ])
  return ok(res, rows.map((r) => ({ source: r._id, count: r.count })), 'Lead source analysis')
})

// GET /api/reports/booking-trend — bookings per day.
export const bookingTrendReport = asyncHandler(async (req, res) => {
  const match = reportScope(req.user, { from: req.query.from, to: req.query.to })
  if (req.user.role === ROLES.SALES_EXECUTIVE) {
    delete match.assignedTo
    match.bookedBy = req.user._id
  }
  const rows = await Booking.aggregate([
    { $match: match },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        bookings: { $sum: 1 },
        value: { $sum: '$bookingAmount' },
      },
    },
    { $sort: { _id: 1 } },
  ])
  return ok(res, rows.map((r) => ({ date: r._id, bookings: r.bookings, value: r.value })), 'Booking trend')
})

// GET /api/reports/employee-performance — per-executive funnel (firm scope).
export const employeePerformanceReport = asyncHandler(async (req, res) => {
  if (req.user.role === ROLES.SALES_EXECUTIVE) {
    // An executive only sees their own stats.
    const stats = await buildExecStats(req.user.firm, req.user._id)
    return ok(res, [stats], 'Your performance')
  }
  const firmMatch = req.user.role === ROLES.SUPER_ADMIN ? {} : { firm: req.user.firm }
  const execs = await User.find({ ...firmMatch, role: ROLES.SALES_EXECUTIVE }).select('name email firm').lean()
  const data = await Promise.all(execs.map((e) => buildExecStats(e.firm, e._id, e)))
  return ok(res, data, 'Employee performance report')
})

async function buildExecStats(firm, execId, exec) {
  const [leads, booked, visits, bookings] = await Promise.all([
    Customer.countDocuments({ assignedTo: execId }),
    Customer.countDocuments({ assignedTo: execId, status: CUSTOMER_STATUS.BOOKED }),
    SiteVisit.countDocuments({ assignedTo: execId }),
    Booking.countDocuments({ bookedBy: execId, status: BOOKING_STATUS.CONFIRMED }),
  ])
  return {
    executive: exec ? { id: exec._id, name: exec.name, email: exec.email } : { id: execId },
    leads,
    booked,
    visits,
    confirmedBookings: bookings,
    conversionRate: leads ? Number(((booked / leads) * 100).toFixed(1)) : 0,
  }
}

// GET /api/reports/visit-conversion — visits vs resulting bookings.
export const visitConversionReport = asyncHandler(async (req, res) => {
  const match = reportScope(req.user, { from: req.query.from, to: req.query.to })
  if (req.user.role === ROLES.SALES_EXECUTIVE) match.assignedTo = req.user._id
  const [totalVisits, conducted] = await Promise.all([
    SiteVisit.countDocuments(match),
    SiteVisit.countDocuments({ ...match, status: 'conducted' }),
  ])
  const bookingMatch = { ...match }
  delete bookingMatch.assignedTo
  if (req.user.role === ROLES.SALES_EXECUTIVE) bookingMatch.bookedBy = req.user._id
  const bookings = await Booking.countDocuments(bookingMatch)
  return ok(res, {
    totalVisits,
    conducted,
    bookings,
    conversionRate: conducted ? Number(((bookings / conducted) * 100).toFixed(1)) : 0,
  }, 'Site visit conversion')
})

// GET /api/reports/revenue — Admin & Super Admin only (§8).
export const revenueReport = asyncHandler(async (req, res) => {
  const match = { status: BOOKING_STATUS.CONFIRMED }
  if (req.user.role !== ROLES.SUPER_ADMIN) match.firm = req.user.firm
  if (req.query.from || req.query.to) {
    match.createdAt = {}
    if (req.query.from) match.createdAt.$gte = new Date(req.query.from)
    if (req.query.to) match.createdAt.$lte = new Date(req.query.to)
  }
  const [agg] = await Booking.aggregate([
    { $match: match },
    { $group: { _id: null, totalRevenue: { $sum: '$bookingAmount' }, totalValue: { $sum: '$totalValue' }, count: { $sum: 1 } } },
  ])
  return ok(res, {
    totalRevenue: agg?.totalRevenue || 0,
    totalDealValue: agg?.totalValue || 0,
    confirmedBookings: agg?.count || 0,
  }, 'Revenue report')
})

// GET /api/reports/attendance — attendance summary by status.
export const attendanceReport = asyncHandler(async (req, res) => {
  const match = {}
  if (req.user.role === ROLES.SALES_EXECUTIVE) match.user = new mongoose.Types.ObjectId(req.user._id)
  else if (req.user.role !== ROLES.SUPER_ADMIN) match.firm = req.user.firm
  if (req.query.date) match.date = req.query.date

  const rows = await Attendance.aggregate([
    { $match: match },
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ])
  return ok(res, rows.map((r) => ({ status: r._id, count: r.count })), 'Attendance report')
})

// GET /api/reports/summary — headline KPIs for the dashboard cards.
export const dashboardSummary = asyncHandler(async (req, res) => {
  const scope = {}
  if (req.user.role === ROLES.SALES_EXECUTIVE) scope.assignedTo = req.user._id
  else if (req.user.role !== ROLES.SUPER_ADMIN) scope.firm = req.user.firm

  const bookingScope = { ...scope }
  if (req.user.role === ROLES.SALES_EXECUTIVE) {
    delete bookingScope.assignedTo
    bookingScope.bookedBy = req.user._id
  }

  const [totalCustomers, booked, lost, confirmedBookings] = await Promise.all([
    Customer.countDocuments(scope),
    Customer.countDocuments({ ...scope, status: CUSTOMER_STATUS.BOOKED }),
    Customer.countDocuments({ ...scope, status: CUSTOMER_STATUS.LOST }),
    Booking.countDocuments({ ...bookingScope, status: BOOKING_STATUS.CONFIRMED }),
  ])

  if (req.user.role === ROLES.SALES_EXECUTIVE) {
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const todayEnd = new Date()
    todayEnd.setHours(23, 59, 59, 999)

    const [todaysFollowups, assignedLeads, siteVisits, bookingsCount, pendingTasks] = await Promise.all([
      FollowUp.countDocuments({ assignedTo: req.user._id, status: FOLLOWUP_STATUS.SCHEDULED, scheduledAt: { $gte: todayStart, $lte: todayEnd } }),
      Customer.countDocuments({ assignedTo: req.user._id }),
      SiteVisit.countDocuments({ assignedTo: req.user._id }),
      Booking.countDocuments({ bookedBy: req.user._id }),
      FollowUp.countDocuments({ assignedTo: req.user._id, status: FOLLOWUP_STATUS.SCHEDULED, scheduledAt: { $lt: todayStart } }),
    ])

    return ok(res, {
      totalCustomers,
      booked,
      lost,
      confirmedBookings,
      todaysFollowups,
      assignedLeads,
      siteVisits,
      bookings: bookingsCount,
      pendingTasks,
    }, 'Dashboard summary')
  }

  return ok(res, { totalCustomers, booked, lost, confirmedBookings }, 'Dashboard summary')
})

// GET /api/reports/admin-revenue-trend?period=today|week|month|year
// Time-series of confirmed-booking revenue & sales for the Admin dashboard's
// Revenue & Sales Trend chart. Read-only; buckets are filled client-agnostic
// (missing buckets returned as zero) so the chart always renders a full axis.
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const dateKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export const adminRevenueTrend = asyncHandler(async (req, res) => {
  const scope = {}
  if (req.user.role !== ROLES.SUPER_ADMIN) scope.firm = req.user.firm

  const period = ['today', 'week', 'month', 'year'].includes(req.query.period) ? req.query.period : 'month'
  const now = new Date()
  const order = [] // ordered [{ key, label }]
  let start
  let keyFor

  if (period === 'today') {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    for (let h = 0; h < 24; h++) order.push({ key: String(h), label: `${String(h).padStart(2, '0')}:00` })
    keyFor = (d) => String(d.getHours())
  } else if (period === 'week') {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6)
    for (let i = 0; i < 7; i++) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
      order.push({ key: dateKey(d), label: WEEKDAYS[d.getDay()] })
    }
    keyFor = (d) => dateKey(d)
  } else if (period === 'year') {
    start = new Date(now.getFullYear(), 0, 1)
    for (let m = 0; m < 12; m++) order.push({ key: String(m), label: MONTHS[m] })
    keyFor = (d) => String(d.getMonth())
  } else {
    // month → one bucket per day of the current month
    start = new Date(now.getFullYear(), now.getMonth(), 1)
    const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    for (let i = 1; i <= days; i++) {
      const d = new Date(now.getFullYear(), now.getMonth(), i)
      order.push({ key: dateKey(d), label: String(i) })
    }
    keyFor = (d) => dateKey(d)
  }

  const docs = await Booking.find({ ...scope, status: BOOKING_STATUS.CONFIRMED, createdAt: { $gte: start } })
    .select('createdAt totalValue bookingAmount')
    .lean()

  const bucket = Object.fromEntries(order.map((o) => [o.key, { revenue: 0, sales: 0 }]))
  for (const b of docs) {
    const k = keyFor(new Date(b.createdAt))
    if (bucket[k]) {
      bucket[k].revenue += b.totalValue ?? b.bookingAmount ?? 0
      bucket[k].sales += 1
    }
  }

  const series = order.map((o) => ({ label: o.label, revenue: bucket[o.key].revenue, sales: bucket[o.key].sales }))
  return ok(res, { period, series }, 'Revenue & sales trend')
})

// GET /api/reports/admin-overview — full Admin dashboard: 4 headline KPIs with
// month-over-month trend, plus the console sections (sales status, branch &
// employee performance, inventory, pipeline, attendance, recent bookings/logs).
export const adminOverview = asyncHandler(async (req, res) => {
  const firm = req.user.firm

  // Month boundaries for the KPI comparison ("this month vs last month").
  const now = new Date()
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)

  const bookingRevenue = { $ifNull: ['$totalValue', '$bookingAmount'] }
  const trend = (curr, prev) => {
    if (!prev) return { deltaPct: curr ? 100 : 0, direction: curr ? 'up' : 'flat' }
    const pct = Math.round(((curr - prev) / prev) * 100)
    return { deltaPct: pct, direction: pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat' }
  }

  const [
    revenueAllAgg, revenueThisAgg, revenueLastAgg,
    salesAll, salesThis, salesLast,
    customersAll, customersThis, customersLast,
    activeProjects, projectsThis, projectsLast,
    statusAgg, inventoryAgg,
    newLeads, followUpsCount, visitsCount, bookingsCount, closedSales,
    recentBookings, recentActivity,
  ] = await Promise.all([
    Booking.aggregate([{ $match: { firm, status: BOOKING_STATUS.CONFIRMED } }, { $group: { _id: null, v: { $sum: bookingRevenue } } }]),
    Booking.aggregate([{ $match: { firm, status: BOOKING_STATUS.CONFIRMED, createdAt: { $gte: thisMonthStart } } }, { $group: { _id: null, v: { $sum: bookingRevenue } } }]),
    Booking.aggregate([{ $match: { firm, status: BOOKING_STATUS.CONFIRMED, createdAt: { $gte: lastMonthStart, $lt: thisMonthStart } } }, { $group: { _id: null, v: { $sum: bookingRevenue } } }]),

    Booking.countDocuments({ firm, status: BOOKING_STATUS.CONFIRMED }),
    Booking.countDocuments({ firm, status: BOOKING_STATUS.CONFIRMED, createdAt: { $gte: thisMonthStart } }),
    Booking.countDocuments({ firm, status: BOOKING_STATUS.CONFIRMED, createdAt: { $gte: lastMonthStart, $lt: thisMonthStart } }),

    Customer.countDocuments({ firm }),
    Customer.countDocuments({ firm, createdAt: { $gte: thisMonthStart } }),
    Customer.countDocuments({ firm, createdAt: { $gte: lastMonthStart, $lt: thisMonthStart } }),

    Project.countDocuments({ firm, isArchived: { $ne: true } }),
    Project.countDocuments({ firm, createdAt: { $gte: thisMonthStart } }),
    Project.countDocuments({ firm, createdAt: { $gte: lastMonthStart, $lt: thisMonthStart } }),

    Booking.aggregate([{ $match: { firm } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Unit.aggregate([{ $match: { firm } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),

    Customer.countDocuments({ firm, status: CUSTOMER_STATUS.NEW }),
    FollowUp.countDocuments({ firm, status: FOLLOWUP_STATUS.SCHEDULED }),
    SiteVisit.countDocuments({ firm }),
    Booking.countDocuments({ firm }),
    Booking.countDocuments({ firm, status: BOOKING_STATUS.CONFIRMED }),

    Booking.find({ firm })
      .populate('customer', 'name').populate('project', 'name').populate('unit', 'unitNumber').populate('bookedBy', 'name')
      .sort({ createdAt: -1 }).limit(8).lean(),
    AuditLog.find({ firm }).populate('actor', 'name').sort({ createdAt: -1 }).limit(8).lean(),
  ])

  const revAll = revenueAllAgg[0]?.v || 0
  const revThis = revenueThisAgg[0]?.v || 0
  const revLast = revenueLastAgg[0]?.v || 0

  const kpis = {
    totalRevenue: { value: revAll, thisMonth: revThis, ...trend(revThis, revLast) },
    totalSales: { value: salesAll, thisMonth: salesThis, ...trend(salesThis, salesLast) },
    totalCustomers: { value: customersAll, thisMonth: customersThis, ...trend(customersThis, customersLast) },
    activeProjects: { value: activeProjects, thisMonth: projectsThis, ...trend(projectsThis, projectsLast) },
  }

  const statusMap = Object.fromEntries(statusAgg.map((r) => [r._id, r.count]))
  const salesStatus = {
    completed: statusMap[BOOKING_STATUS.CONFIRMED] || 0,
    pending: statusMap[BOOKING_STATUS.RESERVED] || 0,
    onHold: statusMap[BOOKING_STATUS.CANCELLED] || 0,
  }

  const inventory = Object.fromEntries(inventoryAgg.map((r) => [r._id, r.count]))
  const inventoryTotal = inventoryAgg.reduce((s, r) => s + r.count, 0)

  // Branch & employee leaderboards from confirmed bookings.
  const [branchPerf, empPerf] = await Promise.all([
    Booking.aggregate([
      { $match: { firm, status: BOOKING_STATUS.CONFIRMED } },
      { $lookup: { from: 'users', localField: 'bookedBy', foreignField: '_id', as: 'o' } },
      { $unwind: '$o' },
      { $group: { _id: '$o.branch', revenue: { $sum: bookingRevenue }, sales: { $sum: 1 } } },
      { $sort: { revenue: -1 } },
      { $limit: 5 },
    ]),
    Booking.aggregate([
      { $match: { firm, status: BOOKING_STATUS.CONFIRMED } },
      { $group: { _id: '$bookedBy', revenue: { $sum: bookingRevenue }, sales: { $sum: 1 } } },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'u' } },
      { $unwind: '$u' },
      { $project: { name: '$u.name', branch: '$u.branch', revenue: 1, sales: 1 } },
      { $sort: { revenue: -1 } },
      { $limit: 5 },
    ]),
  ])

  // Attendance today across the firm's operational staff.
  const today = new Date().toISOString().slice(0, 10)
  const [activeStaff, presentToday] = await Promise.all([
    User.countDocuments({ firm, isActive: true, role: { $in: [ROLES.SUB_ADMIN, ROLES.SALES_EXECUTIVE] } }),
    Attendance.countDocuments({ firm, date: today, status: { $ne: ATTENDANCE_STATUS.ABSENT } }),
  ])
  const attendance = {
    present: presentToday,
    absent: Math.max(0, activeStaff - presentToday),
    total: activeStaff,
    rate: activeStaff > 0 ? Math.round((presentToday / activeStaff) * 100) : null,
  }

  const pipeline = [
    { stage: 'New Leads', count: newLeads },
    { stage: 'Follow-ups', count: followUpsCount },
    { stage: 'Site Visits', count: visitsCount },
    { stage: 'Bookings', count: bookingsCount },
    { stage: 'Closed Sales', count: closedSales },
  ]

  return ok(res, {
    kpis,
    salesStatus,
    inventory: { ...inventory, total: inventoryTotal },
    branchPerformance: branchPerf.map((b, i) => ({ rank: i + 1, branch: b._id || 'Unassigned', revenue: b.revenue, sales: b.sales })),
    topEmployees: empPerf,
    pipeline,
    attendance,
    recentBookings,
    recentActivity,
  }, 'Admin overview')
})

// Per-employee performance for a sub-admin's team (spec §Team/Executive Performance).
async function teamPerformance(firm, team) {
  const ids = team.map((t) => t._id)
  const rev = { $ifNull: ['$totalValue', '$bookingAmount'] }
  const [leads, follows, visits, sales] = await Promise.all([
    Customer.aggregate([{ $match: { firm, assignedTo: { $in: ids } } }, { $group: { _id: '$assignedTo', c: { $sum: 1 } } }]),
    FollowUp.aggregate([{ $match: { firm, assignedTo: { $in: ids }, status: FOLLOWUP_STATUS.COMPLETED } }, { $group: { _id: '$assignedTo', c: { $sum: 1 } } }]),
    SiteVisit.aggregate([{ $match: { firm, assignedTo: { $in: ids } } }, { $group: { _id: '$assignedTo', c: { $sum: 1 } } }]),
    Booking.aggregate([{ $match: { firm, bookedBy: { $in: ids }, status: BOOKING_STATUS.CONFIRMED } }, { $group: { _id: '$bookedBy', c: { $sum: 1 }, rev: { $sum: rev } } }]),
  ])
  const map = (arr) => Object.fromEntries(arr.map((x) => [String(x._id), x]))
  const [L, F, V, S] = [map(leads), map(follows), map(visits), map(sales)]
  return team.map((t) => {
    const id = String(t._id)
    const revenue = S[id]?.rev || 0
    const target = t.targetRevenue || 0
    return {
      id: t._id, name: t.name,
      leadsAssigned: L[id]?.c || 0,
      followupsCompleted: F[id]?.c || 0,
      siteVisits: V[id]?.c || 0,
      bookings: S[id]?.c || 0,
      revenue,
      assignedTarget: target,
      completion: target > 0 ? Math.round((revenue / target) * 100) : null,
    }
  })
}

// GET /api/reports/sub-admin-overview — branch/team dashboard for a Sub-Admin.
// Scoped to the sub-admin's direct reports (manager = self) and managed branch.
export const subAdminOverview = asyncHandler(async (req, res) => {
  const firm = req.user.firm
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const todayStr = new Date().toISOString().slice(0, 10)

  const team = await User.find({ firm, manager: req.user._id }).select('_id name branch targetRevenue role isActive').lean()
  const teamIds = team.map((t) => t._id)
  const branch = await Branch.findOne({ firm, adminUser: req.user._id }).lean()
  const rev = { $ifNull: ['$totalValue', '$bookingAmount'] }

  const [
    todaysLeads, scheduledVisitsToday, monthlyBookings, revenueAgg,
    presentToday, onLeaveToday, pendingLeaves, reservedBookings, heldUnits, unassignedLeads,
    followDue, followCompleted, followOverdue,
    upcomingVisits, leadSourceAgg, recentActivity, collectedAgg, trendDocs,
  ] = await Promise.all([
    Customer.countDocuments({ firm, assignedTo: { $in: teamIds }, createdAt: { $gte: todayStart, $lte: todayEnd } }),
    SiteVisit.countDocuments({ firm, assignedTo: { $in: teamIds }, scheduledAt: { $gte: todayStart, $lte: todayEnd } }),
    Booking.countDocuments({ firm, bookedBy: { $in: teamIds }, createdAt: { $gte: monthStart } }),
    Booking.aggregate([{ $match: { firm, bookedBy: { $in: teamIds }, status: BOOKING_STATUS.CONFIRMED } }, { $group: { _id: null, v: { $sum: rev } } }]),
    Attendance.countDocuments({ firm, user: { $in: teamIds }, date: todayStr, status: { $ne: ATTENDANCE_STATUS.ABSENT } }),
    LeaveRequest.countDocuments({ firm, employee: { $in: teamIds }, status: 'approved', startDate: { $lte: todayEnd }, endDate: { $gte: todayStart } }),
    LeaveRequest.countDocuments({ firm, employee: { $in: teamIds }, status: 'pending' }),
    Booking.countDocuments({ firm, bookedBy: { $in: teamIds }, status: BOOKING_STATUS.RESERVED }),
    Unit.countDocuments({ firm, status: UNIT_STATUS.LOCKED }),
    Customer.countDocuments({ firm, assignedTo: null, status: { $in: [CUSTOMER_STATUS.NEW, CUSTOMER_STATUS.IN_PROGRESS] } }),
    FollowUp.countDocuments({ firm, assignedTo: { $in: teamIds }, status: FOLLOWUP_STATUS.SCHEDULED, scheduledAt: { $gte: todayStart, $lte: todayEnd } }),
    FollowUp.countDocuments({ firm, assignedTo: { $in: teamIds }, status: FOLLOWUP_STATUS.COMPLETED, updatedAt: { $gte: todayStart } }),
    FollowUp.countDocuments({ firm, assignedTo: { $in: teamIds }, status: FOLLOWUP_STATUS.SCHEDULED, scheduledAt: { $lt: todayStart } }),
    SiteVisit.find({ firm, assignedTo: { $in: teamIds }, scheduledAt: { $gte: todayStart }, status: VISIT_STATUS.SCHEDULED })
      .populate('customer', 'name').populate('project', 'name').populate('assignedTo', 'name').sort({ scheduledAt: 1 }).limit(8).lean(),
    Customer.aggregate([{ $match: { firm, assignedTo: { $in: teamIds } } }, { $group: { _id: '$source', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
    AuditLog.find({ firm, actor: { $in: [...teamIds, req.user._id] } }).populate('actor', 'name').sort({ createdAt: -1 }).limit(8).lean(),
    Booking.aggregate([
      { $match: { firm, bookedBy: { $in: teamIds } } },
      { $unwind: '$payments' },
      { $match: { 'payments.date': { $gte: todayStart, $lte: todayEnd } } },
      { $group: { _id: null, total: { $sum: '$payments.amount' } } },
    ]),
    Booking.find({ firm, bookedBy: { $in: teamIds }, status: BOOKING_STATUS.CONFIRMED, createdAt: { $gte: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6) } }).select('createdAt totalValue bookingAmount').lean(),
  ])

  const totalRevenue = revenueAgg[0]?.v || 0
  const target = branch?.monthlyTarget || 0

  // Weekly revenue trend (last 7 days).
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6)
  const order = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + i)
    order.push({ key: dateKey(d), label: WEEKDAYS[d.getDay()] })
  }
  const bucket = Object.fromEntries(order.map((o) => [o.key, 0]))
  for (const b of trendDocs) { const k = dateKey(new Date(b.createdAt)); if (k in bucket) bucket[k] += b.totalValue ?? b.bookingAmount ?? 0 }
  const revenueTrend = order.map((o) => ({ label: o.label, revenue: bucket[o.key] }))

  const perf = await teamPerformance(firm, team)

  // Top 3 critical alerts.
  const allAlerts = [
    { type: 'followup', label: 'Overdue follow-ups', count: followOverdue },
    { type: 'approval', label: 'Pending approvals', count: pendingLeaves },
    { type: 'booking', label: 'Bookings awaiting confirmation', count: reservedBookings },
    { type: 'inventory', label: 'Units on hold', count: heldUnits },
    { type: 'lead', label: 'Unassigned leads', count: unassignedLeads },
  ].filter((a) => a.count > 0)

  const pendingApprovals = pendingLeaves + reservedBookings

  return ok(res, {
    branch: branch?.name || req.user.branch || null,
    kpis: {
      todaysLeads,
      scheduledVisits: scheduledVisitsToday,
      monthlyBookings,
      totalRevenue,
      presentStaff: presentToday,
      staffOnLeave: onLeaveToday,
      pendingApprovals,
      branchTargetProgress: target > 0 ? Math.round((totalRevenue / target) * 100) : null,
      teamSize: teamIds.length,
      target,
    },
    topAlerts: allAlerts.slice(0, 3),
    alertsTotal: allAlerts.reduce((s, a) => s + a.count, 0),
    actionCenter: { pendingLeaves, reservedBookings, heldUnits, unassignedLeads, total: pendingLeaves + reservedBookings + heldUnits + unassignedLeads },
    followUps: { due: followDue, completed: followCompleted, overdue: followOverdue },
    upcomingVisits,
    teamPerformance: perf,
    paymentCollection: { collectedToday: collectedAgg[0]?.total || 0 },
    revenueTrend,
    leadSources: leadSourceAgg.map((r) => ({ source: r._id || 'other', count: r.count })),
    recentActivity,
  }, 'Sub-admin overview')
})

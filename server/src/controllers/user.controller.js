import User from '../models/User.js'
import Customer from '../models/Customer.js'
import FollowUp from '../models/FollowUp.js'
import Booking from '../models/Booking.js'
import Branch from '../models/Branch.js'
import Attendance from '../models/Attendance.js'
import Project from '../models/Project.js'
import SiteVisit from '../models/SiteVisit.js'
import AuditLog from '../models/AuditLog.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from '../utils/ApiError.js'
import { ok, created } from '../utils/apiResponse.js'
import { paginate } from '../utils/paginate.js'
import { writeAudit } from '../middleware/audit.js'
import { AUDIT_ACTIONS, MODULES, ROLES, ROLE_RANK, CUSTOMER_STATUS, BOOKING_STATUS, ATTENDANCE_STATUS } from '../config/constants.js'
import { firmScope } from '../middleware/tenantScope.js'

// Open (active) lead statuses — used for lead counts + reassignment.
const OPEN_LEAD_STATUSES = [CUSTOMER_STATUS.NEW, CUSTOMER_STATUS.IN_PROGRESS, CUSTOMER_STATUS.FOLLOW_UP_DUE]

// Attach per-user activeLeadsCount + revenueGenerated (used by the Admin roster).
async function attachUserMetrics(users) {
  if (!users.length) return users
  const ids = users.map((u) => u._id)
  const attCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const [leads, revenue, attendance] = await Promise.all([
    Customer.aggregate([
      { $match: { assignedTo: { $in: ids }, status: { $in: OPEN_LEAD_STATUSES } } },
      { $group: { _id: '$assignedTo', count: { $sum: 1 } } },
    ]),
    Booking.aggregate([
      { $match: { bookedBy: { $in: ids }, status: BOOKING_STATUS.CONFIRMED } },
      { $group: { _id: '$bookedBy', revenue: { $sum: { $ifNull: ['$totalValue', '$bookingAmount'] } }, bookingsCount: { $sum: 1 } } },
    ]),
    // Attendance over the last 30 days: present ratio per user.
    Attendance.aggregate([
      { $match: { user: { $in: ids }, date: { $gte: attCutoff } } },
      { $group: { _id: '$user', total: { $sum: 1 }, present: { $sum: { $cond: [{ $ne: ['$status', ATTENDANCE_STATUS.ABSENT] }, 1, 0] } } } },
    ]),
  ])
  const lc = Object.fromEntries(leads.map((r) => [String(r._id), r.count]))
  const rv = Object.fromEntries(revenue.map((r) => [String(r._id), r]))
  const at = Object.fromEntries(attendance.map((r) => [String(r._id), r]))
  return users.map((u) => {
    const a = at[String(u._id)]
    const revenue = rv[String(u._id)]?.revenue || 0
    return {
      ...u,
      activeLeadsCount: lc[String(u._id)] || 0,
      revenueGenerated: revenue,
      bookingsCount: rv[String(u._id)]?.bookingsCount || 0,
      attendanceRate: a?.total ? Math.round((a.present / a.total) * 100) : null,
      transferCount: (u.transferHistory || []).length,
      targetProgressPct: u.targetRevenue > 0 ? Math.min(999, Math.round((revenue / u.targetRevenue) * 100)) : null,
    }
  })
}

// Roles a given actor is allowed to create/manage (strictly lower rank).
function manageableRoles(actorRole) {
  if (actorRole === ROLES.ADMIN) return [ROLES.SUB_ADMIN, ROLES.SALES_EXECUTIVE]
  if (actorRole === ROLES.SUB_ADMIN) return [ROLES.SALES_EXECUTIVE]
  return []
}

// GET /api/users — staff within the actor's firm, optionally filtered by role.
// A sub-admin only sees executives (their manageable set).
export const listUsers = asyncHandler(async (req, res) => {
  const { page, limit, search, role, status } = req.query
  const filter = { ...firmScope(req.user) }

  if (req.user.role === ROLES.SUB_ADMIN) {
    filter.role = ROLES.SALES_EXECUTIVE
  } else if (role) {
    filter.role = role
  } else {
    filter.role = { $in: [ROLES.SUB_ADMIN, ROLES.SALES_EXECUTIVE] }
  }

  if (search) filter.$or = [{ name: { $regex: search, $options: 'i' } }, { email: { $regex: search, $options: 'i' } }]
  if (status === 'active') filter.isActive = true
  if (status === 'inactive') filter.isActive = false
  if (req.query.branch) filter.branch = req.query.branch

  const { data, meta } = await paginate(User, filter, {
    page,
    limit,
    populate: { path: 'manager', select: 'name email role' },
  })
  // Admin roster asks for per-user lead/revenue metrics.
  const out = req.query.withMetrics === 'true' ? await attachUserMetrics(data) : data
  return ok(res, out, 'Users fetched', meta)
})

// GET /api/users/stats — top KPI cards for the Admin Employees console.
export const employeeStats = asyncHandler(async (req, res) => {
  const scope = firmScope(req.user)
  const staffRoles = { role: { $in: [ROLES.SUB_ADMIN, ROLES.SALES_EXECUTIVE] } }
  const today = new Date().toISOString().slice(0, 10)

  const [totalEmployees, presentToday, revenueAgg] = await Promise.all([
    User.countDocuments({ ...scope, ...staffRoles, isActive: true }),
    Attendance.countDocuments({ ...scope, date: today, status: { $ne: ATTENDANCE_STATUS.ABSENT } }),
    Booking.aggregate([
      { $match: { ...scope, status: BOOKING_STATUS.CONFIRMED } },
      { $group: { _id: null, revenue: { $sum: { $ifNull: ['$totalValue', '$bookingAmount'] } }, sales: { $sum: 1 } } },
    ]),
  ])

  return ok(res, {
    totalEmployees,
    presentToday,
    totalRevenue: revenueAgg[0]?.revenue || 0,
    totalSales: revenueAgg[0]?.sales || 0,
  }, 'Employee stats')
})

// GET /api/users/:id — full employee profile with the 10 detail sections.
export const getUser = asyncHandler(async (req, res) => {
  const user = await User.findOne({ _id: req.params.id, ...firmScope(req.user) })
    .populate('manager', 'name email role')
    .populate('transferHistory.previousManager', 'name')
    .populate('transferHistory.newManager', 'name')
    .populate('transferHistory.approvedBy', 'name')
    .lean()
  if (!user) throw ApiError.notFound('User not found')

  const uid = user._id
  const attCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const [
    revenueAgg, completedSales, customersHandled, bookings, registrations,
    assignedLeads, activeLeads, closedLeads, lostLeads, followUps,
    attendanceAgg, projectRefs, recentAudit,
  ] = await Promise.all([
    Booking.aggregate([
      { $match: { bookedBy: uid, status: BOOKING_STATUS.CONFIRMED } },
      { $group: { _id: null, revenue: { $sum: { $ifNull: ['$totalValue', '$bookingAmount'] } } } },
    ]),
    Booking.countDocuments({ bookedBy: uid, status: BOOKING_STATUS.CONFIRMED }),
    Customer.countDocuments({ assignedTo: uid }),
    Booking.countDocuments({ bookedBy: uid }),
    Booking.countDocuments({ bookedBy: uid, status: BOOKING_STATUS.CONFIRMED }),

    Customer.countDocuments({ assignedTo: uid }),
    Customer.countDocuments({ assignedTo: uid, status: { $in: OPEN_LEAD_STATUSES } }),
    Customer.countDocuments({ assignedTo: uid, status: CUSTOMER_STATUS.BOOKED }),
    Customer.countDocuments({ assignedTo: uid, status: CUSTOMER_STATUS.LOST }),
    FollowUp.countDocuments({ assignedTo: uid }),

    Attendance.aggregate([
      { $match: { user: uid, date: { $gte: attCutoff } } },
      { $group: {
        _id: '$status',
        count: { $sum: 1 },
      } },
    ]),
    Booking.find({ bookedBy: uid }).distinct('project'),
    AuditLog.find({ $or: [{ actor: uid }, { targetId: uid }] }).sort({ createdAt: -1 }).limit(12).lean(),
  ])

  const revenue = revenueAgg[0]?.revenue || 0
  const attMap = Object.fromEntries(attendanceAgg.map((r) => [r._id, r.count]))
  const presentDays = (attMap[ATTENDANCE_STATUS.ON_TIME] || 0) + (attMap[ATTENDANCE_STATUS.LATE] || 0) + (attMap[ATTENDANCE_STATUS.HALF_DAY] || 0)
  const totalAttDays = attendanceAgg.reduce((s, r) => s + r.count, 0)

  const assignedProjects = await Project.find({ _id: { $in: projectRefs }, firm: req.user.firm })
    .populate('builder', 'name').select('name builder propertyType constructionStatus').lean()

  const targetSummary = {
    assignedTarget: user.targetRevenue || 0,
    achievedTarget: revenue,
    remainingTarget: Math.max(0, (user.targetRevenue || 0) - revenue),
    achievementPct: user.targetRevenue > 0 ? Math.round((revenue / user.targetRevenue) * 100) : null,
    status: user.targetRevenue > 0 ? (revenue >= user.targetRevenue ? 'completed' : revenue > 0 ? 'in_progress' : 'pending') : 'pending',
  }

  const salesPerformance = {
    revenueGenerated: revenue,
    completedSales,
    customersHandled,
    bookings,
    registrations,
    conversionRate: assignedLeads > 0 ? Math.round((closedLeads / assignedLeads) * 100) : 0,
  }

  const attendanceSummary = {
    presentDays,
    absentDays: attMap[ATTENDANCE_STATUS.ABSENT] || 0,
    lateCheckIns: attMap[ATTENDANCE_STATUS.LATE] || 0,
    attendancePct: totalAttDays > 0 ? Math.round((presentDays / totalAttDays) * 100) : null,
  }

  const leadSummary = { assignedLeads, activeLeads, closedLeads, lostLeads, followUps }

  const previousBranch = (user.transferHistory || []).length
    ? user.transferHistory[user.transferHistory.length - 1].fromBranch
    : null

  // Activity timeline: synthesised lifecycle milestones (created → transfers).
  const activityTimeline = [
    { at: user.createdAt, label: 'Employee created', meta: user.branch ? `Assigned to ${user.branch}` : null },
    ...(user.joiningDate ? [{ at: user.joiningDate, label: 'Joined the company' }] : []),
    ...(user.transferHistory || []).map((t) => ({ at: t.date, label: `Transferred ${t.fromBranch || '—'} → ${t.toBranch || '—'}`, meta: t.reason })),
  ].sort((a, b) => new Date(a.at) - new Date(b.at))

  return ok(res, {
    user,
    organization: {
      currentBranch: user.branch || null,
      assignedSubAdmin: user.manager || null,
      reportingManager: user.manager || null,
      previousBranch,
    },
    targetSummary,
    salesPerformance,
    attendanceSummary,
    leadSummary,
    assignedProjects,
    transferHistory: user.transferHistory || [],
    recentActivities: recentAudit,
    activityTimeline,
  }, 'Employee details')
})

// POST /api/users — create a sub-admin (by admin) or executive (by admin/sub-admin).
export const createUser = asyncHandler(async (req, res) => {
  const { role } = req.body
  if (!manageableRoles(req.user.role).includes(role)) {
    throw ApiError.forbidden(`You cannot create a ${role}`)
  }

  const exists = await User.findOne({ email: req.body.email })
  if (exists) throw ApiError.conflict('An account with that email already exists')

  // Auto-assign a sequential employee ID within the firm if none supplied.
  let employeeId = req.body.employeeId
  if (!employeeId) {
    const count = await User.countDocuments({ firm: req.user.firm, role: { $in: [ROLES.SUB_ADMIN, ROLES.SALES_EXECUTIVE] } })
    employeeId = `EMP-${String(count + 1).padStart(4, '0')}`
  }

  const user = await User.create({
    ...req.body,
    employeeId,
    joiningDate: req.body.joiningDate || new Date(),
    firm: req.user.firm, // scoped to creator's firm
    // Executives created by a sub-admin report to that sub-admin by default.
    manager: req.body.manager || (req.user.role === ROLES.SUB_ADMIN ? req.user._id : undefined),
    isActive: true,
    createdBy: req.user._id,
  })

  writeAudit({
    req,
    action: AUDIT_ACTIONS.CREATE,
    module: MODULES.USER,
    targetId: user._id,
    targetLabel: user.name,
    description: `Created ${role} ${user.email}`,
  })
  return created(res, user, 'User created')
})

// PATCH /api/users/:id
export const updateUser = asyncHandler(async (req, res) => {
  const target = await User.findOne({ _id: req.params.id, ...firmScope(req.user) })
  if (!target) throw ApiError.notFound('User not found')
  if (ROLE_RANK[req.user.role] <= ROLE_RANK[target.role]) {
    throw ApiError.forbidden('Cannot manage a user at or above your role')
  }

  const { permissions, ...rest } = req.body
  Object.assign(target, rest)
  if (permissions) target.permissions = permissions
  await target.save()

  writeAudit({
    req,
    action: AUDIT_ACTIONS.UPDATE,
    module: MODULES.USER,
    targetId: target._id,
    targetLabel: target.name,
    description: `Updated ${target.email}`,
  })
  return ok(res, target, 'User updated')
})

// PATCH /api/users/:id/deactivate — mandatory reassignment if active leads (§15).
export const deactivateUser = asyncHandler(async (req, res) => {
  const target = await User.findOne({ _id: req.params.id, ...firmScope(req.user) })
  if (!target) throw ApiError.notFound('User not found')
  if (ROLE_RANK[req.user.role] <= ROLE_RANK[target.role]) {
    throw ApiError.forbidden('Cannot manage a user at or above your role')
  }

  // Active (open) leads still assigned to this user?
  const openStatuses = [CUSTOMER_STATUS.NEW, CUSTOMER_STATUS.IN_PROGRESS, CUSTOMER_STATUS.FOLLOW_UP_DUE]
  const openCount = await Customer.countDocuments({
    assignedTo: target._id,
    status: { $in: openStatuses },
  })

  const { reassignTo } = req.body
  if (openCount > 0 && !reassignTo) {
    // Block disable — surface the count so the UI can prompt for reassignment.
    throw ApiError.conflict('Reassignment required before deactivation', {
      reason: 'active_leads',
      openLeads: openCount,
    })
  }

  if (openCount > 0 && reassignTo) {
    const newOwner = await User.findOne({ _id: reassignTo, ...firmScope(req.user), isActive: true })
    if (!newOwner) throw ApiError.badRequest('Reassignment target is invalid or inactive')

    await Customer.updateMany(
      { assignedTo: target._id, status: { $in: openStatuses } },
      { $set: { assignedTo: newOwner._id, assignedAt: new Date() } }
    )
    await FollowUp.updateMany(
      { assignedTo: target._id, status: 'scheduled' },
      { $set: { assignedTo: newOwner._id } }
    )
    writeAudit({
      req,
      action: AUDIT_ACTIONS.ASSIGN,
      module: MODULES.LEAD,
      targetId: target._id,
      description: `Reassigned ${openCount} open leads from ${target.email} to ${newOwner.email}`,
    })
  }

  target.isActive = false
  target.refreshTokens = []
  await target.save()

  writeAudit({
    req,
    action: AUDIT_ACTIONS.STATUS_CHANGE,
    module: MODULES.USER,
    targetId: target._id,
    targetLabel: target.name,
    description: `Deactivated ${target.email}`,
  })
  return ok(res, target, 'User deactivated')
})

// PATCH /api/users/:id/transfer — move an employee to another branch with the
// full workflow: reassign to a new sub-admin, choose whether existing leads &
// tasks move along, record the reason, and append an immutable history entry.
// transferLeads / transferTasks: true = they move with the employee (default),
// false = they stay behind (released to the branch pool). `leadAction` is still
// accepted for backward compatibility ('retain'|'reassign').
export const transferUser = asyncHandler(async (req, res) => {
  const target = await User.findOne({ _id: req.params.id, ...firmScope(req.user) })
  if (!target) throw ApiError.notFound('User not found')
  if (ROLE_RANK[req.user.role] <= ROLE_RANK[target.role]) {
    throw ApiError.forbidden('Cannot manage a user at or above your role')
  }

  const { branch, newManager, transferDate, reason } = req.body
  // Resolve lead/task handling from the new flags, falling back to leadAction.
  const transferLeads = req.body.transferLeads !== undefined ? req.body.transferLeads : req.body.leadAction !== 'reassign'
  const transferTasks = req.body.transferTasks !== undefined ? req.body.transferTasks : transferLeads

  const dest = await Branch.findOne({ ...firmScope(req.user), name: branch })
  if (!dest) throw ApiError.badRequest('Destination branch not found')

  // Validate the new sub-admin (must belong to the destination branch).
  let newMgr = null
  if (newManager) {
    newMgr = await User.findOne({ _id: newManager, ...firmScope(req.user), role: ROLES.SUB_ADMIN })
    if (!newMgr) throw ApiError.badRequest('Selected sub-admin is invalid')
  }

  const fromBranch = target.branch || '—'
  const prevManager = target.manager
  const prevManagerDoc = prevManager ? await User.findById(prevManager).select('name').lean() : null

  // Append the history entry BEFORE mutating current fields (snapshot names).
  target.transferHistory.push({
    date: transferDate ? new Date(transferDate) : new Date(),
    fromBranch,
    toBranch: branch,
    previousManager: prevManager || null,
    newManager: newMgr?._id || null,
    previousManagerName: prevManagerDoc?.name || null,
    newManagerName: newMgr?.name || null,
    approvedBy: req.user._id,
    approvedByName: req.user.name,
    reason: reason || null,
  })

  target.branch = branch
  if (newMgr) target.manager = newMgr._id
  await target.save()

  // Leads / tasks that DON'T move are released to the branch pool.
  let releasedLeads = 0
  let releasedTasks = 0
  if (!transferLeads) {
    const r = await Customer.updateMany(
      { assignedTo: target._id, status: { $in: OPEN_LEAD_STATUSES } },
      { $set: { assignedTo: null } }
    )
    releasedLeads = r.modifiedCount || 0
  }
  if (!transferTasks) {
    const r = await FollowUp.updateMany(
      { assignedTo: target._id, status: 'scheduled' },
      { $set: { assignedTo: null } }
    )
    releasedTasks = r.modifiedCount || 0
  }

  writeAudit({
    req,
    action: AUDIT_ACTIONS.UPDATE,
    module: MODULES.USER,
    targetId: target._id,
    targetLabel: target.name,
    description: `Transferred ${target.email} "${fromBranch}" → "${branch}"${reason ? ` (${reason})` : ''}${releasedLeads ? `, ${releasedLeads} leads released` : ''}`,
  })
  return ok(res, { ...target.toObject(), releasedLeads, releasedTasks }, `Transferred to ${branch}`)
})

// PATCH /api/users/:id/activate
export const activateUser = asyncHandler(async (req, res) => {
  const target = await User.findOne({ _id: req.params.id, ...firmScope(req.user) })
  if (!target) throw ApiError.notFound('User not found')
  target.isActive = true
  await target.save()
  writeAudit({
    req,
    action: AUDIT_ACTIONS.STATUS_CHANGE,
    module: MODULES.USER,
    targetId: target._id,
    targetLabel: target.name,
    description: `Activated ${target.email}`,
  })
  return ok(res, target, 'User activated')
})

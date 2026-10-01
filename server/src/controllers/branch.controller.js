import Branch from '../models/Branch.js'
import User from '../models/User.js'
import Booking from '../models/Booking.js'
import Customer from '../models/Customer.js'
import Project from '../models/Project.js'
import Unit from '../models/Unit.js'
import Attendance from '../models/Attendance.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from '../utils/ApiError.js'
import { ok, created } from '../utils/apiResponse.js'
import { writeAudit } from '../middleware/audit.js'
import { AUDIT_ACTIONS, MODULES, ROLES, BOOKING_STATUS, ATTENDANCE_STATUS } from '../config/constants.js'
import { firmScope } from '../middleware/tenantScope.js'

// Build per-branch metric maps (keyed by branch name) for a firm. Metrics are
// derived at read time because users link to a branch by the `User.branch` string.
async function computeBranchMetrics(firm) {
  const today = new Date().toISOString().slice(0, 10)

  const [agents, sales, bookings, customers, attendance] = await Promise.all([
    // Active agents (sub-admins + executives) per branch.
    User.aggregate([
      { $match: { firm, isActive: true, role: { $in: [ROLES.SUB_ADMIN, ROLES.SALES_EXECUTIVE] } } },
      { $group: { _id: '$branch', count: { $sum: 1 } } },
    ]),
    // Confirmed-booking revenue + count per branch (join booking → booking owner).
    Booking.aggregate([
      { $match: { firm, status: BOOKING_STATUS.CONFIRMED } },
      { $lookup: { from: 'users', localField: 'bookedBy', foreignField: '_id', as: 'owner' } },
      { $unwind: '$owner' },
      { $group: { _id: '$owner.branch', revenue: { $sum: { $ifNull: ['$totalValue', '$bookingAmount'] } }, salesCount: { $sum: 1 } } },
    ]),
    // All-status booking count + distinct projects touched per branch.
    Booking.aggregate([
      { $match: { firm } },
      { $lookup: { from: 'users', localField: 'bookedBy', foreignField: '_id', as: 'owner' } },
      { $unwind: '$owner' },
      { $group: { _id: '$owner.branch', bookingsCount: { $sum: 1 }, projects: { $addToSet: '$project' } } },
    ]),
    // Customers per branch (attributed via the assigned executive's branch).
    Customer.aggregate([
      { $match: { firm } },
      { $lookup: { from: 'users', localField: 'assignedTo', foreignField: '_id', as: 'a' } },
      { $unwind: '$a' },
      { $group: { _id: '$a.branch', count: { $sum: 1 } } },
    ]),
    // Today's check-ins per branch (anyone not marked absent counts as present).
    Attendance.aggregate([
      { $match: { firm, date: today } },
      { $lookup: { from: 'users', localField: 'user', foreignField: '_id', as: 'u' } },
      { $unwind: '$u' },
      { $group: {
        _id: '$u.branch',
        present: { $sum: { $cond: [{ $ne: ['$status', ATTENDANCE_STATUS.ABSENT] }, 1, 0] } },
      } },
    ]),
  ])

  const toMap = (rows) => Object.fromEntries(rows.map((r) => [r._id || '', r]))
  return {
    agents: toMap(agents),
    sales: toMap(sales),
    bookings: toMap(bookings),
    customers: toMap(customers),
    attendance: toMap(attendance),
  }
}

// Derive the target-completion state for a revenue figure vs its target
// (spec: Not Started / In Progress / Completed / Exceeded).
function targetStatus(revenue, target) {
  if (!target || target <= 0) return { label: 'No Target', completion: null }
  const completion = Math.round((revenue / target) * 100)
  const label = completion > 100 ? 'Exceeded' : completion >= 100 ? 'Completed' : completion > 0 ? 'In Progress' : 'Not Started'
  return { label, completion }
}

// Decorate a lean branch doc with its live metrics.
function decorateBranch(b, m) {
  const activeUsers = m.agents[b.name]?.count || 0
  const present = m.attendance[b.name]?.present || 0
  const revenue = m.sales[b.name]?.revenue || 0
  const ts = targetStatus(revenue, b.monthlyTarget)
  return {
    ...b,
    activeUsers,
    salesCount: m.sales[b.name]?.salesCount || 0,
    revenue,
    bookingsCount: m.bookings[b.name]?.bookingsCount || 0,
    projectsCount: (m.bookings[b.name]?.projects || []).length,
    customersCount: m.customers[b.name]?.count || 0,
    attendanceRate: activeUsers > 0 ? Math.round((present / activeUsers) * 100) : null,
    targetStatus: ts.label,
    targetCompletion: ts.completion,
  }
}

// GET /api/branches — firm-scoped branch list with live metrics attached.
export const listBranches = asyncHandler(async (req, res) => {
  const { search, status, city } = req.query
  const filter = { ...firmScope(req.user) }
  if (status && status !== 'all') filter.status = status
  if (city) filter.city = { $regex: city, $options: 'i' }
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { code: { $regex: search, $options: 'i' } },
      { city: { $regex: search, $options: 'i' } },
    ]
  }

  const branches = await Branch.find(filter)
    .populate('adminUser', 'name email')
    .sort({ createdAt: 1 })
    .lean()

  const metrics = await computeBranchMetrics(req.user.firm)
  const data = branches.map((b) => decorateBranch(b, metrics))
  return ok(res, data, 'Branches fetched')
})

// GET /api/branches/comparison — side-by-side branch table + firm-wide totals.
export const branchComparison = asyncHandler(async (req, res) => {
  const branches = await Branch.find({ ...firmScope(req.user) })
    .populate('adminUser', 'name email')
    .sort({ createdAt: 1 })
    .lean()

  const metrics = await computeBranchMetrics(req.user.firm)
  const rows = branches.map((b) => {
    const d = decorateBranch(b, metrics)
    const completion = b.monthlyTarget > 0 ? Math.round((d.revenue / b.monthlyTarget) * 100) : null
    return {
      _id: b._id,
      name: b.name,
      code: b.code,
      city: b.city,
      adminUser: b.adminUser,
      status: b.status,
      employees: d.activeUsers,
      customers: d.customersCount,
      revenue: d.revenue,
      sales: d.salesCount,
      bookings: d.bookingsCount,
      revenueTarget: b.monthlyTarget || 0,
      salesTarget: b.salesTarget || 0,
      bookingTarget: b.bookingTarget || 0,
      completion,
      targetStatus: d.targetStatus,
    }
  })

  const totals = rows.reduce(
    (t, r) => ({
      branches: t.branches + 1,
      employees: t.employees + r.employees,
      revenue: t.revenue + r.revenue,
      sales: t.sales + r.sales,
      customers: t.customers + r.customers,
      bookings: t.bookings + r.bookings,
    }),
    { branches: 0, employees: 0, revenue: 0, sales: 0, customers: 0, bookings: 0 }
  )

  return ok(res, { rows, totals }, 'Branch comparison fetched')
})

// GET /api/branches/:id — branch details with performance summary and sections.
export const getBranch = asyncHandler(async (req, res) => {
  const branch = await Branch.findOne({ _id: req.params.id, ...firmScope(req.user) })
    .populate('adminUser', 'name email phone')
    .lean()
  if (!branch) throw ApiError.notFound('Branch not found')

  const firm = req.user.firm
  const metrics = await computeBranchMetrics(firm)
  const decorated = decorateBranch(branch, metrics)

  // Employees of this branch (attributed by the User.branch string).
  const employees = await User.find({
    firm,
    branch: branch.name,
    role: { $in: [ROLES.SUB_ADMIN, ROLES.SALES_EXECUTIVE] },
  })
    .select('_id name role isActive email phone')
    .lean()
  const employeeIds = employees.map((e) => e._id)

  // Recent bookings owned by this branch's staff.
  const recentBookings = await Booking.find({ firm, bookedBy: { $in: employeeIds } })
    .populate('customer', 'name')
    .populate('project', 'name')
    .populate('unit', 'unitNumber')
    .populate('bookedBy', 'name')
    .sort({ createdAt: -1 })
    .limit(10)
    .lean()

  // Active projects (firm reference catalog — projects are firm-scoped).
  const activeProjects = await Project.find({ firm, isArchived: { $ne: true } })
    .populate('builder', 'name')
    .select('name builder propertyType constructionStatus')
    .sort({ createdAt: -1 })
    .limit(12)
    .lean()

  // Firm inventory status summary (units are firm-scoped, not branch-scoped).
  const inventoryAgg = await Unit.aggregate([
    { $match: { firm } },
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ])
  const inventory = Object.fromEntries(inventoryAgg.map((r) => [r._id, r.count]))

  // Attendance summary for the branch today.
  const today = new Date().toISOString().slice(0, 10)
  const attendanceRows = await Attendance.find({ firm, date: today, user: { $in: employeeIds } })
    .select('status')
    .lean()
  const present = attendanceRows.filter((a) => a.status !== ATTENDANCE_STATUS.ABSENT).length
  const attendanceSummary = {
    total: employeeIds.length,
    present,
    absent: employeeIds.length - present,
    rate: employeeIds.length > 0 ? Math.round((present / employeeIds.length) * 100) : null,
  }

  const bookedCustomers = await Customer.countDocuments({ firm, assignedTo: { $in: employeeIds }, status: 'booked' })
  const performance = {
    revenue: decorated.revenue,
    sales: decorated.salesCount,
    customers: decorated.customersCount,
    bookings: decorated.bookingsCount,
    conversionRate: decorated.customersCount > 0 ? Math.round((bookedCustomers / decorated.customersCount) * 100) : 0,
  }

  return ok(res, {
    branch: decorated,
    performance,
    employees,
    recentBookings,
    activeProjects,
    inventory,
    attendanceSummary,
  }, 'Branch details fetched')
})

// POST /api/branches
export const createBranch = asyncHandler(async (req, res) => {
  const { name, code, region, city, address, contactNumber, email, adminUser, monthlyTarget, salesTarget, bookingTarget, targetPeriod } = req.body

  const exists = await Branch.findOne({ ...firmScope(req.user), name })
  if (exists) throw ApiError.conflict('A branch with that name already exists')

  const branch = await Branch.create({
    firm: req.user.firm,
    name,
    code,
    region,
    city,
    address,
    contactNumber,
    email,
    adminUser: adminUser || null,
    monthlyTarget: monthlyTarget || 0,
    salesTarget: salesTarget || 0,
    bookingTarget: bookingTarget || 0,
    targetPeriod: targetPeriod || 'monthly',
    createdBy: req.user._id,
  })

  writeAudit({ req, action: AUDIT_ACTIONS.CREATE, module: MODULES.BRANCH, targetId: branch._id, targetLabel: branch.name, description: `Created branch ${branch.name}` })
  return created(res, branch, 'Branch created')
})

// PATCH /api/branches/:id — renaming a branch re-points its users' `branch` string.
export const updateBranch = asyncHandler(async (req, res) => {
  const branch = await Branch.findOne({ _id: req.params.id, ...firmScope(req.user) })
  if (!branch) throw ApiError.notFound('Branch not found')

  const { name, code, region, city, address, contactNumber, email, adminUser, monthlyTarget } = req.body
  const oldName = branch.name

  if (name !== undefined && name !== oldName) {
    const clash = await Branch.findOne({ ...firmScope(req.user), name, _id: { $ne: branch._id } })
    if (clash) throw ApiError.conflict('A branch with that name already exists')
    branch.name = name
    // Keep users pointing at the branch (they reference it by name).
    await User.updateMany({ ...firmScope(req.user), branch: oldName }, { $set: { branch: name } })
  }
  if (code !== undefined) branch.code = code
  if (region !== undefined) branch.region = region
  if (city !== undefined) branch.city = city
  if (address !== undefined) branch.address = address
  if (contactNumber !== undefined) branch.contactNumber = contactNumber
  if (email !== undefined) branch.email = email
  if (adminUser !== undefined) branch.adminUser = adminUser || null
  if (monthlyTarget !== undefined) branch.monthlyTarget = monthlyTarget

  await branch.save()
  writeAudit({ req, action: AUDIT_ACTIONS.UPDATE, module: MODULES.BRANCH, targetId: branch._id, targetLabel: branch.name, description: `Updated branch ${branch.name}` })
  return ok(res, branch, 'Branch updated')
})

// PATCH /api/branches/:id/targets — assign sales / revenue / booking targets.
export const setBranchTargets = asyncHandler(async (req, res) => {
  const branch = await Branch.findOne({ _id: req.params.id, ...firmScope(req.user) })
  if (!branch) throw ApiError.notFound('Branch not found')

  const { monthlyTarget, salesTarget, bookingTarget, targetPeriod, targetStartDate, targetEndDate, targetRemarks } = req.body
  if (monthlyTarget !== undefined) branch.monthlyTarget = monthlyTarget
  if (salesTarget !== undefined) branch.salesTarget = salesTarget
  if (bookingTarget !== undefined) branch.bookingTarget = bookingTarget
  if (targetPeriod !== undefined) branch.targetPeriod = targetPeriod
  if (targetStartDate !== undefined) branch.targetStartDate = targetStartDate || null
  if (targetEndDate !== undefined) branch.targetEndDate = targetEndDate || null
  if (targetRemarks !== undefined) branch.targetRemarks = targetRemarks

  await branch.save()
  writeAudit({ req, action: AUDIT_ACTIONS.UPDATE, module: MODULES.BRANCH, targetId: branch._id, targetLabel: branch.name, description: `Updated targets for ${branch.name}` })
  return ok(res, branch, 'Targets updated')
})

// PATCH /api/branches/:id/status — enable/disable a branch.
export const setBranchStatus = asyncHandler(async (req, res) => {
  const branch = await Branch.findOne({ _id: req.params.id, ...firmScope(req.user) })
  if (!branch) throw ApiError.notFound('Branch not found')
  branch.status = req.body.status
  await branch.save()
  writeAudit({ req, action: AUDIT_ACTIONS.STATUS_CHANGE, module: MODULES.BRANCH, targetId: branch._id, targetLabel: branch.name, description: `Set branch ${branch.name} to ${branch.status}` })
  return ok(res, branch, `Branch ${branch.status === 'active' ? 'activated' : 'disabled'}`)
})

// DELETE /api/branches/:id — blocked if the branch still has staff or bookings
// (data safety: never orphan employees or historical bookings).
export const deleteBranch = asyncHandler(async (req, res) => {
  const branch = await Branch.findOne({ _id: req.params.id, ...firmScope(req.user) })
  if (!branch) throw ApiError.notFound('Branch not found')

  const staffCount = await User.countDocuments({ firm: req.user.firm, branch: branch.name })
  if (staffCount > 0) {
    throw ApiError.conflict(`Cannot delete: ${staffCount} employee(s) are still assigned to this branch. Transfer them first.`)
  }

  await branch.deleteOne()
  writeAudit({ req, action: AUDIT_ACTIONS.DELETE, module: MODULES.BRANCH, targetId: branch._id, targetLabel: branch.name, description: `Deleted branch ${branch.name}` })
  return ok(res, { _id: branch._id }, 'Branch deleted')
})

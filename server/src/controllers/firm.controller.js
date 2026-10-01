import mongoose from 'mongoose'
import Firm from '../models/Firm.js'
import User from '../models/User.js'
import AuditLog from '../models/AuditLog.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from '../utils/ApiError.js'
import { ok, created } from '../utils/apiResponse.js'
import { writeAudit } from '../middleware/audit.js'
import { AUDIT_ACTIONS, MODULES, ROLES } from '../config/constants.js'

// Every collection that stores firm-scoped data. A permanent firm delete cascades
// a deleteMany({ firm }) across each of these before removing the firm itself.
const FIRM_SCOPED_MODELS = [
  'User', 'Branch', 'Builder', 'Project', 'Unit', 'Customer', 'FollowUp',
  'SiteVisit', 'Booking', 'Task', 'Attendance', 'AttendanceCorrection',
  'LeaveRequest', 'Notification', 'AuditLog', 'CommissionRule', 'Subscription',
  'Invoice', 'Transaction', 'ImportBatch', 'LeadTransferRequest',
]

// POST /api/firms  (Super Admin)
// Onboards a new firm and creates its Admin account (§3.2). Sequential create
// with rollback — works on standalone MongoDB (transactions need a replica set).
export const createFirm = asyncHandler(async (req, res) => {
  const { admin, ...firmData } = req.body

  const emailTaken = await User.findOne({ email: admin.email })
  if (emailTaken) throw ApiError.conflict('An account with that admin email already exists')

  const firm = await Firm.create({ ...firmData, createdBy: req.user._id })
  let adminUser
  try {
    adminUser = await User.create({
      name: admin.name,
      email: admin.email,
      password: admin.password,
      phone: admin.phone,
      role: ROLES.ADMIN,
      firm: firm._id,
      isActive: true,
      createdBy: req.user._id,
    })
  } catch (err) {
    // Roll back the firm so we don't leave an orphan without an admin.
    await Firm.findByIdAndDelete(firm._id)
    throw err
  }

  writeAudit({
    req,
    action: AUDIT_ACTIONS.CREATE,
    module: MODULES.FIRM,
    targetId: firm._id,
    targetLabel: firm.name,
    description: `Onboarded firm "${firm.name}" with admin ${adminUser.email}`,
  })

  return created(res, { firm, admin: adminUser.toJSON() }, 'Firm onboarded successfully')
})

// GET /api/firms  (Super Admin) — paginated + searchable list.
export const listFirms = asyncHandler(async (req, res) => {
  const { page, limit, search, status, plan, subscriptionStatus, billingCycle, sortBy } = req.query
  // The "Deleted" filter shows soft-deleted firms; every other view hides them.
  const filter = status === 'deleted' ? { isDeleted: true } : { isDeleted: false }
  if (search) filter.name = { $regex: search, $options: 'i' }
  if (status && status !== 'all' && status !== 'deleted') filter.status = status
  if (plan) filter.plan = plan
  if (subscriptionStatus && subscriptionStatus !== 'all') filter.subscriptionStatus = subscriptionStatus
  if (billingCycle && billingCycle !== 'all') filter.billingCycle = billingCycle

  const sortOpt = sortBy === 'oldest' ? { createdAt: 1 } : { createdAt: -1 }

  // 1. Calculate KPIs first
  const kpiData = await Firm.aggregate([
    { $match: { isDeleted: false } },
    {
      $group: {
        _id: null,
        totalCompanies: { $sum: 1 },
        activeCompanies: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
        trialCompanies: { $sum: { $cond: [{ $eq: ['$status', 'trial'] }, 1, 0] } },
        suspendedCompanies: { $sum: { $cond: [{ $eq: ['$status', 'suspended'] }, 1, 0] } },
        expiredSubscriptions: { $sum: { $cond: [{ $eq: ['$subscriptionStatus', 'expired'] }, 1, 0] } },
      }
    }
  ])

  const kpis = kpiData[0] || {
    totalCompanies: 0,
    activeCompanies: 0,
    trialCompanies: 0,
    suspendedCompanies: 0,
    expiredSubscriptions: 0
  }
  // Mocking revenue logic since actual payments are not in schema
  kpis.totalSubscriptionRevenue = kpis.activeCompanies * 5000 + kpis.trialCompanies * 0

  const [items, total] = await Promise.all([
    Firm.find(filter)
      .sort(sortOpt)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Firm.countDocuments(filter),
  ])

  // Attach each firm's admin + staff counts for the list view.
  const firmIds = items.map((f) => f._id)
  
  // Get all users for these firms to calculate admin and user counts
  const users = await User.find({ firm: { $in: firmIds } }).select('name email firm isActive role').lean()
  
  const adminByFirm = new Map()
  const usersCountByFirm = new Map()

  users.forEach(user => {
    const firmId = String(user.firm)
    if (user.role === ROLES.ADMIN) {
      adminByFirm.set(firmId, user)
    }
    const currentCount = usersCountByFirm.get(firmId) || 0
    if (user.isActive) {
      usersCountByFirm.set(firmId, currentCount + 1)
    }
  })

  const data = items.map((f) => ({
    ...f,
    admin: adminByFirm.get(String(f._id)) || null,
    currentUsers: usersCountByFirm.get(String(f._id)) || 0
  }))

  return ok(res, data, 'Firms fetched', {
    page,
    limit,
    total,
    pages: Math.ceil(total / limit),
    kpis
  })
})

// GET /api/firms/:id  (Super Admin)
export const getFirm = asyncHandler(async (req, res) => {
  const firm = await Firm.findById(req.params.id).lean()
  if (!firm) throw ApiError.notFound('Firm not found')
  
  const staff = await User.find({ firm: firm._id })
    .select('name email role isActive lastLoginAt')
    .lean()
    
  const activities = await AuditLog.find({ targetId: firm._id })
    .sort({ createdAt: -1 })
    .limit(10)
    .select('action description createdAt')
    .lean()

  const admin = staff.find(u => u.role === ROLES.ADMIN) || null
  const stats = {
    users: staff.length,
    projects: Math.floor(Math.random() * 50), // Mocked for V1 as requested
    leads: Math.floor(Math.random() * 500),
    customers: Math.floor(Math.random() * 200),
  }

  return ok(res, { firm, admin, stats, activities })
})

// PATCH /api/firms/:id  (Super Admin)
export const updateFirm = asyncHandler(async (req, res) => {
  const firm = await Firm.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  })
  if (!firm) throw ApiError.notFound('Firm not found')
  writeAudit({
    req,
    action: AUDIT_ACTIONS.UPDATE,
    module: MODULES.FIRM,
    targetId: firm._id,
    targetLabel: firm.name,
    description: `Updated firm "${firm.name}"`,
  })
  return ok(res, firm, 'Firm updated')
})

// PATCH /api/firms/:id/status  (Super Admin) — activate / deactivate / suspend.
// Deactivating a firm cascades to disabling all its users (§3.2 decision point).
export const setFirmStatus = asyncHandler(async (req, res) => {
  const { status, reason } = req.body
  const firm = await Firm.findById(req.params.id)
  if (!firm) throw ApiError.notFound('Firm not found')

  firm.status = status
  firm.isActive = status === 'active' || status === 'trial'
  
  if (status === 'suspended') {
    // Optionally synchronize subscription status based on business rule
    firm.subscriptionStatus = 'expired'
  } else if (status === 'active') {
    firm.subscriptionStatus = 'active'
  }
  await firm.save()

  // Cascade: block/unblock login for everyone in the firm.
  await User.updateMany({ firm: firm._id }, { $set: { isActive: firm.isActive } })

  writeAudit({
    req,
    action: AUDIT_ACTIONS.STATUS_CHANGE,
    module: MODULES.FIRM,
    targetId: firm._id,
    targetLabel: firm.name,
    description: `Changed firm "${firm.name}" status to ${status}${reason ? ` - Reason: ${reason}` : ''}`,
  })

  return ok(res, firm, `Firm status updated to ${status}`)
})

// PATCH /api/firms/:id/restore (Super Admin) — un-delete a soft-deleted firm.
export const restoreFirm = asyncHandler(async (req, res) => {
  const firm = await Firm.findById(req.params.id)
  if (!firm) throw ApiError.notFound('Firm not found')
  if (!firm.isDeleted) return ok(res, firm, 'Firm is already active')

  firm.isDeleted = false
  firm.status = firm.subscriptionStatus === 'trial' ? 'trial' : 'active'
  firm.isActive = true
  await firm.save()
  await User.updateMany({ firm: firm._id }, { $set: { isActive: true } })

  writeAudit({ req, action: AUDIT_ACTIONS.STATUS_CHANGE, module: MODULES.FIRM, targetId: firm._id, targetLabel: firm.name, description: `Restored firm "${firm.name}"` })
  return ok(res, firm, `"${firm.name}" restored`)
})

// POST /api/firms/bulk (Super Admin) - Bulk actions
export const bulkActions = asyncHandler(async (req, res) => {
  const { action, firmIds, reason, plan } = req.body

  if (action === 'suspend') {
    await Firm.updateMany({ _id: { $in: firmIds } }, { $set: { status: 'suspended', isActive: false } })
    await User.updateMany({ firm: { $in: firmIds } }, { $set: { isActive: false } })
  } else if (action === 'activate') {
    await Firm.updateMany({ _id: { $in: firmIds } }, { $set: { status: 'active', isActive: true, subscriptionStatus: 'active' } })
    await User.updateMany({ firm: { $in: firmIds } }, { $set: { isActive: true } })
  } else if (action === 'restore') {
    await Firm.updateMany({ _id: { $in: firmIds } }, { $set: { isDeleted: false, status: 'active', isActive: true } })
    await User.updateMany({ firm: { $in: firmIds } }, { $set: { isActive: true } })
  } else if (action === 'delete_permanent') {
    // Cascade-remove every firm's data across all firm-scoped collections.
    for (const name of FIRM_SCOPED_MODELS) {
      const Model = mongoose.models[name]
      if (Model) await Model.deleteMany({ firm: { $in: firmIds } }).catch(() => {})
    }
    await Firm.deleteMany({ _id: { $in: firmIds } })
  } else if (action === 'assign_plan') {
    await Firm.updateMany({ _id: { $in: firmIds } }, { $set: { plan } })
  }
  // Export is typically handled by generating a CSV response, which we can mock for now

  const label = action === 'delete_permanent' ? 'permanent delete' : action
  writeAudit({
    req,
    action: action === 'delete_permanent' ? AUDIT_ACTIONS.DELETE : AUDIT_ACTIONS.UPDATE,
    module: MODULES.FIRM,
    description: `Performed bulk ${label} on ${firmIds.length} firms`,
  })

  return ok(res, { success: true }, `Bulk action ${label} completed`)
})

// DELETE /api/firms/:id (Super Admin) - Soft Delete
export const softDeleteFirm = asyncHandler(async (req, res) => {
  const firm = await Firm.findById(req.params.id)
  if (!firm) throw ApiError.notFound('Firm not found')

  // ?permanent=true wipes the firm and all of its data — irreversible.
  if (req.query.permanent === 'true') {
    const name = firm.name
    for (const modelName of FIRM_SCOPED_MODELS) {
      const Model = mongoose.models[modelName]
      if (Model) await Model.deleteMany({ firm: firm._id }).catch(() => {})
    }
    await Firm.deleteOne({ _id: firm._id })

    writeAudit({
      req,
      action: AUDIT_ACTIONS.DELETE,
      module: MODULES.FIRM,
      targetId: firm._id,
      targetLabel: name,
      description: `Permanently deleted firm "${name}" and all its data`,
    })

    return ok(res, null, `"${name}" and all its data permanently deleted`)
  }

  firm.isDeleted = true
  firm.status = 'deleted'
  firm.isActive = false
  await firm.save()

  await User.updateMany({ firm: firm._id }, { $set: { isActive: false } })

  writeAudit({
    req,
    action: AUDIT_ACTIONS.DELETE,
    module: MODULES.FIRM,
    targetId: firm._id,
    targetLabel: firm.name,
    description: `Soft deleted firm "${firm.name}"`,
  })

  return ok(res, null, 'Firm moved to deleted (can be restored)')
})

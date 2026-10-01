import mongoose from 'mongoose'
import Expense from '../models/Expense.js'
import ExpenseCategory from '../models/ExpenseCategory.js'
import Project from '../models/Project.js'
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
import { EXPENSE_PAYMENT_METHODS, EXPENSE_STATUS, COUNTED_STATUSES, DEPARTMENTS, DEFAULT_CATEGORIES } from '../config/expense.js'

const LARGE_EXPENSE_THRESHOLD = 100000 // ₹1L — "Large expense recorded" notification

// ── Helpers ──────────────────────────────────────────────────────────────────
const canVerify = (u) => can(u, MODULES.EXPENSE, 'verify')
const canDelete = (u) => can(u, MODULES.EXPENSE, 'delete')
const canManageCategories = (u) => can(u, MODULES.EXPENSE, 'edit')

const baseFilter = (user) => ({ firm: user.firm, isDeleted: { $ne: true } })
// Executives see only expenses they created (§Visibility Rules).
const scopeClause = (user) => (user.role === ROLES.SALES_EXECUTIVE ? [{ createdBy: user._id }] : [])

async function notifyManagers(firm, payload, excludeId) {
  if (!firm) return
  const managers = await User.find({ firm, role: { $in: [ROLES.ADMIN, ROLES.SUB_ADMIN] }, isActive: true }).select('_id').lean()
  await notifyMany(managers.map((m) => m._id).filter((id) => String(id) !== String(excludeId)), payload)
}
function logActivity(expense, type, note, user) {
  expense.activity.push({ type, note, actor: user._id, actorName: user.name })
}

// Provision the default category set for a firm on first use (§Categories).
async function ensureDefaultCategories(firm) {
  const count = await ExpenseCategory.countDocuments({ firm })
  if (count > 0) return
  await ExpenseCategory.insertMany(DEFAULT_CATEGORIES.map((c) => ({ ...c, firm })), { ordered: false }).catch(() => {})
}

async function assertUniqueRef(firm, referenceNumber, exceptId) {
  if (!referenceNumber) return
  const clash = await Expense.findOne({ firm, referenceNumber, isDeleted: { $ne: true }, ...(exceptId ? { _id: { $ne: exceptId } } : {}) }).select('_id').lean()
  if (clash) throw ApiError.conflict('An expense with this reference number already exists')
}

// ── Config ───────────────────────────────────────────────────────────────────
// `departments` is the app-wide list: the standard set plus any department
// actually assigned to an employee in this firm (deduped, standard order first).
export const getConfig = asyncHandler(async (req, res) => {
  const used = await User.distinct('department', { firm: req.user.firm, department: { $nin: [null, ''] } })
  const extras = [...new Set(used.map((d) => (d || '').trim()).filter(Boolean))].filter((d) => !DEPARTMENTS.includes(d)).sort((a, b) => a.localeCompare(b))
  return ok(res, { paymentMethods: EXPENSE_PAYMENT_METHODS, statuses: EXPENSE_STATUS, departments: [...DEPARTMENTS, ...extras] })
})

// ── Categories ───────────────────────────────────────────────────────────────
export const listCategories = asyncHandler(async (req, res) => {
  await ensureDefaultCategories(req.user.firm)
  const cats = await ExpenseCategory.find({ firm: req.user.firm }).sort({ name: 1 }).lean()
  // Attach usage counts.
  const counts = await Expense.aggregate([
    { $match: { firm: req.user.firm, isDeleted: { $ne: true } } },
    { $group: { _id: '$category', n: { $sum: 1 }, amount: { $sum: '$amount' } } },
  ])
  const byId = Object.fromEntries(counts.map((c) => [String(c._id), c]))
  return ok(res, cats.map((c) => ({ ...c, usage: byId[String(c._id)]?.n || 0, amount: byId[String(c._id)]?.amount || 0 })))
})

export const createCategory = asyncHandler(async (req, res) => {
  if (!canManageCategories(req.user)) throw ApiError.forbidden('Not permitted to manage categories')
  const exists = await ExpenseCategory.findOne({ firm: req.user.firm, name: new RegExp(`^${req.body.name}$`, 'i') })
  if (exists) throw ApiError.conflict('A category with that name already exists')
  const cat = await ExpenseCategory.create({ firm: req.user.firm, name: req.body.name, group: req.body.group || 'general', createdBy: req.user._id })
  writeAudit({ req, action: AUDIT_ACTIONS.CREATE, module: MODULES.EXPENSE, targetId: cat._id, targetLabel: cat.name, description: `Created expense category "${cat.name}"` })
  return created(res, cat, 'Category created')
})

export const updateCategory = asyncHandler(async (req, res) => {
  if (!canManageCategories(req.user)) throw ApiError.forbidden('Not permitted to manage categories')
  const cat = await ExpenseCategory.findOne({ _id: req.params.id, firm: req.user.firm })
  if (!cat) throw ApiError.notFound('Category not found')
  for (const f of ['name', 'group', 'active']) if (req.body[f] !== undefined) cat[f] = req.body[f]
  await cat.save()
  // Keep denormalized names/groups on expenses in sync.
  await Expense.updateMany({ firm: req.user.firm, category: cat._id }, { $set: { categoryName: cat.name, categoryGroup: cat.group } })
  writeAudit({ req, action: AUDIT_ACTIONS.UPDATE, module: MODULES.EXPENSE, targetId: cat._id, targetLabel: cat.name, description: `Updated expense category "${cat.name}"` })
  return ok(res, cat, 'Category updated')
})

export const deleteCategory = asyncHandler(async (req, res) => {
  if (!canManageCategories(req.user)) throw ApiError.forbidden('Not permitted to manage categories')
  const cat = await ExpenseCategory.findOne({ _id: req.params.id, firm: req.user.firm })
  if (!cat) throw ApiError.notFound('Category not found')
  const inUse = await Expense.countDocuments({ firm: req.user.firm, category: cat._id, isDeleted: { $ne: true } })
  if (inUse > 0) {
    // Don't destroy history — disable instead so past expenses keep their category.
    cat.active = false
    await cat.save()
    return ok(res, cat, `Category is used by ${inUse} expense(s) — disabled instead of deleted`)
  }
  await cat.deleteOne()
  writeAudit({ req, action: AUDIT_ACTIONS.DELETE, module: MODULES.EXPENSE, targetId: cat._id, targetLabel: cat.name, description: `Deleted expense category "${cat.name}"` })
  return ok(res, { _id: cat._id }, 'Category deleted')
})

// ── List ─────────────────────────────────────────────────────────────────────
export const listExpenses = asyncHandler(async (req, res) => {
  const q = req.query
  const filter = baseFilter(req.user)
  const and = scopeClause(req.user)
  if (q.status && q.status !== 'all') filter.status = q.status
  if (q.method && q.method !== 'all') filter.paymentMethod = q.method
  if (q.branch) filter.branch = q.branch
  if (q.department) filter.department = q.department
  if (q.category) filter.category = q.category
  if (q.employee) filter.createdBy = q.employee
  if (q.hasReceipt === 'true') filter['receipt.fileUrl'] = { $exists: true, $ne: null }
  if (q.hasReceipt === 'false') filter['receipt.fileUrl'] = { $in: [null, undefined] }
  if (q.dateFrom || q.dateTo) {
    filter.expenseDate = {}
    if (q.dateFrom) filter.expenseDate.$gte = new Date(q.dateFrom)
    if (q.dateTo) filter.expenseDate.$lte = new Date(q.dateTo)
  }
  if (q.search) {
    const rx = { $regex: q.search, $options: 'i' }
    and.push({ $or: [{ expenseCode: rx }, { title: rx }, { categoryName: rx }, { createdByName: rx }, { referenceNumber: rx }, { paidTo: rx }] })
  }
  if (and.length) filter.$and = and

  const sort = q.sortBy === 'oldest' ? { expenseDate: 1 } : q.sortBy === 'amount_high' ? { amount: -1 } : q.sortBy === 'amount_low' ? { amount: 1 } : { expenseDate: -1, createdAt: -1 }
  const { data, meta } = await paginate(Expense, filter, {
    page: q.page, limit: q.limit, sort, select: '-activity',
    populate: [{ path: 'createdBy', select: 'name' }],
  })
  return ok(res, data, 'Expenses fetched', meta)
})

// ── Details ──────────────────────────────────────────────────────────────────
export const getExpense = asyncHandler(async (req, res) => {
  const filter = { _id: req.params.id, ...baseFilter(req.user) }
  const and = scopeClause(req.user)
  if (and.length) filter.$and = and
  const expense = await Expense.findOne(filter)
    .populate('createdBy', 'name role email').populate('verifiedBy', 'name').populate('category', 'name group')
    .populate('project', 'name').populate('activity.actor', 'name role').lean()
  if (!expense) throw ApiError.notFound('Expense not found')
  return ok(res, expense)
})

// ── Create ───────────────────────────────────────────────────────────────────
export const createExpense = asyncHandler(async (req, res) => {
  const b = req.body
  const category = await ExpenseCategory.findOne({ _id: b.category, firm: req.user.firm }).lean()
  if (!category) throw ApiError.badRequest('Invalid expense category')
  await assertUniqueRef(req.user.firm, b.referenceNumber)

  let projectName = ''
  if (b.project) { const p = await Project.findOne({ _id: b.project, firm: req.user.firm }).select('name').lean(); projectName = p?.name || '' }

  const seq = (await Expense.countDocuments({ firm: req.user.firm })) + 1
  const status = b.status === 'draft' ? 'draft' : 'submitted'
  const expense = await Expense.create({
    firm: req.user.firm,
    expenseCode: `EXP-${String(seq).padStart(4, '0')}`,
    title: b.title,
    category: category._id, categoryName: category.name, categoryGroup: category.group,
    expenseDate: b.expenseDate,
    branch: b.branch || req.user.branch || '',
    department: b.department || '',
    project: b.project || null, projectName,
    amount: b.amount, paymentMethod: b.paymentMethod,
    paidTo: b.paidTo || '', referenceNumber: b.referenceNumber || '', description: b.description || '',
    status,
    createdBy: req.user._id, createdByName: req.user.name, createdByRole: req.user.role,
    activity: [{ type: status === 'draft' ? 'created' : 'submitted', note: `Expense ${status}`, actor: req.user._id, actorName: req.user.name }],
  })

  // Notifications (§Notifications): finance/managers on creation; owner on large expense.
  if (status !== 'draft') {
    notifyManagers(req.user.firm, { type: NOTIFICATION_TYPES.EXPENSE_CREATED, title: 'New expense recorded', message: `${expense.title} · ₹${expense.amount.toLocaleString('en-IN')} (${expense.categoryName})`, entityType: 'expense', entityId: expense._id }, req.user._id)
    if (expense.amount >= LARGE_EXPENSE_THRESHOLD) {
      notifyManagers(req.user.firm, { type: NOTIFICATION_TYPES.LARGE_EXPENSE_RECORDED, title: 'Large expense recorded', message: `₹${expense.amount.toLocaleString('en-IN')} · ${expense.title}`, entityType: 'expense', entityId: expense._id }, null)
    }
  }
  writeAudit({ req, action: AUDIT_ACTIONS.CREATE, module: MODULES.EXPENSE, targetId: expense._id, targetLabel: expense.expenseCode, description: `Created expense ${expense.expenseCode} "${expense.title}" of ₹${expense.amount}` })
  return created(res, expense, status === 'draft' ? 'Expense saved as draft' : 'Expense recorded')
})

// ── Edit ─────────────────────────────────────────────────────────────────────
export const updateExpense = asyncHandler(async (req, res) => {
  const expense = await loadWritable(req)
  const b = req.body
  if (b.referenceNumber !== undefined && b.referenceNumber !== expense.referenceNumber) await assertUniqueRef(req.user.firm, b.referenceNumber, expense._id)
  if (b.category && String(b.category) !== String(expense.category)) {
    const cat = await ExpenseCategory.findOne({ _id: b.category, firm: req.user.firm }).lean()
    if (!cat) throw ApiError.badRequest('Invalid expense category')
    expense.category = cat._id; expense.categoryName = cat.name; expense.categoryGroup = cat.group
  }
  if (b.project !== undefined) {
    if (b.project) { const p = await Project.findOne({ _id: b.project, firm: req.user.firm }).select('name').lean(); expense.project = b.project; expense.projectName = p?.name || '' }
    else { expense.project = null; expense.projectName = '' }
  }
  for (const f of ['title', 'expenseDate', 'branch', 'department', 'amount', 'paymentMethod', 'paidTo', 'referenceNumber', 'description']) {
    if (b[f] !== undefined) expense[f] = b[f] === '' ? undefined : b[f]
  }
  logActivity(expense, 'edited', 'Expense details updated', req.user)
  await expense.save()
  notifyManagers(req.user.firm, { type: NOTIFICATION_TYPES.EXPENSE_UPDATED, title: 'Expense updated', message: `${expense.expenseCode} updated by ${req.user.name}`, entityType: 'expense', entityId: expense._id }, req.user._id)
  writeAudit({ req, action: AUDIT_ACTIONS.UPDATE, module: MODULES.EXPENSE, targetId: expense._id, targetLabel: expense.expenseCode, description: `Edited expense ${expense.expenseCode}` })
  return ok(res, expense, 'Expense updated')
})

// Load an expense the caller may write to (owner while open, or a manager).
async function loadWritable(req) {
  const expense = await Expense.findOne({ _id: req.params.id, firm: req.user.firm, isDeleted: { $ne: true } })
  if (!expense) throw ApiError.notFound('Expense not found')
  const mine = String(expense.createdBy) === String(req.user._id)
  const manager = can(req.user, MODULES.EXPENSE, 'edit') && req.user.role !== ROLES.SALES_EXECUTIVE
  if (!mine && !manager) throw ApiError.forbidden('You can only edit your own expenses')
  if (['verified', 'cancelled', 'rejected'].includes(expense.status) && !manager) throw ApiError.badRequest('This expense can no longer be edited')
  return expense
}

// ── Status: submit / verify / reject / cancel / draft ────────────────────────
export const changeStatus = asyncHandler(async (req, res) => {
  const { status, note } = req.body
  const expense = await Expense.findOne({ _id: req.params.id, firm: req.user.firm, isDeleted: { $ne: true } })
  if (!expense) throw ApiError.notFound('Expense not found')
  const mine = String(expense.createdBy) === String(req.user._id)
  if (['verified', 'rejected'].includes(status) && !canVerify(req.user)) throw ApiError.forbidden('You are not permitted to verify or reject expenses')
  if (['submitted', 'cancelled', 'draft'].includes(status) && !mine && !canVerify(req.user)) throw ApiError.forbidden('Not permitted')

  expense.status = status
  if (status === 'verified') { expense.verifiedBy = req.user._id; expense.verifiedByName = req.user.name; expense.verifiedAt = new Date() }
  if (status === 'rejected') expense.rejectReason = note || ''
  if (status === 'cancelled') expense.cancelReason = note || ''
  logActivity(expense, status, note || `Status set to ${status}`, req.user)
  await expense.save()

  if (['verified', 'rejected'].includes(status) && String(expense.createdBy) !== String(req.user._id)) {
    notify({ firm: req.user.firm, recipient: expense.createdBy, type: status === 'verified' ? NOTIFICATION_TYPES.EXPENSE_VERIFIED : NOTIFICATION_TYPES.EXPENSE_REJECTED, title: `Expense ${status}`, message: `${expense.expenseCode} · ${expense.title}`, entityType: 'expense', entityId: expense._id })
  }
  writeAudit({ req, action: AUDIT_ACTIONS.STATUS_CHANGE, module: MODULES.EXPENSE, targetId: expense._id, targetLabel: expense.expenseCode, description: `Expense ${expense.expenseCode} → ${status}` })
  return ok(res, expense, `Expense ${status}`)
})

// ── Receipt upload / replace ─────────────────────────────────────────────────
export const uploadReceipt = asyncHandler(async (req, res) => {
  const expense = await Expense.findOne({ _id: req.params.id, firm: req.user.firm, isDeleted: { $ne: true } })
  if (!expense) throw ApiError.notFound('Expense not found')
  const mine = String(expense.createdBy) === String(req.user._id)
  if (!mine && req.user.role === ROLES.SALES_EXECUTIVE) throw ApiError.forbidden('Not permitted')
  if (!req.file) throw ApiError.badRequest('No receipt file uploaded')
  const replacing = Boolean(expense.receipt?.fileUrl)
  const seq = await Expense.countDocuments({ firm: req.user.firm, 'receipt.fileUrl': { $exists: true, $ne: null } })
  expense.receipt = {
    receiptNumber: expense.receipt?.receiptNumber || `RCPT-E${String(seq + 1).padStart(4, '0')}`,
    fileName: req.file.originalname, fileUrl: `/uploads/${req.file.filename}`, mimeType: req.file.mimetype,
    uploadedBy: req.user._id, uploadedByName: req.user.name, uploadedAt: new Date(),
  }
  logActivity(expense, replacing ? 'receipt_replaced' : 'receipt_uploaded', expense.receipt.fileName, req.user)
  await expense.save()
  notifyManagers(req.user.firm, { type: NOTIFICATION_TYPES.EXPENSE_RECEIPT_UPLOADED, title: replacing ? 'Receipt replaced' : 'Receipt uploaded', message: `${expense.expenseCode} · ${expense.title}`, entityType: 'expense', entityId: expense._id }, req.user._id)
  writeAudit({ req, action: AUDIT_ACTIONS.UPDATE, module: MODULES.EXPENSE, targetId: expense._id, targetLabel: expense.expenseCode, description: `${replacing ? 'Replaced' : 'Uploaded'} receipt on ${expense.expenseCode}` })
  return created(res, expense.receipt, replacing ? 'Receipt replaced' : 'Receipt uploaded')
})

export const downloadReceipt = asyncHandler(async (req, res) => {
  const filter = { _id: req.params.id, ...baseFilter(req.user) }
  const and = scopeClause(req.user)
  if (and.length) filter.$and = and
  const expense = await Expense.findOne(filter).select('receipt expenseCode').lean()
  if (!expense) throw ApiError.notFound('Expense not found')
  if (!expense.receipt?.fileUrl) throw ApiError.badRequest('No receipt attached to this expense')
  writeAudit({ req, action: AUDIT_ACTIONS.UPDATE, module: MODULES.EXPENSE, targetId: expense._id, targetLabel: expense.expenseCode, description: `Downloaded receipt for ${expense.expenseCode}` })
  return ok(res, { fileUrl: expense.receipt.fileUrl, fileName: expense.receipt.fileName })
})

// ── Soft delete ──────────────────────────────────────────────────────────────
export const deleteExpense = asyncHandler(async (req, res) => {
  if (!canDelete(req.user)) throw ApiError.forbidden('You are not permitted to delete expenses')
  const expense = await Expense.findOne({ _id: req.params.id, firm: req.user.firm, isDeleted: { $ne: true } })
  if (!expense) throw ApiError.notFound('Expense not found')
  expense.isDeleted = true; expense.deletedAt = new Date(); expense.deletedBy = req.user._id
  logActivity(expense, 'deleted', req.body?.reason || 'Expense deleted', req.user)
  await expense.save()
  writeAudit({ req, action: AUDIT_ACTIONS.DELETE, module: MODULES.EXPENSE, targetId: expense._id, targetLabel: expense.expenseCode, description: `Deleted expense ${expense.expenseCode}` })
  return ok(res, { _id: expense._id }, 'Expense deleted')
})

// ── Shared analytics filter (Dashboard + Reports) ────────────────────────────
function analyticsFilter(req) {
  const q = req.query
  const filter = baseFilter(req.user)
  const and = scopeClause(req.user)
  if (q.branch) filter.branch = q.branch
  if (q.department) filter.department = q.department
  if (q.category) filter.category = new mongoose.Types.ObjectId(q.category)
  if (q.employee) filter.createdBy = new mongoose.Types.ObjectId(q.employee)
  if (q.method && q.method !== 'all') filter.paymentMethod = q.method
  if (q.status && q.status !== 'all') filter.status = q.status
  if (q.dateFrom || q.dateTo) {
    filter.expenseDate = {}
    if (q.dateFrom) filter.expenseDate.$gte = new Date(q.dateFrom)
    if (q.dateTo) filter.expenseDate.$lte = new Date(q.dateTo)
  }
  if (and.length) filter.$and = and
  return filter
}

// ── Dashboard ────────────────────────────────────────────────────────────────
export const dashboard = asyncHandler(async (req, res) => {
  const filter = analyticsFilter(req)
  const counted = { ...filter, status: { $in: COUNTED_STATUSES } }
  const now = new Date()
  const startToday = new Date(now); startToday.setHours(0, 0, 0, 0)
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const [totals, today, month, byBranch, byCategory, byDept, marketing, pending, verified, monthly, recent, pendingVerify, activity] = await Promise.all([
    Expense.aggregate([{ $match: counted }, { $group: { _id: null, amount: { $sum: '$amount' }, count: { $sum: 1 } } }]),
    Expense.aggregate([{ $match: { ...counted, expenseDate: { $gte: startToday } } }, { $group: { _id: null, amount: { $sum: '$amount' } } }]),
    Expense.aggregate([{ $match: { ...counted, expenseDate: { $gte: startMonth } } }, { $group: { _id: null, amount: { $sum: '$amount' } } }]),
    Expense.aggregate([{ $match: counted }, { $group: { _id: { $ifNull: ['$branch', '—'] }, amount: { $sum: '$amount' } } }, { $sort: { amount: -1 } }, { $limit: 8 }]),
    Expense.aggregate([{ $match: counted }, { $group: { _id: { $ifNull: ['$categoryName', '—'] }, amount: { $sum: '$amount' } } }, { $sort: { amount: -1 } }, { $limit: 10 }]),
    Expense.aggregate([{ $match: counted }, { $group: { _id: { $ifNull: ['$department', '—'] }, amount: { $sum: '$amount' } } }, { $sort: { amount: -1 } }, { $limit: 8 }]),
    Expense.aggregate([{ $match: { ...counted, $or: [{ categoryGroup: 'marketing' }, { department: 'Marketing' }] } }, { $group: { _id: null, amount: { $sum: '$amount' } } }]),
    Expense.countDocuments({ ...filter, status: 'submitted' }),
    Expense.countDocuments({ ...filter, status: 'verified' }),
    Expense.aggregate([{ $match: counted }, { $group: { _id: { y: { $year: '$expenseDate' }, m: { $month: '$expenseDate' } }, amount: { $sum: '$amount' } } }, { $sort: { '_id.y': 1, '_id.m': 1 } }]),
    Expense.find(filter).sort({ createdAt: -1 }).limit(8).select('expenseCode title amount categoryName status expenseDate branch').lean(),
    Expense.find({ ...filter, status: 'submitted' }).sort({ expenseDate: -1 }).limit(8).select('expenseCode title amount categoryName expenseDate').lean(),
    AuditLog.find({ module: MODULES.EXPENSE, ...firmScope(req.user), ...(req.user.role === ROLES.SALES_EXECUTIVE ? { actor: req.user._id } : {}) }).populate('actor', 'name role').sort({ createdAt: -1 }).limit(10).lean(),
  ])

  const t = totals[0] || { amount: 0, count: 0 }
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

  return ok(res, {
    kpis: {
      totalExpenses: t.amount, totalCount: t.count,
      todayExpenses: today[0]?.amount || 0,
      monthExpenses: month[0]?.amount || 0,
      branchExpenses: byBranch.reduce((s, b) => s + b.amount, 0),
      marketingExpenses: marketing[0]?.amount || 0,
      verified, pending,
      averageExpense: t.count ? Math.round(t.amount / t.count) : 0,
    },
    monthlyTrend: monthly.map((m) => ({ label: `${monthNames[m._id.m - 1]} ${String(m._id.y).slice(2)}`, amount: m.amount })),
    categoryBreakdown: byCategory.map((c) => ({ category: c._id, amount: c.amount })),
    branchBreakdown: byBranch.map((b) => ({ branch: b._id, amount: b.amount })),
    departmentBreakdown: byDept.map((d) => ({ department: d._id, amount: d.amount })),
    topCategories: byCategory.slice(0, 5).map((c) => ({ category: c._id, amount: c.amount })),
    recentExpenses: recent,
    pendingVerification: pendingVerify,
    recentActivity: activity.map((a) => ({ _id: a._id, action: a.action, description: a.description, actorName: a.actor?.name || 'System', at: a.createdAt })),
  }, 'Expense dashboard')
})

// ── Reports ──────────────────────────────────────────────────────────────────
export const reports = asyncHandler(async (req, res) => {
  const filter = analyticsFilter(req)
  const counted = { ...filter, status: { $in: COUNTED_STATUSES } }

  const [byStatus, daily, monthly, branch, dept, category, employee, marketing] = await Promise.all([
    Expense.aggregate([{ $match: filter }, { $group: { _id: '$status', amount: { $sum: '$amount' }, count: { $sum: 1 } } }]),
    Expense.aggregate([{ $match: counted }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$expenseDate' } }, amount: { $sum: '$amount' }, count: { $sum: 1 } } }, { $sort: { _id: -1 } }, { $limit: 60 }]),
    Expense.aggregate([{ $match: counted }, { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$expenseDate' } }, amount: { $sum: '$amount' }, count: { $sum: 1 } } }, { $sort: { _id: -1 } }, { $limit: 24 }]),
    Expense.aggregate([{ $match: counted }, { $group: { _id: { $ifNull: ['$branch', '—'] }, amount: { $sum: '$amount' }, count: { $sum: 1 } } }, { $sort: { amount: -1 } }]),
    Expense.aggregate([{ $match: counted }, { $group: { _id: { $ifNull: ['$department', '—'] }, amount: { $sum: '$amount' }, count: { $sum: 1 } } }, { $sort: { amount: -1 } }]),
    Expense.aggregate([{ $match: counted }, { $group: { _id: { $ifNull: ['$categoryName', '—'] }, amount: { $sum: '$amount' }, count: { $sum: 1 } } }, { $sort: { amount: -1 } }]),
    Expense.aggregate([{ $match: counted }, { $group: { _id: '$createdBy', name: { $first: '$createdByName' }, amount: { $sum: '$amount' }, count: { $sum: 1 } } }, { $sort: { amount: -1 } }]),
    Expense.aggregate([{ $match: { ...counted, $or: [{ categoryGroup: 'marketing' }, { department: 'Marketing' }] } }, { $group: { _id: { $ifNull: ['$categoryName', '—'] }, amount: { $sum: '$amount' }, count: { $sum: 1 } } }, { $sort: { amount: -1 } }]),
  ])

  const statusMap = Object.fromEntries(byStatus.map((s) => [s._id, s]))
  return ok(res, {
    statusSummary: EXPENSE_STATUS.map((s) => ({ status: s, amount: statusMap[s]?.amount || 0, count: statusMap[s]?.count || 0 })),
    daily: daily.map((d) => ({ date: d._id, amount: d.amount, count: d.count })),
    monthly: monthly.map((m) => ({ month: m._id, amount: m.amount, count: m.count })),
    branch: branch.map((b) => ({ branch: b._id, amount: b.amount, count: b.count })),
    department: dept.map((d) => ({ department: d._id, amount: d.amount, count: d.count })),
    category: category.map((c) => ({ category: c._id, amount: c.amount, count: c.count })),
    employee: employee.map((e) => ({ employee: e.name || 'Unknown', amount: e.amount, count: e.count })),
    marketing: marketing.map((m) => ({ category: m._id, amount: m.amount, count: m.count })),
  }, 'Expense reports')
})

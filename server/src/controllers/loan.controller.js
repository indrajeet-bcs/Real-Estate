import LoanCase, { LOAN_STATUSES } from '../models/LoanCase.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from '../utils/ApiError.js'
import { ok, created } from '../utils/apiResponse.js'
import { paginate } from '../utils/paginate.js'
import { ROLES } from '../config/constants.js'

// Non-super users are scoped to their firm. Executives are further scoped to
// cases they are assigned to (or created).
function scopeFor(req) {
  const scope = {}
  if (req.user.role !== ROLES.SUPER_ADMIN) scope.firm = req.user.firm
  if (req.user.role === ROLES.SALES_EXECUTIVE) {
    scope.$or = [{ assignedExecutive: req.user._id }, { createdBy: req.user._id }]
  }
  return scope
}

// GET /api/loans — filterable list (status, bank, search) + pagination.
export const listLoans = asyncHandler(async (req, res) => {
  const { page, limit, status, bank, search } = req.query
  const filter = { ...scopeFor(req) }
  if (status && status !== 'all') filter.status = status
  if (bank && bank !== 'all') filter.bank = bank
  if (search) {
    filter.$and = [{
      $or: [
        { caseCode: { $regex: search, $options: 'i' } },
        { customerName: { $regex: search, $options: 'i' } },
        { bookingLabel: { $regex: search, $options: 'i' } },
        { project: { $regex: search, $options: 'i' } },
        { applicationNumber: { $regex: search, $options: 'i' } },
      ],
    }]
  }
  const { data, meta } = await paginate(LoanCase, filter, {
    page, limit, sort: { createdAt: -1 },
    populate: { path: 'assignedExecutive', select: 'name email' },
  })
  return ok(res, data, 'Loan cases fetched', meta)
})

// GET /api/loans/dashboard — KPI counts for the dashboard.
export const loanDashboard = asyncHandler(async (req, res) => {
  const scope = scopeFor(req)
  const [total, byStatus, recent, amounts] = await Promise.all([
    LoanCase.countDocuments(scope),
    LoanCase.aggregate([{ $match: scope }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
    LoanCase.find(scope).sort({ updatedAt: -1 }).limit(5).lean(),
    LoanCase.aggregate([{ $match: scope }, { $group: { _id: null, sanctioned: { $sum: '$sanctionedAmount' }, disbursed: { $sum: '$disbursedAmount' }, requested: { $sum: '$loanAmount' } } }]),
  ])
  const statusCounts = Object.fromEntries(byStatus.map((s) => [s._id, s.n]))
  return ok(res, {
    total,
    statusCounts,
    docsPending: statusCounts['Documents Pending'] || 0,
    underReview: statusCounts['Under Review'] || 0,
    sanctioned: statusCounts['Sanctioned'] || 0,
    fullyDisbursed: statusCounts['Fully Disbursed'] || 0,
    amounts: amounts[0] || { sanctioned: 0, disbursed: 0, requested: 0 },
    recent,
  }, 'Loan dashboard')
})

// GET /api/loans/reports — aggregated report rows (bank summary, status split).
export const loanReports = asyncHandler(async (req, res) => {
  const scope = scopeFor(req)
  const [byBank, byStatus, byExecutive] = await Promise.all([
    LoanCase.aggregate([{ $match: scope }, { $group: { _id: '$bank', cases: { $sum: 1 }, sanctioned: { $sum: '$sanctionedAmount' }, disbursed: { $sum: '$disbursedAmount' } } }, { $sort: { cases: -1 } }]),
    LoanCase.aggregate([{ $match: scope }, { $group: { _id: '$status', cases: { $sum: 1 } } }, { $sort: { cases: -1 } }]),
    LoanCase.aggregate([{ $match: scope }, { $group: { _id: '$assignedExecutiveName', cases: { $sum: 1 }, disbursed: { $sum: '$disbursedAmount' } } }, { $sort: { cases: -1 } }]),
  ])
  return ok(res, { byBank, byStatus, byExecutive }, 'Loan reports')
})

async function findScoped(req) {
  const doc = await LoanCase.findOne({ _id: req.params.id, ...scopeFor(req) })
  if (!doc) throw ApiError.notFound('Loan case not found')
  return doc
}

// GET /api/loans/:id
export const getLoan = asyncHandler(async (req, res) => {
  const doc = await LoanCase.findOne({ _id: req.params.id, ...scopeFor(req) })
    .populate('assignedExecutive', 'name email')
    .populate('customer', 'name mobile')
    .lean()
  if (!doc) throw ApiError.notFound('Loan case not found')
  return ok(res, doc)
})

// POST /api/loans
export const createLoan = asyncHandler(async (req, res) => {
  const firm = req.user.role === ROLES.SUPER_ADMIN ? req.body.firm : req.user.firm
  if (!firm) throw ApiError.badRequest('A firm is required')
  const body = { ...req.body }
  delete body.firm
  const doc = await LoanCase.create({
    ...body,
    firm,
    branch: body.branch || req.user.branch,
    assignedExecutive: body.assignedExecutive || (req.user.role === ROLES.SALES_EXECUTIVE ? req.user._id : undefined),
    assignedExecutiveName: body.assignedExecutiveName || (req.user.role === ROLES.SALES_EXECUTIVE ? req.user.name : undefined),
    createdBy: req.user._id,
    timeline: [{ user: req.user.name, activity: 'Loan Case Created', remarks: body.remarks || '' }],
  })
  return created(res, doc, 'Loan case created')
})

// PATCH /api/loans/:id — edit case fields.
export const updateLoan = asyncHandler(async (req, res) => {
  const doc = await findScoped(req)
  const editable = ['loanRequired', 'loanAmount', 'bank', 'loanType', 'applicationNumber', 'applicationDate', 'expectedSanctionDate', 'sanctionedAmount', 'disbursedAmount', 'assignedExecutiveName', 'customerName', 'project', 'unitNumber', 'branch']
  for (const k of editable) if (k in req.body) doc[k] = req.body[k]
  doc.timeline.push({ user: req.user.name, activity: 'Case Updated', remarks: req.body.remarks || '' })
  await doc.save()
  return ok(res, doc, 'Loan case updated')
})

// PATCH /api/loans/:id/status — change status (records the timeline).
export const updateLoanStatus = asyncHandler(async (req, res) => {
  const { status, remarks } = req.body
  if (!LOAN_STATUSES.includes(status)) throw ApiError.badRequest('Invalid status')
  const doc = await findScoped(req)
  doc.status = status
  doc.timeline.push({ user: req.user.name, activity: `Status → ${status}`, remarks: remarks || '' })
  await doc.save()
  return ok(res, doc, 'Status updated')
})

// POST /api/loans/:id/documents — attach a document record.
export const addLoanDocument = asyncHandler(async (req, res) => {
  const doc = await findScoped(req)
  const { name, type, status, remarks } = req.body
  if (!name || !type) throw ApiError.badRequest('Document name and type are required')
  doc.documents.push({ name, type, status: status || 'Received', remarks, uploadedBy: req.user.name, uploadDate: new Date() })
  doc.timeline.push({ user: req.user.name, activity: 'Document Added', remarks: `${type}: ${name}` })
  await doc.save()
  return created(res, doc, 'Document added')
})

// PATCH /api/loans/:id/documents/:docId — update a document's status.
export const updateLoanDocument = asyncHandler(async (req, res) => {
  const doc = await findScoped(req)
  const sub = doc.documents.id(req.params.docId)
  if (!sub) throw ApiError.notFound('Document not found')
  const { status, remarks } = req.body
  if (status) sub.status = status
  if (remarks !== undefined) sub.remarks = remarks
  if (status === 'Verified') { sub.verifiedBy = req.user.name; sub.verificationDate = new Date() }
  await doc.save()
  return ok(res, doc, 'Document updated')
})

// DELETE /api/loans/:id
export const deleteLoan = asyncHandler(async (req, res) => {
  const doc = await LoanCase.findOneAndDelete({ _id: req.params.id, ...scopeFor(req) })
  if (!doc) throw ApiError.notFound('Loan case not found')
  return ok(res, { _id: doc._id }, 'Loan case deleted')
})

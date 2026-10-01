import LeadTransferRequest from '../models/LeadTransferRequest.js'
import Customer from '../models/Customer.js'
import User from '../models/User.js'
import FollowUp from '../models/FollowUp.js'
import SiteVisit from '../models/SiteVisit.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from '../utils/ApiError.js'
import { ok, created } from '../utils/apiResponse.js'
import { paginate } from '../utils/paginate.js'
import { writeAudit } from '../middleware/audit.js'
import { notify } from '../services/notification.service.js'
import { AUDIT_ACTIONS, MODULES, ROLES, NOTIFICATION_TYPES, FOLLOWUP_STATUS, VISIT_STATUS } from '../config/constants.js'
import { firmScope } from '../middleware/tenantScope.js'

// POST /api/lead-transfers — an executive requests that one of their leads be
// transferred (Employee spec §Request Lead Transfer). Employees cannot reassign
// directly; a Sub-Admin/Admin approves. Only one open request per lead.
export const createTransferRequest = asyncHandler(async (req, res) => {
  const { customer: customerId, reason, remarks } = req.body

  const customer = await Customer.findOne({ _id: customerId, firm: req.user.firm, assignedTo: req.user._id })
  if (!customer) throw ApiError.notFound('Lead not found or not assigned to you')

  const openReq = await LeadTransferRequest.findOne({ customer: customer._id, status: 'pending' })
  if (openReq) throw ApiError.conflict('A transfer request for this lead is already pending')

  const request = await LeadTransferRequest.create({
    firm: req.user.firm,
    customer: customer._id,
    requestedBy: req.user._id,
    requestedByName: req.user.name,
    reason,
    remarks,
    status: 'pending',
  })
  customer.logActivity('transfer_requested', `Transfer requested by ${req.user.name}: ${reason}`, req.user._id)
  await customer.save()

  // Notify the branch manager (sub-admin) so they can act on it.
  if (req.user.manager) {
    notify({
      firm: req.user.firm,
      recipient: req.user.manager,
      type: NOTIFICATION_TYPES.LEAD_TRANSFER_REQUEST,
      title: 'Lead transfer request',
      message: `${req.user.name} requested a transfer for ${customer.name}`,
      entityType: 'customer',
      entityId: customer._id,
    })
  }

  writeAudit({ req, action: AUDIT_ACTIONS.TRANSFER, module: MODULES.LEAD, targetId: customer._id, targetLabel: customer.name, description: `Requested transfer of ${customer.name}` })
  return created(res, request, 'Transfer request submitted for approval')
})

// GET /api/lead-transfers — executives see their own requests; sub-admin/admin
// see the branch/firm queue (default: pending first).
export const listTransferRequests = asyncHandler(async (req, res) => {
  const { page, limit, status } = req.query
  const filter = { ...firmScope(req.user) }
  if (req.user.role === ROLES.SALES_EXECUTIVE) filter.requestedBy = req.user._id
  else if (req.user.role === ROLES.SUB_ADMIN) {
    // Branch scope approximated by the requester's manager == this sub-admin.
    const team = await User.find({ firm: req.user.firm, manager: req.user._id }).select('_id').lean()
    filter.requestedBy = { $in: [...team.map((t) => t._id), req.user._id] }
  }
  if (status && status !== 'all') filter.status = status

  const { data, meta } = await paginate(LeadTransferRequest, filter, {
    page,
    limit,
    sort: { status: 1, createdAt: -1 },
    populate: [
      { path: 'customer', select: 'name mobile status assignedTo' },
      { path: 'requestedBy', select: 'name email' },
      { path: 'newEmployee', select: 'name email' },
    ],
  })
  return ok(res, data, 'Transfer requests fetched', meta)
})

// PATCH /api/lead-transfers/:id — Sub-Admin/Admin approve or reject (spec
// §Approval Flow). Approval reassigns the lead + its pending follow-ups & future
// visits to the chosen employee (or the unassigned pool) and records history.
export const decideTransferRequest = asyncHandler(async (req, res) => {
  const { decision, newEmployee, note } = req.body
  const request = await LeadTransferRequest.findOne({ _id: req.params.id, ...firmScope(req.user) })
  if (!request) throw ApiError.notFound('Transfer request not found')
  if (request.status !== 'pending') throw ApiError.badRequest('This request has already been decided')

  request.decidedBy = req.user._id
  request.decidedByName = req.user.name
  request.decidedAt = new Date()
  request.decisionNote = note

  const customer = await Customer.findOne({ _id: request.customer, firm: req.user.firm })
  if (!customer) throw ApiError.notFound('Lead no longer exists')

  if (decision === 'reject') {
    request.status = 'rejected'
    await request.save()
    customer.logActivity('transfer_rejected', `Transfer request rejected by ${req.user.name}`, req.user._id)
    await customer.save()
    notify({
      firm: req.user.firm,
      recipient: request.requestedBy,
      type: NOTIFICATION_TYPES.LEAD_TRANSFER_DECISION,
      title: 'Transfer request rejected',
      message: `Your transfer request for ${customer.name} was rejected`,
      entityType: 'customer',
      entityId: customer._id,
    })
    writeAudit({ req, action: AUDIT_ACTIONS.TRANSFER, module: MODULES.LEAD, targetId: customer._id, targetLabel: customer.name, description: `Rejected transfer of ${customer.name}` })
    return ok(res, request, 'Transfer request rejected')
  }

  // Approve → reassign ownership.
  let target = null
  if (newEmployee) {
    target = await User.findOne({ _id: newEmployee, firm: req.user.firm, role: ROLES.SALES_EXECUTIVE, isActive: true }).select('name')
    if (!target) throw ApiError.badRequest('Select an active sales executive to transfer to')
    if (String(customer.assignedTo) === String(target._id)) throw ApiError.badRequest('Lead is already assigned to that employee')
  }

  const prevId = customer.assignedTo || null
  const prev = prevId ? await User.findById(prevId).select('name') : null

  customer.assignedTo = target ? target._id : null
  customer.assignedAt = target ? new Date() : undefined
  customer.transferHistory.push({
    previousEmployee: prevId,
    previousEmployeeName: prev?.name || 'Unassigned',
    newEmployee: target?._id || null,
    newEmployeeName: target?.name || 'Unassigned pool',
    transferredBy: req.user._id,
    transferredByName: req.user.name,
    reason: request.reason,
    remarks: note || request.remarks,
  })
  customer.logActivity('lead_transferred', `Transfer approved: ${prev?.name || 'pool'} → ${target?.name || 'pool'}`, req.user._id, { reason: request.reason })
  await customer.save()

  const now = new Date()
  const followUpFilter = { customer: customer._id, status: FOLLOWUP_STATUS.SCHEDULED }
  const visitFilter = { customer: customer._id, status: VISIT_STATUS.SCHEDULED, scheduledAt: { $gte: now } }
  if (target) {
    await Promise.all([
      FollowUp.updateMany(followUpFilter, { $set: { assignedTo: target._id } }),
      SiteVisit.updateMany(visitFilter, { $set: { assignedTo: target._id } }),
    ])
  }

  request.status = 'approved'
  request.newEmployee = target?._id || null
  request.newEmployeeName = target?.name || 'Unassigned pool'
  await request.save()

  // Notify the requester and the new owner.
  notify({
    firm: req.user.firm,
    recipient: request.requestedBy,
    type: NOTIFICATION_TYPES.LEAD_TRANSFER_DECISION,
    title: 'Transfer request approved',
    message: `${customer.name} was transferred to ${target?.name || 'the pool'}`,
    entityType: 'customer',
    entityId: customer._id,
  })
  if (target) {
    notify({
      firm: req.user.firm,
      recipient: target._id,
      type: NOTIFICATION_TYPES.LEAD_ASSIGNED,
      title: 'Lead transferred to you',
      message: `${customer.name} was transferred to you`,
      entityType: 'customer',
      entityId: customer._id,
    })
  }

  writeAudit({ req, action: AUDIT_ACTIONS.TRANSFER, module: MODULES.LEAD, targetId: customer._id, targetLabel: customer.name, description: `Approved transfer of ${customer.name} to ${target?.name || 'pool'}` })
  return ok(res, request, 'Transfer approved and lead reassigned')
})

// PATCH /api/lead-transfers/:id/cancel — the requesting executive withdraws a
// still-pending request.
export const cancelTransferRequest = asyncHandler(async (req, res) => {
  const request = await LeadTransferRequest.findOne({ _id: req.params.id, firm: req.user.firm, requestedBy: req.user._id })
  if (!request) throw ApiError.notFound('Transfer request not found')
  if (request.status !== 'pending') throw ApiError.badRequest('Only a pending request can be cancelled')
  request.status = 'cancelled'
  await request.save()
  return ok(res, request, 'Transfer request cancelled')
})

import FollowUp from '../models/FollowUp.js'
import Customer from '../models/Customer.js'
import User from '../models/User.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from '../utils/ApiError.js'
import { ok, created } from '../utils/apiResponse.js'
import { paginate } from '../utils/paginate.js'
import { writeAudit } from '../middleware/audit.js'
import { notify, notifyMany } from '../services/notification.service.js'
import { AUDIT_ACTIONS, MODULES, ROLES, FOLLOWUP_STATUS, CUSTOMER_STATUS, NOTIFICATION_TYPES } from '../config/constants.js'
import { ownershipScope, firmScope } from '../middleware/tenantScope.js'

// GET /api/followups?scope=due|overdue|today&status=
export const listFollowUps = asyncHandler(async (req, res) => {
  const { page, limit, status, scope } = req.query
  const filter = { ...ownershipScope(req.user, 'assignedTo') }
  if (status) filter.status = status
  // Sub-Admin/Admin may narrow to a single employee (Employee module tabs).
  if (req.query.assignedTo && req.user.role !== ROLES.SALES_EXECUTIVE) filter.assignedTo = req.query.assignedTo

  const now = new Date()
  if (scope === 'overdue') {
    filter.status = FOLLOWUP_STATUS.SCHEDULED
    filter.scheduledAt = { $lt: now }
  } else if (scope === 'today') {
    const start = new Date(now); start.setHours(0, 0, 0, 0)
    const end = new Date(now); end.setHours(23, 59, 59, 999)
    filter.status = FOLLOWUP_STATUS.SCHEDULED
    filter.scheduledAt = { $gte: start, $lte: end }
  } else if (scope === 'upcoming') {
    filter.status = FOLLOWUP_STATUS.SCHEDULED
    filter.scheduledAt = { $gte: now }
  }

  const { data, meta } = await paginate(FollowUp, filter, {
    page,
    limit,
    sort: { scheduledAt: 1 },
    populate: [
      { path: 'customer', select: 'name mobile status notes interestedProjects' },
      { path: 'assignedTo', select: 'name' },
      { path: 'project', select: 'name' },
    ],
  })
  return ok(res, data, 'Follow-ups fetched', meta)
})

// POST /api/followups — schedule (§6).
export const createFollowUp = asyncHandler(async (req, res) => {
  const customer = await Customer.findOne({ _id: req.body.customer, ...firmScope(req.user) })
  if (!customer) throw ApiError.notFound('Customer not found')
  if (req.user.role === ROLES.SALES_EXECUTIVE && String(customer.assignedTo) !== String(req.user._id)) {
    throw ApiError.forbidden('Customer is not assigned to you')
  }

  const followUp = await FollowUp.create({
    ...req.body,
    firm: req.user.firm,
    assignedTo: customer.assignedTo || req.user._id,
    createdBy: req.user._id,
    timeline: [{ type: 'created', note: 'Follow-up created' }],
  })

  // Surface on the pipeline: mark an open lead as follow-up due (don't regress a
  // converted/booked customer).
  if ([CUSTOMER_STATUS.NEW, CUSTOMER_STATUS.IN_PROGRESS, CUSTOMER_STATUS.INTERESTED].includes(customer.status)) {
    customer.status = CUSTOMER_STATUS.FOLLOW_UP_DUE
  }
  customer.logActivity('followup_scheduled', `Follow-up on ${new Date(req.body.scheduledAt).toLocaleString()}`, req.user._id)
  await customer.save()

  writeAudit({ req, action: AUDIT_ACTIONS.CREATE, module: MODULES.FOLLOWUP, targetId: followUp._id, targetLabel: customer.name, description: `Scheduled follow-up for ${customer.name}` })
  return created(res, followUp, 'Follow-up scheduled')
})

// PATCH /api/followups/:id/complete (spec §Mark Follow-up Completed / §Outcome)
export const completeFollowUp = asyncHandler(async (req, res) => {
  const { outcome, remarks, conversationSummary, nextAction, nextFollowUpDate, nextFollowUpRequired, nextFollowUp } = req.body
  const followUp = await findOwnedFollowUp(req)

  const summary = conversationSummary || remarks || ''
  followUp.status = FOLLOWUP_STATUS.COMPLETED
  followUp.outcome = outcome
  followUp.conversationSummary = summary
  followUp.nextAction = nextAction
  followUp.outcomeNotes = summary ? `${outcome || 'Completed'}: ${summary}` : (outcome || 'Completed')
  followUp.completedAt = new Date()
  followUp.timeline.push({ type: 'completed', note: `Outcome: ${outcome || 'completed'}` })
  if (summary) followUp.timeline.push({ type: 'notes_added', note: summary })

  // Advance the customer stage from the outcome, where it makes sense.
  const customer = await Customer.findById(followUp.customer)
  if (customer) {
    const logDesc = `Follow-up completed. Outcome: ${outcome || 'Completed'}.${summary ? ' Summary: ' + summary : ''}`
    customer.logActivity('followup_completed', logDesc, req.user._id)
    customer.notes.push({ type: 'call', text: logDesc, outcome: outcome || 'Completed', createdBy: req.user._id })
    const map = {
      interested: CUSTOMER_STATUS.INTERESTED,
      site_visit_scheduled: CUSTOMER_STATUS.SITE_VISIT_SCHEDULED,
      negotiation: CUSTOMER_STATUS.NEGOTIATION,
      not_interested: CUSTOMER_STATUS.LOST,
      converted: CUSTOMER_STATUS.QUALIFIED,
    }
    const openStages = [CUSTOMER_STATUS.NEW, CUSTOMER_STATUS.IN_PROGRESS, CUSTOMER_STATUS.FOLLOW_UP_DUE, CUSTOMER_STATUS.INTERESTED, CUSTOMER_STATUS.SITE_VISIT_SCHEDULED, CUSTOMER_STATUS.NEGOTIATION]
    if (map[outcome] && openStages.includes(customer.status)) customer.status = map[outcome]
    await customer.save()
  }

  // Create the next follow-up from either the convenience date or the full object.
  const nextAt = nextFollowUpDate || (nextFollowUpRequired && nextFollowUp?.scheduledAt)
  if (nextAt) {
    const next = await FollowUp.create({
      firm: req.user.firm,
      customer: followUp.customer,
      assignedTo: followUp.assignedTo,
      scheduledAt: nextAt,
      priority: nextFollowUp?.priority || followUp.priority || 'medium',
      type: nextFollowUp?.type || 'call',
      purpose: nextAction || nextFollowUp?.notes || 'Scheduled next follow-up',
      notes: nextAction || nextFollowUp?.notes || 'Scheduled next follow-up',
      project: followUp.project,
      createdBy: req.user._id,
      timeline: [{ type: 'created', note: 'Created from a completed follow-up' }],
    })
    followUp.timeline.push({ type: 'next_scheduled', note: 'Next follow-up scheduled' })
    void next
  }
  await followUp.save()

  writeAudit({ req, action: AUDIT_ACTIONS.STATUS_CHANGE, module: MODULES.FOLLOWUP, targetId: followUp._id, description: 'Follow-up completed' })
  return ok(res, followUp, 'Follow-up completed')
})

// PATCH /api/followups/:id — edit an upcoming follow-up (spec §Edit Upcoming
// Follow-ups). Completed/cancelled follow-ups are locked.
export const updateFollowUp = asyncHandler(async (req, res) => {
  const followUp = await findOwnedFollowUp(req)
  if ([FOLLOWUP_STATUS.COMPLETED, FOLLOWUP_STATUS.CANCELLED].includes(followUp.status)) {
    throw ApiError.badRequest('Completed or cancelled follow-ups cannot be edited')
  }
  const allowed = ['scheduledAt', 'type', 'priority', 'notes', 'purpose', 'conversationSummary', 'project']
  for (const k of allowed) if (req.body[k] !== undefined) followUp[k] = req.body[k]
  followUp.timeline.push({ type: 'updated', note: 'Follow-up updated' })
  await followUp.save()
  writeAudit({ req, action: AUDIT_ACTIONS.UPDATE, module: MODULES.FOLLOWUP, targetId: followUp._id, description: 'Follow-up updated' })
  return ok(res, followUp, 'Follow-up updated')
})

// PATCH /api/followups/:id/miss — triggers escalation to Sub-Admin (§9).
export const missFollowUp = asyncHandler(async (req, res) => {
  const { reason } = req.body
  const followUp = await findOwnedFollowUp(req)
  followUp.status = FOLLOWUP_STATUS.MISSED
  followUp.outcomeNotes = reason ? `Missed: ${reason}` : 'Missed'
  await followUp.save()

  const customer = await Customer.findById(followUp.customer).select('name firm')
  
  if (customer) {
    customer.logActivity('followup_missed', `Follow-up missed. Reason: ${reason || 'Not specified'}`, req.user._id)
    await customer.save()
  }

  // Escalate: notify the executive's sub-admin managers within the firm.
  const subAdmins = await User.find({ firm: followUp.firm, role: ROLES.SUB_ADMIN, isActive: true }).select('_id')
  notifyMany(subAdmins.map((s) => s._id), {
    firm: followUp.firm,
    type: NOTIFICATION_TYPES.FOLLOWUP_MISSED,
    title: 'Missed follow-up',
    message: `A follow-up for ${customer?.name || 'a customer'} was missed`,
    entityType: 'followup',
    entityId: followUp._id,
  })
  notify({
    firm: followUp.firm,
    recipient: followUp.assignedTo,
    type: NOTIFICATION_TYPES.FOLLOWUP_MISSED,
    title: 'Follow-up marked missed',
    message: `Your follow-up for ${customer?.name || 'a customer'} was missed`,
  })

  writeAudit({ req, action: AUDIT_ACTIONS.STATUS_CHANGE, module: MODULES.FOLLOWUP, targetId: followUp._id, description: 'Follow-up missed — escalated to sub-admin' })
  return ok(res, followUp, 'Follow-up marked missed and escalated')
})

// PATCH /api/followups/:id/reschedule
export const rescheduleFollowUp = asyncHandler(async (req, res) => {
  const { scheduledAt, reason, priority } = req.body
  const followUp = await findOwnedFollowUp(req)
  followUp.status = FOLLOWUP_STATUS.RESCHEDULED
  followUp.outcomeNotes = reason ? `Rescheduled: ${reason}` : 'Rescheduled'
  followUp.timeline.push({ type: 'rescheduled', note: reason || 'Follow-up rescheduled' })

  const next = await FollowUp.create({
    firm: followUp.firm,
    customer: followUp.customer,
    assignedTo: followUp.assignedTo,
    scheduledAt,
    priority: priority || followUp.priority,
    interestLevel: followUp.interestLevel,
    type: followUp.type,
    purpose: followUp.purpose,
    project: followUp.project,
    notes: reason ? `Rescheduled: ${reason}` : followUp.notes,
    createdBy: req.user._id,
    timeline: [{ type: 'created', note: 'Rescheduled from an earlier follow-up' }],
  })

  followUp.rescheduledTo = next._id
  await followUp.save()
  
  const customer = await Customer.findById(followUp.customer)
  if (customer) {
    customer.logActivity('followup_rescheduled', `Follow-up rescheduled. Reason: ${reason || 'Not specified'}`, req.user._id)
    await customer.save()
  }

  writeAudit({ req, action: AUDIT_ACTIONS.STATUS_CHANGE, module: MODULES.FOLLOWUP, targetId: followUp._id, description: 'Follow-up rescheduled' })
  return ok(res, { previous: followUp, next }, 'Follow-up rescheduled')
})

// PATCH /api/followups/:id/reassign — Sub-Admin/Admin reassign to another exec.
export const reassignFollowUp = asyncHandler(async (req, res) => {
  const followUp = await findOwnedFollowUp(req)
  const target = await User.findOne({ _id: req.body.assignedTo, firm: req.user.firm, role: ROLES.SALES_EXECUTIVE, isActive: true }).select('name')
  if (!target) throw ApiError.badRequest('Select an active sales executive')

  followUp.assignedTo = target._id
  await followUp.save()
  notify({
    firm: followUp.firm,
    recipient: target._id,
    type: NOTIFICATION_TYPES.FOLLOWUP_DUE,
    title: 'Follow-up reassigned to you',
    message: 'A follow-up has been reassigned to you',
    entityType: 'followup',
    entityId: followUp._id,
  })
  writeAudit({ req, action: AUDIT_ACTIONS.ASSIGN, module: MODULES.FOLLOWUP, targetId: followUp._id, description: `Follow-up reassigned to ${target.name}` })
  return ok(res, followUp, 'Follow-up reassigned')
})

// PATCH /api/followups/:id/cancel — cancel a follow-up (spec §Actions).
export const cancelFollowUp = asyncHandler(async (req, res) => {
  const followUp = await findOwnedFollowUp(req)
  followUp.status = FOLLOWUP_STATUS.CANCELLED
  followUp.outcomeNotes = req.body.reason ? `Cancelled: ${req.body.reason}` : 'Cancelled'
  await followUp.save()
  writeAudit({ req, action: AUDIT_ACTIONS.STATUS_CHANGE, module: MODULES.FOLLOWUP, targetId: followUp._id, description: 'Follow-up cancelled' })
  return ok(res, followUp, 'Follow-up cancelled')
})

async function findOwnedFollowUp(req) {
  const filter = { _id: req.params.id, ...firmScope(req.user) }
  if (req.user.role === ROLES.SALES_EXECUTIVE) filter.assignedTo = req.user._id
  const followUp = await FollowUp.findOne(filter)
  if (!followUp) throw ApiError.notFound('Follow-up not found')
  return followUp
}

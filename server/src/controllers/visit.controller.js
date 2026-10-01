import SiteVisit from '../models/SiteVisit.js'
import Customer from '../models/Customer.js'
import User from '../models/User.js'
import FollowUp from '../models/FollowUp.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from '../utils/ApiError.js'
import { ok, created } from '../utils/apiResponse.js'
import { paginate } from '../utils/paginate.js'
import { writeAudit } from '../middleware/audit.js'
import { notify } from '../services/notification.service.js'
import { AUDIT_ACTIONS, MODULES, ROLES, VISIT_STATUS, NOTIFICATION_TYPES } from '../config/constants.js'
import { ownershipScope, firmScope } from '../middleware/tenantScope.js'

// GET /api/visits?scope=upcoming|missed&status=
export const listVisits = asyncHandler(async (req, res) => {
  const { page, limit, status, scope, project, customer } = req.query
  const filter = { ...ownershipScope(req.user, 'assignedTo') }
  if (status) filter.status = status
  if (project) filter.project = project
  if (customer) filter.customer = customer
  // Sub-Admin/Admin may narrow to a single employee (Employee module tabs).
  if (req.query.assignedTo && req.user.role !== ROLES.SALES_EXECUTIVE) filter.assignedTo = req.query.assignedTo
  const now = new Date()
  if (scope === 'upcoming') {
    filter.status = VISIT_STATUS.SCHEDULED
    filter.scheduledAt = { $gte: now }
  } else if (scope === 'missed') {
    filter.status = VISIT_STATUS.SCHEDULED
    filter.scheduledAt = { $lt: now }
  }

  const { data, meta } = await paginate(SiteVisit, filter, {
    page,
    limit,
    sort: { scheduledAt: 1 },
    populate: [
      { path: 'customer', select: 'name mobile email status budgetMin budgetMax propertyType configuration' },
      { path: 'project', select: 'name location' },
      { path: 'builder', select: 'name' },
      { path: 'unit', select: 'unitNumber' },
      { path: 'assignedTo', select: 'name' },
      { path: 'createdBy', select: 'name' },
    ],
  })
  return ok(res, data, 'Site visits fetched', meta)
})

// POST /api/visits — create + visit reminder (§6/§9).
export const createVisit = asyncHandler(async (req, res) => {
  const customer = await Customer.findOne({ _id: req.body.customer, ...firmScope(req.user) })
  if (!customer) throw ApiError.notFound('Customer not found')
  if (req.user.role === ROLES.SALES_EXECUTIVE && String(customer.assignedTo) !== String(req.user._id)) {
    throw ApiError.forbidden('Customer is not assigned to you')
  }

  const visit = await SiteVisit.create({
    ...req.body,
    firm: req.user.firm,
    assignedTo: customer.assignedTo || req.user._id,
    createdBy: req.user._id,
    timeline: [{ type: 'scheduled', note: 'Visit scheduled' }],
  })
  customer.logActivity('visit_scheduled', 'Site visit scheduled', req.user._id)
  await customer.save()

  notify({
    firm: req.user.firm,
    recipient: visit.assignedTo,
    type: NOTIFICATION_TYPES.VISIT_REMINDER,
    title: 'Site visit scheduled',
    message: `Visit for ${customer.name} on ${new Date(req.body.scheduledAt).toLocaleString()}`,
    entityType: 'visit',
    entityId: visit._id,
  })
  writeAudit({ req, action: AUDIT_ACTIONS.CREATE, module: MODULES.VISIT, targetId: visit._id, targetLabel: customer.name, description: `Scheduled visit for ${customer.name}` })
  return created(res, visit, 'Site visit scheduled')
})

// PATCH /api/visits/:id/conduct
export const conductVisit = asyncHandler(async (req, res) => {
  const visit = await findOwnedVisit(req)
  visit.status = VISIT_STATUS.CONDUCTED
  visit.outcome = req.body.outcome
  visit.remarks = req.body.remarks
  if (req.body.photos) visit.photos = req.body.photos
  await visit.save()
  writeAudit({ req, action: AUDIT_ACTIONS.STATUS_CHANGE, module: MODULES.VISIT, targetId: visit._id, description: 'Visit conducted' })
  return ok(res, visit, 'Visit outcome captured')
})

// PATCH /api/visits/:id — edit an upcoming (not-yet-completed) visit.
export const updateVisit = asyncHandler(async (req, res) => {
  const visit = await findOwnedVisit(req)
  if ([VISIT_STATUS.CONDUCTED, VISIT_STATUS.CANCELLED].includes(visit.status)) {
    throw ApiError.badRequest('Completed or cancelled visits cannot be edited')
  }
  const allowed = ['project', 'builder', 'unit', 'scheduledAt', 'visitType', 'meetingPoint', 'notes']
  for (const k of allowed) if (req.body[k] !== undefined) visit[k] = req.body[k]
  visit.timeline.push({ type: 'updated', note: 'Visit details updated' })
  await visit.save()
  writeAudit({ req, action: AUDIT_ACTIONS.UPDATE, module: MODULES.VISIT, targetId: visit._id, description: 'Visit updated' })
  return ok(res, visit, 'Visit updated')
})

// PATCH /api/visits/:id/reschedule
export const rescheduleVisit = asyncHandler(async (req, res) => {
  const visit = await findOwnedVisit(req)
  visit.status = VISIT_STATUS.RESCHEDULED
  visit.reason = req.body.reason
  visit.timeline.push({ type: 'rescheduled', note: req.body.reason || 'Visit rescheduled' })
  const next = await SiteVisit.create({
    firm: visit.firm,
    customer: visit.customer,
    project: visit.project,
    builder: visit.builder,
    unit: visit.unit,
    assignedTo: visit.assignedTo,
    scheduledAt: req.body.scheduledAt,
    visitType: visit.visitType,
    meetingPoint: visit.meetingPoint,
    notes: visit.notes,
    createdBy: req.user._id,
    timeline: [{ type: 'scheduled', note: 'Rescheduled from an earlier visit' }],
  })
  visit.rescheduledTo = next._id
  await visit.save()
  // Keep the customer timeline in sync (spec: every visit activity updates it).
  await Customer.updateOne({ _id: visit.customer }, {
    $push: { activity: { action: 'visit_rescheduled', description: 'Site visit rescheduled', actor: req.user._id, at: new Date() } },
  })
  writeAudit({ req, action: AUDIT_ACTIONS.STATUS_CHANGE, module: MODULES.VISIT, targetId: visit._id, description: 'Visit rescheduled' })
  return ok(res, { previous: visit, next }, 'Visit rescheduled')
})

// PATCH /api/visits/:id/check-in — employee reaches the site (spec §Check-In).
// Captures GPS + time (+ optional photo) and moves the visit to In Progress.
export const checkInVisit = asyncHandler(async (req, res) => {
  const visit = await findOwnedVisit(req)
  if (visit.checkIn?.at) throw ApiError.badRequest('Already checked in for this visit')
  if ([VISIT_STATUS.CONDUCTED, VISIT_STATUS.CANCELLED].includes(visit.status)) {
    throw ApiError.badRequest('This visit can no longer be checked in')
  }
  const at = new Date()
  visit.checkIn = { at, location: req.body.location, photo: req.body.photo }
  visit.status = VISIT_STATUS.IN_PROGRESS
  visit.timeline.push({ type: 'check_in', note: req.body.location?.address || 'Checked in at site' })
  await visit.save()
  await Customer.updateOne({ _id: visit.customer }, {
    $push: { activity: { action: 'visit_check_in', description: 'Employee checked in at site', actor: req.user._id, at } },
  })
  writeAudit({ req, action: AUDIT_ACTIONS.STATUS_CHANGE, module: MODULES.VISIT, targetId: visit._id, description: 'Checked in at site visit' })
  return ok(res, visit, 'Checked in')
})

// PATCH /api/visits/:id/check-out — employee leaves the site (spec §Check-Out).
// Captures GPS + time, auto-calculates duration.
export const checkOutVisit = asyncHandler(async (req, res) => {
  const visit = await findOwnedVisit(req)
  if (!visit.checkIn?.at) throw ApiError.badRequest('Check in before checking out')
  if (visit.checkOut?.at) throw ApiError.badRequest('Already checked out for this visit')
  const at = new Date()
  visit.checkOut = { at, location: req.body.location, summary: req.body.summary }
  visit.durationMinutes = Math.max(0, Math.round((at - new Date(visit.checkIn.at)) / 60000))
  visit.timeline.push({ type: 'check_out', note: `Checked out · ${visit.durationMinutes} min on site` })
  await visit.save()
  await Customer.updateOne({ _id: visit.customer }, {
    $push: { activity: { action: 'visit_check_out', description: `Employee checked out (${visit.durationMinutes} min on site)`, actor: req.user._id, at } },
  })
  writeAudit({ req, action: AUDIT_ACTIONS.STATUS_CHANGE, module: MODULES.VISIT, targetId: visit._id, description: 'Checked out of site visit' })
  return ok(res, visit, 'Checked out')
})

// PATCH /api/visits/:id/complete — capture outcome + mark completed
// (spec §Complete Site Visit / §Visit Outcome). Optionally schedules a follow-up.
export const completeVisit = asyncHandler(async (req, res) => {
  const visit = await findOwnedVisit(req)
  if (visit.status === VISIT_STATUS.CONDUCTED) throw ApiError.badRequest('Visit already completed')
  const { feedback, interestLevel, nextAction, remarks, nextFollowUpDate } = req.body
  visit.status = VISIT_STATUS.CONDUCTED
  if (feedback !== undefined) visit.feedback = feedback
  if (interestLevel !== undefined) visit.interestLevel = interestLevel
  if (nextAction !== undefined) visit.nextAction = nextAction
  if (remarks !== undefined) visit.remarks = remarks
  visit.outcome = visit.outcome || feedback || 'Visit completed'
  visit.timeline.push({ type: 'completed', note: 'Visit completed' })
  if (feedback) visit.timeline.push({ type: 'feedback', note: feedback })
  await visit.save()

  const customer = await Customer.findById(visit.customer)
  if (customer) {
    customer.logActivity('visit_completed', `Site visit completed${interestLevel ? ` · ${interestLevel}` : ''}`, req.user._id)
    // Advance an early-stage lead to "site visit completed" (non-destructive).
    if ([undefined, null, 'new', 'in_progress', 'follow_up_due', 'interested', 'site_visit_scheduled'].includes(customer.status)) {
      customer.status = 'site_visit_completed'
    }
    await customer.save()
  }

  // Optional follow-up reminder.
  let followUp = null
  if (nextFollowUpDate) {
    followUp = await FollowUp.create({
      firm: visit.firm,
      customer: visit.customer,
      assignedTo: visit.assignedTo,
      scheduledAt: nextFollowUpDate,
      type: 'call',
      purpose: 'Post site-visit follow-up',
      notes: nextAction || 'Follow up after site visit',
      project: visit.project,
      createdBy: req.user._id,
    })
  }

  writeAudit({ req, action: AUDIT_ACTIONS.STATUS_CHANGE, module: MODULES.VISIT, targetId: visit._id, description: 'Site visit completed' })
  return ok(res, { visit, followUp }, 'Visit completed')
})

// PATCH /api/visits/:id/cancel
export const cancelVisit = asyncHandler(async (req, res) => {
  const visit = await findOwnedVisit(req)
  visit.status = VISIT_STATUS.CANCELLED
  visit.reason = req.body.reason
  await visit.save()
  writeAudit({ req, action: AUDIT_ACTIONS.STATUS_CHANGE, module: MODULES.VISIT, targetId: visit._id, description: 'Visit cancelled' })
  return ok(res, visit, 'Visit cancelled')
})

// PATCH /api/visits/:id/flag-missed — Sub-Admin oversight (§5).
export const flagMissed = asyncHandler(async (req, res) => {
  const visit = await SiteVisit.findOne({ _id: req.params.id, ...firmScope(req.user) })
  if (!visit) throw ApiError.notFound('Visit not found')
  visit.status = VISIT_STATUS.MISSED
  await visit.save()
  notify({
    firm: visit.firm,
    recipient: visit.assignedTo,
    type: NOTIFICATION_TYPES.VISIT_REMINDER,
    title: 'Missed site visit',
    message: 'A scheduled site visit was flagged as missed',
    entityType: 'visit',
    entityId: visit._id,
  })
  writeAudit({ req, action: AUDIT_ACTIONS.STATUS_CHANGE, module: MODULES.VISIT, targetId: visit._id, description: 'Visit flagged missed by oversight' })
  return ok(res, visit, 'Visit flagged as missed')
})

// PATCH /api/visits/:id/status — generic status change (spec §Actions ·
// Update Visit Status). Accepts scheduled/confirmed/in_progress/conducted/etc.
export const updateVisitStatus = asyncHandler(async (req, res) => {
  const visit = await findOwnedVisit(req)
  const prev = visit.status
  visit.status = req.body.status
  await visit.save()
  writeAudit({ req, action: AUDIT_ACTIONS.STATUS_CHANGE, module: MODULES.VISIT, targetId: visit._id, description: `Visit ${prev} → ${visit.status}` })
  return ok(res, visit, 'Visit status updated')
})

// PATCH /api/visits/:id/reassign — reassign the visit to another executive
// (Sub-Admin/Admin). Notifies the new owner.
export const reassignVisit = asyncHandler(async (req, res) => {
  const visit = await SiteVisit.findOne({ _id: req.params.id, ...firmScope(req.user) })
  if (!visit) throw ApiError.notFound('Visit not found')

  const target = await User.findOne({ _id: req.body.assignedTo, firm: req.user.firm, role: ROLES.SALES_EXECUTIVE, isActive: true }).select('name')
  if (!target) throw ApiError.badRequest('Select an active sales executive')

  visit.assignedTo = target._id
  await visit.save()
  notify({
    firm: visit.firm,
    recipient: target._id,
    type: NOTIFICATION_TYPES.VISIT_REMINDER,
    title: 'Site visit reassigned to you',
    message: 'A site visit has been reassigned to you',
    entityType: 'visit',
    entityId: visit._id,
  })
  writeAudit({ req, action: AUDIT_ACTIONS.ASSIGN, module: MODULES.VISIT, targetId: visit._id, description: `Visit reassigned to ${target.name}` })
  return ok(res, visit, 'Visit reassigned')
})

async function findOwnedVisit(req) {
  const filter = { _id: req.params.id, ...firmScope(req.user) }
  if (req.user.role === ROLES.SALES_EXECUTIVE) filter.assignedTo = req.user._id
  const visit = await SiteVisit.findOne(filter)
  if (!visit) throw ApiError.notFound('Visit not found')
  return visit
}

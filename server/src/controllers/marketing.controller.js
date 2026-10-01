import mongoose from 'mongoose'
import MarketingTask from '../models/MarketingTask.js'
import MarketingCampaign from '../models/MarketingCampaign.js'
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
import {
  CHANNEL_BY_TYPE,
  MARKETING_CHANNEL,
  ONLINE_MARKETING_TYPES,
  OFFLINE_MARKETING_TYPES,
  MARKETING_TYPES,
  MARKETING_TASK_STATUS,
  MARKETING_PRIORITY,
  CAMPAIGN_STATUS,
  isOverdue,
} from '../config/marketing.js'

// ── Helpers ──────────────────────────────────────────────────────────────────
const canAssign = (user) => can(user, MODULES.MARKETING, 'assign')
const canDelete = (user) => can(user, MODULES.MARKETING, 'delete')

const OPEN_STATUSES = ['draft', 'pending', 'in_progress', 'on_hold']

// Attach a derived `overdue` flag (never stored — see config/marketing.js).
const withDerived = (task) => ({ ...task, overdue: isOverdue(task) })

// The set of tasks a user is allowed to see: managers → whole firm; everyone
// else → only tasks they own (§Visibility Rules).
function visibilityFilter(user) {
  if (canAssign(user)) return { ...firmScope(user) }
  return { ...firmScope(user), owner: user._id }
}

// Load a task the caller may READ, or 404.
async function loadVisibleTask(req) {
  const task = await MarketingTask.findOne({ _id: req.params.id, ...visibilityFilter(req.user) })
  if (!task) throw ApiError.notFound('Marketing task not found')
  return task
}

// Can the caller WRITE to this task? Owner (while open) or a manager.
function assertWritable(task, user, { allowCompleted = false } = {}) {
  const mine = String(task.owner) === String(user._id)
  if (!mine && !canAssign(user)) throw ApiError.forbidden('You can only update your own tasks')
  if (!allowCompleted && ['completed', 'cancelled'].includes(task.status)) {
    throw ApiError.badRequest('Completed or cancelled tasks are read-only')
  }
}

function logActivity(task, type, note, user) {
  task.activity.push({ type, note, actor: user._id, actorName: user.name })
}

// Notify the firm's managers (admins + sub-admins) of a marketing event.
async function notifyManagers(firm, payload, excludeId) {
  if (!firm) return
  const managers = await User.find({ firm, role: { $in: [ROLES.ADMIN, ROLES.SUB_ADMIN] }, isActive: true }).select('_id').lean()
  const ids = managers.map((m) => m._id).filter((id) => String(id) !== String(excludeId))
  await notifyMany(ids, payload)
}

// ── Config (Create Task form + filters) ──────────────────────────────────────
export const getConfig = asyncHandler(async (_req, res) => {
  return ok(res, {
    channels: Object.values(MARKETING_CHANNEL),
    onlineTypes: ONLINE_MARKETING_TYPES,
    offlineTypes: OFFLINE_MARKETING_TYPES,
    marketingTypes: MARKETING_TYPES,
    statuses: MARKETING_TASK_STATUS,
    priorities: MARKETING_PRIORITY,
    campaignStatuses: CAMPAIGN_STATUS,
  })
})

// ── Tasks ────────────────────────────────────────────────────────────────────
export const listTasks = asyncHandler(async (req, res) => {
  const q = req.query
  const scope = q.scope || 'mine'
  if (scope === 'team' && !canAssign(req.user)) {
    throw ApiError.forbidden('You are not permitted to view team tasks')
  }
  const filter = scope === 'team' ? { ...firmScope(req.user) } : { ...firmScope(req.user), owner: req.user._id }

  if (q.status && q.status !== 'all') {
    if (q.status === 'overdue') {
      filter.status = { $in: OPEN_STATUSES }
      filter.dueDate = { $lt: new Date() }
    } else {
      filter.status = q.status
    }
  }
  if (q.priority && q.priority !== 'all') filter.priority = q.priority
  if (q.channel && q.channel !== 'all') filter.channel = q.channel
  if (q.marketingType) filter.marketingType = q.marketingType
  if (q.campaign) filter.campaign = q.campaign
  if (q.branch) filter.branch = q.branch
  if (q.assignedTo && scope === 'team') filter.owner = q.assignedTo
  if (q.taskType === 'assigned') filter.isSelfTask = false
  if (q.taskType === 'self') filter.isSelfTask = true
  if (q.dateFrom || q.dateTo) {
    filter.createdAt = {}
    if (q.dateFrom) filter.createdAt.$gte = new Date(q.dateFrom)
    if (q.dateTo) filter.createdAt.$lte = new Date(q.dateTo)
  }
  if (q.search) {
    filter.$or = [
      { title: { $regex: q.search, $options: 'i' } },
      { code: { $regex: q.search, $options: 'i' } },
    ]
  }

  const sort = q.sortBy === 'oldest' ? { createdAt: 1 } : q.sortBy === 'due' ? { dueDate: 1 } : { createdAt: -1 }

  const { data, meta } = await paginate(MarketingTask, filter, {
    page: q.page,
    limit: q.limit,
    sort,
    select: '-activity -remarks',
    populate: [
      { path: 'owner', select: 'name email role branch' },
      { path: 'campaign', select: 'name status' },
      { path: 'createdBy', select: 'name role' },
    ],
  })
  return ok(res, data.map(withDerived), 'Marketing tasks fetched', meta)
})

export const getTask = asyncHandler(async (req, res) => {
  const task = await MarketingTask.findOne({ _id: req.params.id, ...visibilityFilter(req.user) })
    .populate('owner', 'name email role branch')
    .populate('createdBy', 'name role')
    .populate('campaign', 'name status budget')
    .populate('relatedProject', 'name')
    .populate('relatedBuilder', 'name')
    .populate('activity.actor', 'name role')
    .lean()
  if (!task) throw ApiError.notFound('Marketing task not found')
  return ok(res, withDerived(task))
})

export const createTask = asyncHandler(async (req, res) => {
  const b = req.body
  const channel = b.channel || CHANNEL_BY_TYPE[b.marketingType]
  if (!channel) throw ApiError.badRequest('Unknown marketing type')

  // Resolve the owner: Assign To (managers only) → Assigned Task; else Self Task.
  let owner = req.user
  let isSelfTask = true
  if (b.assignTo && String(b.assignTo) !== String(req.user._id)) {
    if (!canAssign(req.user)) throw ApiError.forbidden('You are not permitted to assign tasks to others')
    owner = await User.findOne({ _id: b.assignTo, firm: req.user.firm })
    if (!owner) throw ApiError.badRequest('Assignee not found in your organization')
    isSelfTask = false
  }

  // Managers may create straight into Draft; everything else starts Pending.
  const status = b.status === 'draft' && canAssign(req.user) ? 'draft' : 'pending'

  const seq = (await MarketingTask.countDocuments({ firm: req.user.firm })) + 1
  const code = `MKT-${String(seq).padStart(4, '0')}`

  const task = await MarketingTask.create({
    firm: req.user.firm || null,
    code,
    owner: owner._id,
    ownerName: owner.name,
    createdBy: req.user._id,
    createdByName: req.user.name,
    createdByRole: req.user.role,
    isSelfTask,
    title: b.title,
    description: b.description || '',
    channel,
    marketingType: b.marketingType,
    campaign: b.campaign || null,
    relatedProject: b.relatedProject || null,
    relatedBuilder: b.relatedBuilder || null,
    branch: b.branch || owner.branch || req.user.branch || '',
    priority: b.priority || 'medium',
    dueDate: b.dueDate || undefined,
    estimatedBudget: b.estimatedBudget || 0,
    status,
    activity: [
      { type: 'created', note: `Task created (${isSelfTask ? 'self task' : 'assigned task'})`, actor: req.user._id, actorName: req.user.name },
      ...(isSelfTask ? [] : [{ type: 'assigned', note: `Assigned to ${owner.name}`, actor: req.user._id, actorName: req.user.name }]),
    ],
  })

  // Notifications: assigned → tell the doer; self → tell managers (§Notifications).
  if (!isSelfTask) {
    notify({
      firm: task.firm, recipient: owner._id, type: NOTIFICATION_TYPES.MARKETING_TASK_ASSIGNED,
      title: 'New marketing task assigned', message: `${req.user.name} assigned you: ${task.title}`,
      entityType: 'marketing_task', entityId: task._id,
    })
  } else {
    notifyManagers(task.firm, {
      type: NOTIFICATION_TYPES.MARKETING_TASK_UPDATE, title: 'Self task created',
      message: `${req.user.name} created a self task: ${task.title}`,
      entityType: 'marketing_task', entityId: task._id,
    }, req.user._id)
  }

  writeAudit({ req, action: AUDIT_ACTIONS.CREATE, module: MODULES.MARKETING, targetId: task._id, targetLabel: task.title, description: `Created marketing task "${task.title}"${isSelfTask ? '' : ` and assigned it to ${owner.name}`}` })
  return created(res, task, isSelfTask ? 'Self task created' : 'Task created and assigned')
})

export const updateTask = asyncHandler(async (req, res) => {
  const task = await loadVisibleTask(req)
  assertWritable(task, req.user)
  const b = req.body
  const fields = ['title', 'description', 'campaign', 'relatedProject', 'relatedBuilder', 'branch', 'priority', 'dueDate', 'estimatedBudget']
  for (const f of fields) if (b[f] !== undefined) task[f] = b[f] === '' ? undefined : b[f]
  if (b.marketingType) {
    task.marketingType = b.marketingType
    task.channel = b.channel || CHANNEL_BY_TYPE[b.marketingType]
  }
  logActivity(task, 'updated', 'Task details updated', req.user)
  await task.save()
  writeAudit({ req, action: AUDIT_ACTIONS.UPDATE, module: MODULES.MARKETING, targetId: task._id, targetLabel: task.title, description: `Edited marketing task "${task.title}"` })
  return ok(res, withDerived(task.toObject()), 'Task updated')
})

export const updateProgress = asyncHandler(async (req, res) => {
  const task = await loadVisibleTask(req)
  assertWritable(task, req.user)
  const { status, progress, note } = req.body
  if (progress !== undefined) task.progress = progress
  if (status) {
    if (status === 'in_progress' && !task.startedAt) {
      task.startedAt = new Date()
      logActivity(task, 'started', 'Work started', req.user)
    }
    task.status = status
  }
  logActivity(task, 'progress_updated', note || `Progress ${task.progress}%${status ? ` · ${status}` : ''}`, req.user)
  await task.save()
  // Assigned tasks: keep the assigner in the loop.
  if (!task.isSelfTask && task.createdBy && String(task.createdBy) !== String(req.user._id)) {
    notify({ firm: task.firm, recipient: task.createdBy, type: NOTIFICATION_TYPES.MARKETING_TASK_UPDATE, title: 'Task progress updated', message: `${req.user.name} updated: ${task.title}`, entityType: 'marketing_task', entityId: task._id })
  }
  writeAudit({ req, action: AUDIT_ACTIONS.UPDATE, module: MODULES.MARKETING, targetId: task._id, targetLabel: task.title, description: note ? `Updated progress on "${task.title}" — ${note}` : `Updated progress on "${task.title}"` })
  return ok(res, withDerived(task.toObject()), 'Progress updated')
})

export const changeStatus = asyncHandler(async (req, res) => {
  const task = await loadVisibleTask(req)
  const { status, note } = req.body
  if (status === 'completed') throw ApiError.badRequest('Use the complete action to finish a task')
  // Cancelling a task others own is a management action.
  if (status === 'cancelled' && String(task.owner) !== String(req.user._id) && !canAssign(req.user)) {
    throw ApiError.forbidden('Only a manager can cancel this task')
  }
  assertWritable(task, req.user, { allowCompleted: status === 'cancelled' })
  task.status = status
  if (status === 'in_progress' && !task.startedAt) task.startedAt = new Date()
  if (status === 'cancelled') task.cancelReason = note || ''
  logActivity(task, status === 'cancelled' ? 'cancelled' : 'status_changed', note || `Status set to ${status}`, req.user)
  await task.save()
  writeAudit({ req, action: AUDIT_ACTIONS.STATUS_CHANGE, module: MODULES.MARKETING, targetId: task._id, targetLabel: task.title, description: `Marketing task "${task.title}" → ${status}` })
  return ok(res, withDerived(task.toObject()), `Task ${status.replace('_', ' ')}`)
})

export const completeTask = asyncHandler(async (req, res) => {
  const task = await loadVisibleTask(req)
  assertWritable(task, req.user)
  task.status = 'completed'
  task.progress = 100
  task.completedAt = new Date()
  task.completionRemarks = req.body.completionRemarks || ''
  logActivity(task, 'completed', task.completionRemarks || 'Task completed', req.user)
  await task.save()
  // Notify the assigner (Assigned Task Completed §Notifications → Team Leader).
  if (!task.isSelfTask && task.createdBy && String(task.createdBy) !== String(req.user._id)) {
    notify({ firm: task.firm, recipient: task.createdBy, type: NOTIFICATION_TYPES.MARKETING_TASK_UPDATE, title: 'Marketing task completed', message: `${req.user.name} completed: ${task.title}`, entityType: 'marketing_task', entityId: task._id })
  }
  writeAudit({ req, action: AUDIT_ACTIONS.STATUS_CHANGE, module: MODULES.MARKETING, targetId: task._id, targetLabel: task.title, description: `Completed marketing task "${task.title}"` })
  return ok(res, withDerived(task.toObject()), 'Task completed')
})

// Reopen a completed task (owner or manager). Clears completion + returns it to
// In Progress so work can resume (§Task Actions · Reopen).
export const reopenTask = asyncHandler(async (req, res) => {
  const task = await loadVisibleTask(req)
  const mine = String(task.owner) === String(req.user._id)
  if (!mine && !canAssign(req.user)) throw ApiError.forbidden('You can only reopen your own tasks')
  if (task.status !== 'completed') throw ApiError.badRequest('Only completed tasks can be reopened')
  task.status = 'in_progress'
  task.completedAt = undefined
  task.completionRemarks = ''
  if ((task.progress || 0) >= 100) task.progress = 90
  logActivity(task, 'status_changed', req.body?.note || 'Task reopened', req.user)
  await task.save()
  if (!task.isSelfTask && task.createdBy && String(task.createdBy) !== String(req.user._id)) {
    notify({ firm: task.firm, recipient: task.createdBy, type: NOTIFICATION_TYPES.MARKETING_TASK_UPDATE, title: 'Marketing task reopened', message: `${req.user.name} reopened: ${task.title}`, entityType: 'marketing_task', entityId: task._id })
  }
  writeAudit({ req, action: AUDIT_ACTIONS.STATUS_CHANGE, module: MODULES.MARKETING, targetId: task._id, targetLabel: task.title, description: `Reopened marketing task "${task.title}"` })
  return ok(res, withDerived(task.toObject()), 'Task reopened')
})

export const reassignTask = asyncHandler(async (req, res) => {
  if (!canAssign(req.user)) throw ApiError.forbidden('You are not permitted to reassign tasks')
  const task = await MarketingTask.findOne({ _id: req.params.id, ...firmScope(req.user) })
  if (!task) throw ApiError.notFound('Marketing task not found')
  const next = await User.findOne({ _id: req.body.assignTo, firm: req.user.firm })
  if (!next) throw ApiError.badRequest('Assignee not found in your organization')
  const prevOwner = task.owner
  task.owner = next._id
  task.ownerName = next.name
  task.isSelfTask = false
  task.branch = next.branch || task.branch
  logActivity(task, 'reassigned', `Reassigned to ${next.name}${req.body.reason ? ` · ${req.body.reason}` : ''}`, req.user)
  await task.save()
  notify({ firm: task.firm, recipient: next._id, type: NOTIFICATION_TYPES.MARKETING_TASK_REASSIGNED, title: 'Marketing task reassigned to you', message: `${req.user.name} reassigned: ${task.title}`, entityType: 'marketing_task', entityId: task._id })
  if (String(prevOwner) !== String(next._id)) {
    notify({ firm: task.firm, recipient: prevOwner, type: NOTIFICATION_TYPES.MARKETING_TASK_REASSIGNED, title: 'Marketing task reassigned', message: `${task.title} was reassigned to ${next.name}`, entityType: 'marketing_task', entityId: task._id })
  }
  writeAudit({ req, action: AUDIT_ACTIONS.ASSIGN, module: MODULES.MARKETING, targetId: task._id, targetLabel: task.title, description: `Reassigned "${task.title}" to ${next.name}` })
  return ok(res, withDerived(task.toObject()), 'Task reassigned')
})

export const changeDueDate = asyncHandler(async (req, res) => {
  const task = await loadVisibleTask(req)
  if (String(task.owner) !== String(req.user._id) && !canAssign(req.user)) throw ApiError.forbidden('Not permitted')
  task.dueDate = req.body.dueDate
  logActivity(task, 'due_date_changed', `Due date changed${req.body.reason ? ` · ${req.body.reason}` : ''}`, req.user)
  await task.save()
  writeAudit({ req, action: AUDIT_ACTIONS.UPDATE, module: MODULES.MARKETING, targetId: task._id, targetLabel: task.title, description: `Changed due date on "${task.title}"` })
  return ok(res, withDerived(task.toObject()), 'Due date updated')
})

export const addAttachment = asyncHandler(async (req, res) => {
  const task = await loadVisibleTask(req)
  assertWritable(task, req.user, { allowCompleted: true })
  if (!req.file) throw ApiError.badRequest('No file uploaded')
  const doc = {
    label: req.body.label || req.file.originalname,
    fileName: req.file.originalname,
    fileUrl: `/uploads/${req.file.filename}`,
    kind: req.body.kind || 'proof',
    uploadedBy: req.user._id,
    uploadedByName: req.user.name,
  }
  task.attachments.push(doc)
  logActivity(task, 'attachment_uploaded', doc.label, req.user)
  await task.save()
  writeAudit({ req, action: AUDIT_ACTIONS.UPDATE, module: MODULES.MARKETING, targetId: task._id, targetLabel: task.title, description: `Uploaded attachment to "${task.title}"` })
  return created(res, task.attachments.at(-1), 'Attachment uploaded')
})

// The related roles for a task: its owner (doer) + its creator/assigner. Used to
// notify everyone connected when a remark/link is added (minus the actor).
function relatedRecipients(task, actorId) {
  return [task.owner, task.createdBy].filter((id) => id && String(id) !== String(actorId))
}

export const addLink = asyncHandler(async (req, res) => {
  const task = await loadVisibleTask(req)
  assertWritable(task, req.user, { allowCompleted: true })
  task.links.push({ url: req.body.url, label: req.body.label || req.body.url, addedBy: req.user._id })
  logActivity(task, 'attachment_uploaded', `Added link: ${req.body.label || req.body.url}`, req.user)
  await task.save()
  // Surface to related roles + Activity History.
  notifyMany(relatedRecipients(task, req.user._id), { firm: task.firm, type: NOTIFICATION_TYPES.MARKETING_TASK_UPDATE, title: 'New link on task', message: `${req.user.name} added a link to "${task.title}"`, entityType: 'marketing_task', entityId: task._id })
  writeAudit({ req, action: AUDIT_ACTIONS.UPDATE, module: MODULES.MARKETING, targetId: task._id, targetLabel: task.title, description: `Added a link to "${task.title}": ${req.body.label || req.body.url}` })
  return created(res, task.links.at(-1), 'Link added')
})

export const addRemark = asyncHandler(async (req, res) => {
  const task = await loadVisibleTask(req)
  // Managers + owner can leave remarks (related managers may comment on self tasks).
  if (String(task.owner) !== String(req.user._id) && !canAssign(req.user)) throw ApiError.forbidden('Not permitted')
  task.remarks.push({ text: req.body.text, author: req.user._id, authorName: req.user.name, authorRole: req.user.role })
  logActivity(task, 'remark_added', req.body.text, req.user)
  await task.save()
  // Notify the related roles (owner + assigner) so remarks surface for everyone,
  // and record it in the module Activity History via the audit log.
  notifyMany(relatedRecipients(task, req.user._id), { firm: task.firm, type: NOTIFICATION_TYPES.MARKETING_TASK_UPDATE, title: 'New remark on task', message: `${req.user.name} on "${task.title}": ${req.body.text.slice(0, 90)}`, entityType: 'marketing_task', entityId: task._id })
  writeAudit({ req, action: AUDIT_ACTIONS.UPDATE, module: MODULES.MARKETING, targetId: task._id, targetLabel: task.title, description: `Added a remark on "${task.title}": ${req.body.text.slice(0, 120)}` })
  return created(res, task.remarks.at(-1), 'Remark added')
})

export const deleteTask = asyncHandler(async (req, res) => {
  const task = await MarketingTask.findOne({ _id: req.params.id, ...firmScope(req.user) })
  if (!task) throw ApiError.notFound('Marketing task not found')
  const mine = String(task.owner) === String(req.user._id)
  // Employees can only delete their own DRAFT self tasks (§Visibility Rules).
  if (canDelete(req.user) && canAssign(req.user)) {
    // manager: may delete any
  } else if (mine && task.isSelfTask && task.status === 'draft') {
    // owner deleting own draft self task
  } else {
    throw ApiError.forbidden('Only draft self tasks can be deleted (managers can delete any)')
  }
  await task.deleteOne()
  writeAudit({ req, action: AUDIT_ACTIONS.DELETE, module: MODULES.MARKETING, targetId: task._id, targetLabel: task.title, description: `Deleted marketing task "${task.title}"` })
  return ok(res, { _id: task._id }, 'Task deleted')
})

// ── Campaigns ────────────────────────────────────────────────────────────────
export const listCampaigns = asyncHandler(async (req, res) => {
  const filter = { ...firmScope(req.user) }
  if (req.query.status && req.query.status !== 'all') filter.status = req.query.status
  const campaigns = await MarketingCampaign.find(filter).populate('builder', 'name').populate('project', 'name').sort({ createdAt: -1 }).lean()
  // Attach task counts + completion + spent (sum of task budgets) per campaign.
  const ids = campaigns.map((c) => c._id)
  const stats = await MarketingTask.aggregate([
    { $match: { campaign: { $in: ids } } },
    { $group: { _id: '$campaign', tasks: { $sum: 1 }, completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } }, budget: { $sum: '$estimatedBudget' } } },
  ])
  const byId = Object.fromEntries(stats.map((s) => [String(s._id), s]))
  const data = campaigns.map((c) => ({ ...c, taskCount: byId[String(c._id)]?.tasks || 0, completedCount: byId[String(c._id)]?.completed || 0, taskBudget: byId[String(c._id)]?.budget || 0 }))
  return ok(res, data, 'Campaigns fetched')
})

export const getCampaign = asyncHandler(async (req, res) => {
  const campaign = await MarketingCampaign.findOne({ _id: req.params.id, ...firmScope(req.user) }).populate('builder', 'name').populate('project', 'name').lean()
  if (!campaign) throw ApiError.notFound('Campaign not found')
  const tasks = await MarketingTask.find({ campaign: campaign._id }).populate('owner', 'name').select('code title status priority channel marketingType dueDate owner estimatedBudget').sort({ createdAt: -1 }).lean()
  return ok(res, { campaign, tasks: tasks.map(withDerived) })
})

export const createCampaign = asyncHandler(async (req, res) => {
  if (!canAssign(req.user)) throw ApiError.forbidden('You are not permitted to manage campaigns')
  const campaign = await MarketingCampaign.create({
    ...req.body,
    builder: req.body.builder || null,
    project: req.body.project || null,
    firm: req.user.firm || null,
    createdBy: req.user._id,
    createdByName: req.user.name,
  })
  writeAudit({ req, action: AUDIT_ACTIONS.CREATE, module: MODULES.MARKETING, targetId: campaign._id, targetLabel: campaign.name, description: `Created campaign "${campaign.name}"` })
  if (campaign.status === 'active') {
    notifyManagers(campaign.firm, { type: NOTIFICATION_TYPES.CAMPAIGN_STARTED, title: 'Campaign started', message: `Campaign "${campaign.name}" is now active`, entityType: 'campaign', entityId: campaign._id }, req.user._id)
  }
  return created(res, campaign, 'Campaign created')
})

export const updateCampaign = asyncHandler(async (req, res) => {
  if (!canAssign(req.user)) throw ApiError.forbidden('You are not permitted to manage campaigns')
  const campaign = await MarketingCampaign.findOne({ _id: req.params.id, ...firmScope(req.user) })
  if (!campaign) throw ApiError.notFound('Campaign not found')
  const prevStatus = campaign.status
  for (const f of ['name', 'description', 'budget', 'startDate', 'endDate', 'branch', 'status', 'builder', 'project']) {
    if (req.body[f] !== undefined) campaign[f] = req.body[f] === '' ? null : req.body[f]
  }
  await campaign.save()
  writeAudit({ req, action: AUDIT_ACTIONS.UPDATE, module: MODULES.MARKETING, targetId: campaign._id, targetLabel: campaign.name, description: `Updated campaign "${campaign.name}"` })
  if (prevStatus !== 'active' && campaign.status === 'active') {
    notifyManagers(campaign.firm, { type: NOTIFICATION_TYPES.CAMPAIGN_STARTED, title: 'Campaign started', message: `Campaign "${campaign.name}" is now active`, entityType: 'campaign', entityId: campaign._id }, req.user._id)
  }
  if (prevStatus !== 'completed' && campaign.status === 'completed') {
    notifyManagers(campaign.firm, { type: NOTIFICATION_TYPES.CAMPAIGN_COMPLETED, title: 'Campaign completed', message: `Campaign "${campaign.name}" is complete`, entityType: 'campaign', entityId: campaign._id }, req.user._id)
  }
  return ok(res, campaign, 'Campaign updated')
})

export const deleteCampaign = asyncHandler(async (req, res) => {
  if (!canAssign(req.user)) throw ApiError.forbidden('You are not permitted to manage campaigns')
  const campaign = await MarketingCampaign.findOne({ _id: req.params.id, ...firmScope(req.user) })
  if (!campaign) throw ApiError.notFound('Campaign not found')
  // Detach tasks (they keep working without a campaign) then remove it.
  await MarketingTask.updateMany({ campaign: campaign._id }, { $set: { campaign: null } })
  await campaign.deleteOne()
  writeAudit({ req, action: AUDIT_ACTIONS.DELETE, module: MODULES.MARKETING, targetId: campaign._id, targetLabel: campaign.name, description: `Deleted campaign "${campaign.name}"` })
  return ok(res, { _id: campaign._id }, 'Campaign deleted')
})

// ── Shared analytics filter builder (Dashboard + Reports) ────────────────────
function analyticsFilter(req) {
  const q = req.query
  // Managers default to team-wide; everyone else is locked to their own tasks.
  const teamAllowed = canAssign(req.user)
  const filter = teamAllowed && q.scope !== 'mine' ? { ...firmScope(req.user) } : { ...firmScope(req.user), owner: req.user._id }
  if (q.branch) filter.branch = q.branch
  if (q.employee && teamAllowed) filter.owner = q.employee
  if (q.campaign) filter.campaign = new mongoose.Types.ObjectId(q.campaign)
  if (q.channel && q.channel !== 'all') filter.channel = q.channel
  if (q.marketingType) filter.marketingType = q.marketingType
  if (q.status && q.status !== 'all' && q.status !== 'overdue') filter.status = q.status
  if (q.dateFrom || q.dateTo) {
    filter.createdAt = {}
    if (q.dateFrom) filter.createdAt.$gte = new Date(q.dateFrom)
    if (q.dateTo) filter.createdAt.$lte = new Date(q.dateTo)
  }
  return filter
}

// ── Dashboard ────────────────────────────────────────────────────────────────
export const dashboard = asyncHandler(async (req, res) => {
  const filter = analyticsFilter(req)
  const now = new Date()
  const soon = new Date(now.getTime() + 7 * 86400000)

  const [byStatus, byChannel, byType, empProd, campPerf, upcoming, recent, mineCount, overdueCount] = await Promise.all([
    MarketingTask.aggregate([{ $match: filter }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
    MarketingTask.aggregate([{ $match: filter }, { $group: { _id: '$channel', n: { $sum: 1 } } }]),
    MarketingTask.aggregate([{ $match: filter }, { $group: { _id: '$marketingType', n: { $sum: 1 } } }, { $sort: { n: -1 } }, { $limit: 8 }]),
    MarketingTask.aggregate([
      { $match: filter },
      { $group: { _id: '$owner', ownerName: { $first: '$ownerName' }, total: { $sum: 1 }, completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } } } },
      { $sort: { completed: -1 } }, { $limit: 8 },
    ]),
    MarketingTask.aggregate([
      { $match: { ...filter, campaign: { $ne: null } } },
      { $group: { _id: '$campaign', total: { $sum: 1 }, completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } }, budget: { $sum: '$estimatedBudget' } } },
      { $sort: { total: -1 } }, { $limit: 6 },
    ]),
    MarketingTask.find({ ...filter, status: { $in: OPEN_STATUSES }, dueDate: { $gte: now, $lte: soon } }).populate('owner', 'name').select('code title dueDate priority status owner marketingType').sort({ dueDate: 1 }).limit(8).lean(),
    AuditLog.find({ module: MODULES.MARKETING, ...firmScope(req.user), ...(canAssign(req.user) ? {} : { actor: req.user._id }) }).populate('actor', 'name role').sort({ createdAt: -1 }).limit(10).lean(),
    MarketingTask.countDocuments({ ...firmScope(req.user), owner: req.user._id }),
    MarketingTask.countDocuments({ ...filter, status: { $in: OPEN_STATUSES }, dueDate: { $lt: now } }),
  ])

  const statusMap = Object.fromEntries(byStatus.map((s) => [s._id, s.n]))
  const channelMap = Object.fromEntries(byChannel.map((c) => [c._id, c.n]))
  const total = byStatus.reduce((s, x) => s + x.n, 0)

  // Resolve campaign names for the performance widget.
  const campaigns = await MarketingCampaign.find({ _id: { $in: campPerf.map((c) => c._id) } }).select('name').lean()
  const campName = Object.fromEntries(campaigns.map((c) => [String(c._id), c.name]))

  return ok(res, {
    kpis: {
      total,
      pending: statusMap.pending || 0,
      inProgress: statusMap.in_progress || 0,
      completed: statusMap.completed || 0,
      onHold: statusMap.on_hold || 0,
      draft: statusMap.draft || 0,
      cancelled: statusMap.cancelled || 0,
      overdue: overdueCount,
      myTasks: mineCount,
      teamTasks: canAssign(req.user) ? total : mineCount,
      online: channelMap[MARKETING_CHANNEL.ONLINE] || 0,
      offline: channelMap[MARKETING_CHANNEL.OFFLINE] || 0,
    },
    statusDistribution: MARKETING_TASK_STATUS.map((s) => ({ status: s, count: statusMap[s] || 0 })),
    channelDistribution: [
      { channel: 'online', count: channelMap.online || 0 },
      { channel: 'offline', count: channelMap.offline || 0 },
    ],
    typeDistribution: byType.map((t) => ({ type: t._id, count: t.n })),
    employeeProductivity: empProd.map((e) => ({ employee: e.ownerName || 'Unknown', total: e.total, completed: e.completed, rate: e.total ? Math.round((e.completed / e.total) * 100) : 0 })),
    campaignPerformance: campPerf.map((c) => ({ campaign: campName[String(c._id)] || 'Campaign', total: c.total, completed: c.completed, budget: c.budget })),
    upcomingDue: upcoming.map(withDerived),
    recentActivities: recent.map((a) => ({ _id: a._id, action: a.action, description: a.description, actorName: a.actor?.name || 'System', actorRole: a.actorRole, at: a.createdAt })),
  }, 'Marketing dashboard')
})

// ── Reports ──────────────────────────────────────────────────────────────────
export const reports = asyncHandler(async (req, res) => {
  const filter = analyticsFilter(req)

  const [employeePerformance, statusCounts, campaignRows, typeRows, branchRows, completionTiming] = await Promise.all([
    MarketingTask.aggregate([
      { $match: filter },
      { $group: { _id: '$owner', employee: { $first: '$ownerName' }, assigned: { $sum: { $cond: ['$isSelfTask', 0, 1] } }, self: { $sum: { $cond: ['$isSelfTask', 1, 0] } }, total: { $sum: 1 }, completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } } } },
      { $sort: { completed: -1 } },
    ]),
    MarketingTask.aggregate([{ $match: filter }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
    MarketingTask.aggregate([
      { $match: { ...filter, campaign: { $ne: null } } },
      { $group: { _id: '$campaign', total: { $sum: 1 }, completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } }, budget: { $sum: '$estimatedBudget' } } },
    ]),
    MarketingTask.aggregate([
      { $match: filter },
      { $group: { _id: { channel: '$channel', type: '$marketingType' }, total: { $sum: 1 }, completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } } } },
    ]),
    MarketingTask.aggregate([
      { $match: filter },
      { $group: { _id: { $ifNull: ['$branch', '—'] }, total: { $sum: 1 }, completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } } } },
      { $sort: { total: -1 } },
    ]),
    MarketingTask.aggregate([
      { $match: { ...filter, status: 'completed', dueDate: { $ne: null }, completedAt: { $ne: null } } },
      { $project: { onTime: { $cond: [{ $lte: ['$completedAt', '$dueDate'] }, 1, 0] } } },
      { $group: { _id: null, onTime: { $sum: '$onTime' }, total: { $sum: 1 } } },
    ]),
  ])

  const statusMap = Object.fromEntries(statusCounts.map((s) => [s._id, s.n]))
  const campaigns = await MarketingCampaign.find({ _id: { $in: campaignRows.map((c) => c._id) } }).select('name budget status').lean()
  const campById = Object.fromEntries(campaigns.map((c) => [String(c._id), c]))

  const online = typeRows.filter((t) => t._id.channel === 'online').map((t) => ({ type: t._id.type, total: t.total, completed: t.completed }))
  const offline = typeRows.filter((t) => t._id.channel === 'offline').map((t) => ({ type: t._id.type, total: t.total, completed: t.completed }))
  const timing = completionTiming[0] || { onTime: 0, total: 0 }

  return ok(res, {
    employeePerformance: employeePerformance.map((e) => ({ employee: e.employee || 'Unknown', assigned: e.assigned, self: e.self, total: e.total, completed: e.completed, completionRate: e.total ? Math.round((e.completed / e.total) * 100) : 0 })),
    taskCompletion: {
      byStatus: MARKETING_TASK_STATUS.map((s) => ({ status: s, count: statusMap[s] || 0 })),
      onTime: timing.onTime,
      late: timing.total - timing.onTime,
      completed: statusMap.completed || 0,
    },
    campaignReport: campaignRows.map((c) => ({ campaign: campById[String(c._id)]?.name || 'Campaign', status: campById[String(c._id)]?.status, total: c.total, completed: c.completed, plannedBudget: campById[String(c._id)]?.budget || 0, taskBudget: c.budget })),
    onlineReport: online,
    offlineReport: offline,
    branchReport: branchRows.map((b) => ({ branch: b._id || '—', total: b.total, completed: b.completed })),
  }, 'Marketing reports')
})

// ── Activity History (audit-backed, §Activity History) ───────────────────────
export const activityHistory = asyncHandler(async (req, res) => {
  const filter = { module: MODULES.MARKETING, ...firmScope(req.user) }
  // Employees only see activity they generated (their own tasks live under them).
  if (!canAssign(req.user)) filter.actor = req.user._id
  if (req.query.dateFrom || req.query.dateTo) {
    filter.createdAt = {}
    if (req.query.dateFrom) filter.createdAt.$gte = new Date(req.query.dateFrom)
    if (req.query.dateTo) filter.createdAt.$lte = new Date(req.query.dateTo)
  }
  if (req.query.action && req.query.action !== 'all') filter.action = req.query.action
  const page = Number(req.query.page) || 1
  const limit = Number(req.query.limit) || 30
  const { data, meta } = await paginate(AuditLog, filter, {
    page, limit, sort: { createdAt: -1 }, populate: { path: 'actor', select: 'name role' },
  })
  const rows = data.map((a) => ({
    _id: a._id,
    action: a.action,
    description: a.description,
    target: a.targetLabel,
    user: a.actor?.name || 'System',
    role: a.actorRole,
    at: a.createdAt,
  }))
  return ok(res, rows, 'Activity history', meta)
})

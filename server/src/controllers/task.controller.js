import Task from '../models/Task.js'
import User from '../models/User.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from '../utils/ApiError.js'
import { ok, created } from '../utils/apiResponse.js'
import { notify } from '../services/notification.service.js'
import { NOTIFICATION_TYPES } from '../config/constants.js'

// Helper: check access permissions to a task.
// Admins and Sub-Admins have firm-wide access to tasks; Executives access their own assigned or planner tasks.
async function findAccessibleTask(req) {
  const isManagement = ['admin', 'sub_admin', 'super_admin'].includes(req.user.role)
  let task
  if (isManagement) {
    const filter = { _id: req.params.id }
    if (req.user.firm) {
      filter.$or = [
        { firm: req.user.firm },
        { assignedBy: req.user._id },
        { owner: req.user._id },
      ]
    }
    task = await Task.findOne(filter)
  } else {
    task = await Task.findOne({ _id: req.params.id, owner: req.user._id })
  }
  if (!task) throw ApiError.notFound('Task not found')
  return task
}

// GET /api/tasks - fetch tasks.
// If caller is Admin or Sub-Admin: returns all tasks in the firm (or filtered by executive/status/priority/etc).
// If caller is Sales Executive: returns their own assigned/planner tasks.
export const listTasks = asyncHandler(async (req, res) => {
  const isManagement = ['admin', 'sub_admin', 'super_admin'].includes(req.user.role)
  const filter = {}

  if (isManagement) {
    if (req.user.firm) {
      filter.firm = req.user.firm
    }
    if (req.query.assignedTo || req.query.owner) {
      filter.owner = req.query.assignedTo || req.query.owner
    }
  } else {
    filter.owner = req.user._id
  }

  if (req.query.status && req.query.status !== 'all') {
    filter.status = req.query.status
  }
  if (req.query.priority && req.query.priority !== 'all') {
    filter.priority = req.query.priority
  }
  if (req.query.official === 'true') {
    filter.official = true
  } else if (req.query.official === 'false') {
    filter.official = { $ne: true }
  }

  if (req.query.search) {
    const q = req.query.search.trim()
    filter.$or = [
      { title: { $regex: q, $options: 'i' } },
      { description: { $regex: q, $options: 'i' } },
      { assignedByName: { $regex: q, $options: 'i' } },
    ]
  }

  if (req.query.scope === 'today') {
    const start = new Date(); start.setHours(0, 0, 0, 0)
    const end = new Date(); end.setHours(23, 59, 59, 999)
    filter.$or = [{ dueDate: { $gte: start, $lte: end } }]
  }

  const tasks = await Task.find(filter)
    .populate('owner', 'name role email phone branch designation')
    .populate('assignedBy', 'name role email')
    .sort({ dueDate: 1, createdAt: -1 })
    .lean()

  return ok(res, tasks, 'Tasks fetched')
})

// GET /api/tasks/:id - single task details with populated assignee, assigner and comments.
export const getTask = asyncHandler(async (req, res) => {
  const task = await findAccessibleTask(req)
  const populated = await Task.findById(task._id)
    .populate('owner', 'name role email phone branch designation')
    .populate('assignedBy', 'name role email')
    .populate('comments.author', 'name role')
    .lean()
  return ok(res, populated)
})

// POST /api/tasks - create or assign task.
// If created by Admin/Sub-Admin with assignedTo/owner: creates an official assigned task for the executive.
// If created by Sales Executive: personal planner task.
export const createTask = asyncHandler(async (req, res) => {
  const isManagement = ['admin', 'sub_admin', 'super_admin'].includes(req.user.role)
  const targetOwnerId = (isManagement && (req.body.assignedTo || req.body.owner))
    ? (req.body.assignedTo || req.body.owner)
    : req.user._id

  const isOfficial = isManagement && String(targetOwnerId) !== String(req.user._id)
  let assigneeName = req.user.name

  if (isOfficial) {
    const u = await User.findById(targetOwnerId).lean()
    if (!u) throw ApiError.badRequest('Assigned employee not found')
    assigneeName = u.name
  }

  const task = await Task.create({
    title: req.body.title,
    description: req.body.description || '',
    dueDate: req.body.dueDate || undefined,
    dueTime: req.body.dueTime || undefined,
    priority: req.body.priority || 'medium',
    relatedType: req.body.relatedType || 'none',
    relatedId: req.body.relatedId || null,
    owner: targetOwnerId,
    firm: req.user.firm || null,
    official: isOfficial,
    assignedBy: isOfficial ? req.user._id : null,
    assignedByName: isOfficial ? req.user.name : undefined,
    assignedByRole: isOfficial ? req.user.role : undefined,
    status: req.body.status || 'pending',
    activity: [
      {
        type: isOfficial ? 'assigned' : 'created',
        note: isOfficial ? `Task assigned to ${assigneeName} by ${req.user.name} (${req.user.role})` : 'Task created in planner',
        actor: req.user._id,
        actorName: req.user.name,
      },
    ],
  })

  if (isOfficial) {
    notify({
      firm: task.firm,
      recipient: targetOwnerId,
      type: NOTIFICATION_TYPES.TASK_UPDATE,
      title: 'New task assigned',
      message: `${req.user.name} assigned you a task: ${task.title}`,
      entityType: 'task',
      entityId: task._id,
    })
  }

  const populated = await Task.findById(task._id)
    .populate('owner', 'name role email phone branch designation')
    .populate('assignedBy', 'name role email')
    .lean()

  return created(res, populated, 'Task created')
})

// PATCH /api/tasks/:id - edit fields or reassign.
export const updateTask = asyncHandler(async (req, res) => {
  const isManagement = ['admin', 'sub_admin', 'super_admin'].includes(req.user.role)
  const task = await findAccessibleTask(req)

  if (!isManagement) {
    if (task.official) throw ApiError.forbidden('Tasks assigned by your Admin/Sub-Admin cannot be edited directly')
    if (task.status === 'completed') throw ApiError.badRequest('Completed tasks are read-only')
  }

  const fields = ['title', 'description', 'dueDate', 'dueTime', 'priority', 'relatedType', 'relatedId', 'status']
  for (const f of fields) {
    if (req.body[f] !== undefined) task[f] = req.body[f]
  }

  if (req.body.status === 'completed' && !task.completedAt) {
    task.completedAt = new Date()
    task.completionRemarks = req.body.completionRemarks || task.completionRemarks
  }

  // Management reassignment
  if (isManagement && (req.body.assignedTo || req.body.owner)) {
    const newOwnerId = req.body.assignedTo || req.body.owner
    if (String(task.owner) !== String(newOwnerId)) {
      const newOwner = await User.findById(newOwnerId).lean()
      if (newOwner) {
        task.owner = newOwnerId
        task.activity.push({
          type: 'reassigned',
          note: `Reassigned to ${newOwner.name} by ${req.user.name}`,
          actor: req.user._id,
          actorName: req.user.name,
        })
        notify({
          firm: task.firm,
          recipient: newOwnerId,
          type: NOTIFICATION_TYPES.TASK_UPDATE,
          title: 'Task reassigned to you',
          message: `${req.user.name} assigned you the task: ${task.title}`,
          entityType: 'task',
          entityId: task._id,
        })
      }
    }
  }

  await task.save()

  const populated = await Task.findById(task._id)
    .populate('owner', 'name role email phone branch designation')
    .populate('assignedBy', 'name role email')
    .lean()

  return ok(res, populated, 'Task updated')
})

// PATCH /api/tasks/:id/status - status toggle.
export const setTaskStatus = asyncHandler(async (req, res) => {
  const task = await findAccessibleTask(req)
  task.status = req.body.status
  task.completedAt = req.body.status === 'completed' ? new Date() : undefined
  task.activity.push({
    type: 'status_changed',
    note: `Status set to ${req.body.status} by ${req.user.name}`,
    actor: req.user._id,
    actorName: req.user.name,
  })
  await task.save()
  return ok(res, task, `Task ${task.status}`)
})

// PATCH /api/tasks/:id/progress - update progress note.
export const updateProgress = asyncHandler(async (req, res) => {
  const task = await findAccessibleTask(req)
  if (task.status === 'completed') throw ApiError.badRequest('Completed tasks are read-only')
  const { status, progressNote } = req.body
  if (status) task.status = status
  const note = progressNote ? `${status ? status + ': ' : ''}${progressNote}` : `Status set to ${status}`
  task.activity.push({ type: 'progress_updated', note, actor: req.user._id, actorName: req.user.name })
  await task.save()
  return ok(res, task, 'Progress updated')
})

// PATCH /api/tasks/:id/complete - mark completed.
export const completeTask = asyncHandler(async (req, res) => {
  const task = await findAccessibleTask(req)
  if (task.status === 'completed') throw ApiError.badRequest('Task is already completed')
  task.status = 'completed'
  task.completedAt = new Date()
  task.completionRemarks = req.body.completionRemarks
  task.activity.push({
    type: 'completed',
    note: req.body.completionRemarks || 'Task completed',
    actor: req.user._id,
    actorName: req.user.name,
  })
  await task.save()

  // Notify the Admin/Sub-Admin who assigned it.
  if (task.assignedBy && String(task.assignedBy) !== String(req.user._id)) {
    notify({
      firm: task.firm,
      recipient: task.assignedBy,
      type: NOTIFICATION_TYPES.TASK_UPDATE,
      title: 'Task completed',
      message: `${req.user.name} completed the task: ${task.title}`,
      entityType: 'task',
      entityId: task._id,
    })
  }
  return ok(res, task, 'Task completed')
})

// POST /api/tasks/:id/comments - add a comment or reply.
export const addComment = asyncHandler(async (req, res) => {
  const task = await findAccessibleTask(req)
  const comment = {
    text: req.body.text,
    parent: req.body.parent || null,
    author: req.user._id,
    authorName: req.user.name,
    authorRole: req.user.role,
  }
  task.comments.push(comment)
  task.activity.push({
    type: 'comment_added',
    note: req.body.text,
    actor: req.user._id,
    actorName: req.user.name,
  })
  await task.save()

  // Notify the other party
  const recipient = String(req.user._id) === String(task.owner) ? task.assignedBy : task.owner
  if (recipient && String(recipient) !== String(req.user._id)) {
    notify({
      firm: task.firm,
      recipient,
      type: NOTIFICATION_TYPES.TASK_UPDATE,
      title: 'New task comment',
      message: `${req.user.name} commented on: ${task.title}`,
      entityType: 'task',
      entityId: task._id,
    })
  }
  return created(res, task.comments.at(-1), 'Comment added')
})

// POST /api/tasks/:id/attachments - upload a supporting document.
export const addAttachment = asyncHandler(async (req, res) => {
  const task = await findAccessibleTask(req)
  if (!req.file) throw ApiError.badRequest('No file uploaded')
  const doc = {
    label: req.body.label || req.file.originalname,
    fileName: req.file.originalname,
    fileUrl: `/uploads/${req.file.filename}`,
    uploadedBy: req.user._id,
  }
  task.attachments.push(doc)
  task.activity.push({
    type: 'attachment_added',
    note: doc.label,
    actor: req.user._id,
    actorName: req.user.name,
  })
  await task.save()
  return created(res, task.attachments.at(-1), 'Attachment uploaded')
})

// DELETE /api/tasks/:id - delete task.
export const deleteTask = asyncHandler(async (req, res) => {
  const isManagement = ['admin', 'sub_admin', 'super_admin'].includes(req.user.role)
  const task = await findAccessibleTask(req)

  if (!isManagement) {
    if (task.official) throw ApiError.forbidden('Tasks assigned by your Admin/Sub-Admin cannot be deleted')
    if (task.status === 'completed') throw ApiError.badRequest('Reopen the task before deleting it')
  }

  await task.deleteOne()
  return ok(res, { _id: task._id }, 'Task deleted')
})

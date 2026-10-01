import Task from '../models/Task.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from '../utils/ApiError.js'
import { ok, created } from '../utils/apiResponse.js'
import { notify } from '../services/notification.service.js'
import { NOTIFICATION_TYPES } from '../config/constants.js'

// GET /api/tasks - the caller's own tasks. `official=true` returns only tasks
// assigned by an Admin/Sub-Admin (Tasks tab); `official=false` returns only the
// personal Work Planner items. `scope=today` limits to due-today/overdue.
export const listTasks = asyncHandler(async (req, res) => {
  const filter = { owner: req.user._id }
  if (req.query.status) filter.status = req.query.status
  if (req.query.priority) filter.priority = req.query.priority
  if (req.query.official === 'true') filter.official = true
  if (req.query.official === 'false') filter.official = { $ne: true }
  if (req.query.scope === 'today') {
    const end = new Date(); end.setHours(23, 59, 59, 999)
    filter.$or = [{ dueDate: { $lte: end } }, { dueDate: null }]
  }
  const tasks = await Task.find(filter)
    .populate('assignedBy', 'name role')
    .sort({ status: 1, dueDate: 1, createdAt: -1 })
    .lean()
  return ok(res, tasks, 'Tasks fetched')
})

// GET /api/tasks/:id - single task with populated assigner (Tasks tab details).
export const getTask = asyncHandler(async (req, res) => {
  const task = await Task.findOne({ _id: req.params.id, owner: req.user._id })
    .populate('assignedBy', 'name role email')
    .populate('comments.author', 'name role')
    .lean()
  if (!task) throw ApiError.notFound('Task not found')
  return ok(res, task)
})

// POST /api/tasks - personal work-planner task (employees cannot create official tasks).
export const createTask = asyncHandler(async (req, res) => {
  const task = await Task.create({
    ...req.body,
    owner: req.user._id,
    firm: req.user.firm || null,
    official: false,
    relatedType: req.body.relatedType || 'none',
  })
  return created(res, task, 'Task created')
})

async function findOwnTask(req) {
  const task = await Task.findOne({ _id: req.params.id, owner: req.user._id })
  if (!task) throw ApiError.notFound('Task not found')
  return task
}

// PATCH /api/tasks/:id - edit fields. Official tasks + completed tasks are
// read-only to the employee (spec Business Rules).
export const updateTask = asyncHandler(async (req, res) => {
  const task = await findOwnTask(req)
  if (task.official) throw ApiError.forbidden('Tasks assigned by your Admin/Sub-Admin cannot be edited')
  if (task.status === 'completed') throw ApiError.badRequest('Completed tasks are read-only')
  const fields = ['title', 'description', 'dueDate', 'dueTime', 'priority', 'relatedType', 'relatedId']
  for (const f of fields) if (req.body[f] !== undefined) task[f] = req.body[f]
  await task.save()
  return ok(res, task, 'Task updated')
})

// PATCH /api/tasks/:id/status - planner complete/reopen toggle.
export const setTaskStatus = asyncHandler(async (req, res) => {
  const task = await findOwnTask(req)
  task.status = req.body.status
  task.completedAt = req.body.status === 'completed' ? new Date() : undefined
  await task.save()
  return ok(res, task, `Task ${task.status}`)
})

// PATCH /api/tasks/:id/progress - update progress (spec Update Progress).
// Allowed statuses: pending | in_progress | on_hold. Records a progress note.
export const updateProgress = asyncHandler(async (req, res) => {
  const task = await findOwnTask(req)
  if (task.status === 'completed') throw ApiError.badRequest('Completed tasks are read-only')
  const { status, progressNote } = req.body
  if (status) task.status = status
  const note = progressNote ? `${status ? status + ': ' : ''}${progressNote}` : `Status set to ${status}`
  task.activity.push({ type: 'progress_updated', note, actor: req.user._id, actorName: req.user.name })
  await task.save()
  return ok(res, task, 'Progress updated')
})

// PATCH /api/tasks/:id/complete - mark completed (spec Mark Task Completed).
// Records completion time + remarks and notifies the assigner.
export const completeTask = asyncHandler(async (req, res) => {
  const task = await findOwnTask(req)
  if (task.status === 'completed') throw ApiError.badRequest('Task is already completed')
  task.status = 'completed'
  task.completedAt = new Date()
  task.completionRemarks = req.body.completionRemarks
  task.activity.push({ type: 'completed', note: req.body.completionRemarks || 'Task completed', actor: req.user._id, actorName: req.user.name })
  await task.save()

  // Notify the Admin/Sub-Admin who assigned it.
  if (task.assignedBy) {
    notify({
      firm: task.firm, recipient: task.assignedBy, type: NOTIFICATION_TYPES.TASK_UPDATE,
      title: 'Task completed', message: `${req.user.name} completed the task: ${task.title}`,
      entityType: 'task', entityId: task._id,
    })
  }
  return ok(res, task, 'Task completed')
})

// POST /api/tasks/:id/comments - add a comment or reply (spec Comments).
export const addComment = asyncHandler(async (req, res) => {
  const task = await findOwnTask(req)
  const comment = { text: req.body.text, parent: req.body.parent || null, author: req.user._id, authorName: req.user.name, authorRole: req.user.role }
  task.comments.push(comment)
  task.activity.push({ type: 'comment_added', note: req.body.text, actor: req.user._id, actorName: req.user.name })
  await task.save()
  if (task.assignedBy && !req.body.parent) {
    notify({ firm: task.firm, recipient: task.assignedBy, type: NOTIFICATION_TYPES.TASK_UPDATE, title: 'New task comment', message: `${req.user.name} commented on: ${task.title}`, entityType: 'task', entityId: task._id })
  }
  return created(res, task.comments.at(-1), 'Comment added')
})

// POST /api/tasks/:id/attachments - upload a supporting document (spec Upload Attachments).
export const addAttachment = asyncHandler(async (req, res) => {
  const task = await findOwnTask(req)
  if (!req.file) throw ApiError.badRequest('No file uploaded')
  const doc = { label: req.body.label || req.file.originalname, fileName: req.file.originalname, fileUrl: `/uploads/${req.file.filename}`, uploadedBy: req.user._id }
  task.attachments.push(doc)
  task.activity.push({ type: 'attachment_added', note: doc.label, actor: req.user._id, actorName: req.user.name })
  await task.save()
  return created(res, task.attachments.at(-1), 'Attachment uploaded')
})

// DELETE /api/tasks/:id - planner tasks only, before completion (spec Work Planner).
export const deleteTask = asyncHandler(async (req, res) => {
  const task = await findOwnTask(req)
  if (task.official) throw ApiError.forbidden('Tasks assigned by your Admin/Sub-Admin cannot be deleted')
  if (task.status === 'completed') throw ApiError.badRequest('Reopen the task before deleting it')
  await task.deleteOne()
  return ok(res, { _id: task._id }, 'Task deleted')
})

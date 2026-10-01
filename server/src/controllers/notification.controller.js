import Notification from '../models/Notification.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ok } from '../utils/apiResponse.js'
import { paginate } from '../utils/paginate.js'

// GET /api/notifications — the caller's own notifications (§9).
export const listNotifications = asyncHandler(async (req, res) => {
  const { page, limit, unread } = req.query
  const filter = { recipient: req.user._id }
  if (unread === 'true') filter.read = false
  const { data, meta } = await paginate(Notification, filter, { page, limit })
  const unreadCount = await Notification.countDocuments({ recipient: req.user._id, read: false })
  return ok(res, data, 'Notifications fetched', { ...meta, unreadCount })
})

// PATCH /api/notifications/:id/read
export const markRead = asyncHandler(async (req, res) => {
  const n = await Notification.findOneAndUpdate(
    { _id: req.params.id, recipient: req.user._id },
    { read: true, readAt: new Date() },
    { new: true }
  )
  return ok(res, n, 'Marked read')
})

// PATCH /api/notifications/read-all
export const markAllRead = asyncHandler(async (req, res) => {
  await Notification.updateMany(
    { recipient: req.user._id, read: false },
    { read: true, readAt: new Date() }
  )
  return ok(res, null, 'All notifications marked read')
})

// DELETE /api/notifications/:id — clear a single notification (spec §Clear Notification).
export const deleteNotification = asyncHandler(async (req, res) => {
  await Notification.deleteOne({ _id: req.params.id, recipient: req.user._id })
  return ok(res, { _id: req.params.id }, 'Notification cleared')
})

// DELETE /api/notifications — clear all of the caller's notifications.
export const clearAllNotifications = asyncHandler(async (req, res) => {
  await Notification.deleteMany({ recipient: req.user._id })
  return ok(res, null, 'All notifications cleared')
})

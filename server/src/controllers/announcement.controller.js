import Announcement from '../models/Announcement.js'
import NotificationHistory from '../models/NotificationHistory.js'
import Firm from '../models/Firm.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from '../utils/ApiError.js'
import { ok, created } from '../utils/apiResponse.js'

// --- Announcements ---

export const listAnnouncements = asyncHandler(async (req, res) => {
  const announcements = await Announcement.find()
    .populate('createdBy', 'name')
    .sort({ createdAt: -1 })
    .lean()
  return ok(res, announcements, 'Announcements fetched')
})

export const getAnnouncement = asyncHandler(async (req, res) => {
  const announcement = await Announcement.findById(req.params.id)
    .populate('targetCompanies', 'name')
    .lean()
  if (!announcement) throw ApiError.notFound('Announcement not found')
  return ok(res, announcement, 'Announcement fetched')
})

const createNotificationLog = async (announcement, user) => {
  let targetCompanies = announcement.targetCompanies
  let totalCompanies = targetCompanies.length
  
  if (announcement.audienceType === 'All Companies') {
    const firms = await Firm.find({ isDeleted: false, status: 'active' }, '_id')
    targetCompanies = firms.map(f => f._id)
    totalCompanies = targetCompanies.length
  }
  
  await NotificationHistory.create({
    announcement: announcement._id,
    audienceType: announcement.audienceType,
    totalCompanies,
    deliveryStatus: 'Delivered', // For demo purposes, assume instant delivery
    targetCompanies,
    sentBy: user._id,
    sentDate: new Date()
  })
}

export const createAnnouncement = asyncHandler(async (req, res) => {
  const payload = { ...req.body, createdBy: req.user._id }
  
  if (payload.status === 'Published' && !payload.publishDate) {
    payload.publishDate = new Date()
  }

  const announcement = await Announcement.create(payload)

  if (announcement.status === 'Published') {
    await createNotificationLog(announcement, req.user)
  }

  return created(res, announcement, 'Announcement created')
})

export const updateAnnouncement = asyncHandler(async (req, res) => {
  const announcement = await Announcement.findById(req.params.id)
  if (!announcement) throw ApiError.notFound('Announcement not found')
  
  const wasDraft = announcement.status === 'Draft'
  const isNowPublished = req.body.status === 'Published'

  if (isNowPublished && !req.body.publishDate) {
    req.body.publishDate = new Date()
  }

  const updated = await Announcement.findByIdAndUpdate(req.params.id, req.body, { new: true })

  if (wasDraft && isNowPublished) {
    await createNotificationLog(updated, req.user)
  }

  return ok(res, updated, 'Announcement updated')
})

export const deleteAnnouncement = asyncHandler(async (req, res) => {
  const announcement = await Announcement.findByIdAndDelete(req.params.id)
  if (!announcement) throw ApiError.notFound('Announcement not found')
  return ok(res, null, 'Announcement deleted')
})

// --- Notification History ---

export const listNotificationHistory = asyncHandler(async (req, res) => {
  const history = await NotificationHistory.find()
    .populate('announcement', 'title')
    .populate('sentBy', 'name')
    .populate('targetCompanies', 'name')
    .sort({ createdAt: -1 })
    .lean()
  return ok(res, history, 'Notification history fetched')
})

import CompanySettings from '../models/CompanySettings.js'
import MasterDataItem from '../models/MasterDataItem.js'
import User from '../models/User.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from '../utils/ApiError.js'
import { ok, created } from '../utils/apiResponse.js'

// Get (creating if missing) the firm's settings doc.
async function getDoc(firm) {
  let doc = await CompanySettings.findOne({ firm })
  if (!doc) doc = await CompanySettings.create({ firm })
  return doc
}

// Factory: GET a named section (returns the stored object, or {}).
const makeGet = (section) => asyncHandler(async (req, res) => {
  const doc = await getDoc(req.user.firm)
  return ok(res, doc[section] || {}, `${section} fetched`)
})

// Factory: PATCH a named section (merges the posted object and returns it).
const makeUpdate = (section) => asyncHandler(async (req, res) => {
  const doc = await getDoc(req.user.firm)
  doc[section] = { ...(doc[section] || {}), ...(req.body || {}) }
  doc.updatedBy = req.user._id
  doc.markModified(section)
  await doc.save()
  return ok(res, doc[section], `${section} updated`)
})

export const getPreferences = makeGet('preferences')
export const updatePreferences = makeUpdate('preferences')
export const getBusinessConfig = makeGet('businessConfig')
export const updateBusinessConfig = makeUpdate('businessConfig')
export const getNotifications = makeGet('notifications')
export const updateNotifications = makeUpdate('notifications')
export const getSecurity = makeGet('security')
export const updateSecurity = makeUpdate('security')
export const getBranding = makeGet('branding')
export const updateBranding = makeUpdate('branding')

// Branding asset uploads (logo / favicon) — stores the served path onto branding.
const makeAssetUpload = (field) => asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('No file uploaded')
  const url = `/uploads/${req.file.filename}`
  const doc = await getDoc(req.user.firm)
  doc.branding = { ...(doc.branding || {}), [field]: url }
  doc.updatedBy = req.user._id
  doc.markModified('branding')
  await doc.save()
  return ok(res, doc.branding, `${field} uploaded`)
})
export const uploadLogo = makeAssetUpload('logo')
export const uploadFavicon = makeAssetUpload('favicon')

// ── Master data ──────────────────────────────────────────────────────────────
const serialize = (d) => ({ id: String(d._id), name: d.name, description: d.description || '', active: d.active !== false, usage: d.usage || 0 })

export const listMasterData = asyncHandler(async (req, res) => {
  const items = await MasterDataItem.find({ firm: req.user.firm, category: req.params.category }).sort({ createdAt: 1 }).lean()
  return ok(res, items.map(serialize), 'Master data fetched')
})

export const createMasterData = asyncHandler(async (req, res) => {
  const { name, description } = req.body
  if (!name || !name.trim()) throw ApiError.badRequest('Name is required')
  const exists = await MasterDataItem.findOne({ firm: req.user.firm, category: req.params.category, name: name.trim() })
  if (exists) throw ApiError.conflict('An item with this name already exists in this category')
  const item = await MasterDataItem.create({
    firm: req.user.firm, category: req.params.category, name: name.trim(),
    description: description || '', createdBy: req.user._id,
  })
  return created(res, serialize(item), 'Item created')
})

export const updateMasterData = asyncHandler(async (req, res) => {
  const item = await MasterDataItem.findOne({ _id: req.params.id, firm: req.user.firm, category: req.params.category })
  if (!item) throw ApiError.notFound('Item not found')
  if (req.body.name !== undefined) item.name = req.body.name.trim()
  if (req.body.description !== undefined) item.description = req.body.description
  if (req.body.active !== undefined) item.active = !!req.body.active
  await item.save()
  return ok(res, serialize(item), 'Item updated')
})

export const setMasterDataStatus = asyncHandler(async (req, res) => {
  const item = await MasterDataItem.findOne({ _id: req.params.id, firm: req.user.firm, category: req.params.category })
  if (!item) throw ApiError.notFound('Item not found')
  item.active = !!req.body.active
  await item.save()
  return ok(res, serialize(item), `Item ${item.active ? 'activated' : 'deactivated'}`)
})

// ── Active sessions ──────────────────────────────────────────────────────────
// Real, minimal: reports the current session (device + last login) and how many
// refresh tokens are live. Revoke signs out the other sessions.
export const listSessions = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('+refreshTokens lastLoginAt lastLoginDevice').lean()
  const count = user?.refreshTokens?.length || 0
  const sessions = []
  if (count > 0) {
    sessions.push({
      id: 'current', device: user.lastLoginDevice || 'Current device',
      lastActive: user.lastLoginAt || user.updatedAt, current: true,
      otherSessions: Math.max(0, count - 1),
    })
  }
  return ok(res, sessions, 'Active sessions fetched')
})

export const revokeSession = asyncHandler(async (req, res) => {
  // Sign out every other session by clearing stored refresh tokens.
  await User.updateOne({ _id: req.user._id }, { $set: { refreshTokens: [] } })
  return ok(res, { revoked: true }, 'Other sessions signed out')
})

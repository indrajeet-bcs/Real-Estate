import User from '../models/User.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from '../utils/ApiError.js'
import { ok } from '../utils/apiResponse.js'
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashToken,
  generateOtp,
} from '../utils/token.js'
import { writeAudit } from '../middleware/audit.js'
import { AUDIT_ACTIONS } from '../config/constants.js'
import { effectivePermissions } from '../config/permissions.js'
import { env, isProd } from '../config/env.js'

const REFRESH_COOKIE = 'refreshToken'

function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'strict' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7d
    path: '/api/auth',
  }
}

// Issues an access token (returned in body) and a refresh token (httpOnly
// cookie). The refresh token's hash is stored so it can be rotated/revoked.
// An atomic $push (keeping the newest 5) avoids optimistic-concurrency
// VersionErrors when the same user logs in from two requests at once.
async function issueTokens(res, user, set = {}) {
  const accessToken = signAccessToken(user)
  const refreshToken = signRefreshToken(user)
  const hash = hashToken(refreshToken)
  const update = { $push: { refreshTokens: { $each: [hash], $slice: -5 } } }
  if (Object.keys(set).length) update.$set = set
  await User.updateOne({ _id: user._id }, update)
  res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions())
  return accessToken
}

// POST /api/auth/login
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body
  const user = await User.findOne({ email }).select('+password +refreshTokens').populate('customRole')
  if (!user || !(await user.comparePassword(password))) {
    throw ApiError.unauthorized('Invalid email or password')
  }
  if (!user.isActive) {
    throw ApiError.forbidden('Account is inactive. Please contact your admin.')
  }

  const accessToken = await issueTokens(res, user, {
    lastLoginAt: new Date(),
    lastLoginDevice: (req.headers['user-agent'] || '').slice(0, 200),
  })

  writeAudit({ req: { ...req, user }, action: AUDIT_ACTIONS.LOGIN, module: 'user', description: 'User logged in' })

  return ok(res, {
    accessToken,
    user: user.toJSON(),
    permissions: effectivePermissions(user),
  }, 'Login successful')
})

// POST /api/auth/refresh — rotates the refresh token.
export const refresh = asyncHandler(async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE]
  if (!token) throw ApiError.unauthorized('No refresh token')

  let payload
  try {
    payload = verifyRefreshToken(token)
  } catch {
    throw ApiError.unauthorized('Invalid refresh token')
  }

  const user = await User.findById(payload.sub).select('+refreshTokens').populate('customRole')
  if (!user || !user.isActive) throw ApiError.unauthorized('Session no longer valid')

  const tokenHash = hashToken(token)
  if (!user.refreshTokens.includes(tokenHash)) {
    // Token reuse / revoked — clear all sessions defensively (atomic).
    await User.updateOne({ _id: user._id }, { $set: { refreshTokens: [] } })
    throw ApiError.unauthorized('Session revoked, please log in again')
  }

  // Rotate: atomically drop the old hash, then issue a fresh pair.
  await User.updateOne({ _id: user._id }, { $pull: { refreshTokens: tokenHash } })
  const accessToken = await issueTokens(res, user)

  return ok(res, { accessToken, user: user.toJSON(), permissions: effectivePermissions(user) }, 'Token refreshed')
})

// POST /api/auth/logout
export const logout = asyncHandler(async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE]
  if (token) {
    try {
      const payload = verifyRefreshToken(token)
      const user = await User.findById(payload.sub).select('name role firm')
      if (user) {
        await User.updateOne({ _id: user._id }, { $pull: { refreshTokens: hashToken(token) } })
        writeAudit({ req: { ...req, user }, action: AUDIT_ACTIONS.LOGOUT, module: 'user', description: 'User logged out' })
      }
    } catch {
      /* ignore — logging out with an invalid token is fine */
    }
  }
  res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' })
  return ok(res, null, 'Logged out')
})

// GET /api/auth/me
export const me = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).populate('manager', 'name').populate('customRole')
  const json = user.toJSON()
  json.managerName = user.manager?.name || null
  return ok(res, { user: json, permissions: effectivePermissions(user) })
})

// PATCH /api/auth/profile — the signed-in user edits their OWN profile.
// Identity/employment fields (email, role, employeeId/Code, branch, manager,
// department) are read-only — only personal fields & preferences change. Every
// update is written to the audit history (spec §Business Rules).
export const updateMyProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id)
  if (!user) throw ApiError.notFound('User not found')

  const personal = ['name', 'phone', 'altMobile', 'designation', 'avatar', 'dob', 'gender', 'bloodGroup', 'maritalStatus', 'address', 'emergencyContactName', 'emergencyContactNumber']
  const changed = []
  for (const f of personal) {
    if (req.body[f] !== undefined) { user[f] = req.body[f] === '' && (f === 'dob') ? undefined : req.body[f]; changed.push(f) }
  }
  if (req.body.notificationPrefs !== undefined) {
    user.notificationPrefs = { ...(user.notificationPrefs?.toObject?.() ?? user.notificationPrefs), ...req.body.notificationPrefs }
    changed.push('notificationPrefs')
  }
  if (req.body.preferences !== undefined) {
    user.preferences = { ...(user.preferences?.toObject?.() ?? user.preferences), ...req.body.preferences }
    changed.push('preferences')
  }
  await user.save()

  writeAudit({ req, action: AUDIT_ACTIONS.UPDATE, module: 'user', targetId: user._id, targetLabel: user.name, description: `Updated own profile (${changed.join(', ') || 'no changes'})` })
  return ok(res, { user: user.toJSON() }, 'Profile updated')
})

// POST /api/auth/profile/documents — upload/replace a permitted profile document
// (spec §Documents). Replacing an existing type overwrites the prior file.
const ALLOWED_DOC_TYPES = ['id_proof', 'address_proof', 'pan', 'aadhaar', 'driving_license', 'other']
export const uploadProfileDocument = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('No file uploaded')
  const type = ALLOWED_DOC_TYPES.includes(req.body.type) ? req.body.type : 'other'
  const user = await User.findById(req.user._id)
  if (!user) throw ApiError.notFound('User not found')

  const doc = { type, label: req.body.label || req.file.originalname, fileName: req.file.originalname, fileUrl: `/uploads/${req.file.filename}`, uploadedAt: new Date() }
  // Replace an existing document of the same type (except 'other', which stacks).
  if (type !== 'other') user.documents = user.documents.filter((d) => d.type !== type)
  user.documents.push(doc)
  await user.save()

  writeAudit({ req, action: AUDIT_ACTIONS.UPDATE, module: 'user', targetId: user._id, targetLabel: user.name, description: `Uploaded profile document (${type})` })
  return ok(res, { user: user.toJSON() }, 'Document uploaded')
})

// POST /api/auth/logout-all — revoke every session (spec §Security).
export const logoutAllDevices = asyncHandler(async (req, res) => {
  await User.updateOne({ _id: req.user._id }, { $set: { refreshTokens: [] } })
  res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' })
  return ok(res, null, 'Signed out of all devices. Please log in again.')
})

// POST /api/auth/forgot-password — generates an OTP.
// (Email/SMS delivery is stubbed; in dev the OTP is returned for testing.)
export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body
  const user = await User.findOne({ email }).select('+resetOtpHash +resetOtpExpires')
  // Always respond success to avoid account enumeration.
  if (!user || !user.isActive) {
    return ok(res, null, 'If the account exists, an OTP has been sent')
  }

  const otp = generateOtp()
  user.resetOtpHash = hashToken(otp)
  user.resetOtpExpires = new Date(Date.now() + 10 * 60 * 1000) // 10 min
  await user.save()

  // TODO: send OTP via email/SMS provider. Dev convenience below.
  const devOtp = isProd ? undefined : otp
  return ok(res, { devOtp }, 'If the account exists, an OTP has been sent')
})

// POST /api/auth/reset-password
export const resetPassword = asyncHandler(async (req, res) => {
  const { email, otp, newPassword } = req.body
  const user = await User.findOne({ email }).select('+resetOtpHash +resetOtpExpires +refreshTokens')
  if (!user || !user.resetOtpHash || !user.resetOtpExpires) {
    throw ApiError.badRequest('Invalid or expired OTP')
  }
  if (user.resetOtpExpires.getTime() < Date.now() || user.resetOtpHash !== hashToken(otp)) {
    throw ApiError.badRequest('Invalid or expired OTP')
  }

  user.password = newPassword
  user.resetOtpHash = undefined
  user.resetOtpExpires = undefined
  user.refreshTokens = [] // force re-login everywhere
  await user.save()

  return ok(res, null, 'Password reset successful. Please log in.')
})

// POST /api/auth/change-password (authenticated)
export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body
  const user = await User.findById(req.user._id).select('+password +refreshTokens')
  if (!(await user.comparePassword(currentPassword))) {
    throw ApiError.badRequest('Current password is incorrect')
  }
  user.password = newPassword
  user.passwordChangedAt = new Date()
  user.refreshTokens = []
  await user.save()
  writeAudit({ req, action: AUDIT_ACTIONS.UPDATE, module: 'user', targetId: user._id, targetLabel: user.name, description: 'Changed own password' })
  res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' })
  return ok(res, null, 'Password changed. Please log in again.')
})

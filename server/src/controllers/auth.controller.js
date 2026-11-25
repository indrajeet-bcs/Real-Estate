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
import { sendOtpEmail } from '../utils/email.js'

const REFRESH_COOKIE = 'refreshToken'
const LAST_ACTIVITY_COOKIE = 'lastActivity'

const isSecure = isProd || process.env.RENDER === 'true'

// Idle timeout in milliseconds (default 30 min, driven by SESSION_IDLE_TIMEOUT_MIN env var)
const IDLE_TIMEOUT_MS = (parseInt(process.env.SESSION_IDLE_TIMEOUT_MIN, 10) || 30) * 60 * 1000

function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: isSecure,
    // 'none' is required for cross-origin requests (e.g. Render frontend <-> Render backend).
    // Browsers reject SameSite=Strict/Lax on cross-site credentialed requests.
    // 'none' is only sent over HTTPS (secure: true guards this).
    sameSite: isSecure ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7d
    path: '/api/auth',
  }
}

function lastActivityCookieOptions() {
  return {
    httpOnly: false,          // Readable by JS so the client can also enforce idle timeout
    secure: isSecure,
    sameSite: isSecure ? 'none' : 'lax',
    maxAge: IDLE_TIMEOUT_MS,  // Automatically expires after the idle window
    path: '/',
  }
}

function clearRefreshCookie(res) {
  res.clearCookie(REFRESH_COOKIE, {
    path: '/api/auth',
    httpOnly: true,
    secure: isSecure,
    sameSite: isSecure ? 'none' : 'lax',
  })
  res.clearCookie(LAST_ACTIVITY_COOKIE, {
    path: '/',
    secure: isSecure,
    sameSite: isSecure ? 'none' : 'lax',
  })
}

// Issues an access token (returned in body) and a refresh token (httpOnly
// cookie). The refresh token's hash is stored so it can be rotated/revoked.
// An atomic $push (keeping the newest 5) avoids optimistic-concurrency
// VersionErrors when the same user logs in from two requests at once.
// Also sets a lastActivity cookie (non-httpOnly) so the server can enforce
// the idle timeout on every refresh call.
async function issueTokens(res, user, set = {}) {
  const accessToken = signAccessToken(user)
  const refreshToken = signRefreshToken(user)
  const hash = hashToken(refreshToken)
  const update = { $push: { refreshTokens: { $each: [hash], $slice: -5 } } }
  if (Object.keys(set).length) update.$set = set
  await User.updateOne({ _id: user._id }, update)
  res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions())
  // Update the sliding-window last-activity timestamp
  res.cookie(LAST_ACTIVITY_COOKIE, Date.now().toString(), lastActivityCookieOptions())
  return accessToken
}

// POST /api/auth/login
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body
  const user = await User.findOne({ email }).select('+password +refreshTokens').populate('customRole').populate('firm', 'name logo')
  if (!user || !(await user.comparePassword(password))) {
    throw ApiError.unauthorized('Invalid email or password')
  }
  if (!user.isActive) {
    throw ApiError.forbidden('Account is inactive. Please contact your admin.')
  }
  if (user.status === 'pending') {
    throw ApiError.forbidden('Your account is pending activation. Please accept the invitation and set your password using the link sent to your email.')
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

  // ── Idle-session enforcement ────────────────────────────────────────────
  // The lastActivity cookie is updated on every successful token issue.
  // If it is missing OR older than IDLE_TIMEOUT_MS we treat the session as
  // expired, clear all cookies, and return 401 so the client redirects to login.
  const lastActivity = req.cookies?.[LAST_ACTIVITY_COOKIE]
  if (!lastActivity || Date.now() - parseInt(lastActivity, 10) > IDLE_TIMEOUT_MS) {
    // Clear cookies but we can't call clearRefreshCookie without verifying the
    // token first, so clear both cookies directly here.
    res.clearCookie(REFRESH_COOKIE, { path: '/api/auth', httpOnly: true, secure: isSecure, sameSite: isSecure ? 'none' : 'lax' })
    res.clearCookie(LAST_ACTIVITY_COOKIE, { path: '/', secure: isSecure, sameSite: isSecure ? 'none' : 'lax' })
    throw ApiError.unauthorized('Session expired due to inactivity. Please log in again.')
  }
  // ───────────────────────────────────────────────────────────────────────

  let payload
  try {
    payload = verifyRefreshToken(token)
  } catch {
    throw ApiError.unauthorized('Invalid refresh token')
  }

  const user = await User.findById(payload.sub).select('+refreshTokens').populate('customRole').populate('firm', 'name logo')
  if (!user || !user.isActive) throw ApiError.unauthorized('Session no longer valid')

  const tokenHash = hashToken(token)
  const tokens = Array.isArray(user.refreshTokens) ? user.refreshTokens : []
  if (!tokens.includes(tokenHash)) {
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
  clearRefreshCookie(res)
  return ok(res, null, 'Logged out')
})

// GET /api/auth/me
export const me = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).populate('manager', 'name').populate('customRole').populate('firm', 'name logo')
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
  clearRefreshCookie(res)
  return ok(res, null, 'Signed out of all devices. Please log in again.')
})

// POST /api/auth/forgot-password — generates an OTP and emails it to the user.
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

  // Send real OTP email to the registered address.
  // With direct SSL on port 465, this takes ~2 seconds and ensures the container
  // finishes delivering the SMTP packet before closing the request.
  const emailResult = await sendOtpEmail({
    to: user.email,
    name: user.name,
    otp,
  })

  // Only show devOtp if real email was not sent (e.g. SMTP credentials missing in dev)
  const devOtp = (!isProd && !emailResult?.sent) ? otp : undefined
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
  user.mustSetPassword = false
  user.refreshTokens = [] // force re-login everywhere
  await user.save()

  return ok(res, null, 'Password reset successful. Please log in.')
})

// POST /api/auth/set-password — activates account and sets permanent password via One-Time Password
export const setPassword = asyncHandler(async (req, res) => {
  const { email, otp, newPassword } = req.body
  const cleanEmail = String(email || '').trim().toLowerCase()
  const cleanOtp = String(otp || '').trim()

  const user = await User.findOne({ email: cleanEmail })
    .select('+resetOtpHash +resetOtpExpires +password +refreshTokens')
    .populate('customRole')
    .populate('firm', 'name logo')

  if (!user || !user.resetOtpHash || !user.resetOtpExpires) {
    throw ApiError.badRequest('Invalid or expired One-Time Password')
  }

  if (user.resetOtpExpires.getTime() < Date.now() || user.resetOtpHash !== hashToken(cleanOtp)) {
    throw ApiError.badRequest('Invalid or expired One-Time Password')
  }

  user.password = newPassword
  user.resetOtpHash = undefined
  user.resetOtpExpires = undefined
  user.mustSetPassword = false
  user.passwordChangedAt = new Date()
  user.refreshTokens = []
  await user.save()

  // Issue tokens and log them in directly so they can transition straight to their dashboard
  const accessToken = await issueTokens(res, user, {
    lastLoginAt: new Date(),
    lastLoginDevice: (req.headers['user-agent'] || '').slice(0, 200),
  })

  writeAudit({
    req: { ...req, user },
    action: AUDIT_ACTIONS.UPDATE,
    module: 'user',
    targetId: user._id,
    targetLabel: user.name,
    description: 'Set permanent password using One-Time Password (OTP)',
  })

  return ok(res, {
    accessToken,
    user: user.toJSON(),
    permissions: effectivePermissions(user),
  }, 'Password set successfully! Welcome to your dashboard.')
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
  clearRefreshCookie(res)
  return ok(res, null, 'Password changed. Please log in again.')
})

// GET /api/auth/verify-invitation?token=TOKEN
export const verifyInvitation = asyncHandler(async (req, res) => {
  const rawToken = String(req.query.token || '').trim()
  if (!rawToken) {
    throw ApiError.badRequest('Invitation token is required')
  }

  const tokenHash = hashToken(rawToken)
  const user = await User.findOne({ invitationTokenHash: tokenHash })
    .select('+invitationTokenHash +invitationTokenExpires')
    .populate('firm', 'name logo officialEmail')

  if (!user) {
    throw ApiError.badRequest('Invalid or expired invitation link')
  }

  if (user.status === 'active' && !user.invitationTokenExpires) {
    return ok(res, {
      valid: false,
      alreadyActive: true,
      message: 'This invitation has already been accepted and the account is active. Please log in.',
    }, 'Invitation already accepted')
  }

  if (!user.invitationTokenExpires || user.invitationTokenExpires.getTime() < Date.now()) {
    throw ApiError.badRequest('This invitation has expired. Please contact your administrator to resend the invitation.')
  }

  return ok(res, {
    valid: true,
    email: user.email,
    name: user.name,
    role: user.role,
    employeeId: user.employeeId || '',
    firmName: user.firm?.name || 'Real Estate CRM',
    firmLogo: user.firm?.logo || null,
    expiresAt: user.invitationTokenExpires,
  }, 'Invitation verified successfully')
})

// POST /api/auth/accept-invitation
export const acceptInvitation = asyncHandler(async (req, res) => {
  const { token, password } = req.body
  const rawToken = String(token || '').trim()
  if (!rawToken) {
    throw ApiError.badRequest('Invitation token is required')
  }

  const tokenHash = hashToken(rawToken)

  const user = await User.findOne({
    invitationTokenHash: tokenHash,
  })
    .select('+invitationTokenHash +invitationTokenExpires +password +refreshTokens')
    .populate('customRole')
    .populate('firm', 'name logo')

  if (!user) {
    throw ApiError.badRequest('Invalid, expired, or already-used invitation token')
  }

  if (user.status === 'active' && !user.invitationTokenExpires) {
    throw ApiError.badRequest('This invitation has already been accepted and the account is active. Please log in.')
  }

  if (!user.invitationTokenExpires || user.invitationTokenExpires.getTime() < Date.now()) {
    throw ApiError.badRequest('This invitation has expired. Please contact your administrator to resend the invitation.')
  }

  // Atomically claim the invitation to prevent simultaneous replay attacks
  const claimed = await User.findOneAndUpdate(
    { _id: user._id, invitationTokenHash: tokenHash, status: { $ne: 'active' } },
    {
      $unset: { invitationTokenHash: 1, invitationTokenExpires: 1, resetOtpHash: 1, resetOtpExpires: 1 },
      $set: { status: 'active', isActive: true, mustSetPassword: false, invitationAcceptedAt: new Date() },
    },
    { new: true }
  )

  if (!claimed) {
    throw ApiError.badRequest('Invitation token has already been claimed or is no longer valid')
  }

  // Update password through model instance so bcrypt hash hook runs reliably
  user.password = password
  user.status = 'active'
  user.isActive = true
  user.mustSetPassword = false
  user.invitationTokenHash = undefined
  user.invitationTokenExpires = undefined
  user.invitationAcceptedAt = new Date()
  user.passwordChangedAt = new Date()
  user.refreshTokens = []
  await user.save()

  // Issue session tokens and log them in directly
  const accessToken = await issueTokens(res, user, {
    lastLoginAt: new Date(),
    lastLoginDevice: (req.headers['user-agent'] || '').slice(0, 200),
  })

  writeAudit({
    req: { ...req, user },
    action: AUDIT_ACTIONS.UPDATE,
    module: 'user',
    targetId: user._id,
    targetLabel: user.name,
    description: 'Accepted employee invitation and set permanent password',
  })

  return ok(res, {
    accessToken,
    user: user.toJSON(),
    permissions: effectivePermissions(user),
  }, 'Account activated successfully! Welcome to your dashboard.')
})

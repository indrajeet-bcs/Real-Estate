import User from '../models/User.js'
import { verifyAccessToken } from '../utils/token.js'
import { ApiError } from '../utils/ApiError.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { env } from '../config/env.js'

// Authenticates via Bearer access token. Loads the user, enforces the
// active-account and idle-session rules, and attaches req.user.
export const authenticate = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) throw ApiError.unauthorized('Authentication required')

  let payload
  try {
    payload = verifyAccessToken(token)
  } catch {
    throw ApiError.unauthorized('Invalid or expired session')
  }

  const user = await User.findById(payload.sub).populate('customRole')
  if (!user) throw ApiError.unauthorized('Account not found')

  // Disabled/inactive account → block (§2 decision point).
  if (!user.isActive) throw ApiError.forbidden('Account is inactive. Contact your admin.')

  // Idle session timeout (§10): token TTL is short, but we also reject if the
  // last activity exceeds the configured idle window.
  const idleMs = env.sessionIdleTimeoutMin * 60 * 1000
  if (payload.iat && Date.now() - payload.iat * 1000 > idleMs) {
    throw ApiError.unauthorized('Session expired due to inactivity')
  }

  req.user = user
  next()
})

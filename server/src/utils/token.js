import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { env } from '../config/env.js'

export function signAccessToken(user) {
  return jwt.sign(
    {
      sub: user._id.toString(),
      role: user.role,
      firm: user.firm ? user.firm.toString() : null,
    },
    env.jwt.accessSecret,
    { expiresIn: env.jwt.accessExpires }
  )
}

export function signRefreshToken(user) {
  return jwt.sign({ sub: user._id.toString() }, env.jwt.refreshSecret, {
    expiresIn: env.jwt.refreshExpires,
  })
}

export function verifyAccessToken(token) {
  return jwt.verify(token, env.jwt.accessSecret)
}

export function verifyRefreshToken(token) {
  return jwt.verify(token, env.jwt.refreshSecret)
}

// We store only a hash of the refresh token so a DB leak can't reuse it.
export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export function generateOtp() {
  // 6-digit numeric OTP for password reset.
  return crypto.randomInt(100000, 999999).toString()
}

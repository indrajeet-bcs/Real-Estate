import Firm from '../models/Firm.js'
import { encryptSmtpPassword, decryptSmtpPassword } from '../utils/crypto.js'
import {
  invalidateTransporterCache,
  verifySmtpCredentials,
  testCompanySmtp,
  sendCompanyTestEmail,
} from '../utils/email.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from '../utils/ApiError.js'
import { ok } from '../utils/apiResponse.js'
import { writeAudit } from '../middleware/audit.js'
import { AUDIT_ACTIONS, MODULES, ROLES } from '../config/constants.js'

/**
 * Determines the target firmId based on the authenticated user's role.
 * Super Admin can pass firmId in query/body to manage any company.
 * Company Admin and other roles are strictly scoped to their own firm.
 */
function resolveFirmId(req) {
  if (req.user.role === ROLES.SUPER_ADMIN) {
    const id = req.query.firmId || req.body.firmId || req.user.firm
    if (!id) throw ApiError.badRequest('firmId is required for Super Admin SMTP operations')
    return id
  }
  if (!req.user.firm) {
    throw ApiError.forbidden('No company associated with this account')
  }
  return req.user.firm
}

// GET /api/company-smtp
export const getSmtpConfig = asyncHandler(async (req, res) => {
  const firmId = resolveFirmId(req)
  const firm = await Firm.findById(firmId).select('+smtpConfig.passwordEncrypted').lean()
  if (!firm) throw ApiError.notFound('Company not found')

  const smtp = firm.smtpConfig || {}
  const hasPassword = Boolean(smtp.passwordEncrypted && smtp.passwordEncrypted.length > 0)

  return ok(res, {
    firmId: String(firm._id),
    firmName: firm.name,
    officialEmail: firm.officialEmail || '',
    fromEmail: firm.officialEmail || '',
    contactEmail: firm.contactEmail || '',
    smtpConfig: {
      fromName: smtp.fromName || '',
      host: smtp.host || '',
      port: smtp.port || 587,
      secure: Boolean(smtp.secure),
      username: smtp.username || '',
      hasPassword,
      isConfigured: Boolean(smtp.isConfigured || (smtp.host && smtp.username && hasPassword)),
      isVerified: Boolean(smtp.isVerified),
      lastVerifiedAt: smtp.lastVerifiedAt || null,
    },
  }, 'Company SMTP settings retrieved')
})

// PATCH /api/company-smtp
export const updateSmtpConfig = asyncHandler(async (req, res) => {
  const firmId = resolveFirmId(req)
  const firm = await Firm.findById(firmId).select('+smtpConfig.passwordEncrypted')
  if (!firm) throw ApiError.notFound('Company not found')

  const officialEmailInput = req.body.officialEmail !== undefined ? req.body.officialEmail : req.body.fromEmail
  const fromNameInput = req.body.fromName
  const hostInput = req.body.host
  const portInput = req.body.port
  const secureInput = req.body.secure
  const usernameInput = req.body.username !== undefined ? req.body.username : req.body.user
  const passwordInput = req.body.password !== undefined ? req.body.password : req.body.pass

  const nextHost = (hostInput !== undefined ? hostInput : firm.smtpConfig?.host || '').trim()
  const nextPort = portInput !== undefined ? Number(portInput) : (firm.smtpConfig?.port || 587)
  const nextSecure = secureInput !== undefined ? Boolean(secureInput) : Boolean(firm.smtpConfig?.secure)
  const nextUsername = (usernameInput !== undefined ? usernameInput : firm.smtpConfig?.username || '').trim()
  const newPlainPassword = typeof passwordInput === 'string' && passwordInput.trim().length > 0
    ? passwordInput.trim()
    : null

  // Resolve plain password for fast-fail verification before saving
  let passwordForVerify = newPlainPassword
  if (!passwordForVerify && firm.smtpConfig?.passwordEncrypted) {
    try {
      passwordForVerify = decryptSmtpPassword(firm.smtpConfig.passwordEncrypted)
    } catch {
      throw ApiError.badRequest('Existing saved SMTP password could not be decrypted. Please re-enter your SMTP password.')
    }
  }

  if (!passwordForVerify) {
    throw ApiError.badRequest('SMTP password is required')
  }

  // Run transporter.verify() on save so invalid credentials fail fast with a clear error
  const verifyResult = await verifySmtpCredentials({
    host: nextHost,
    port: nextPort,
    secure: nextSecure,
    username: nextUsername,
    plainPassword: passwordForVerify,
  })

  if (!verifyResult.success) {
    throw ApiError.badRequest(`SMTP verification failed: ${verifyResult.error}`)
  }

  if (officialEmailInput !== undefined) {
    firm.officialEmail = officialEmailInput.trim().toLowerCase()
  }

  if (!firm.smtpConfig) {
    firm.smtpConfig = {}
  }

  if (fromNameInput !== undefined) firm.smtpConfig.fromName = fromNameInput.trim()
  firm.smtpConfig.host = nextHost
  firm.smtpConfig.port = nextPort
  firm.smtpConfig.secure = nextSecure
  firm.smtpConfig.username = nextUsername

  if (newPlainPassword) {
    firm.smtpConfig.passwordEncrypted = encryptSmtpPassword(newPlainPassword)
  }

  firm.smtpConfig.isConfigured = true
  firm.smtpConfig.isVerified = true
  firm.smtpConfig.lastVerifiedAt = new Date()

  await firm.save()

  // Invalidate any cached transporter for this firm
  invalidateTransporterCache(firm._id)

  writeAudit({
    req,
    action: AUDIT_ACTIONS.UPDATE,
    module: MODULES.SETTINGS,
    targetId: firm._id,
    targetLabel: firm.name,
    description: `Verified and saved company SMTP settings for "${firm.name}" (Credentials changed: ${newPlainPassword ? 'Yes' : 'No'})`,
  })

  return ok(res, {
    firmId: String(firm._id),
    firmName: firm.name,
    officialEmail: firm.officialEmail || '',
    fromEmail: firm.officialEmail || '',
    smtpConfig: {
      fromName: firm.smtpConfig.fromName || '',
      host: firm.smtpConfig.host || '',
      port: firm.smtpConfig.port || 587,
      secure: Boolean(firm.smtpConfig.secure),
      username: firm.smtpConfig.username || '',
      hasPassword: true,
      isConfigured: true,
      isVerified: true,
      lastVerifiedAt: firm.smtpConfig.lastVerifiedAt,
    },
  }, 'SMTP connection verified and settings saved successfully')
})

// POST /api/company-smtp/test-connection
export const testConnection = asyncHandler(async (req, res) => {
  const firmId = resolveFirmId(req)
  const hasOverride = Boolean(
    req.body.host &&
    (req.body.username || req.body.user) &&
    (req.body.password || req.body.pass)
  )

  const result = await testCompanySmtp(firmId, hasOverride ? req.body : null)
  if (!result.success) {
    throw ApiError.badRequest(result.error || 'SMTP connection verification failed')
  }

  writeAudit({
    req,
    action: AUDIT_ACTIONS.UPDATE,
    module: MODULES.SETTINGS,
    targetId: firmId,
    description: `Tested SMTP connection for firm ${firmId} (Result: Success)`,
  })

  return ok(res, { verified: true }, result.message)
})

// POST /api/company-smtp/send-test-email
export const sendTestEmail = asyncHandler(async (req, res) => {
  const firmId = resolveFirmId(req)
  const to = (req.body.to || req.body.recipientEmail || '').trim()
  if (!to) {
    throw ApiError.badRequest('Recipient email is required')
  }

  const result = await sendCompanyTestEmail(firmId, to.toLowerCase())
  if (!result.sent) {
    throw ApiError.badRequest(result.message || result.error || 'Failed to send test email')
  }

  writeAudit({
    req,
    action: AUDIT_ACTIONS.UPDATE,
    module: MODULES.SETTINGS,
    targetId: firmId,
    description: `Sent company SMTP test email to ${to}`,
  })

  return ok(res, { sent: true, to, messageId: result.messageId }, `Test email delivered successfully to ${to}`)
})

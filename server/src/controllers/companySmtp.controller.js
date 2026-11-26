import Firm from '../models/Firm.js'
import { encryptSmtpPassword, decryptSmtpPassword } from '../utils/crypto.js'
import {
  invalidateTransporterCache,
  verifyProviderCredentials,
  testCompanySmtp,
  sendCompanyTestEmail,
} from '../utils/email.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from '../utils/ApiError.js'
import { ok } from '../utils/apiResponse.js'
import { writeAudit } from '../middleware/audit.js'
import { AUDIT_ACTIONS, MODULES, ROLES } from '../config/constants.js'
import { assertRealEmail } from '../utils/emailValidator.js'

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
      provider: smtp.provider || 'smtp',
      fromName: smtp.fromName || '',
      host: smtp.host || '',
      port: smtp.port || 587,
      secure: Boolean(smtp.secure),
      username: smtp.username || '',
      webhookUrl: smtp.webhookUrl || '',
      hasPassword,
      isConfigured: Boolean(
        smtp.isConfigured ||
        (smtp.provider === 'gmail_webhook' && smtp.webhookUrl) ||
        ((smtp.provider === 'brevo_api' || smtp.provider === 'resend_api') && hasPassword) ||
        (smtp.host && smtp.username && hasPassword)
      ),
      isVerified: Boolean(smtp.isVerified),
      lastVerifiedAt: smtp.lastVerifiedAt || null,
      lastError: smtp.lastError || '',
      lastErrorAt: smtp.lastErrorAt || null,
    },
  }, 'Company SMTP settings retrieved')
})

// PATCH /api/company-smtp
export const updateSmtpConfig = asyncHandler(async (req, res) => {
  const firmId = resolveFirmId(req)
  const firm = await Firm.findById(firmId).select('+smtpConfig.passwordEncrypted')
  if (!firm) throw ApiError.notFound('Company not found')

  const nextProvider = req.body.provider || firm.smtpConfig?.provider || 'smtp'
  const officialEmailInput = req.body.officialEmail !== undefined ? req.body.officialEmail : req.body.fromEmail
  const fromNameInput = req.body.fromName
  const hostInput = req.body.host
  const portInput = req.body.port
  const secureInput = req.body.secure
  const usernameInput = req.body.username !== undefined ? req.body.username : req.body.user
  const webhookUrlInput = req.body.webhookUrl
  const passwordInput = req.body.password !== undefined ? req.body.password : req.body.pass

  const nextHost = (hostInput !== undefined ? hostInput : firm.smtpConfig?.host || '').trim()
  let nextPort = portInput !== undefined ? Number(portInput) : (firm.smtpConfig?.port || 587)
  let nextSecure = secureInput !== undefined ? Boolean(secureInput) : Boolean(firm.smtpConfig?.secure)
  const nextUsername = (usernameInput !== undefined ? usernameInput : firm.smtpConfig?.username || '').trim()
  const nextWebhookUrl = (webhookUrlInput !== undefined ? webhookUrlInput : firm.smtpConfig?.webhookUrl || '').trim()
  const newPlainPassword = typeof passwordInput === 'string' && passwordInput.trim().length > 0
    ? passwordInput.trim()
    : null

  // Validate official email BEFORE testing provider so we don't save invalid domains
  let nextOfficialEmail = firm.officialEmail || ''
  if (officialEmailInput !== undefined) {
    const trimmedOfficial = officialEmailInput.trim()
    nextOfficialEmail = trimmedOfficial
      ? await assertRealEmail(trimmedOfficial, { label: 'Company official email' })
      : ''
  }

  const previousProvider = firm.smtpConfig?.provider || 'smtp'
  const providerChanged = nextProvider !== previousProvider

  // Resolve plain credential/API key/secret for verification before saving
  let passwordForVerify = newPlainPassword
  if (!passwordForVerify && !providerChanged && firm.smtpConfig?.passwordEncrypted) {
    try {
      passwordForVerify = decryptSmtpPassword(firm.smtpConfig.passwordEncrypted)
    } catch {
      if (nextProvider !== 'gmail_webhook') {
        throw ApiError.badRequest('Existing saved credentials could not be decrypted. Please re-enter them.')
      }
    }
  }

  if (nextProvider !== 'gmail_webhook' && !passwordForVerify) {
    throw ApiError.badRequest(
      nextProvider === 'smtp' ? 'SMTP password is required' : 'API key is required'
    )
  }

  // Run verification on save so invalid credentials or blocked ports fail fast with a clear error
  const verifyResult = await verifyProviderCredentials({
    provider: nextProvider,
    host: nextHost,
    port: nextPort,
    secure: nextSecure,
    username: nextUsername,
    plainPassword: passwordForVerify || '',
    webhookUrl: nextWebhookUrl,
  })

  if (!verifyResult.success) {
    throw ApiError.badRequest(`Email verification failed: ${verifyResult.error}`)
  }

  if (verifyResult.fallbackPort) {
    nextPort = verifyResult.fallbackPort
    nextSecure = Boolean(verifyResult.fallbackSecure)
  }

  if (officialEmailInput !== undefined) {
    firm.officialEmail = nextOfficialEmail
  }

  if (!firm.smtpConfig) {
    firm.smtpConfig = {}
  }

  firm.smtpConfig.provider = nextProvider
  if (fromNameInput !== undefined) firm.smtpConfig.fromName = fromNameInput.trim()
  firm.smtpConfig.host = nextHost
  firm.smtpConfig.port = nextPort
  firm.smtpConfig.secure = nextSecure
  firm.smtpConfig.username = nextUsername
  firm.smtpConfig.webhookUrl = nextWebhookUrl

  if (newPlainPassword) {
    firm.smtpConfig.passwordEncrypted = encryptSmtpPassword(newPlainPassword)
  } else if (providerChanged) {
    firm.smtpConfig.passwordEncrypted = undefined
  }

  firm.smtpConfig.isConfigured = true
  firm.smtpConfig.isVerified = true
  firm.smtpConfig.lastVerifiedAt = new Date()
  firm.smtpConfig.lastError = ''
  firm.smtpConfig.lastErrorAt = null

  await firm.save()

  // Invalidate any cached transporter for this firm
  invalidateTransporterCache(firm._id)

  writeAudit({
    req,
    action: AUDIT_ACTIONS.UPDATE,
    module: MODULES.SETTINGS,
    targetId: firm._id,
    targetLabel: firm.name,
    description: `Verified and saved company mail settings [${nextProvider}] for "${firm.name}"`,
  })

  return ok(res, {
    firmId: String(firm._id),
    firmName: firm.name,
    officialEmail: firm.officialEmail || '',
    fromEmail: firm.officialEmail || '',
    smtpConfig: {
      provider: firm.smtpConfig.provider,
      fromName: firm.smtpConfig.fromName || '',
      host: firm.smtpConfig.host || '',
      port: firm.smtpConfig.port || 587,
      secure: Boolean(firm.smtpConfig.secure),
      username: firm.smtpConfig.username || '',
      webhookUrl: firm.smtpConfig.webhookUrl || '',
      hasPassword: Boolean(firm.smtpConfig.passwordEncrypted),
      isConfigured: true,
      isVerified: true,
      lastVerifiedAt: firm.smtpConfig.lastVerifiedAt,
      lastError: '',
      lastErrorAt: null,
    },
  }, 'Email connection verified and settings saved successfully')
})

// POST /api/company-smtp/test-connection
export const testConnection = asyncHandler(async (req, res) => {
  const firmId = resolveFirmId(req)
  const provider = req.body.provider || 'smtp'
  const hasOverride =
    (provider === 'smtp' && Boolean(req.body.host && (req.body.username || req.body.user) && (req.body.password || req.body.pass))) ||
    ((provider === 'brevo_api' || provider === 'resend_api') && Boolean(req.body.password || req.body.pass)) ||
    (provider === 'gmail_webhook' && Boolean(req.body.webhookUrl))

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

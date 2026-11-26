import nodemailer from 'nodemailer'
import Firm from '../models/Firm.js'
import { decryptSmtpPassword } from './crypto.js'
import { env } from '../config/env.js'

// In-memory cache for company-specific Nodemailer transporters.
// Isolated by firmId. Invalidate whenever a firm's SMTP settings update.
export const companyTransporterCache = new Map()

/**
 * Invalidate the transporter cache for a specific company or all companies.
 * @param {string} [firmId]
 */
export function invalidateTransporterCache(firmId) {
  if (!firmId) {
    for (const [id, item] of companyTransporterCache.entries()) {
      try { item.transporter?.close?.() } catch {}
    }
    companyTransporterCache.clear()
    return
  }

  const idStr = String(firmId)
  if (companyTransporterCache.has(idStr)) {
    const item = companyTransporterCache.get(idStr)
    try { item.transporter?.close?.() } catch {}
    companyTransporterCache.delete(idStr)
  }
}

/**
 * Internal fallback transporter using platform .env configuration.
 */
let platformTransporter = null

function getPlatformTransporter() {
  if (platformTransporter) return platformTransporter

  if (!env.email.user || !env.email.pass || env.email.pass === 'your_16_digit_app_password_here') {
    // eslint-disable-next-line no-console
    console.warn('[email] Platform EMAIL_USER / EMAIL_PASS not fully configured in .env.')
    return null
  }

  platformTransporter = nodemailer.createTransport({
    host: env.email.host || 'smtp.gmail.com',
    port: Number(env.email.port) || 465,
    secure: env.email.secure || Number(env.email.port) === 465,
    family: 4,
    connectionTimeout: 6000,
    greetingTimeout: 5000,
    socketTimeout: 10000,
    auth: {
      user: env.email.user.trim(),
      pass: env.email.pass.replace(/\s+/g, '').trim(),
    },
  })

  return platformTransporter
}

/**
 * Build a Nodemailer transporter for a given set of plain SMTP credentials.
 */
function buildSmtpTransporter({ host, port, secure, username, plainPassword }) {
  const numPort = Number(port) || 587
  const isSecure = Boolean(secure) || numPort === 465
  const cleanHost = host.trim()
  const normalizedPass = cleanHost.toLowerCase().includes('gmail')
    ? plainPassword.replace(/\s+/g, '').trim()
    : plainPassword.trim()

  return nodemailer.createTransport({
    host: cleanHost,
    port: numPort,
    secure: isSecure,
    family: 4, // Force IPv4 so Linux/cloud hosts don't stall on IPv6 routes
    connectionTimeout: 6000, // 6s connect timeout
    greetingTimeout: 5000,   // 5s greeting timeout
    socketTimeout: 10000,    // 10s socket timeout
    auth: {
      user: username.trim(),
      pass: normalizedPass,
    },
  })
}

function isNetworkTimeoutError(err) {
  const msg = String(err?.message || '').toLowerCase()
  return (
    err?.code === 'ETIMEDOUT' ||
    err?.code === 'ESOCKET' ||
    err?.code === 'ECONNREFUSED' ||
    err?.code === 'ENETUNREACH' ||
    msg.includes('timeout') ||
    msg.includes('timed out') ||
    msg.includes('econnrefused')
  )
}

async function recordDeliveryOutcome(firmId, success, errorMessage = '') {
  if (!firmId) return
  try {
    if (success) {
      await Firm.findByIdAndUpdate(firmId, {
        $set: { 'smtpConfig.lastError': '', 'smtpConfig.lastErrorAt': null },
      })
    } else {
      await Firm.findByIdAndUpdate(firmId, {
        $set: {
          'smtpConfig.lastError': String(errorMessage || 'Email delivery failed').slice(0, 500),
          'smtpConfig.lastErrorAt': new Date(),
        },
      })
    }
  } catch {
    // Non-fatal metadata update
  }
}

async function sendViaHttpsProvider({ provider, apiKeyOrSecret, webhookUrl, fromName, fromEmail, to, subject, html, text }) {
  try {
    if (provider === 'brevo_api') {
      const resp = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': String(apiKeyOrSecret || '').trim(),
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          sender: { name: fromName, email: fromEmail },
          to: [{ email: to }],
          subject,
          htmlContent: html,
          textContent: text,
        }),
        signal: AbortSignal.timeout(10000),
      })
      const data = await resp.json().catch(() => ({}))
      if (!resp.ok) {
        return { sent: false, error: data?.message || `Brevo API error (${resp.status})` }
      }
      return { sent: true, messageId: data?.messageId || 'brevo-ok' }
    }

    if (provider === 'resend_api') {
      const resp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${String(apiKeyOrSecret || '').trim()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `"${fromName}" <${fromEmail}>`,
          to: [to],
          subject,
          html,
          text,
        }),
        signal: AbortSignal.timeout(10000),
      })
      const data = await resp.json().catch(() => ({}))
      if (!resp.ok) {
        return { sent: false, error: data?.message || `Resend API error (${resp.status})` }
      }
      return { sent: true, messageId: data?.id || 'resend-ok' }
    }

    if (provider === 'gmail_webhook') {
      const url = String(webhookUrl || '').trim()
      if (!url.startsWith('https://')) {
        return { sent: false, error: 'Invalid Gmail HTTPS Web App URL' }
      }
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send',
          secret: String(apiKeyOrSecret || '').trim(),
          to,
          subject,
          html,
          text,
          fromName,
        }),
        signal: AbortSignal.timeout(12000),
      })
      const rawText = await resp.text().catch(() => '')
      let data = null
      try { data = JSON.parse(rawText) } catch {}
      if (!resp.ok || !data || data.success !== true) {
        return {
          sent: false,
          error: data?.error || data?.message || `Gmail Relay returned an unexpected response (${resp.status}). Verify the Web App URL and ensure "Who has access" is set to "Anyone".`,
        }
      }
      return { sent: true, messageId: data?.messageId || 'gmail-webhook-ok' }
    }

    return { sent: false, error: `Unsupported email provider: ${provider}` }
  } catch (err) {
    return { sent: false, error: err?.message || 'HTTPS email request failed' }
  }
}

/**
 * Verify provider credentials (SMTP handshake, Brevo/Resend key, or Gmail Webhook ping).
 */
export async function verifyProviderCredentials({
  provider = 'smtp',
  host,
  port,
  secure,
  username,
  plainPassword,
  webhookUrl,
}) {
  if (provider === 'brevo_api') {
    if (!plainPassword?.trim()) {
      return { success: false, error: 'Brevo API Key is required.' }
    }
    try {
      const resp = await fetch('https://api.brevo.com/v3/account', {
        method: 'GET',
        headers: { 'api-key': plainPassword.trim(), Accept: 'application/json' },
        signal: AbortSignal.timeout(8000),
      })
      const data = await resp.json().catch(() => ({}))
      if (!resp.ok) {
        return { success: false, error: data?.message || `Brevo authentication failed (${resp.status}).` }
      }
      return { success: true }
    } catch (err) {
      return { success: false, error: `Could not reach Brevo API: ${err.message}` }
    }
  }

  if (provider === 'resend_api') {
    if (!plainPassword?.trim()) {
      return { success: false, error: 'Resend API Key is required.' }
    }
    try {
      const resp = await fetch('https://api.resend.com/domains', {
        method: 'GET',
        headers: { Authorization: `Bearer ${plainPassword.trim()}` },
        signal: AbortSignal.timeout(8000),
      })
      const data = await resp.json().catch(() => ({}))
      // Sending-only Resend keys are valid even if restricted from listing domains
      const isSendingOnly = resp.status === 401 && String(data?.message || '').toLowerCase().includes('restricted to only send')
      if (!resp.ok && !isSendingOnly) {
        return { success: false, error: data?.message || `Resend authentication failed (${resp.status}).` }
      }
      return { success: true }
    } catch (err) {
      return { success: false, error: `Could not reach Resend API: ${err.message}` }
    }
  }

  if (provider === 'gmail_webhook') {
    const url = String(webhookUrl || '').trim()
    if (!url.startsWith('https://')) {
      return { success: false, error: 'A valid HTTPS Google Apps Script Web App URL is required.' }
    }
    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ping', secret: String(plainPassword || '').trim() }),
        signal: AbortSignal.timeout(10000),
      })
      const rawText = await resp.text().catch(() => '')
      let data = null
      try { data = JSON.parse(rawText) } catch {}
      if (!resp.ok || !data || data.success !== true) {
        return {
          success: false,
          error: data?.error || `Gmail Relay verification failed (${resp.status}). Ensure "Who has access" is set to "Anyone" and the Web App URL is current.`,
        }
      }
      return { success: true }
    } catch (err) {
      return { success: false, error: `Could not reach Gmail Relay URL: ${err.message}` }
    }
  }

  // Standard SMTP verification with automatic 587 -> 465 SSL fallback on timeout
  if (!host || !username || !plainPassword) {
    return {
      success: false,
      error: 'SMTP host, username, and password are required for verification.',
    }
  }

  const transporter = buildSmtpTransporter({ host, port, secure, username, plainPassword })
  try {
    await transporter.verify()
    return { success: true }
  } catch (err) {
    // If port 587 STARTTLS timed out, retry once on port 465 SSL automatically
    if (Number(port) === 587 && !secure && isNetworkTimeoutError(err)) {
      const sslTransporter = buildSmtpTransporter({ host, port: 465, secure: true, username, plainPassword })
      try {
        await sslTransporter.verify()
        return { success: true, fallbackPort: 465, fallbackSecure: true }
      } catch (sslErr) {
        if (isNetworkTimeoutError(sslErr)) {
          return {
            success: false,
            error: `SMTP ports 587 and 465 timed out (${sslErr.message}). If hosted on Render Free Tier, outbound SMTP ports are blocked — switch Delivery Method to "Brevo HTTPS API" or "Gmail HTTPS Relay" (Port 443).`,
          }
        }
        return {
          success: false,
          error: sslErr.message || 'SMTP connection verification failed.',
        }
      } finally {
        try { sslTransporter.close?.() } catch {}
      }
    }

    if (isNetworkTimeoutError(err)) {
      return {
        success: false,
        error: `SMTP connection timed out (${err.message}). If hosted on Render Free Tier, outbound SMTP ports are blocked — switch Delivery Method to "Brevo HTTPS API" or "Gmail HTTPS Relay" (Port 443).`,
      }
    }

    return {
      success: false,
      error: err.message || 'SMTP connection verification failed. Check host, port, security mode, and credentials.',
    }
  } finally {
    try { transporter.close?.() } catch {}
  }
}

// Keep alias export for backwards compatibility
export const verifySmtpCredentials = verifyProviderCredentials

/**
 * Constructs or retrieves a company-specific Nodemailer transporter.
 * @param {object} firm
 * @returns {Promise<nodemailer.Transporter|null>}
 */
async function getCompanyTransporter(firm) {
  if (!firm || !firm.smtpConfig) return null

  const { host, port, secure, username, passwordEncrypted } = firm.smtpConfig
  if (!host || !username || !passwordEncrypted) {
    return null
  }

  const firmIdStr = String(firm._id)

  // Check cache
  if (companyTransporterCache.has(firmIdStr)) {
    const cached = companyTransporterCache.get(firmIdStr)
    // Reuse only if settings and encrypted password fingerprint match
    if (
      cached.host === host &&
      cached.port === port &&
      cached.secure === secure &&
      cached.username === username &&
      cached.passwordEncrypted === passwordEncrypted
    ) {
      return cached.transporter
    }
    invalidateTransporterCache(firmIdStr)
  }

  // Decrypt password securely
  let plainPassword = ''
  try {
    plainPassword = decryptSmtpPassword(passwordEncrypted)
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`[email] Failed to decrypt SMTP password for firm ${firmIdStr}:`, err.message)
    return null
  }

  const transporter = buildSmtpTransporter({ host, port, secure, username, plainPassword })

  companyTransporterCache.set(firmIdStr, {
    transporter,
    host,
    port,
    secure,
    username,
    passwordEncrypted,
    createdAt: Date.now(),
  })

  return transporter
}

/**
 * Send an email dynamically using a company's verified mail configuration
 * (supports Standard SMTP with IPv4/465 retry, Brevo API, Resend API, or Gmail HTTPS Relay).
 * Never uses another company's credentials.
 */
export async function sendCompanyEmail({ firmId, to, subject, html, text }) {
  if (!firmId) {
    return sendEmail({ to, subject, html, text })
  }

  const firm = await Firm.findById(firmId).select('+smtpConfig.passwordEncrypted')
  if (!firm) {
    return { sent: false, error: 'Company not found' }
  }

  const smtp = firm.smtpConfig || {}
  const provider = smtp.provider || 'smtp'
  const senderEmail = firm.officialEmail || smtp.username
  const fromDisplayName = (smtp.fromName || firm.name || 'Real Estate CRM').replace(/"/g, '')
  const fromAddress = `"${fromDisplayName}" <${senderEmail}>`

  // Route HTTPS providers over Port 443 (works on Render Free Tier where SMTP ports are blocked)
  if (provider === 'brevo_api' || provider === 'resend_api' || provider === 'gmail_webhook') {
    const hasSecret = Boolean(smtp.passwordEncrypted && smtp.passwordEncrypted.length > 0)
    if (provider !== 'gmail_webhook' && !hasSecret) {
      return {
        sent: false,
        notConfigured: true,
        message: `Email API key is not configured for ${firm.name}.`,
      }
    }
    if (provider === 'gmail_webhook' && !smtp.webhookUrl) {
      return {
        sent: false,
        notConfigured: true,
        message: `Gmail Relay Web App URL is not configured for ${firm.name}.`,
      }
    }

    let plainSecret = ''
    if (hasSecret) {
      try {
        plainSecret = decryptSmtpPassword(smtp.passwordEncrypted)
      } catch (err) {
        const msg = `Failed to decrypt ${provider} credentials for ${firm.name}: ${err.message}`
        await recordDeliveryOutcome(firmId, false, msg)
        return { sent: false, error: msg, message: msg }
      }
    }

    const res = await sendViaHttpsProvider({
      provider,
      apiKeyOrSecret: plainSecret,
      webhookUrl: smtp.webhookUrl,
      fromName: fromDisplayName,
      fromEmail: senderEmail,
      to,
      subject,
      html,
      text,
    })

    if (res.sent) {
      await recordDeliveryOutcome(firmId, true)
      // eslint-disable-next-line no-console
      console.log(`[email] Sent message ${res.messageId} to ${to} via ${firm.name} [${provider}] (${senderEmail})`)
      return { sent: true, messageId: res.messageId, from: fromAddress }
    }

    // eslint-disable-next-line no-console
    console.error(`[email] Failed via ${firm.name} [${provider}]:`, res.error)
    await recordDeliveryOutcome(firmId, false, res.error)
    return {
      sent: false,
      error: res.error,
      message: `Failed to deliver email through ${firm.name} (${provider}): ${res.error}`,
    }
  }

  // Standard SMTP transport
  if (!smtp.host || !smtp.username || !smtp.passwordEncrypted) {
    return {
      sent: false,
      notConfigured: true,
      message: `SMTP is not configured for ${firm.name}. Please configure company SMTP settings to send outgoing emails.`,
    }
  }

  const transporter = await getCompanyTransporter(firm)
  if (!transporter) {
    const errMsg = `Unable to initialize SMTP transporter for ${firm.name}. Re-enter password in Office Settings → Email & SMTP Settings.`
    await recordDeliveryOutcome(firmId, false, errMsg)
    return { sent: false, notConfigured: true, message: errMsg }
  }

  const mailOptions = {
    from: fromAddress,
    to,
    subject,
    text,
    html,
    priority: 'high',
    headers: {
      'X-Priority': '1 (Highest)',
      'X-MSMail-Priority': 'High',
      'Importance': 'High',
    },
  }

  try {
    const info = await transporter.sendMail(mailOptions)
    await recordDeliveryOutcome(firmId, true)
    // eslint-disable-next-line no-console
    console.log(`[email] Sent message ${info.messageId} to ${to} via ${firm.name} (${senderEmail})`)
    return { sent: true, messageId: info.messageId, from: fromAddress }
  } catch (err) {
    // If port 587 STARTTLS hit a timeout/network block, try port 465 SSL automatically once
    if (Number(smtp.port) === 587 && !smtp.secure && isNetworkTimeoutError(err)) {
      let plainPass = ''
      try {
        plainPass = decryptSmtpPassword(smtp.passwordEncrypted)
      } catch {}
      if (plainPass) {
        const sslTransporter = buildSmtpTransporter({
          host: smtp.host,
          port: 465,
          secure: true,
          username: smtp.username,
          plainPassword: plainPass,
        })
        try {
          const sslInfo = await sslTransporter.sendMail(mailOptions)
          await recordDeliveryOutcome(firmId, true)
          // eslint-disable-next-line no-console
          console.log(`[email] Sent via 465 SSL fallback (${sslInfo.messageId}) to ${to} via ${firm.name}`)
          return { sent: true, messageId: sslInfo.messageId, from: fromAddress }
        } catch (sslErr) {
          err = sslErr
        } finally {
          try { sslTransporter.close?.() } catch {}
        }
      }
    }

    const hint = isNetworkTimeoutError(err)
      ? `${err.message}. Note: Cloud hosts like Render Free Tier block outbound SMTP ports (587/465) — switch Delivery Method in Office Settings to "Brevo HTTPS API" or "Gmail HTTPS Relay".`
      : err.message
    // eslint-disable-next-line no-console
    console.error(`[email] Failed to send email via ${firm.name} SMTP:`, hint)
    await recordDeliveryOutcome(firmId, false, hint)
    return {
      sent: false,
      error: hint,
      message: `Failed to deliver email through ${firm.name} SMTP: ${hint}`,
    }
  }
}

/**
 * Verify and test an email provider connection (with optional credential overrides for live form testing).
 */
export async function testCompanySmtp(firmId, configOverride = null) {
  let firm = null
  if (firmId) {
    firm = await Firm.findById(firmId).select('+smtpConfig.passwordEncrypted')
    if (!firm) throw new Error('Company not found')
  }

  const smtp = firm?.smtpConfig || {}
  const savedProvider = smtp.provider || 'smtp'
  const provider = configOverride?.provider || savedProvider
  const sameProvider = provider === savedProvider
  const host = configOverride?.host || smtp.host
  const port = configOverride?.port ?? smtp.port ?? 587
  const secure = configOverride?.secure !== undefined ? Boolean(configOverride.secure) : Boolean(smtp.secure)
  const username = configOverride?.username || configOverride?.user || smtp.username
  const webhookUrl = configOverride?.webhookUrl || smtp.webhookUrl

  let plainPassword = configOverride?.password || configOverride?.pass || ''
  if (!plainPassword && sameProvider && smtp.passwordEncrypted) {
    try {
      plainPassword = decryptSmtpPassword(smtp.passwordEncrypted)
    } catch {
      return { success: false, error: 'Saved credentials could not be decrypted. Please re-enter them.' }
    }
  }

  const verifyRes = await verifyProviderCredentials({
    provider,
    host,
    port,
    secure,
    username,
    plainPassword,
    webhookUrl,
  })

  if (verifyRes.success) {
    if (firmId && !configOverride) {
      await Firm.findByIdAndUpdate(firmId, {
        'smtpConfig.isVerified': true,
        'smtpConfig.lastVerifiedAt': new Date(),
        'smtpConfig.lastError': '',
        'smtpConfig.lastErrorAt': null,
      })
    }
    return {
      success: true,
      message: `Email connection for ${firm?.name || 'Company'} verified successfully.`,
    }
  }

  if (firmId && !configOverride) {
    await Firm.findByIdAndUpdate(firmId, {
      'smtpConfig.isVerified': false,
      'smtpConfig.lastError': verifyRes.error,
      'smtpConfig.lastErrorAt': new Date(),
    })
  }
  return {
    success: false,
    error: verifyRes.error || 'Connection verification failed.',
  }
}

/**
 * Send a test email using the company's SMTP configuration.
 */
export async function sendCompanyTestEmail(firmId, recipientEmail) {
  const firm = await Firm.findById(firmId).select('+smtpConfig.passwordEncrypted')
  if (!firm) return { sent: false, error: 'Company not found' }

  const senderEmail = firm.officialEmail || firm.smtpConfig?.username || 'noreply@crm.local'
  const subject = `[Test Email] SMTP Configuration Verified - ${firm.name}`

  const text = `Hello,\n\n` +
    `This is a test email sent from ${firm.name} Real Estate CRM to verify that your company's outgoing SMTP email server is working properly.\n\n` +
    `Sender Address: ${senderEmail}\n` +
    `SMTP Server: ${firm.smtpConfig?.host}:${firm.smtpConfig?.port}\n` +
    `Timestamp: ${new Date().toISOString()}\n\n` +
    `Regards,\n${firm.name} Team`

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
          .container { max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
          .header { background: #059669; padding: 24px 32px; text-align: center; }
          .header h1 { margin: 0; color: #ffffff; font-size: 20px; font-weight: 700; }
          .header p { margin: 6px 0 0; color: #d1fae5; font-size: 13px; }
          .content { padding: 32px; }
          .badge { display: inline-block; background: #ecfdf5; color: #047857; font-weight: 700; font-size: 12px; padding: 6px 14px; border-radius: 9999px; border: 1px solid #a7f3d0; margin-bottom: 20px; }
          .details { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px 20px; margin: 20px 0; font-size: 13px; }
          .row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px dashed #e2e8f0; }
          .row:last-child { border-bottom: none; }
          .label { color: #64748b; font-weight: 500; }
          .val { color: #0f172a; font-weight: 600; }
          .footer { background: #f8fafc; padding: 16px 32px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #f1f5f9; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>SMTP Connection Verified</h1>
            <p>${firm.name}</p>
          </div>
          <div class="content">
            <div style="text-align: center;">
              <span class="badge">✓ Email Delivery Working</span>
            </div>
            <p style="font-size: 14px; line-height: 1.6; color: #334155;">
              Congratulations! Your company's custom SMTP configuration is operating properly. Outgoing emails, employee invitations, and notifications will be sent directly through your official company mail server.
            </p>
            <div class="details">
              <div class="row"><span class="label">Company</span><span class="val">${firm.name}</span></div>
              <div class="row"><span class="label">Sender Email</span><span class="val">${senderEmail}</span></div>
              <div class="row"><span class="label">SMTP Host</span><span class="val">${firm.smtpConfig?.host}:${firm.smtpConfig?.port}</span></div>
              <div class="row"><span class="label">Tested At</span><span class="val">${new Date().toLocaleString()}</span></div>
            </div>
          </div>
          <div class="footer">
            &copy; ${new Date().getFullYear()} ${firm.name}. All rights reserved.
          </div>
        </div>
      </body>
    </html>
  `

  const result = await sendCompanyEmail({ firmId, to: recipientEmail, subject, html, text })
  if (result.sent) {
    await Firm.findByIdAndUpdate(firmId, {
      'smtpConfig.isVerified': true,
      'smtpConfig.lastVerifiedAt': new Date(),
    })
  }
  return result
}

/**
 * Send an Employee Invitation Email according to Section 8 spec.
 */
export async function sendCompanyInvitationEmail({
  firmId,
  to,
  name,
  role,
  employeeId,
  invitationToken,
  setupLink,
}) {
  const firm = await Firm.findById(firmId)
  const firmName = firm?.name || 'Real Estate CRM'
  const displayName = name || 'there'
  const roleTitle = role ? role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : 'Staff Member'
  const subject = `Invitation to Join ${firmName} Real Estate CRM`

  const text = `Hello ${displayName},\n\n` +
    `Your employee account has been created by the Admin.\n\n` +
    `Click the link below to activate your account and create your password:\n` +
    `${setupLink}\n\n` +
    `The invitation expires in 24 hours and can only be used once.\n\n` +
    `Regards,\n${firmName} Team.`

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
          .container { max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
          .header { background: #1e40af; padding: 28px 32px; text-align: center; }
          .header h1 { margin: 0; color: #ffffff; font-size: 22px; font-weight: 700; letter-spacing: -0.5px; }
          .header p { margin: 6px 0 0; color: #bfdbfe; font-size: 14px; }
          .content { padding: 32px; }
          .greeting { font-size: 16px; font-weight: 600; margin-bottom: 12px; color: #0f172a; }
          .message { font-size: 14px; line-height: 1.6; color: #475569; margin-bottom: 24px; }
          .details-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px 20px; margin-bottom: 24px; font-size: 13px; }
          .details-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px dashed #e2e8f0; }
          .details-row:last-child { border-bottom: none; }
          .details-label { color: #64748b; font-weight: 500; }
          .details-value { color: #0f172a; font-weight: 600; }
          .btn-container { text-align: center; margin: 28px 0; }
          .btn { display: inline-block; background-color: #2563eb; color: #ffffff !important; text-decoration: none; font-size: 15px; font-weight: 600; padding: 14px 32px; border-radius: 10px; box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.25); }
          .link-fallback { font-size: 12px; color: #64748b; word-break: break-all; margin-top: 20px; text-align: center; line-height: 1.5; }
          .notice { font-size: 12px; color: #64748b; line-height: 1.5; margin-top: 24px; padding-top: 16px; border-top: 1px solid #f1f5f9; text-align: center; }
          .footer { background: #f8fafc; padding: 16px 32px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #f1f5f9; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Invitation to Join ${firmName}</h1>
            <p>Real Estate CRM</p>
          </div>
          <div class="content">
            <div class="greeting">Hello ${displayName},</div>
            <div class="message">
              Your employee account has been created by the Admin. Click the button below to activate your account and create your password.
            </div>

            <div class="details-card">
              <div class="details-row"><span class="details-label">Registered Email</span><span class="details-value">${to}</span></div>
              <div class="details-row"><span class="details-label">Role</span><span class="details-value">${roleTitle}</span></div>
              ${employeeId ? `<div class="details-row"><span class="details-label">Employee ID</span><span class="details-value">${employeeId}</span></div>` : ''}
            </div>

            <div class="btn-container">
              <a href="${setupLink}" class="btn" target="_blank">Accept Invitation &amp; Set Password</a>
            </div>

            <div class="link-fallback">
              Or copy and paste this link into your browser:<br>
              <a href="${setupLink}" style="color: #2563eb;">${setupLink}</a>
            </div>

            <div class="notice">
              ⏱️ The invitation expires in <strong>24 hours</strong> and can only be used once.
            </div>

            <div style="margin-top: 24px; font-size: 14px; color: #475569;">
              Regards,<br>
              <strong>${firmName} Team.</strong>
            </div>
          </div>
          <div class="footer">
            &copy; ${new Date().getFullYear()} ${firmName}. All rights reserved.
          </div>
        </div>
      </body>
    </html>
  `

  return sendCompanyEmail({ firmId, to, subject, html, text })
}

/**
 * Generic email sender with fallback to platform credentials.
 */
export async function sendEmail({ to, subject, html, text }) {
  const mailer = getPlatformTransporter()
  if (!mailer) {
    // eslint-disable-next-line no-console
    console.log(`[email dev fallback] To: ${to} | Subject: ${subject} | Content: ${text || html}`)
    return { sent: false, mocked: true }
  }

  try {
    const info = await mailer.sendMail({
      from: env.email.from,
      to,
      subject,
      text,
      html,
      priority: 'high',
      headers: {
        'X-Priority': '1 (Highest)',
        'X-MSMail-Priority': 'High',
        'Importance': 'High',
      },
    })
    return { sent: true, messageId: info.messageId }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`[email] Failed to send email to ${to}:`, err.message)
    return { sent: false, error: err.message }
  }
}

/**
 * Send a 6-digit Password Reset OTP email.
 */
export async function sendOtpEmail({ firmId, to, name, otp }) {
  let brandTitle = 'Real Estate CRM'
  if (firmId) {
    try {
      const firm = await Firm.findById(firmId).select('name').lean()
      if (firm?.name) brandTitle = firm.name
    } catch {}
  }

  const displayName = name || 'there'
  const subject = `${brandTitle} - Your Password Reset OTP: ${otp}`

  const text = `Hello ${displayName},\n\n` +
    `You requested to reset your password for your ${brandTitle} account.\n\n` +
    `Your OTP verification code is: ${otp}\n\n` +
    `This code is valid for 10 minutes. Please do not share this code with anyone.\n\n` +
    `If you did not request this, please ignore this email.\n\n` +
    `Regards,\n${brandTitle} Team`

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
          .container { max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
          .header { background: #1e40af; padding: 24px 32px; text-align: center; }
          .header h1 { margin: 0; color: #ffffff; font-size: 20px; font-weight: 700; }
          .content { padding: 32px; }
          .greeting { font-size: 16px; font-weight: 600; margin-bottom: 12px; color: #0f172a; }
          .message { font-size: 14px; line-height: 1.6; color: #475569; margin-bottom: 24px; }
          .otp-box { text-align: center; margin: 28px 0; }
          .otp-code { display: inline-block; font-size: 36px; font-weight: 800; letter-spacing: 10px; color: #1e40af; background: #eff6ff; padding: 14px 28px 14px 36px; border-radius: 12px; border: 2px dashed #93c5fd; font-family: Courier, monospace; }
          .warning { font-size: 13px; color: #64748b; line-height: 1.5; margin-top: 24px; padding-top: 20px; border-top: 1px solid #f1f5f9; }
          .footer { background: #f8fafc; padding: 16px 32px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #f1f5f9; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${brandTitle}</h1>
          </div>
          <div class="content">
            <div class="greeting">Hello ${displayName},</div>
            <div class="message">
              We received a request to reset the password for your account. Use the one-time verification code below to proceed:
            </div>
            <div class="otp-box">
              <div class="otp-code">${otp}</div>
            </div>
            <div class="message" style="text-align: center; font-size: 13px; color: #64748b;">
              ⏱️ This code will expire in <strong>10 minutes</strong>.
            </div>
            <div class="warning">
              <strong>Security tip:</strong> Never share this OTP with anyone, including support staff. If you did not request a password reset, you can safely ignore this email.
            </div>
          </div>
          <div class="footer">
            &copy; ${new Date().getFullYear()} ${brandTitle}. All rights reserved.
          </div>
        </div>
      </body>
    </html>
  `

  if (firmId) {
    const companyRes = await sendCompanyEmail({ firmId, to, subject, html, text })
    if (companyRes.sent || !companyRes.notConfigured) {
      return companyRes
    }
  }
  return sendEmail({ to, subject, html, text })
}

/**
 * Backward compatibility: Send a welcome email with OTP.
 */
export async function sendNewUserInviteEmail({
  firmId,
  to,
  name,
  role,
  email,
  employeeId,
  otp,
  setupLink,
  firmName,
}) {
  const displayName = name || 'there'
  const companyTitle = firmName || 'Real Estate CRM'
  const roleTitle = role ? role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : 'Staff Member'
  const subject = `Welcome to ${companyTitle} - Your One-Time Password & Account Setup`

  const text = `Hello ${displayName},\n\n` +
    `Your account has been created on ${companyTitle}.\n\n` +
    `Here are your account details:\n` +
    `- Name: ${displayName}\n` +
    `- Email: ${email || to}\n` +
    `- Role: ${roleTitle}\n` +
    (employeeId ? `- Employee ID: ${employeeId}\n` : '') +
    `\nYour One-Time Password (OTP) is: ${otp}\n\n` +
    `Please set your own secure password by opening the following link:\n` +
    `${setupLink}\n\n` +
    `This one-time password and setup link will expire in 48 hours.\n\n` +
    `Regards,\n${companyTitle} Team`

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
          .container { max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
          .header { background: #1e40af; padding: 28px 32px; text-align: center; }
          .header h1 { margin: 0; color: #ffffff; font-size: 22px; font-weight: 700; }
          .header p { margin: 6px 0 0; color: #bfdbfe; font-size: 14px; }
          .content { padding: 32px; }
          .greeting { font-size: 16px; font-weight: 600; margin-bottom: 12px; color: #0f172a; }
          .message { font-size: 14px; line-height: 1.6; color: #475569; margin-bottom: 24px; }
          .details-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px 20px; margin-bottom: 24px; }
          .details-row { display: flex; justify-content: space-between; font-size: 13px; padding: 6px 0; border-bottom: 1px dashed #e2e8f0; }
          .details-row:last-child { border-bottom: none; }
          .details-label { color: #64748b; font-weight: 500; }
          .details-value { color: #0f172a; font-weight: 600; }
          .otp-section { text-align: center; background: #eff6ff; border: 2px dashed #93c5fd; border-radius: 12px; padding: 20px; margin: 24px 0; }
          .otp-title { font-size: 12px; text-transform: uppercase; font-weight: 700; color: #1e40af; letter-spacing: 1px; margin-bottom: 8px; }
          .otp-code { font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #1d4ed8; font-family: Courier, monospace; }
          .otp-hint { font-size: 12px; color: #64748b; margin-top: 6px; }
          .btn-container { text-align: center; margin: 28px 0; }
          .btn { display: inline-block; background-color: #2563eb; color: #ffffff !important; text-decoration: none; font-size: 15px; font-weight: 600; padding: 14px 32px; border-radius: 10px; box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.2); }
          .link-fallback { font-size: 12px; color: #64748b; word-break: break-all; margin-top: 20px; text-align: center; line-height: 1.5; }
          .warning { font-size: 13px; color: #64748b; line-height: 1.5; margin-top: 24px; padding-top: 20px; border-top: 1px solid #f1f5f9; }
          .footer { background: #f8fafc; padding: 16px 32px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #f1f5f9; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to ${companyTitle}</h1>
            <p>Your team account is ready</p>
          </div>
          <div class="content">
            <div class="greeting">Hello ${displayName},</div>
            <div class="message">
              Your account has been created by your administrator. Use your One-Time Password (OTP) below to set your permanent password and activate your account.
            </div>

            <div class="details-card">
              <div class="details-row"><span class="details-label">Registered Email</span><span class="details-value">${email || to}</span></div>
              <div class="details-row"><span class="details-label">Role</span><span class="details-value">${roleTitle}</span></div>
              ${employeeId ? `<div class="details-row"><span class="details-label">Employee ID</span><span class="details-value">${employeeId}</span></div>` : ''}
            </div>

            <div class="otp-section">
              <div class="otp-title">Your One-Time Password (OTP)</div>
              <div class="otp-code">${otp}</div>
              <div class="otp-hint">Valid for 48 hours • Single use only</div>
            </div>

            <div class="btn-container">
              <a href="${setupLink}" class="btn" target="_blank">Set Your Password &amp; Activate Account</a>
            </div>

            <div class="link-fallback">
              Or copy and paste this link into your browser:<br>
              <a href="${setupLink}" style="color: #2563eb;">${setupLink}</a>
            </div>

            <div class="warning">
              <strong>Security Notice:</strong> Do not share this One-Time Password with anyone. Once you set your permanent password, this OTP will expire automatically.
            </div>
          </div>
          <div class="footer">
            &copy; ${new Date().getFullYear()} ${companyTitle}. All rights reserved.
          </div>
        </div>
      </body>
    </html>
  `

  if (firmId) {
    return sendCompanyEmail({ firmId, to, subject, html, text })
  }
  return sendEmail({ to, subject, html, text })
}

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
    connectionTimeout: 7000,
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
    connectionTimeout: 8000, // 8s connect timeout
    greetingTimeout: 6000,   // 6s greeting timeout
    socketTimeout: 12000,    // 12s socket timeout
    auth: {
      user: username.trim(),
      pass: normalizedPass,
    },
  })
}

/**
 * Verify plain SMTP credentials via Nodemailer's transporter.verify() before saving.
 */
export async function verifySmtpCredentials({ host, port, secure, username, plainPassword }) {
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
    return {
      success: false,
      error: err.message || 'SMTP connection verification failed. Check host, port, security mode, and credentials.',
    }
  } finally {
    try { transporter.close?.() } catch {}
  }
}

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
 * Send an email dynamically using a company's verified SMTP configuration.
 * Never uses another company's SMTP credentials.
 */
export async function sendCompanyEmail({ firmId, to, subject, html, text }) {
  if (!firmId) {
    return sendEmail({ to, subject, html, text })
  }

  const firm = await Firm.findById(firmId).select('+smtpConfig.passwordEncrypted')
  if (!firm) {
    return { sent: false, error: 'Company not found' }
  }

  const smtp = firm.smtpConfig
  if (!smtp || !smtp.host || !smtp.username || !smtp.passwordEncrypted) {
    return {
      sent: false,
      notConfigured: true,
      message: `SMTP is not configured for ${firm.name}. Please configure company SMTP settings to send outgoing emails.`,
    }
  }

  const transporter = await getCompanyTransporter(firm)
  if (!transporter) {
    return {
      sent: false,
      notConfigured: true,
      message: `Unable to initialize SMTP transporter for ${firm.name}. Check credentials in Office Settings → Email & SMTP Settings.`,
    }
  }

  const senderEmail = firm.officialEmail || smtp.username
  const fromDisplayName = (smtp.fromName || firm.name || 'Real Estate CRM').replace(/"/g, '')
  const fromAddress = `"${fromDisplayName}" <${senderEmail}>`

  try {
    const info = await transporter.sendMail({
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
    })

    // eslint-disable-next-line no-console
    console.log(`[email] Sent message ${info.messageId} to ${to} via ${firm.name} (${senderEmail})`)
    return { sent: true, messageId: info.messageId, from: fromAddress }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`[email] Failed to send email via ${firm.name} SMTP:`, err.message)
    return {
      sent: false,
      error: err.message,
      message: `Failed to deliver email through ${firm.name} SMTP: ${err.message}`,
    }
  }
}

/**
 * Verify and test an SMTP connection (with optional credential overrides for live form testing).
 */
export async function testCompanySmtp(firmId, configOverride = null) {
  let transporter = null
  let firmName = 'Company'
  let closeOnDone = false

  const overrideUser = configOverride?.username || configOverride?.user
  const overridePass = configOverride?.password || configOverride?.pass

  if (configOverride && configOverride.host && overrideUser && overridePass) {
    transporter = buildSmtpTransporter({
      host: configOverride.host,
      port: configOverride.port,
      secure: configOverride.secure,
      username: overrideUser,
      plainPassword: overridePass,
    })
    closeOnDone = true
  } else if (firmId) {
    const firm = await Firm.findById(firmId).select('+smtpConfig.passwordEncrypted')
    if (!firm) throw new Error('Company not found')
    firmName = firm.name
    transporter = await getCompanyTransporter(firm)
  }

  if (!transporter) {
    return { success: false, error: 'SMTP configuration is incomplete. Host, username, and password are required.' }
  }

  try {
    await transporter.verify()
    if (firmId && !configOverride) {
      await Firm.findByIdAndUpdate(firmId, {
        'smtpConfig.isVerified': true,
        'smtpConfig.lastVerifiedAt': new Date(),
      })
    }
    return { success: true, message: `SMTP connection to ${firmName} email server verified successfully.` }
  } catch (err) {
    if (firmId && !configOverride) {
      await Firm.findByIdAndUpdate(firmId, {
        'smtpConfig.isVerified': false,
      })
    }
    return {
      success: false,
      error: err.message || 'SMTP connection verification failed. Please check host, port, credentials, and firewall settings.',
    }
  } finally {
    if (closeOnDone) {
      try { transporter.close?.() } catch {}
    }
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
  const displayName = name || 'there'
  const subject = `Your Password Reset OTP: ${otp}`

  const text = `Hello ${displayName},\n\n` +
    `You requested to reset your password for your Real Estate CRM account.\n\n` +
    `Your OTP verification code is: ${otp}\n\n` +
    `This code is valid for 10 minutes. Please do not share this code with anyone.\n\n` +
    `If you did not request this, please ignore this email.\n\n` +
    `Regards,\nReal Estate CRM Team`

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
            <h1>Real Estate CRM</h1>
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
            &copy; ${new Date().getFullYear()} Real Estate CRM. All rights reserved.
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

import nodemailer from 'nodemailer'
import { env } from '../config/env.js'

let transporter = null

function getTransporter() {
  if (transporter) return transporter

  if (!env.email.user || !env.email.pass || env.email.pass === 'your_16_digit_app_password_here') {
    // eslint-disable-next-line no-console
    console.warn('[email] EMAIL_USER / EMAIL_PASS not fully configured in .env. OTP will be logged to console.')
    return null
  }

  const isGmail = env.email.host.includes('gmail')
  const transportConfig = isGmail
    ? {
        service: 'gmail',
        auth: {
          user: env.email.user,
          pass: env.email.pass.replace(/\s+/g, ''), // strip spaces if copied with spaces
        },
      }
    : {
        host: env.email.host,
        port: env.email.port,
        secure: env.email.secure,
        auth: {
          user: env.email.user,
          pass: env.email.pass,
        },
      }

  transporter = nodemailer.createTransport(transportConfig)
  return transporter
}

/**
 * Send a generic email.
 */
export async function sendEmail({ to, subject, html, text }) {
  const mailer = getTransporter()
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
    })
    // eslint-disable-next-line no-console
    console.log(`[email] Successfully sent message ${info.messageId} to ${to}`)
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
export async function sendOtpEmail({ to, name, otp }) {
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
          .header h1 { margin: 0; color: #ffffff; font-size: 20px; font-weight: 700; letter-spacing: -0.5px; }
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

  return sendOtpEmailInternal({ to, subject, html, text })
}

async function sendOtpEmailInternal({ to, subject, html, text }) {
  return sendEmail({ to, subject, html, text })
}

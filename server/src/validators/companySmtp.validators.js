import { z } from 'zod'

const PROVIDERS = ['smtp', 'brevo_api', 'resend_api', 'gmail_webhook']

export const updateSmtpConfigSchema = z.object({
  firmId: z.string().optional(),
  provider: z.enum(PROVIDERS).default('smtp'),
  fromName: z.string().trim().max(120).optional().or(z.literal('')),
  officialEmail: z.string().email('Please enter a valid official company email').optional().or(z.literal('')),
  fromEmail: z.string().email('Please enter a valid sender email').optional().or(z.literal('')),
  host: z.string().trim().optional().or(z.literal('')),
  port: z.coerce.number().int().min(1).max(65535).default(587),
  secure: z.boolean().default(false),
  username: z.string().trim().optional().or(z.literal('')),
  user: z.string().trim().optional().or(z.literal('')),
  webhookUrl: z.string().trim().optional().or(z.literal('')),
  password: z.string().optional().or(z.literal('')),
  pass: z.string().optional().or(z.literal('')),
}).superRefine((data, ctx) => {
  const provider = data.provider || 'smtp'
  const senderEmail = (data.officialEmail || data.fromEmail || '').trim()

  if (provider === 'smtp') {
    if (!(data.host || '').trim()) {
      ctx.addIssue({ code: 'custom', path: ['host'], message: 'SMTP host is required' })
    }
    if (!((data.username || data.user || '').trim())) {
      ctx.addIssue({ code: 'custom', path: ['username'], message: 'SMTP username or email is required' })
    }
  } else if (provider === 'brevo_api' || provider === 'resend_api') {
    if (!senderEmail) {
      ctx.addIssue({ code: 'custom', path: ['officialEmail'], message: 'Official sender email is required for API delivery' })
    }
  } else if (provider === 'gmail_webhook') {
    if (!senderEmail) {
      ctx.addIssue({ code: 'custom', path: ['officialEmail'], message: 'Official Gmail address is required' })
    }
    if (!(data.webhookUrl || '').trim().startsWith('https://')) {
      ctx.addIssue({ code: 'custom', path: ['webhookUrl'], message: 'A valid HTTPS Google Apps Script Web App URL is required' })
    }
  }
})

export const testSmtpConnectionSchema = z.object({
  firmId: z.string().optional(),
  provider: z.enum(PROVIDERS).optional(),
  host: z.string().optional(),
  port: z.coerce.number().int().optional(),
  secure: z.boolean().optional(),
  username: z.string().optional(),
  user: z.string().optional(),
  webhookUrl: z.string().optional(),
  password: z.string().optional(),
  pass: z.string().optional(),
})

export const sendTestEmailSchema = z.object({
  firmId: z.string().optional(),
  to: z.string().email('Please enter a valid recipient email address').optional(),
  recipientEmail: z.string().email('Please enter a valid recipient email address').optional(),
}).refine((data) => data.to || data.recipientEmail, {
  message: 'Recipient email address is required',
  path: ['to'],
})

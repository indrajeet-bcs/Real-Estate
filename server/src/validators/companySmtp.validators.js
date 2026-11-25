import { z } from 'zod'

export const updateSmtpConfigSchema = z.object({
  firmId: z.string().optional(),
  fromName: z.string().trim().max(120).optional().or(z.literal('')),
  officialEmail: z.string().email('Please enter a valid official company email').optional().or(z.literal('')),
  fromEmail: z.string().email('Please enter a valid sender email').optional().or(z.literal('')),
  host: z.string().min(1, 'SMTP host is required'),
  port: z.coerce.number().int().min(1).max(65535).default(587),
  secure: z.boolean().default(false),
  username: z.string().min(1, 'SMTP username or email is required').optional(),
  user: z.string().min(1, 'SMTP username or email is required').optional(),
  password: z.string().optional().or(z.literal('')),
  pass: z.string().optional().or(z.literal('')),
}).refine((data) => Boolean((data.username || data.user || '').trim()), {
  message: 'SMTP username or email is required',
  path: ['username'],
})

export const testSmtpConnectionSchema = z.object({
  firmId: z.string().optional(),
  host: z.string().optional(),
  port: z.coerce.number().int().optional(),
  secure: z.boolean().optional(),
  username: z.string().optional(),
  user: z.string().optional(),
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

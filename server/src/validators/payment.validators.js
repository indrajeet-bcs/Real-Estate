import { z } from 'zod'
import { PAYMENT_METHODS, PAYMENT_STATUS } from '../config/payment.js'

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id')
const optId = objectId.optional().or(z.literal(''))
const optStr = z.string().optional().or(z.literal(''))
const optDate = z.coerce.date().optional().or(z.literal(''))

export const createPaymentSchema = z.object({
  booking: objectId, // §Validations: booking must exist before payment entry
  amount: z.coerce.number().positive('Amount must be greater than zero'),
  paymentDate: z.coerce.date({ required_error: 'Payment date is required' }),
  method: z.enum(PAYMENT_METHODS),
  status: z.enum(PAYMENT_STATUS).optional(),
  referenceNumber: optStr,
  bankName: optStr,
  transactionId: optStr,
  chequeNumber: optStr,
  chequeDate: optDate,
  upiId: optStr,
  receivedBy: optId,
  remarks: optStr,
})

export const updatePaymentSchema = z.object({
  amount: z.coerce.number().positive('Amount must be greater than zero').optional(),
  paymentDate: z.coerce.date().optional(),
  method: z.enum(PAYMENT_METHODS).optional(),
  referenceNumber: optStr,
  bankName: optStr,
  transactionId: optStr,
  chequeNumber: optStr,
  chequeDate: optDate,
  upiId: optStr,
  receivedBy: optId,
  remarks: optStr,
})

export const statusSchema = z.object({
  status: z.enum(PAYMENT_STATUS),
  note: optStr,
  refundAmount: z.coerce.number().min(0).optional(),
})

export const listPaymentsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(20),
  search: optStr,
  status: z.enum([...PAYMENT_STATUS, 'all']).optional(),
  method: z.enum([...PAYMENT_METHODS, 'all']).optional(),
  branch: optStr,
  project: optId,
  employee: optId,
  booking: optId,
  hasReceipt: z.enum(['true', 'false']).optional(),
  dateFrom: optDate,
  dateTo: optDate,
  sortBy: z.enum(['newest', 'oldest', 'amount_high', 'amount_low']).default('newest'),
})

export const analyticsSchema = z.object({
  branch: optStr,
  project: optId,
  employee: optId,
  method: z.enum([...PAYMENT_METHODS, 'all']).optional(),
  status: z.enum([...PAYMENT_STATUS, 'all']).optional(),
  dateFrom: optDate,
  dateTo: optDate,
})

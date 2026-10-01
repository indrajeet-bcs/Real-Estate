import { z } from 'zod'
import {
  PAYMENT_MODE, BOOKING_STATUS, PAYMENT_STATUS, REGISTRATION_STATUS, DISCOUNT_GIVEN_BY, DISCOUNT_SOURCE,
} from '../config/constants.js'

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id')

// Discount breakdown shared by create + request (spec §Discount Section).
const discountInputSchema = z.object({
  saleAmount: z.coerce.number().min(0).optional(),
  givenBy: z.enum(DISCOUNT_GIVEN_BY).optional(),
  builderSalesExecutive: z.string().optional().or(z.literal('')),
  source: z.enum(DISCOUNT_SOURCE).optional(),
  firmDiscount: z.coerce.number().min(0).optional(),
  builderDiscount: z.coerce.number().min(0).optional(),
  remarks: z.string().max(1000).optional().or(z.literal('')),
  supportingDocument: z
    .object({ label: z.string().optional(), fileName: z.string().optional(), fileUrl: z.string().optional() })
    .optional(),
})

export const createBookingSchema = z.object({
  customer: objectId,
  project: objectId,
  unit: objectId,
  builder: objectId.optional(),
  bookingAmount: z.coerce.number().positive('Booking amount must be positive'),
  paymentMode: z.enum(PAYMENT_MODE).default('other'),
  bookingSource: z.string().optional(),
  bookingDate: z.coerce.date().optional(),
  notes: z.string().max(2000).optional(),
  draft: z.boolean().optional(), // Save Draft vs Submit Booking
  tokenAmount: z.coerce.number().min(0).optional(), // maps to amountReceived
  totalValue: z.coerce.number().optional(),
  // Admin-flow port: discount %, escrow token, RERA sign-off (commission is derived).
  appliedDiscount: z.coerce.number().min(0).max(100).optional(),
  amountReceived: z.coerce.number().min(0).optional(),
  reraVerified: z.boolean().optional(),
  // Optional discount request captured during booking creation.
  discount: discountInputSchema.optional(),
  paymentMilestones: z
    .array(
      z.object({
        label: z.string().optional(),
        amount: z.coerce.number(),
        dueDate: z.coerce.date().optional(),
      })
    )
    .optional(),
})

export const updateBookingSchema = z.object({
  bookingSource: z.string().optional(),
  paymentMode: z.enum(PAYMENT_MODE).optional(),
  bookingAmount: z.coerce.number().positive().optional(),
  bookingDate: z.coerce.date().optional(),
  notes: z.string().max(2000).optional(),
  tokenAmount: z.coerce.number().min(0).optional(),
  project: objectId.optional(),
  unit: objectId.optional(),
})

// Employee raises a discount request (spec §Request Discount). Remarks are
// mandatory when any discount is entered.
export const discountRequestSchema = discountInputSchema

// Employee raises a cancellation request (spec §Request Booking Cancellation).
export const cancellationRequestSchema = z.object({
  reason: z.string().min(1, 'Cancellation reason is required'),
  remarks: z.string().max(1000).optional().or(z.literal('')),
})

// Sub-Admin / Admin decision on a pending request.
export const decideRequestSchema = z.object({
  decision: z.enum(['approve', 'reject']),
  note: z.string().max(1000).optional().or(z.literal('')),
})

export const transferBookingSchema = z.object({
  newExecutive: objectId,
  reason: z.string().min(1, 'Transfer reason is required'),
})

export const updateBookingStatusSchema = z.object({
  status: z.enum(Object.values(BOOKING_STATUS)),
  cancelReason: z.string().optional(),
})

export const milestonePaidSchema = z.object({
  paid: z.boolean().default(true),
})

// Discount breakdown (spec §Discount Information).
export const discountSchema = z.object({
  saleAmount: z.coerce.number().min(0).optional(),
  givenBy: z.enum(DISCOUNT_GIVEN_BY).optional(),
  builderSalesExecutive: z.string().optional().or(z.literal('')),
  source: z.enum(DISCOUNT_SOURCE).optional(),
  firmDiscount: z.coerce.number().min(0).optional(),
  builderDiscount: z.coerce.number().min(0).optional(),
  remarks: z.string().max(1000).optional().or(z.literal('')),
  supportingDocument: z
    .object({ label: z.string().optional(), fileName: z.string().optional(), fileUrl: z.string().optional() })
    .optional(),
})

// Recorded payment entry (spec §Payment Information).
export const paymentSchema = z.object({
  date: z.coerce.date().optional(),
  amount: z.coerce.number().positive('Amount must be positive'),
  mode: z.enum(PAYMENT_MODE).default('other'),
  reference: z.string().optional().or(z.literal('')),
  receiptNumber: z.string().optional().or(z.literal('')),
  receiptUrl: z.string().optional().or(z.literal('')),
  remarks: z.string().optional().or(z.literal('')),
})

// Registration progress (spec §Registration Information).
export const registrationSchema = z.object({
  registrationStatus: z.enum(Object.values(REGISTRATION_STATUS)).optional(),
  registrationDate: z.coerce.date().optional().or(z.literal('')),
  agreementNumber: z.string().optional().or(z.literal('')),
  registrationRemarks: z.string().max(1000).optional().or(z.literal('')),
})

// Kept for symmetry with any future payment-status endpoints.
export const paymentStatusValues = Object.values(PAYMENT_STATUS)

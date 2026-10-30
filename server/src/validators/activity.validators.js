import { z } from 'zod'
import { PRIORITY, INTEREST_LEVEL, VISIT_TYPES, VISIT_INTEREST } from '../config/constants.js'

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id')

// --- Follow-ups ---
export const createFollowUpSchema = z.object({
  customer: objectId,
  scheduledAt: z.coerce.date(),
  priority: z.enum(PRIORITY).default('medium'),
  interestLevel: z.enum(INTEREST_LEVEL).default('warm'),
  notes: z.string().optional(),
  type: z.string().optional(),
  purpose: z.string().optional(),
  project: objectId.optional().nullable(),
})

export const completeFollowUpSchema = z.object({
  outcome: z.string().optional(),
  remarks: z.string().optional(),
  conversationSummary: z.string().optional(),
  nextAction: z.string().optional(),
  nextFollowUpDate: z.coerce.date().optional(), // convenience: schedules a next follow-up
  nextFollowUpRequired: z.boolean().optional(),
  nextFollowUp: z.object({
    type: z.string().optional(),
    scheduledAt: z.coerce.date().optional(),
    priority: z.enum(PRIORITY).optional(),
    notes: z.string().optional(),
  }).optional().nullable(),
  outcomeNotes: z.string().optional(),
})

// Edit an upcoming follow-up (spec §Actions · Edit Upcoming Follow-ups).
export const updateFollowUpSchema = z.object({
  scheduledAt: z.coerce.date().optional(),
  type: z.string().optional(),
  priority: z.enum(PRIORITY).optional(),
  notes: z.string().optional(),
  purpose: z.string().optional(),
  conversationSummary: z.string().optional(),
  project: objectId.optional().nullable(),
})

export const rescheduleSchema = z.object({
  scheduledAt: z.coerce.date(),
  reason: z.string().optional(),
  priority: z.enum(PRIORITY).optional(),
  notes: z.string().optional(),
})

// --- Site visits ---
export const createVisitSchema = z.object({
  customer: objectId,
  project: objectId,
  builder: objectId.optional(),
  unit: objectId.optional(),
  assignedTo: objectId.optional(),
  scheduledAt: z.coerce.date(),
  visitType: z.enum(VISIT_TYPES).optional(),
  meetingPoint: z.string().optional(),
  notes: z.string().optional(),
})

// Edit an upcoming visit (spec §Actions · Edit Upcoming Visits).
export const updateVisitSchema = z.object({
  project: objectId.optional(),
  builder: objectId.optional().nullable(),
  unit: objectId.optional().nullable(),
  scheduledAt: z.coerce.date().optional(),
  visitType: z.enum(VISIT_TYPES).optional(),
  meetingPoint: z.string().optional(),
  notes: z.string().optional(),
})

export const conductVisitSchema = z.object({
  outcome: z.string().min(1, 'Outcome is required'),
  remarks: z.string().optional(),
  photos: z.array(z.string()).optional(),
})

export const cancelVisitSchema = z.object({
  reason: z.string().min(1, 'Reason is required'),
})

const geoPoint = z.object({
  lat: z.coerce.number().optional(),
  lng: z.coerce.number().optional(),
  address: z.string().optional(),
}).optional()

// Check-in when reaching the site (spec §Check-In).
export const checkInVisitSchema = z.object({
  location: geoPoint,
  photo: z.string().optional(),
})

// Check-out after the visit (spec §Check-Out).
export const checkOutVisitSchema = z.object({
  location: geoPoint,
  summary: z.string().optional(),
})

// Complete the visit + capture outcome (spec §Complete Site Visit / §Visit Outcome).
export const completeVisitSchema = z.object({
  feedback: z.string().optional(),
  interestLevel: z.enum(VISIT_INTEREST).optional(),
  nextAction: z.string().optional(),
  remarks: z.string().optional(),
  nextFollowUpDate: z.coerce.date().optional(),
})

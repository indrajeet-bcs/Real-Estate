import { Router } from 'express'
import { z } from 'zod'
import * as ctrl from '../controllers/attendance.controller.js'
import { authenticate } from '../middleware/auth.js'
import { requireRole, requirePermission } from '../middleware/rbac.js'
import { validate } from '../middleware/validate.js'
import { MODULES, ROLES } from '../config/constants.js'
import { listQuerySchema, objectId } from '../utils/validators.common.js'

const geoSchema = z.object({
  location: z
    .object({
      lat: z.number().optional(),
      lng: z.number().optional(),
      accuracy: z.number().optional(),
      address: z.string().optional(),
    })
    .optional(),
  remarks: z.string().optional().or(z.literal('')),
  // Optional check-in selfie as a data URL (Sales-Exec flow §E4). Capped ~4MB.
  photo: z.string().max(4_000_000).optional().or(z.literal('')),
})

const reviewSchema = listQuerySchema.extend({
  date: z.string().optional(),
  status: z.enum(['on_time', 'late', 'half_day', 'absent']).optional(),
  user: objectId.optional(),
})

const correctionSchema = z.object({
  date: z.string().min(1, 'Date is required'),
  requestedCheckInAt: z.coerce.date().optional().or(z.literal('')),
  requestedCheckOutAt: z.coerce.date().optional().or(z.literal('')),
  reason: z.string().min(1, 'Reason is required'),
})

const decideCorrectionSchema = z.object({
  decision: z.enum(['approve', 'reject']),
  note: z.string().optional().or(z.literal('')),
})

const listCorrectionsSchema = listQuerySchema.extend({
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
})

const router = Router()
router.use(authenticate)

// Executive self-service.
router.post('/check-in', validate(geoSchema), requirePermission(MODULES.ATTENDANCE, 'create'), ctrl.checkIn)
router.post('/check-out', validate(geoSchema), requirePermission(MODULES.ATTENDANCE, 'create'), ctrl.checkOut)
router.get('/me', validate(listQuerySchema, 'query'), ctrl.myAttendance)

// Attendance corrections (spec §Attendance Correction).
router.post('/corrections', validate(correctionSchema), requirePermission(MODULES.ATTENDANCE, 'create'), ctrl.submitCorrection)
router.get('/corrections', validate(listCorrectionsSchema, 'query'), requirePermission(MODULES.ATTENDANCE, 'view'), ctrl.listCorrections)
router.patch('/corrections/:id', requireRole(ROLES.SUB_ADMIN, ROLES.ADMIN), validate(decideCorrectionSchema), requirePermission(MODULES.ATTENDANCE, 'view'), ctrl.decideCorrection)

// Team review (Sub-Admin / Admin).
router.get(
  '/',
  requireRole(ROLES.SUB_ADMIN, ROLES.ADMIN),
  validate(reviewSchema, 'query'),
  requirePermission(MODULES.ATTENDANCE, 'view'),
  ctrl.reviewAttendance
)

export default router

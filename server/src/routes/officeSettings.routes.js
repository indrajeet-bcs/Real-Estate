import { Router } from 'express'
import { z } from 'zod'
import * as ctrl from '../controllers/officeSettings.controller.js'
import { authenticate } from '../middleware/auth.js'
import { requireRole } from '../middleware/rbac.js'
import { validate } from '../middleware/validate.js'
import { ROLES } from '../config/constants.js'

const updateSchema = z.object({
  // §1 Sales & Inventory
  inventoryLockHours: z.coerce.number().int().min(1).max(720).optional(),
  discountCapPercent: z.coerce.number().min(0).max(100).optional(),
  commissionSplit: z.object({
    office: z.coerce.number().min(0).max(100),
    executive: z.coerce.number().min(0).max(100),
    branch: z.coerce.number().min(0).max(100),
  }).optional(),
  // §2 Booking
  bookingValidityDays: z.coerce.number().int().min(1).max(365).optional(),
  autoCancelUnconfirmed: z.boolean().optional(),
  // §3 Lead allocation
  autoLeadAssignment: z.boolean().optional(),
  leadAssignmentMethod: z.enum(['manual', 'round_robin']).optional(),
  // §4 Attendance
  officeStartTime: z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:MM').optional(),
  officeEndTime: z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:MM').optional(),
  halfDayThresholdHours: z.coerce.number().min(0).max(24).optional(),
  // §5 Notifications
  notifications: z.object({
    newLeadAssignment: z.boolean().optional(),
    discountRequests: z.boolean().optional(),
    bookingConfirmation: z.boolean().optional(),
    employeeTransfer: z.boolean().optional(),
    attendanceAlerts: z.boolean().optional(),
  }).optional(),
})

const router = Router()

// The firm owner (Admin) manages their own firm's operational settings.
router.use(authenticate, requireRole(ROLES.ADMIN))
router.get('/', ctrl.getOfficeSettings)
router.patch('/', validate(updateSchema), ctrl.updateOfficeSettings)

export default router

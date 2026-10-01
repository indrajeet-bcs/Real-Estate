import { Router } from 'express'
import { z } from 'zod'
import * as ctrl from '../controllers/booking.controller.js'
import { authenticate } from '../middleware/auth.js'
import { requirePermission, requireRole } from '../middleware/rbac.js'
import { validate } from '../middleware/validate.js'
import { upload } from '../middleware/upload.js'
import { MODULES, ROLES } from '../config/constants.js'
import { listQuerySchema } from '../utils/validators.common.js'
import {
  createBookingSchema,
  updateBookingSchema,
  updateBookingStatusSchema,
  milestonePaidSchema,
  discountSchema,
  discountRequestSchema,
  cancellationRequestSchema,
  decideRequestSchema,
  paymentSchema,
  registrationSchema,
  transferBookingSchema,
} from '../validators/booking.validators.js'

const listSchema = listQuerySchema.extend({
  status: z.enum(['draft', 'reserved', 'confirmed', 'cancelled', 'sale_completed']).optional(),
  pendingRequests: z.enum(['discount', 'cancellation']).optional(),
})

const router = Router()
router.use(authenticate)

router.get('/', validate(listSchema, 'query'), requirePermission(MODULES.BOOKING, 'view'), ctrl.listBookings)
router.get('/:id', requirePermission(MODULES.BOOKING, 'view'), ctrl.getBooking)
router.post('/', validate(createBookingSchema), requirePermission(MODULES.BOOKING, 'create'), ctrl.createBooking)
router.patch('/:id', validate(updateBookingSchema), requirePermission(MODULES.BOOKING, 'edit'), ctrl.updateBooking)
router.post('/:id/submit', requirePermission(MODULES.BOOKING, 'edit'), ctrl.submitBooking)
router.patch('/:id/transfer', requireRole(ROLES.SUB_ADMIN, ROLES.ADMIN), validate(transferBookingSchema), requirePermission(MODULES.BOOKING, 'edit'), ctrl.transferBooking)
router.patch('/:id/status', validate(updateBookingStatusSchema), requirePermission(MODULES.BOOKING, 'edit'), ctrl.updateBookingStatus)
router.patch('/:id/milestones/:milestoneId', validate(milestonePaidSchema), requirePermission(MODULES.BOOKING, 'edit'), ctrl.setMilestonePaid)
router.patch('/:id/discount', validate(discountSchema), requirePermission(MODULES.BOOKING, 'edit'), ctrl.updateDiscount)
router.delete('/:id/discount', requirePermission(MODULES.BOOKING, 'edit'), ctrl.removeDiscount)
// Employee-raised requests + Sub-Admin/Admin decisions (spec §Approval Flow).
router.post('/:id/discount-request', validate(discountRequestSchema), requirePermission(MODULES.BOOKING, 'edit'), ctrl.requestDiscount)
router.patch('/:id/discount-request', requireRole(ROLES.SUB_ADMIN, ROLES.ADMIN), validate(decideRequestSchema), requirePermission(MODULES.BOOKING, 'edit'), ctrl.decideDiscountRequest)
router.post('/:id/cancellation-request', validate(cancellationRequestSchema), requirePermission(MODULES.BOOKING, 'edit'), ctrl.requestCancellation)
router.patch('/:id/cancellation-request', requireRole(ROLES.SUB_ADMIN, ROLES.ADMIN), validate(decideRequestSchema), requirePermission(MODULES.BOOKING, 'edit'), ctrl.decideCancellation)
router.post('/:id/documents', requirePermission(MODULES.BOOKING, 'edit'), upload.single('file'), ctrl.addBookingDocument)
router.post('/:id/payments', validate(paymentSchema), requirePermission(MODULES.BOOKING, 'edit'), ctrl.addPayment)
router.patch('/:id/registration', validate(registrationSchema), requirePermission(MODULES.BOOKING, 'edit'), ctrl.updateRegistration)

export default router

import { Router } from 'express'
import { z } from 'zod'
import * as ctrl from '../controllers/visit.controller.js'
import { authenticate } from '../middleware/auth.js'
import { requirePermission } from '../middleware/rbac.js'
import { validate } from '../middleware/validate.js'
import { MODULES } from '../config/constants.js'
import { listQuerySchema } from '../utils/validators.common.js'
import {
  createVisitSchema,
  updateVisitSchema,
  conductVisitSchema,
  rescheduleSchema,
  cancelVisitSchema,
  checkInVisitSchema,
  checkOutVisitSchema,
  completeVisitSchema,
} from '../validators/activity.validators.js'

const objId = z.string().regex(/^[0-9a-fA-F]{24}$/)
const VISIT_STATUSES = ['scheduled', 'confirmed', 'in_progress', 'conducted', 'rescheduled', 'cancelled', 'missed']

const listSchema = listQuerySchema.extend({
  status: z.enum(VISIT_STATUSES).optional(),
  scope: z.enum(['upcoming', 'missed']).optional(),
  assignedTo: objId.optional(),
  project: objId.optional(),
  customer: objId.optional(),
})

const statusSchema = z.object({ status: z.enum(VISIT_STATUSES) })
const reassignSchema = z.object({ assignedTo: objId })

const router = Router()
router.use(authenticate)

router.get('/', validate(listSchema, 'query'), requirePermission(MODULES.VISIT, 'view'), ctrl.listVisits)
router.post('/', validate(createVisitSchema), requirePermission(MODULES.VISIT, 'create'), ctrl.createVisit)
router.patch('/:id', validate(updateVisitSchema), requirePermission(MODULES.VISIT, 'edit'), ctrl.updateVisit)
router.patch('/:id/conduct', validate(conductVisitSchema), requirePermission(MODULES.VISIT, 'edit'), ctrl.conductVisit)
router.patch('/:id/check-in', validate(checkInVisitSchema), requirePermission(MODULES.VISIT, 'edit'), ctrl.checkInVisit)
router.patch('/:id/check-out', validate(checkOutVisitSchema), requirePermission(MODULES.VISIT, 'edit'), ctrl.checkOutVisit)
router.patch('/:id/complete', validate(completeVisitSchema), requirePermission(MODULES.VISIT, 'edit'), ctrl.completeVisit)
router.patch('/:id/reschedule', validate(rescheduleSchema), requirePermission(MODULES.VISIT, 'edit'), ctrl.rescheduleVisit)
router.patch('/:id/cancel', validate(cancelVisitSchema), requirePermission(MODULES.VISIT, 'edit'), ctrl.cancelVisit)
router.patch('/:id/status', validate(statusSchema), requirePermission(MODULES.VISIT, 'edit'), ctrl.updateVisitStatus)
router.patch('/:id/reassign', validate(reassignSchema), requirePermission(MODULES.VISIT, 'edit'), ctrl.reassignVisit)
router.patch('/:id/flag-missed', requirePermission(MODULES.VISIT, 'edit'), ctrl.flagMissed)

export default router

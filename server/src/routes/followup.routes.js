import { Router } from 'express'
import { z } from 'zod'
import * as ctrl from '../controllers/followup.controller.js'
import { authenticate } from '../middleware/auth.js'
import { requirePermission, requireRole } from '../middleware/rbac.js'
import { validate } from '../middleware/validate.js'
import { MODULES, ROLES } from '../config/constants.js'
import { listQuerySchema } from '../utils/validators.common.js'
import {
  createFollowUpSchema,
  completeFollowUpSchema,
  updateFollowUpSchema,
  rescheduleSchema,
} from '../validators/activity.validators.js'

const objId = z.string().regex(/^[0-9a-fA-F]{24}$/)
const listSchema = listQuerySchema.extend({
  status: z.enum(['scheduled', 'pending', 'completed', 'missed', 'rescheduled', 'cancelled', 'closed']).optional(),
  scope: z.enum(['due', 'overdue', 'today', 'upcoming']).optional(),
  assignedTo: objId.optional(),
})
const reassignSchema = z.object({ assignedTo: objId })
const cancelSchema = z.object({ reason: z.string().optional().or(z.literal('')) })

const router = Router()
router.use(authenticate)

router.get('/', validate(listSchema, 'query'), requirePermission(MODULES.FOLLOWUP, 'view'), ctrl.listFollowUps)
router.post('/', validate(createFollowUpSchema), requirePermission(MODULES.FOLLOWUP, 'create'), ctrl.createFollowUp)
router.patch('/:id', validate(updateFollowUpSchema), requirePermission(MODULES.FOLLOWUP, 'edit'), ctrl.updateFollowUp)
router.patch('/:id/complete', validate(completeFollowUpSchema), requirePermission(MODULES.FOLLOWUP, 'edit'), ctrl.completeFollowUp)
router.patch('/:id/miss', requirePermission(MODULES.FOLLOWUP, 'edit'), ctrl.missFollowUp)
router.patch('/:id/reschedule', validate(rescheduleSchema), requirePermission(MODULES.FOLLOWUP, 'edit'), ctrl.rescheduleFollowUp)
router.patch('/:id/reassign', requireRole(ROLES.SUB_ADMIN, ROLES.ADMIN), validate(reassignSchema), requirePermission(MODULES.FOLLOWUP, 'edit'), ctrl.reassignFollowUp)
router.patch('/:id/cancel', validate(cancelSchema), requirePermission(MODULES.FOLLOWUP, 'edit'), ctrl.cancelFollowUp)

export default router

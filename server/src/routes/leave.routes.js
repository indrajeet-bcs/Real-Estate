import { Router } from 'express'
import * as ctrl from '../controllers/leave.controller.js'
import { authenticate } from '../middleware/auth.js'
import { requireRole, requirePermission } from '../middleware/rbac.js'
import { validate } from '../middleware/validate.js'
import { upload } from '../middleware/upload.js'
import { ROLES, MODULES } from '../config/constants.js'
import { createLeaveSchema, rejectLeaveSchema } from '../validators/leave.validators.js'

const router = Router()
router.use(authenticate)

// Executives raise leave; Sub-Admins/Admins view the team + approve/reject.
router.get('/', requirePermission(MODULES.LEAVE, 'view'), ctrl.listLeaves)
router.post('/', requireRole(ROLES.SALES_EXECUTIVE), validate(createLeaveSchema), requirePermission(MODULES.LEAVE, 'create'), ctrl.createLeave)
router.patch('/:id/cancel', requireRole(ROLES.SALES_EXECUTIVE), requirePermission(MODULES.LEAVE, 'create'), ctrl.cancelLeave)
router.post('/:id/attachments', requireRole(ROLES.SALES_EXECUTIVE), requirePermission(MODULES.LEAVE, 'create'), upload.single('file'), ctrl.addLeaveAttachment)
router.patch('/:id/approve', requireRole(ROLES.SUB_ADMIN, ROLES.ADMIN), requirePermission(MODULES.LEAVE, 'approve'), ctrl.approveLeave)
router.patch('/:id/reject', requireRole(ROLES.SUB_ADMIN, ROLES.ADMIN), validate(rejectLeaveSchema), requirePermission(MODULES.LEAVE, 'approve'), ctrl.rejectLeave)

export default router

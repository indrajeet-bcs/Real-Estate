import { Router } from 'express'
import * as ctrl from '../controllers/actionCenter.controller.js'
import { authenticate } from '../middleware/auth.js'
import { requireRole } from '../middleware/rbac.js'
import { ROLES } from '../config/constants.js'

const router = Router()

// The branch approvals hub is for Sub-Admins (and Admins for oversight).
router.use(authenticate, requireRole(ROLES.SUB_ADMIN, ROLES.ADMIN))
router.get('/summary', ctrl.getActionSummary)

export default router

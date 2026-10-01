import { Router } from 'express'
import { z } from 'zod'
import * as ctrl from '../controllers/branchSettings.controller.js'
import { authenticate } from '../middleware/auth.js'
import { requireRole } from '../middleware/rbac.js'
import { validate } from '../middleware/validate.js'
import { ROLES } from '../config/constants.js'

const updateSchema = z.object({
  geofenceRadius: z.coerce.number().int().min(50).max(500).optional(),
  workingHours: z.string().max(64).optional(),
  autoRouteLeads: z.boolean().optional(),
})

const router = Router()

// A Sub-Admin manages their own branch's operational preferences.
router.use(authenticate, requireRole(ROLES.SUB_ADMIN, ROLES.ADMIN))
router.get('/', ctrl.getMyBranchSettings)
router.patch('/', validate(updateSchema), ctrl.updateMyBranchSettings)

export default router

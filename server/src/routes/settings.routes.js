import { Router } from 'express'
import { z } from 'zod'
import * as ctrl from '../controllers/settings.controller.js'
import { authenticate } from '../middleware/auth.js'
import { requireRole, requirePermission } from '../middleware/rbac.js'
import { validate } from '../middleware/validate.js'
import { MODULES, ROLES } from '../config/constants.js'

const updateSettingsSchema = z.object({
  sessionTimeoutMin: z.coerce.number().int().min(1).optional(),
  lateThreshold: z.string().optional(),
  halfDayMinutes: z.coerce.number().int().optional(),
  notificationTemplates: z.record(z.any()).optional(),
  general: z.record(z.any()).optional(),
})

const router = Router()

// System settings + permission matrix are Super Admin only (§3.2).
router.use(authenticate, requireRole(ROLES.SUPER_ADMIN))

router.get('/', requirePermission(MODULES.SETTINGS, 'view'), ctrl.getSettings)
router.patch('/', validate(updateSettingsSchema), requirePermission(MODULES.SETTINGS, 'edit'), ctrl.updateSettings)
router.get('/permissions', ctrl.getPermissionMatrix)

export default router

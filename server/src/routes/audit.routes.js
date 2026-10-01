import { Router } from 'express'
import { z } from 'zod'
import * as ctrl from '../controllers/audit.controller.js'
import { authenticate } from '../middleware/auth.js'
import { requireRole, requirePermission } from '../middleware/rbac.js'
import { validate } from '../middleware/validate.js'
import { MODULES, ROLES, AUDIT_ACTIONS } from '../config/constants.js'
import { listQuerySchema } from '../utils/validators.common.js'

const listSchema = listQuerySchema.extend({
  module: z.enum(Object.values(MODULES)).optional(),
  action: z.enum(Object.values(AUDIT_ACTIONS)).optional(),
  actor: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  search: z.string().optional(),
})

const router = Router()

// Audit visibility: Super Admin (all), Admin (own firm), Sub-Admin (own branch) — §3.2, §10.
router.use(authenticate, requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.SUB_ADMIN))
router.get('/', validate(listSchema, 'query'), requirePermission(MODULES.AUDIT, 'view'), ctrl.listAuditLogs)

export default router

import { Router } from 'express'
import * as ctrl from '../controllers/commission.controller.js'
import { authenticate } from '../middleware/auth.js'
import { requireRole, requirePermission } from '../middleware/rbac.js'
import { validate } from '../middleware/validate.js'
import { ROLES, MODULES } from '../config/constants.js'
import {
  createCommissionRuleSchema,
  updateCommissionRuleSchema,
  toggleCommissionRuleSchema,
} from '../validators/commission.validators.js'

const router = Router()
router.use(authenticate, requireRole(ROLES.ADMIN))

router.get('/', requirePermission(MODULES.COMMISSION, 'view'), ctrl.listCommissionRules)
router.post('/', validate(createCommissionRuleSchema), requirePermission(MODULES.COMMISSION, 'create'), ctrl.createCommissionRule)
router.patch('/:id', validate(updateCommissionRuleSchema), requirePermission(MODULES.COMMISSION, 'edit'), ctrl.updateCommissionRule)
router.patch('/:id/status', validate(toggleCommissionRuleSchema), requirePermission(MODULES.COMMISSION, 'edit'), ctrl.toggleCommissionRule)
router.delete('/:id', requirePermission(MODULES.COMMISSION, 'delete'), ctrl.deleteCommissionRule)

export default router

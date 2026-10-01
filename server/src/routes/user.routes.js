import { Router } from 'express'
import * as userCtrl from '../controllers/user.controller.js'
import { authenticate } from '../middleware/auth.js'
import { requireRole, requirePermission } from '../middleware/rbac.js'
import { validate } from '../middleware/validate.js'
import { ROLES, MODULES } from '../config/constants.js'
import {
  createUserSchema,
  updateUserSchema,
  listUsersSchema,
  deactivateUserSchema,
  transferUserSchema,
} from '../validators/user.validators.js'

const router = Router()

// Staff management is for Admin (sub-admins) and Sub-Admin (executives).
router.use(authenticate, requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.SUB_ADMIN))

router.get('/', validate(listUsersSchema, 'query'), requirePermission(MODULES.USER, 'view'), userCtrl.listUsers)
// Static route must precede the parameterised `/:id`.
router.get('/stats', requirePermission(MODULES.USER, 'view'), userCtrl.employeeStats)
router.get('/:id', requirePermission(MODULES.USER, 'view'), userCtrl.getUser)
router.post('/', validate(createUserSchema), requirePermission(MODULES.USER, 'create'), userCtrl.createUser)
router.patch('/:id', validate(updateUserSchema), requirePermission(MODULES.USER, 'edit'), userCtrl.updateUser)
router.patch(
  '/:id/deactivate',
  validate(deactivateUserSchema),
  requirePermission(MODULES.USER, 'edit'),
  userCtrl.deactivateUser
)
router.patch('/:id/activate', requirePermission(MODULES.USER, 'edit'), userCtrl.activateUser)
router.patch('/:id/transfer', validate(transferUserSchema), requirePermission(MODULES.USER, 'edit'), userCtrl.transferUser)

export default router

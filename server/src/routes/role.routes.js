import { Router } from 'express'
import * as ctrl from '../controllers/role.controller.js'
import { authenticate } from '../middleware/auth.js'
import { requirePermission } from '../middleware/rbac.js'
import { MODULES } from '../config/constants.js'

const router = Router()
router.use(authenticate)

const view = requirePermission(MODULES.ROLE, 'view')
const create = requirePermission(MODULES.ROLE, 'create')
const edit = requirePermission(MODULES.ROLE, 'edit')
const del = requirePermission(MODULES.ROLE, 'delete')

router.get('/', view, ctrl.listRoles)
router.get('/assignable/users', view, ctrl.listAssignableUsers)
router.get('/:id', view, ctrl.getRole)
router.get('/:id/users', view, ctrl.listRoleUsers)
router.post('/', create, ctrl.createRole)
router.patch('/:id', edit, ctrl.updateRole)
router.patch('/:id/status', edit, ctrl.setRoleStatus)
router.post('/:id/assign', edit, ctrl.assignUsers)
router.post('/:id/unassign', edit, ctrl.unassignUsers)
router.delete('/:id', del, ctrl.deleteRole)

export default router

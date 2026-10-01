import { Router } from 'express'
import * as ctrl from '../controllers/project.controller.js'
import { authenticate } from '../middleware/auth.js'
import { requirePermission } from '../middleware/rbac.js'
import { validate } from '../middleware/validate.js'
import { MODULES } from '../config/constants.js'
import { listQuerySchema } from '../utils/validators.common.js'
import { createProjectSchema, updateProjectSchema } from '../validators/catalog.validators.js'

const router = Router()
router.use(authenticate)

router.get('/', validate(listQuerySchema, 'query'), requirePermission(MODULES.PROJECT, 'view'), ctrl.listProjects)
router.get('/:id', requirePermission(MODULES.PROJECT, 'view'), ctrl.getProject)
router.post('/', validate(createProjectSchema), requirePermission(MODULES.PROJECT, 'create'), ctrl.createProject)
router.patch('/:id', validate(updateProjectSchema), requirePermission(MODULES.PROJECT, 'edit'), ctrl.updateProject)
router.delete('/:id', requirePermission(MODULES.PROJECT, 'delete'), ctrl.archiveProject)

export default router

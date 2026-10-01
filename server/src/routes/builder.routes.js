import { Router } from 'express'
import * as ctrl from '../controllers/builder.controller.js'
import { authenticate } from '../middleware/auth.js'
import { requirePermission } from '../middleware/rbac.js'
import { validate } from '../middleware/validate.js'
import { MODULES } from '../config/constants.js'
import { listQuerySchema } from '../utils/validators.common.js'
import { createBuilderSchema, updateBuilderSchema } from '../validators/catalog.validators.js'

const router = Router()
router.use(authenticate)

router.get('/', validate(listQuerySchema, 'query'), requirePermission(MODULES.BUILDER, 'view'), ctrl.listBuilders)
router.get('/:id', requirePermission(MODULES.BUILDER, 'view'), ctrl.getBuilder)
router.post('/', validate(createBuilderSchema), requirePermission(MODULES.BUILDER, 'create'), ctrl.createBuilder)
router.patch('/:id', validate(updateBuilderSchema), requirePermission(MODULES.BUILDER, 'edit'), ctrl.updateBuilder)
router.delete('/:id', requirePermission(MODULES.BUILDER, 'delete'), ctrl.archiveBuilder)

export default router

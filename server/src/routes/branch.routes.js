import { Router } from 'express'
import * as ctrl from '../controllers/branch.controller.js'
import { authenticate } from '../middleware/auth.js'
import { requireRole, requirePermission } from '../middleware/rbac.js'
import { validate } from '../middleware/validate.js'
import { ROLES, MODULES } from '../config/constants.js'
import {
  createBranchSchema,
  updateBranchSchema,
  setBranchStatusSchema,
  setBranchTargetsSchema,
  listBranchesSchema,
} from '../validators/branch.validators.js'

const router = Router()

// Branches are an Admin-scoped console (firm owner manages their own hubs).
router.use(authenticate, requireRole(ROLES.ADMIN))

router.get('/', validate(listBranchesSchema, 'query'), requirePermission(MODULES.BRANCH, 'view'), ctrl.listBranches)
// Static route must precede the parameterised `/:id` route.
router.get('/comparison', requirePermission(MODULES.BRANCH, 'view'), ctrl.branchComparison)
router.get('/:id', requirePermission(MODULES.BRANCH, 'view'), ctrl.getBranch)
router.post('/', validate(createBranchSchema), requirePermission(MODULES.BRANCH, 'create'), ctrl.createBranch)
router.patch('/:id', validate(updateBranchSchema), requirePermission(MODULES.BRANCH, 'edit'), ctrl.updateBranch)
router.patch('/:id/targets', validate(setBranchTargetsSchema), requirePermission(MODULES.BRANCH, 'edit'), ctrl.setBranchTargets)
router.patch('/:id/status', validate(setBranchStatusSchema), requirePermission(MODULES.BRANCH, 'edit'), ctrl.setBranchStatus)
router.delete('/:id', requirePermission(MODULES.BRANCH, 'delete'), ctrl.deleteBranch)

export default router

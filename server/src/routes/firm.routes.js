import { Router } from 'express'
import * as firmCtrl from '../controllers/firm.controller.js'
import { authenticate } from '../middleware/auth.js'
import { requireRole } from '../middleware/rbac.js'
import { validate } from '../middleware/validate.js'
import { ROLES } from '../config/constants.js'
import {
  createFirmSchema,
  updateFirmSchema,
  listFirmsSchema,
  bulkFirmActionSchema,
} from '../validators/firm.validators.js'

const router = Router()

// Firm/Admin management is Super Admin only (§3).
router.use(authenticate, requireRole(ROLES.SUPER_ADMIN))

router.post('/', validate(createFirmSchema), firmCtrl.createFirm)
router.get('/', validate(listFirmsSchema, 'query'), firmCtrl.listFirms)
router.post('/bulk', validate(bulkFirmActionSchema), firmCtrl.bulkActions)
router.get('/:id', firmCtrl.getFirm)
router.patch('/:id', validate(updateFirmSchema), firmCtrl.updateFirm)
router.patch('/:id/status', firmCtrl.setFirmStatus)
router.patch('/:id/restore', firmCtrl.restoreFirm)
router.delete('/:id', firmCtrl.softDeleteFirm)

export default router

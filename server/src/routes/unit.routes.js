import { Router } from 'express'
import { z } from 'zod'
import * as ctrl from '../controllers/unit.controller.js'
import { authenticate } from '../middleware/auth.js'
import { requirePermission } from '../middleware/rbac.js'
import { validate } from '../middleware/validate.js'
import { MODULES } from '../config/constants.js'
import { listQuerySchema } from '../utils/validators.common.js'
import { createUnitSchema, updateUnitSchema, lockUnitSchema } from '../validators/catalog.validators.js'

const bulkUnitsSchema = z.object({
  project: z.string().regex(/^[0-9a-fA-F]{24}$/),
  units: z.array(z.object({ unitNumber: z.string().min(1) }).passthrough()).min(1),
})

const UNIT_STATUSES = ['available', 'reserved', 'booked', 'blocked', 'locked', 'token', 'hold', 'sold', 'registered', 'possession']

const unitListSchema = listQuerySchema.extend({
  project: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  status: z.enum(UNIT_STATUSES).optional(),
  availability: z.enum(UNIT_STATUSES).optional(),
  bookingStatus: z.enum(['booked', 'reserved']).optional(),
  propertyType: z.string().optional(),
  configuration: z.string().optional(),
  tower: z.string().optional(),
  floor: z.string().optional(),
  assignedExec: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  priceMin: z.coerce.number().optional(),
  priceMax: z.coerce.number().optional(),
  areaMin: z.coerce.number().optional(),
  areaMax: z.coerce.number().optional(),
})

const transferUnitSchema = z.object({
  newUnit: z.string().regex(/^[0-9a-fA-F]{24}$/),
  reason: z.string().min(1, 'Transfer reason is required'),
})

const router = Router()
router.use(authenticate)

router.get('/', validate(unitListSchema, 'query'), requirePermission(MODULES.UNIT, 'view'), ctrl.listUnits)
// Static route before the parameterised `/:id`.
router.get('/stats', requirePermission(MODULES.UNIT, 'view'), ctrl.inventoryStats)
router.get('/:id', requirePermission(MODULES.UNIT, 'view'), ctrl.getUnit)
router.post('/', validate(createUnitSchema), requirePermission(MODULES.UNIT, 'create'), ctrl.createUnit)
router.post('/bulk', validate(bulkUnitsSchema), requirePermission(MODULES.UNIT, 'create'), ctrl.bulkCreateUnits)
router.post('/:id/lock', validate(lockUnitSchema), requirePermission(MODULES.UNIT, 'edit'), ctrl.lockUnit)
router.post('/:id/release', requirePermission(MODULES.UNIT, 'edit'), ctrl.releaseUnit)
router.post('/:id/transfer', validate(transferUnitSchema), requirePermission(MODULES.UNIT, 'edit'), ctrl.transferUnit)
router.patch('/:id', validate(updateUnitSchema), requirePermission(MODULES.UNIT, 'edit'), ctrl.updateUnit)

export default router

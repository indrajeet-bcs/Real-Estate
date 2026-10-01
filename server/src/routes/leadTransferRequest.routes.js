import { Router } from 'express'
import { z } from 'zod'
import * as ctrl from '../controllers/leadTransferRequest.controller.js'
import { authenticate } from '../middleware/auth.js'
import { requireRole } from '../middleware/rbac.js'
import { validate } from '../middleware/validate.js'
import { ROLES } from '../config/constants.js'

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id')

const createSchema = z.object({
  customer: objectId,
  reason: z.string().min(1, 'Transfer reason is required'),
  remarks: z.string().optional().or(z.literal('')),
})

const listSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  status: z.enum(['pending', 'approved', 'rejected', 'cancelled', 'all']).optional(),
})

const decideSchema = z.object({
  decision: z.enum(['approve', 'reject']),
  newEmployee: objectId.optional(),
  note: z.string().optional().or(z.literal('')),
})

const router = Router()
router.use(authenticate)

// Executive raises / withdraws a request.
router.post('/', requireRole(ROLES.SALES_EXECUTIVE), validate(createSchema), ctrl.createTransferRequest)
router.patch('/:id/cancel', requireRole(ROLES.SALES_EXECUTIVE), ctrl.cancelTransferRequest)

// Everyone in scope can list (executive: own, sub-admin/admin: queue).
router.get('/', validate(listSchema, 'query'), ctrl.listTransferRequests)

// Sub-Admin / Admin decide (spec §Approval Flow).
router.patch('/:id', requireRole(ROLES.SUB_ADMIN, ROLES.ADMIN), validate(decideSchema), ctrl.decideTransferRequest)

export default router

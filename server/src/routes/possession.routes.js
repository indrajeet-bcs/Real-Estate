import { Router } from 'express'
import { z } from 'zod'
import * as ctrl from '../controllers/possession.controller.js'
import { authenticate } from '../middleware/auth.js'
import { requirePermission } from '../middleware/rbac.js'
import { validate } from '../middleware/validate.js'
import { MODULES } from '../config/constants.js'
import { POSSESSION_STATUSES, POSSESSION_DOC_STATUSES } from '../models/PossessionCase.js'

const objId = z.string().regex(/^[0-9a-fA-F]{24}$/)
const dateish = z.union([z.coerce.date(), z.literal('')]).optional()

const createSchema = z.object({
  customer: objId.optional(), customerName: z.string().optional().or(z.literal('')),
  booking: objId.optional(), bookingLabel: z.string().optional().or(z.literal('')),
  registrationLabel: z.string().optional().or(z.literal('')),
  project: z.string().optional().or(z.literal('')), unitNumber: z.string().optional().or(z.literal('')),
  branch: z.string().optional().or(z.literal('')),
  assignedEmployee: objId.optional(), assignedEmployeeName: z.string().optional().or(z.literal('')),
  expectedPossessionDate: dateish, scheduledDate: dateish, scheduledTime: z.string().optional().or(z.literal('')),
  actualPossessionDate: dateish, location: z.string().optional().or(z.literal('')),
  customerConfirmation: z.enum(['Pending', 'Confirmed']).optional(),
  status: z.enum(POSSESSION_STATUSES).optional(),
  remarks: z.string().optional().or(z.literal('')),
})
const updateSchema = createSchema.partial()
const statusSchema = z.object({ status: z.enum(POSSESSION_STATUSES), remarks: z.string().optional().or(z.literal('')) })
const checklistSchema = z.object({ status: z.enum(['Pending', 'Completed']) })
const docSchema = z.object({ name: z.string().min(1), type: z.string().min(1), status: z.enum(POSSESSION_DOC_STATUSES).optional(), remarks: z.string().optional().or(z.literal('')) })

const router = Router()
router.use(authenticate)

router.get('/', requirePermission(MODULES.POSSESSION, 'view'), ctrl.listPossessions)
router.get('/dashboard', requirePermission(MODULES.POSSESSION, 'view'), ctrl.possessionDashboard)
router.get('/reports', requirePermission(MODULES.POSSESSION, 'view'), ctrl.possessionReports)
router.get('/:id', requirePermission(MODULES.POSSESSION, 'view'), ctrl.getPossession)
router.post('/', validate(createSchema), requirePermission(MODULES.POSSESSION, 'create'), ctrl.createPossession)
router.patch('/:id', validate(updateSchema), requirePermission(MODULES.POSSESSION, 'edit'), ctrl.updatePossession)
router.patch('/:id/status', validate(statusSchema), requirePermission(MODULES.POSSESSION, 'edit'), ctrl.updatePossessionStatus)
router.patch('/:id/checklist/:itemId', validate(checklistSchema), requirePermission(MODULES.POSSESSION, 'edit'), ctrl.updateChecklistItem)
router.post('/:id/documents', validate(docSchema), requirePermission(MODULES.POSSESSION, 'edit'), ctrl.addPossessionDocument)
router.delete('/:id', requirePermission(MODULES.POSSESSION, 'delete'), ctrl.deletePossession)

export default router

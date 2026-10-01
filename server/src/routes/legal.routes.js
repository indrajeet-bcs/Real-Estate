import { Router } from 'express'
import * as ctrl from '../controllers/legal.controller.js'
import { authenticate } from '../middleware/auth.js'
import { requirePermission } from '../middleware/rbac.js'
import { validate } from '../middleware/validate.js'
import { upload } from '../middleware/upload.js'
import { MODULES } from '../config/constants.js'
import {
  createCaseSchema,
  updateCaseSchema,
  assignSchema,
  statusSchema,
  addDocumentSchema,
  updateDocumentSchema,
  listCasesSchema,
  analyticsSchema,
} from '../validators/legal.validators.js'

const router = Router()
router.use(authenticate)

const view = requirePermission(MODULES.LEGAL, 'view')
const create = requirePermission(MODULES.LEGAL, 'create')
const edit = requirePermission(MODULES.LEGAL, 'edit')
const remove = requirePermission(MODULES.LEGAL, 'delete')

router.get('/config', view, ctrl.getConfig)
router.get('/dashboard', validate(analyticsSchema, 'query'), view, ctrl.dashboard)
router.get('/reports', validate(analyticsSchema, 'query'), view, ctrl.reports)
router.get('/bookings', view, ctrl.listBookings)
router.get('/booking/:bookingId/context', view, ctrl.getBookingContext)

router.get('/', validate(listCasesSchema, 'query'), view, ctrl.listCases)
router.post('/', validate(createCaseSchema), create, ctrl.createCase)
router.get('/:id', view, ctrl.getCase)
router.patch('/:id', validate(updateCaseSchema), edit, ctrl.updateCase)
router.patch('/:id/assign', validate(assignSchema), edit, ctrl.assignCase)
router.patch('/:id/status', validate(statusSchema), edit, ctrl.changeStatus)
router.post('/:id/documents', validate(addDocumentSchema), edit, ctrl.addDocument)
router.patch('/:id/documents/:docId', validate(updateDocumentSchema), edit, ctrl.updateDocument)
router.post('/:id/documents/:docId/upload', edit, upload.single('file'), ctrl.uploadDocument)
router.get('/:id/documents/:docId/download', view, ctrl.downloadDocument)
router.delete('/:id', remove, ctrl.deleteCase)

export default router

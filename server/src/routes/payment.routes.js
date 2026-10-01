import { Router } from 'express'
import * as ctrl from '../controllers/payment.controller.js'
import { authenticate } from '../middleware/auth.js'
import { requirePermission } from '../middleware/rbac.js'
import { validate } from '../middleware/validate.js'
import { upload } from '../middleware/upload.js'
import { MODULES } from '../config/constants.js'
import {
  createPaymentSchema,
  updatePaymentSchema,
  statusSchema,
  listPaymentsSchema,
  analyticsSchema,
} from '../validators/payment.validators.js'

const router = Router()
router.use(authenticate)

const view = requirePermission(MODULES.PAYMENT, 'view')
const create = requirePermission(MODULES.PAYMENT, 'create')
const edit = requirePermission(MODULES.PAYMENT, 'edit')
const remove = requirePermission(MODULES.PAYMENT, 'delete')

router.get('/config', view, ctrl.getConfig)
router.get('/dashboard', validate(analyticsSchema, 'query'), view, ctrl.dashboard)
router.get('/reports', validate(analyticsSchema, 'query'), view, ctrl.reports)
router.get('/bookings', view, ctrl.listBookings)
router.get('/booking/:bookingId/context', view, ctrl.getBookingContext)

router.get('/', validate(listPaymentsSchema, 'query'), view, ctrl.listPayments)
router.post('/', validate(createPaymentSchema), create, ctrl.createPayment)
router.get('/:id', view, ctrl.getPayment)
router.patch('/:id', validate(updatePaymentSchema), edit, ctrl.updatePayment)
router.patch('/:id/status', validate(statusSchema), edit, ctrl.changeStatus)
router.post('/:id/receipt', edit, upload.single('file'), ctrl.uploadReceipt)
router.get('/:id/receipt/download', view, ctrl.downloadReceipt)
router.delete('/:id', remove, ctrl.deletePayment)

export default router

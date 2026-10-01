import { Router } from 'express'
import * as ctrl from '../controllers/customer.controller.js'
import { authenticate } from '../middleware/auth.js'
import { requirePermission } from '../middleware/rbac.js'
import { requireRole } from '../middleware/rbac.js'
import { validate } from '../middleware/validate.js'
import { upload } from '../middleware/upload.js'
import { MODULES, ROLES } from '../config/constants.js'
import {
  createCustomerSchema,
  updateCustomerSchema,
  listCustomersSchema,
  addNoteSchema,
  interestSchema,
  changeStatusSchema,
  assignSchema,
  transferLeadSchema,
  distributeSchema,
  importSchema,
} from '../validators/customer.validators.js'

const router = Router()
router.use(authenticate)

// Assignment + import are sub-admin (team lead management, §5).
router.post(
  '/assign',
  requireRole(ROLES.SUB_ADMIN, ROLES.ADMIN),
  validate(assignSchema),
  requirePermission(MODULES.LEAD, 'assign'),
  ctrl.assignCustomers
)
router.post(
  '/distribute',
  requireRole(ROLES.SUB_ADMIN, ROLES.ADMIN),
  validate(distributeSchema),
  requirePermission(MODULES.LEAD, 'assign'),
  ctrl.distributeLeads
)
// Lead transfer — Admin/Sub-Admin only (spec §Lead Transfer).
router.post(
  '/:id/transfer',
  requireRole(ROLES.SUB_ADMIN, ROLES.ADMIN),
  validate(transferLeadSchema),
  requirePermission(MODULES.LEAD, 'assign'),
  ctrl.transferLead
)
router.post(
  '/import',
  requireRole(ROLES.SUB_ADMIN, ROLES.ADMIN),
  validate(importSchema),
  requirePermission(MODULES.LEAD, 'import'),
  ctrl.importCustomers
)

router.get('/', validate(listCustomersSchema, 'query'), requirePermission(MODULES.CUSTOMER, 'view'), ctrl.listCustomers)
router.get('/:id', requirePermission(MODULES.CUSTOMER, 'view'), ctrl.getCustomer)
router.post('/', validate(createCustomerSchema), requirePermission(MODULES.LEAD, 'create'), ctrl.createCustomer)
router.patch('/:id', validate(updateCustomerSchema), requirePermission(MODULES.CUSTOMER, 'edit'), ctrl.updateCustomer)

router.post('/:id/notes', validate(addNoteSchema), requirePermission(MODULES.CUSTOMER, 'edit'), ctrl.addNote)
router.post('/:id/interests', validate(interestSchema), requirePermission(MODULES.CUSTOMER, 'edit'), ctrl.addInterest)
router.delete('/:id/interests/:interestId', requirePermission(MODULES.CUSTOMER, 'edit'), ctrl.removeInterest)
router.post('/:id/documents', requirePermission(MODULES.CUSTOMER, 'edit'), upload.single('file'), ctrl.addDocument)
router.patch('/:id/status', validate(changeStatusSchema), requirePermission(MODULES.CUSTOMER, 'edit'), ctrl.changeStatus)
router.post('/:id/reopen', requirePermission(MODULES.CUSTOMER, 'edit'), ctrl.reopenCustomer)
// Convert a qualified lead to a customer (Employee spec §Convert to Customer).
router.post('/:id/convert', requirePermission(MODULES.CUSTOMER, 'edit'), ctrl.convertLead)

export default router

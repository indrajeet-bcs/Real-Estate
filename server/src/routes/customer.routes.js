import { Router } from 'express'
import * as ctrl from '../controllers/customer.controller.js'
import { authenticate } from '../middleware/auth.js'
import { requirePermission } from '../middleware/rbac.js'
import { requireRole } from '../middleware/rbac.js'
 preeti
import { ApiError } from '../utils/ApiError.js'
import { can } from '../config/permissions.js'

import { can } from '../config/permissions.js'
import { ApiError } from '../utils/ApiError.js'
main
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

 preeti
router.get('/', validate(listCustomersSchema, 'query'), requirePermission(MODULES.CUSTOMER, 'view'), ctrl.listCustomers)
router.get('/:id', requirePermission(MODULES.CUSTOMER, 'view'), ctrl.getCustomer)
router.post(
  '/',
  validate(createCustomerSchema),
  (req, res, next) => {
    if (can(req.user, MODULES.CUSTOMER, 'create') || can(req.user, MODULES.LEAD, 'create')) {
      return next()
    }
    return next(ApiError.forbidden('Not permitted to create customer'))
  },
  ctrl.createCustomer
)
router.patch('/:id', validate(updateCustomerSchema), requirePermission(MODULES.CUSTOMER, 'edit'), ctrl.updateCustomer)

// Guarantees that Sales Executive, Sub-Admin, and Admin always have full access
// to create, view, and edit leads/customers without RBAC 403 blocks.
function requireLeadOrCustomerPermission(action) {
  return (req, res, next) => {
    if (!req.user) return next(ApiError.unauthorized())
    if ([ROLES.ADMIN, ROLES.SUB_ADMIN, ROLES.SALES_EXECUTIVE, ROLES.SUPER_ADMIN].includes(req.user.role)) {
      return next()
    }
    if (can(req.user, MODULES.LEAD, action) || can(req.user, MODULES.CUSTOMER, action)) {
      return next()
    }
    return requirePermission(MODULES.LEAD, action)(req, res, next)
  }
}
 main

router.get('/', validate(listCustomersSchema, 'query'), requireLeadOrCustomerPermission('view'), ctrl.listCustomers)
router.get('/:id', requireLeadOrCustomerPermission('view'), ctrl.getCustomer)
router.post('/', validate(createCustomerSchema), requireLeadOrCustomerPermission('create'), ctrl.createCustomer)
router.patch('/:id', validate(updateCustomerSchema), requireLeadOrCustomerPermission('edit'), ctrl.updateCustomer)

router.post('/:id/notes', validate(addNoteSchema), requireLeadOrCustomerPermission('edit'), ctrl.addNote)
router.post('/:id/interests', validate(interestSchema), requireLeadOrCustomerPermission('edit'), ctrl.addInterest)
router.delete('/:id/interests/:interestId', requireLeadOrCustomerPermission('edit'), ctrl.removeInterest)
router.post('/:id/documents', requireLeadOrCustomerPermission('edit'), upload.single('file'), ctrl.addDocument)
router.patch('/:id/status', validate(changeStatusSchema), requireLeadOrCustomerPermission('edit'), ctrl.changeStatus)
router.post('/:id/reopen', requireLeadOrCustomerPermission('edit'), ctrl.reopenCustomer)
// Convert a qualified lead to a customer (Employee spec §Convert to Customer).
router.post('/:id/convert', requireLeadOrCustomerPermission('edit'), ctrl.convertLead)

export default router

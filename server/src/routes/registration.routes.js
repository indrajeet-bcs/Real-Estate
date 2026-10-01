import { Router } from 'express'
import { z } from 'zod'
import * as ctrl from '../controllers/registration.controller.js'
import { authenticate } from '../middleware/auth.js'
import { requirePermission } from '../middleware/rbac.js'
import { validate } from '../middleware/validate.js'
import { MODULES } from '../config/constants.js'
import { REGISTRATION_STATUSES, REGISTRATION_TYPES, REG_DOC_STATUSES } from '../models/RegistrationCase.js'

const objId = z.string().regex(/^[0-9a-fA-F]{24}$/)
const dateish = z.union([z.coerce.date(), z.literal('')]).optional()

const createSchema = z.object({
  customer: objId.optional(), customerName: z.string().optional().or(z.literal('')),
  booking: objId.optional(), bookingLabel: z.string().optional().or(z.literal('')),
  project: z.string().optional().or(z.literal('')), unitNumber: z.string().optional().or(z.literal('')),
  branch: z.string().optional().or(z.literal('')),
  registrationType: z.enum(REGISTRATION_TYPES).optional(),
  assignedEmployee: objId.optional(), assignedEmployeeName: z.string().optional().or(z.literal('')),
  expectedRegistrationDate: dateish, registrationAuthority: z.string().optional().or(z.literal('')),
  status: z.enum(REGISTRATION_STATUSES).optional(),
  appointmentDate: dateish, appointmentTime: z.string().optional().or(z.literal('')), appointmentReference: z.string().optional().or(z.literal('')),
  registrationNumber: z.string().optional().or(z.literal('')), registrationDate: dateish,
  remarks: z.string().optional().or(z.literal('')),
})
const updateSchema = createSchema.partial()
const statusSchema = z.object({ status: z.enum(REGISTRATION_STATUSES), remarks: z.string().optional().or(z.literal('')) })
const docSchema = z.object({ name: z.string().min(1), type: z.string().min(1), status: z.enum(REG_DOC_STATUSES).optional(), remarks: z.string().optional().or(z.literal('')) })
const docUpdateSchema = z.object({ status: z.enum(REG_DOC_STATUSES).optional(), remarks: z.string().optional().or(z.literal('')) })

const router = Router()
router.use(authenticate)

router.get('/', requirePermission(MODULES.REGISTRATION, 'view'), ctrl.listRegistrations)
router.get('/dashboard', requirePermission(MODULES.REGISTRATION, 'view'), ctrl.registrationDashboard)
router.get('/reports', requirePermission(MODULES.REGISTRATION, 'view'), ctrl.registrationReports)
router.get('/:id', requirePermission(MODULES.REGISTRATION, 'view'), ctrl.getRegistration)
router.post('/', validate(createSchema), requirePermission(MODULES.REGISTRATION, 'create'), ctrl.createRegistration)
router.patch('/:id', validate(updateSchema), requirePermission(MODULES.REGISTRATION, 'edit'), ctrl.updateRegistration)
router.patch('/:id/status', validate(statusSchema), requirePermission(MODULES.REGISTRATION, 'edit'), ctrl.updateRegistrationStatus)
router.post('/:id/documents', validate(docSchema), requirePermission(MODULES.REGISTRATION, 'edit'), ctrl.addRegistrationDocument)
router.patch('/:id/documents/:docId', validate(docUpdateSchema), requirePermission(MODULES.REGISTRATION, 'edit'), ctrl.updateRegistrationDocument)
router.delete('/:id', requirePermission(MODULES.REGISTRATION, 'delete'), ctrl.deleteRegistration)

export default router

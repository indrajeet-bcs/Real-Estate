import { Router } from 'express'
import { z } from 'zod'
import * as ctrl from '../controllers/loan.controller.js'
import { authenticate } from '../middleware/auth.js'
import { requirePermission } from '../middleware/rbac.js'
import { validate } from '../middleware/validate.js'
import { MODULES } from '../config/constants.js'
import { LOAN_STATUSES, LOAN_TYPES, LOAN_DOC_STATUSES } from '../models/LoanCase.js'

const objId = z.string().regex(/^[0-9a-fA-F]{24}$/)
const dateish = z.union([z.coerce.date(), z.literal('')]).optional()

const createSchema = z.object({
  customer: objId.optional(), customerName: z.string().optional().or(z.literal('')),
  booking: objId.optional(), bookingLabel: z.string().optional().or(z.literal('')),
  project: z.string().optional().or(z.literal('')), unitNumber: z.string().optional().or(z.literal('')),
  branch: z.string().optional().or(z.literal('')),
  loanRequired: z.coerce.boolean().optional(),
  loanAmount: z.coerce.number().min(0).optional(),
  bank: z.string().optional().or(z.literal('')),
  loanType: z.enum(LOAN_TYPES).optional(),
  applicationNumber: z.string().optional().or(z.literal('')),
  applicationDate: dateish, expectedSanctionDate: dateish,
  assignedExecutive: objId.optional(), assignedExecutiveName: z.string().optional().or(z.literal('')),
  status: z.enum(LOAN_STATUSES).optional(),
  sanctionedAmount: z.coerce.number().min(0).nullable().optional(),
  disbursedAmount: z.coerce.number().min(0).optional(),
  remarks: z.string().optional().or(z.literal('')),
})
const updateSchema = createSchema.partial()
const statusSchema = z.object({ status: z.enum(LOAN_STATUSES), remarks: z.string().optional().or(z.literal('')) })
const docSchema = z.object({ name: z.string().min(1), type: z.string().min(1), status: z.enum(LOAN_DOC_STATUSES).optional(), remarks: z.string().optional().or(z.literal('')) })
const docUpdateSchema = z.object({ status: z.enum(LOAN_DOC_STATUSES).optional(), remarks: z.string().optional().or(z.literal('')) })

const router = Router()
router.use(authenticate)

router.get('/', requirePermission(MODULES.LOAN, 'view'), ctrl.listLoans)
router.get('/dashboard', requirePermission(MODULES.LOAN, 'view'), ctrl.loanDashboard)
router.get('/reports', requirePermission(MODULES.LOAN, 'view'), ctrl.loanReports)
router.get('/:id', requirePermission(MODULES.LOAN, 'view'), ctrl.getLoan)
router.post('/', validate(createSchema), requirePermission(MODULES.LOAN, 'create'), ctrl.createLoan)
router.patch('/:id', validate(updateSchema), requirePermission(MODULES.LOAN, 'edit'), ctrl.updateLoan)
router.patch('/:id/status', validate(statusSchema), requirePermission(MODULES.LOAN, 'edit'), ctrl.updateLoanStatus)
router.post('/:id/documents', validate(docSchema), requirePermission(MODULES.LOAN, 'edit'), ctrl.addLoanDocument)
router.patch('/:id/documents/:docId', validate(docUpdateSchema), requirePermission(MODULES.LOAN, 'edit'), ctrl.updateLoanDocument)
router.delete('/:id', requirePermission(MODULES.LOAN, 'delete'), ctrl.deleteLoan)

export default router

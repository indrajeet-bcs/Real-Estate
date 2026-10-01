import { Router } from 'express'
import * as ctrl from '../controllers/expense.controller.js'
import { authenticate } from '../middleware/auth.js'
import { requirePermission } from '../middleware/rbac.js'
import { validate } from '../middleware/validate.js'
import { upload } from '../middleware/upload.js'
import { MODULES } from '../config/constants.js'
import {
  createExpenseSchema,
  updateExpenseSchema,
  statusSchema,
  listExpensesSchema,
  analyticsSchema,
  createCategorySchema,
  updateCategorySchema,
} from '../validators/expense.validators.js'

const router = Router()
router.use(authenticate)

const view = requirePermission(MODULES.EXPENSE, 'view')
const create = requirePermission(MODULES.EXPENSE, 'create')
const edit = requirePermission(MODULES.EXPENSE, 'edit')
const remove = requirePermission(MODULES.EXPENSE, 'delete')

router.get('/config', view, ctrl.getConfig)
router.get('/dashboard', validate(analyticsSchema, 'query'), view, ctrl.dashboard)
router.get('/reports', validate(analyticsSchema, 'query'), view, ctrl.reports)

// Categories (create/edit/delete gated to managers via 'edit' inside controller)
router.get('/categories', view, ctrl.listCategories)
router.post('/categories', validate(createCategorySchema), edit, ctrl.createCategory)
router.patch('/categories/:id', validate(updateCategorySchema), edit, ctrl.updateCategory)
router.delete('/categories/:id', edit, ctrl.deleteCategory)

// Expenses
router.get('/', validate(listExpensesSchema, 'query'), view, ctrl.listExpenses)
router.post('/', validate(createExpenseSchema), create, ctrl.createExpense)
router.get('/:id', view, ctrl.getExpense)
router.patch('/:id', validate(updateExpenseSchema), edit, ctrl.updateExpense)
router.patch('/:id/status', validate(statusSchema), edit, ctrl.changeStatus)
router.post('/:id/receipt', edit, upload.single('file'), ctrl.uploadReceipt)
router.get('/:id/receipt/download', view, ctrl.downloadReceipt)
router.delete('/:id', remove, ctrl.deleteExpense)

export default router

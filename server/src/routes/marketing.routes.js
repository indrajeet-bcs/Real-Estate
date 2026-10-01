import { Router } from 'express'
import * as ctrl from '../controllers/marketing.controller.js'
import { authenticate } from '../middleware/auth.js'
import { requirePermission } from '../middleware/rbac.js'
import { validate } from '../middleware/validate.js'
import { upload } from '../middleware/upload.js'
import { MODULES } from '../config/constants.js'
import {
  createTaskSchema,
  updateTaskSchema,
  progressSchema,
  statusSchema,
  completeSchema,
  reassignSchema,
  dueDateSchema,
  remarkSchema,
  linkSchema,
  listTasksSchema,
  createCampaignSchema,
  updateCampaignSchema,
  analyticsSchema,
} from '../validators/marketing.validators.js'

const router = Router()
router.use(authenticate)

const view = requirePermission(MODULES.MARKETING, 'view')
const create = requirePermission(MODULES.MARKETING, 'create')
const edit = requirePermission(MODULES.MARKETING, 'edit')
const remove = requirePermission(MODULES.MARKETING, 'delete')

// Config + analytics
router.get('/config', view, ctrl.getConfig)
router.get('/dashboard', validate(analyticsSchema, 'query'), view, ctrl.dashboard)
router.get('/reports', validate(analyticsSchema, 'query'), view, ctrl.reports)
router.get('/activity', view, ctrl.activityHistory)

// Campaigns (create/edit/delete gated to managers inside the controller via 'assign')
router.get('/campaigns', view, ctrl.listCampaigns)
router.post('/campaigns', validate(createCampaignSchema), create, ctrl.createCampaign)
router.get('/campaigns/:id', view, ctrl.getCampaign)
router.patch('/campaigns/:id', validate(updateCampaignSchema), edit, ctrl.updateCampaign)
router.delete('/campaigns/:id', remove, ctrl.deleteCampaign)

// Tasks
router.get('/tasks', validate(listTasksSchema, 'query'), view, ctrl.listTasks)
router.post('/tasks', validate(createTaskSchema), create, ctrl.createTask)
router.get('/tasks/:id', view, ctrl.getTask)
router.patch('/tasks/:id', validate(updateTaskSchema), edit, ctrl.updateTask)
router.patch('/tasks/:id/progress', validate(progressSchema), edit, ctrl.updateProgress)
router.patch('/tasks/:id/status', validate(statusSchema), edit, ctrl.changeStatus)
router.patch('/tasks/:id/complete', validate(completeSchema), edit, ctrl.completeTask)
router.patch('/tasks/:id/reopen', edit, ctrl.reopenTask)
router.patch('/tasks/:id/reassign', validate(reassignSchema), edit, ctrl.reassignTask)
router.patch('/tasks/:id/due-date', validate(dueDateSchema), edit, ctrl.changeDueDate)
router.post('/tasks/:id/attachments', edit, upload.single('file'), ctrl.addAttachment)
router.post('/tasks/:id/links', validate(linkSchema), edit, ctrl.addLink)
router.post('/tasks/:id/remarks', validate(remarkSchema), edit, ctrl.addRemark)
router.delete('/tasks/:id', remove, ctrl.deleteTask)

export default router

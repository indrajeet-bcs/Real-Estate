import { Router } from 'express'
import { z } from 'zod'
import * as ctrl from '../controllers/task.controller.js'
import { authenticate } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { upload } from '../middleware/upload.js'

const objId = z.string().regex(/^[0-9a-fA-F]{24}$/)

const createSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional().or(z.literal('')),
  dueDate: z.coerce.date().optional().or(z.literal('')),
  dueTime: z.string().optional().or(z.literal('')),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  relatedType: z.enum(['lead', 'customer', 'booking', 'site_visit', 'none']).optional(),
  relatedId: objId.optional().or(z.literal('')),
})
const updateSchema = createSchema.partial()
const statusSchema = z.object({ status: z.enum(['pending', 'in_progress', 'on_hold', 'completed']) })
const progressSchema = z.object({ status: z.enum(['pending', 'in_progress', 'on_hold']).optional(), progressNote: z.string().optional().or(z.literal('')) })
const completeSchema = z.object({ completionRemarks: z.string().optional().or(z.literal('')) })
const commentSchema = z.object({ text: z.string().min(1, 'Comment cannot be empty'), parent: objId.optional().or(z.literal('')) })
const listSchema = z.object({
  status: z.enum(['pending', 'in_progress', 'on_hold', 'completed']).optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  official: z.enum(['true', 'false']).optional(),
  scope: z.enum(['today']).optional(),
})

const router = Router()
router.use(authenticate) // personal resource - owner-scoped in the controller

router.get('/', validate(listSchema, 'query'), ctrl.listTasks)
router.get('/:id', ctrl.getTask)
router.post('/', validate(createSchema), ctrl.createTask)
router.patch('/:id', validate(updateSchema), ctrl.updateTask)
router.patch('/:id/status', validate(statusSchema), ctrl.setTaskStatus)
router.patch('/:id/progress', validate(progressSchema), ctrl.updateProgress)
router.patch('/:id/complete', validate(completeSchema), ctrl.completeTask)
router.post('/:id/comments', validate(commentSchema), ctrl.addComment)
router.post('/:id/attachments', upload.single('file'), ctrl.addAttachment)
router.delete('/:id', ctrl.deleteTask)

export default router

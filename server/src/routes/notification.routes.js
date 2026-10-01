import { Router } from 'express'
import { z } from 'zod'
import * as ctrl from '../controllers/notification.controller.js'
import { authenticate } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { listQuerySchema } from '../utils/validators.common.js'

const listSchema = listQuerySchema.extend({ unread: z.enum(['true', 'false']).optional() })

const router = Router()
router.use(authenticate)

router.get('/', validate(listSchema, 'query'), ctrl.listNotifications)
router.patch('/read-all', ctrl.markAllRead)
router.delete('/', ctrl.clearAllNotifications)
router.patch('/:id/read', ctrl.markRead)
router.delete('/:id', ctrl.deleteNotification)

export default router

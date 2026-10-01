import { Router } from 'express'
import {
  listAnnouncements, getAnnouncement, createAnnouncement, updateAnnouncement, deleteAnnouncement,
  listNotificationHistory
} from '../controllers/announcement.controller.js'
import { authenticate } from '../middleware/auth.js'
import { requireRole } from '../middleware/rbac.js'
import { ROLES } from '../config/constants.js'

const router = Router()

router.use(authenticate)
router.use(requireRole(ROLES.SUPER_ADMIN))

router.get('/history', listNotificationHistory)

router.get('/', listAnnouncements)
router.get('/:id', getAnnouncement)
router.post('/', createAnnouncement)
router.patch('/:id', updateAnnouncement)
router.delete('/:id', deleteAnnouncement)

export default router

import { Router } from 'express'
import { z } from 'zod'
import * as ctrl from '../controllers/dailyReport.controller.js'
import { authenticate } from '../middleware/auth.js'
import { requireRole } from '../middleware/rbac.js'
import { validate } from '../middleware/validate.js'
import { ROLES } from '../config/constants.js'

const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const count = z.coerce.number().int().min(0).optional()

const submitSchema = z.object({
  date: dateKey.optional(),
  callsCount: count,
  meetingsCount: count,
  visitsCount: count,
  bookingsCount: count,
  newLeadsCount: count,
  summary: z.string().max(2000).optional().or(z.literal('')),
  challenges: z.string().max(2000).optional().or(z.literal('')),
  tomorrowPlan: z.string().max(2000).optional().or(z.literal('')),
})

const router = Router()
router.use(authenticate) // personal resource — owner/firm scoped in the controller

router.get('/today', requireRole(ROLES.SALES_EXECUTIVE), ctrl.getToday)
router.get('/', ctrl.listReports) // exec → own; sub-admin/admin → team (firm-scoped)
router.get('/:id', ctrl.getReport)
router.post('/', requireRole(ROLES.SALES_EXECUTIVE), validate(submitSchema), ctrl.submitReport)

export default router

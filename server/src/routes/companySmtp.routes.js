import { Router } from 'express'
import * as smtpCtrl from '../controllers/companySmtp.controller.js'
import { authenticate } from '../middleware/auth.js'
import { requirePermission } from '../middleware/rbac.js'
import { validate } from '../middleware/validate.js'
import { MODULES } from '../config/constants.js'
import {
  updateSmtpConfigSchema,
  testSmtpConnectionSchema,
  sendTestEmailSchema,
} from '../validators/companySmtp.validators.js'

const router = Router()

// All SMTP configuration routes require authentication.
router.use(authenticate)

router.get(
  '/',
  requirePermission(MODULES.SETTINGS, 'view'),
  smtpCtrl.getSmtpConfig
)

router.patch(
  '/',
  validate(updateSmtpConfigSchema),
  requirePermission(MODULES.SETTINGS, 'edit'),
  smtpCtrl.updateSmtpConfig
)

router.post(
  '/test-connection',
  validate(testSmtpConnectionSchema),
  requirePermission(MODULES.SETTINGS, 'test'),
  smtpCtrl.testConnection
)

router.post(
  '/send-test-email',
  validate(sendTestEmailSchema),
  requirePermission(MODULES.SETTINGS, 'send_test'),
  smtpCtrl.sendTestEmail
)

export default router

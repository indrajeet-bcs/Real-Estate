import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import * as authCtrl from '../controllers/auth.controller.js'
import { authenticate } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { upload } from '../middleware/upload.js'
import {
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  updateProfileSchema,
} from '../validators/auth.validators.js'

const router = Router()

// Throttle credential endpoints against brute force.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts, try again later' },
})

router.post('/login', authLimiter, validate(loginSchema), authCtrl.login)
router.post('/refresh', authCtrl.refresh)
router.post('/logout', authCtrl.logout)
router.post('/forgot-password', authLimiter, validate(forgotPasswordSchema), authCtrl.forgotPassword)
router.post('/reset-password', authLimiter, validate(resetPasswordSchema), authCtrl.resetPassword)

router.get('/me', authenticate, authCtrl.me)
router.patch('/profile', authenticate, validate(updateProfileSchema), authCtrl.updateMyProfile)
router.post('/profile/documents', authenticate, upload.single('file'), authCtrl.uploadProfileDocument)
router.post('/change-password', authenticate, validate(changePasswordSchema), authCtrl.changePassword)
router.post('/logout-all', authenticate, authCtrl.logoutAllDevices)

export default router

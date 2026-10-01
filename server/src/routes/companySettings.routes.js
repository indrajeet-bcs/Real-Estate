import { Router } from 'express'
import * as ctrl from '../controllers/companySettings.controller.js'
import { authenticate } from '../middleware/auth.js'
import { requireRole } from '../middleware/rbac.js'
import { upload } from '../middleware/upload.js'
import { ROLES } from '../config/constants.js'

// Company (Office) settings — Admin-managed, firm-scoped. Each router below is
// mounted at the path the frontend already calls (see api/resources.js).
const router = Router()
router.use(authenticate, requireRole(ROLES.ADMIN))

export const companyPreferencesRouter = Router()
companyPreferencesRouter.use(authenticate, requireRole(ROLES.ADMIN))
companyPreferencesRouter.get('/', ctrl.getPreferences)
companyPreferencesRouter.patch('/', ctrl.updatePreferences)

export const companyBusinessConfigRouter = Router()
companyBusinessConfigRouter.use(authenticate, requireRole(ROLES.ADMIN))
companyBusinessConfigRouter.get('/', ctrl.getBusinessConfig)
companyBusinessConfigRouter.patch('/', ctrl.updateBusinessConfig)

export const companyNotificationsRouter = Router()
companyNotificationsRouter.use(authenticate, requireRole(ROLES.ADMIN))
companyNotificationsRouter.get('/', ctrl.getNotifications)
companyNotificationsRouter.patch('/', ctrl.updateNotifications)

export const companySecurityRouter = Router()
companySecurityRouter.use(authenticate, requireRole(ROLES.ADMIN))
companySecurityRouter.get('/', ctrl.getSecurity)
companySecurityRouter.patch('/', ctrl.updateSecurity)

export const companyBrandingRouter = Router()
companyBrandingRouter.use(authenticate, requireRole(ROLES.ADMIN))
companyBrandingRouter.get('/', ctrl.getBranding)
companyBrandingRouter.patch('/', ctrl.updateBranding)
companyBrandingRouter.post('/logo', upload.single('file'), ctrl.uploadLogo)
companyBrandingRouter.post('/favicon', upload.single('file'), ctrl.uploadFavicon)

export const masterDataRouter = Router()
masterDataRouter.use(authenticate, requireRole(ROLES.ADMIN))
masterDataRouter.get('/:category', ctrl.listMasterData)
masterDataRouter.post('/:category', ctrl.createMasterData)
masterDataRouter.patch('/:category/:id', ctrl.updateMasterData)
masterDataRouter.patch('/:category/:id/status', ctrl.setMasterDataStatus)

export const activeSessionsRouter = Router()
activeSessionsRouter.use(authenticate, requireRole(ROLES.ADMIN))
activeSessionsRouter.get('/', ctrl.listSessions)
activeSessionsRouter.delete('/:id', ctrl.revokeSession)

export default router

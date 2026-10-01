import { Router } from 'express'
import authRoutes from './auth.routes.js'
import firmRoutes from './firm.routes.js'
import userRoutes from './user.routes.js'
import branchRoutes from './branch.routes.js'
import builderRoutes from './builder.routes.js'
import projectRoutes from './project.routes.js'
import unitRoutes from './unit.routes.js'
import customerRoutes from './customer.routes.js'
import leadTransferRequestRoutes from './leadTransferRequest.routes.js'
import followupRoutes from './followup.routes.js'
import visitRoutes from './visit.routes.js'
import bookingRoutes from './booking.routes.js'
import taskRoutes from './task.routes.js'
import commissionRoutes from './commission.routes.js'
import leaveRoutes from './leave.routes.js'
import actionCenterRoutes from './actionCenter.routes.js'
import attendanceRoutes from './attendance.routes.js'
import notificationRoutes from './notification.routes.js'
import auditRoutes from './audit.routes.js'
import reportRoutes from './report.routes.js'
import settingsRoutes from './settings.routes.js'
import officeSettingsRoutes from './officeSettings.routes.js'
import branchSettingsRoutes from './branchSettings.routes.js'
import ticketRoutes from './ticket.routes.js'
import announcementRoutes from './announcement.routes.js'
import billingRoutes from './billing.routes.js'
import marketingRoutes from './marketing.routes.js'
import paymentRoutes from './payment.routes.js'
import expenseRoutes from './expense.routes.js'
import legalRoutes from './legal.routes.js'
import dailyReportRoutes from './dailyReport.routes.js'
import loanRoutes from './loan.routes.js'
import roleRoutes from './role.routes.js'
import registrationRoutes from './registration.routes.js'
import possessionRoutes from './possession.routes.js'
import {
  companyPreferencesRouter, companyBusinessConfigRouter, companyNotificationsRouter,
  companySecurityRouter, companyBrandingRouter, masterDataRouter, activeSessionsRouter,
} from './companySettings.routes.js'

const router = Router()

router.get('/health', (_req, res) => {
  res.json({ success: true, message: 'API is healthy', timestamp: new Date().toISOString() })
})

router.use('/auth', authRoutes)
router.use('/firms', firmRoutes)
router.use('/users', userRoutes)
router.use('/branches', branchRoutes)
router.use('/builders', builderRoutes)
router.use('/projects', projectRoutes)
router.use('/units', unitRoutes)
router.use('/customers', customerRoutes)
router.use('/lead-transfers', leadTransferRequestRoutes)
router.use('/followups', followupRoutes)
router.use('/visits', visitRoutes)
router.use('/bookings', bookingRoutes)
router.use('/tasks', taskRoutes)
router.use('/commissions', commissionRoutes)
router.use('/leaves', leaveRoutes)
router.use('/action-center', actionCenterRoutes)
router.use('/attendance', attendanceRoutes)
router.use('/notifications', notificationRoutes)
router.use('/audit-logs', auditRoutes)
router.use('/reports', reportRoutes)
router.use('/settings', settingsRoutes)
router.use('/office-settings', officeSettingsRoutes)
router.use('/branch-settings', branchSettingsRoutes)
router.use('/tickets', ticketRoutes)
router.use('/announcements', announcementRoutes)
router.use('/billing', billingRoutes)
router.use('/marketing', marketingRoutes)
router.use('/payments', paymentRoutes)
router.use('/expenses', expenseRoutes)
router.use('/legal', legalRoutes)
router.use('/daily-reports', dailyReportRoutes)
router.use('/loans', loanRoutes)
router.use('/roles', roleRoutes)
router.use('/registrations', registrationRoutes)
router.use('/possessions', possessionRoutes)
router.use('/company-preferences', companyPreferencesRouter)
router.use('/company-business-config', companyBusinessConfigRouter)
router.use('/company-notifications', companyNotificationsRouter)
router.use('/company-security', companySecurityRouter)
router.use('/company-branding', companyBrandingRouter)
router.use('/master-data', masterDataRouter)
router.use('/active-sessions', activeSessionsRouter)

export default router

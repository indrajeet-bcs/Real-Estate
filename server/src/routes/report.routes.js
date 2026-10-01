import { Router } from 'express'
import * as ctrl from '../controllers/report.controller.js'
import { authenticate } from '../middleware/auth.js'
import { requireRole, requirePermission } from '../middleware/rbac.js'
import { MODULES, ROLES } from '../config/constants.js'

const router = Router()
router.use(authenticate)

// All report endpoints are role-scoped inside the controller (§8).
const view = requirePermission(MODULES.REPORT, 'view')

router.get('/summary', view, ctrl.dashboardSummary)
router.get('/lead-source', view, ctrl.leadSourceReport)
router.get('/booking-trend', view, ctrl.bookingTrendReport)
router.get('/employee-performance', view, ctrl.employeePerformanceReport)
router.get('/visit-conversion', view, ctrl.visitConversionReport)
router.get('/attendance', view, ctrl.attendanceReport)

// Revenue is Admin & Super Admin only (§8).
router.get('/revenue', requireRole(ROLES.ADMIN, ROLES.SUPER_ADMIN), view, ctrl.revenueReport)

// Full Admin console overview (KPIs + sections). Admin & Super Admin only.
router.get('/admin-overview', requireRole(ROLES.ADMIN, ROLES.SUPER_ADMIN), view, ctrl.adminOverview)
router.get('/admin-revenue-trend', requireRole(ROLES.ADMIN, ROLES.SUPER_ADMIN), view, ctrl.adminRevenueTrend)

// Branch/team dashboard for a Sub-Admin.
router.get('/sub-admin-overview', requireRole(ROLES.SUB_ADMIN), view, ctrl.subAdminOverview)

// Executive's own computed performance (Employee spec §My Performance).
router.get('/my-performance', requireRole(ROLES.SALES_EXECUTIVE), view, ctrl.myPerformance)

// Super Admin platform overview — live metrics across every firm.
router.get('/platform-overview', requireRole(ROLES.SUPER_ADMIN), view, ctrl.platformOverview)

export default router

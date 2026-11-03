import { Router } from 'express'
import { z } from 'zod'
import * as ctrl from '../controllers/billing.controller.js'
import { authenticate } from '../middleware/auth.js'
import { requireRole } from '../middleware/rbac.js'
import { validate } from '../middleware/validate.js'
import { ROLES } from '../config/constants.js'

const featureSchema = z.object({
  maxEmployees: z.coerce.number().optional(), maxProjects: z.coerce.number().optional(),
  maxLeads: z.coerce.number().optional(), maxStorage: z.coerce.number().optional(),
  attendance: z.boolean().optional(), reports: z.boolean().optional(), analytics: z.boolean().optional(),
  mobile: z.boolean().optional(), whatsapp: z.boolean().optional(), api: z.boolean().optional(),
  prioritySupport: z.boolean().optional(), customBranding: z.boolean().optional(),
  whiteLabel: z.boolean().optional(), customDomain: z.boolean().optional(), backupFrequency: z.string().optional(),
}).partial()

const planSchema = z.object({
  name: z.string().min(1, 'Plan name is required'),
  color: z.string().optional(), icon: z.string().optional(),
  monthlyPrice: z.coerce.number().min(0).optional(), yearlyPrice: z.coerce.number().min(0).optional(),
  trialDays: z.coerce.number().min(0).optional(), status: z.enum(['active', 'archived']).optional(),
  description: z.string().optional(), displayOrder: z.coerce.number().optional(),
  features: featureSchema.optional(),
})

const settingsSchema = z.object({
  currency: z.string().optional(), gstPercent: z.coerce.number().min(0).max(100).optional(),
  invoicePrefix: z.string().optional(), companyName: z.string().optional(),
  companyGstNo: z.string().optional(), billingEmail: z.string().optional(),
  gateways: z.record(z.boolean()).optional(),
  autoCharge: z.boolean().optional(), sendReminders: z.boolean().optional(), reminderDaysBefore: z.coerce.number().optional(),
}).partial()

const router = Router()
router.use(authenticate, requireRole(ROLES.SUPER_ADMIN)) // billing is Super Admin only

router.get('/overview', ctrl.billingOverview)
router.get('/plans', ctrl.listPlans)
router.post('/plans', validate(planSchema), ctrl.createPlan)
router.get('/plans/:id', ctrl.getPlan)
router.patch('/plans/:id', validate(planSchema.partial()), ctrl.updatePlan)
router.delete('/plans/:id', ctrl.deletePlan)
router.get('/subscriptions', ctrl.listSubscriptions)
router.get('/subscriptions/:id', ctrl.getSubscription)
router.get('/invoices', ctrl.listInvoices)
router.get('/invoices/:id/download', ctrl.downloadInvoice)
router.post('/invoices/:id/email', ctrl.emailInvoice)
router.get('/transactions', ctrl.listTransactions)
router.post('/subscriptions/:id/retry', ctrl.retryPayment)
router.get('/settings', ctrl.getBillingSettings)
router.patch('/settings', validate(settingsSchema), ctrl.updateBillingSettings)

export default router

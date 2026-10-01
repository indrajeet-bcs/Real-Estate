import Firm from '../models/Firm.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from '../utils/ApiError.js'
import { ok } from '../utils/apiResponse.js'
import { writeAudit } from '../middleware/audit.js'
import { AUDIT_ACTIONS, MODULES } from '../config/constants.js'

const SETTINGS_FIELDS = [
  'name companyId plan',
  'inventoryLockHours discountCapPercent commissionSplit',
  'bookingValidityDays autoCancelUnconfirmed',
  'autoLeadAssignment leadAssignmentMethod',
  'officeStartTime officeEndTime halfDayThresholdHours',
  'notifications',
].join(' ')

const DEFAULT_NOTIFICATIONS = {
  newLeadAssignment: true,
  discountRequests: true,
  bookingConfirmation: true,
  employeeTransfer: true,
  attendanceAlerts: true,
}

// Merge stored settings over defaults so firms created before a field existed
// still return a complete, well-shaped settings object.
function withDefaults(firm) {
  return {
    ...firm,
    inventoryLockHours: firm.inventoryLockHours ?? 48,
    discountCapPercent: firm.discountCapPercent ?? 2,
    commissionSplit: firm.commissionSplit || { office: 60, executive: 25, branch: 15 },
    bookingValidityDays: firm.bookingValidityDays ?? 7,
    autoCancelUnconfirmed: firm.autoCancelUnconfirmed ?? false,
    autoLeadAssignment: firm.autoLeadAssignment ?? false,
    leadAssignmentMethod: firm.leadAssignmentMethod || 'manual',
    officeStartTime: firm.officeStartTime || '09:00',
    officeEndTime: firm.officeEndTime || '18:00',
    halfDayThresholdHours: firm.halfDayThresholdHours ?? 4,
    notifications: { ...DEFAULT_NOTIFICATIONS, ...(firm.notifications || {}) },
  }
}

// GET /api/office-settings — the Admin's own firm operational settings.
export const getOfficeSettings = asyncHandler(async (req, res) => {
  const firm = await Firm.findById(req.user.firm).select(SETTINGS_FIELDS).lean()
  if (!firm) throw ApiError.notFound('Firm not found')
  return ok(res, withDefaults(firm), 'Office settings fetched')
})

// PATCH /api/office-settings — company-wide operational defaults (spec §Office
// Settings). Only company-wide config lives here — commission rules, discount
// approval logic, booking data and permissions are managed in their own modules.
export const updateOfficeSettings = asyncHandler(async (req, res) => {
  const firm = await Firm.findById(req.user.firm)
  if (!firm) throw ApiError.notFound('Firm not found')

  const b = req.body
  const scalar = [
    'inventoryLockHours', 'discountCapPercent',
    'bookingValidityDays', 'autoCancelUnconfirmed',
    'autoLeadAssignment', 'leadAssignmentMethod',
    'officeStartTime', 'officeEndTime', 'halfDayThresholdHours',
  ]
  for (const k of scalar) if (b[k] !== undefined) firm[k] = b[k]
  if (b.commissionSplit !== undefined) firm.commissionSplit = b.commissionSplit
  if (b.notifications !== undefined) firm.notifications = { ...DEFAULT_NOTIFICATIONS, ...firm.notifications, ...b.notifications }
  await firm.save()

  writeAudit({ req, action: AUDIT_ACTIONS.UPDATE, module: MODULES.SETTINGS, targetId: firm._id, targetLabel: firm.name, description: 'Updated office settings' })
  const out = await Firm.findById(firm._id).select(SETTINGS_FIELDS).lean()
  return ok(res, withDefaults(out), 'Office settings updated')
})

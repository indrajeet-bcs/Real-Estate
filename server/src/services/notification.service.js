import Notification from '../models/Notification.js'
import { NOTIFICATION_TYPES as T } from '../config/constants.js'

// Priority auto-derived from the notification type (Employee spec §Notification
// Panel · Priority). Anything unmapped defaults to medium.
const PRIORITY_BY_TYPE = {
  [T.FOLLOWUP_MISSED]: 'high',
  [T.UNAUTHORIZED_ATTEMPT]: 'high',
  [T.BOOKING_COMPLETED]: 'high',
  [T.LEAD_TRANSFER_REQUEST]: 'high',
  [T.LEAD_TRANSFER_DECISION]: 'high',
  [T.LEAVE_REQUEST]: 'high',
  [T.LEAVE_DECISION]: 'high',
  [T.LEAD_ASSIGNED]: 'medium',
  [T.FOLLOWUP_DUE]: 'medium',
  [T.VISIT_REMINDER]: 'medium',
  [T.TASK_ASSIGNED]: 'medium',
  [T.TASK_UPDATE]: 'medium',
  [T.MARKETING_TASK_ASSIGNED]: 'medium',
  [T.MARKETING_TASK_UPDATE]: 'medium',
  [T.MARKETING_TASK_REASSIGNED]: 'medium',
  [T.CAMPAIGN_STARTED]: 'medium',
  [T.CAMPAIGN_COMPLETED]: 'high',
  [T.PAYMENT_RECORDED]: 'medium',
  [T.PAYMENT_RECEIPT_UPLOADED]: 'low',
  [T.PAYMENT_EDITED]: 'medium',
  [T.PAYMENT_VERIFIED]: 'medium',
  [T.LARGE_PAYMENT_RECEIVED]: 'high',
  [T.DAILY_COLLECTION_SUMMARY]: 'low',
  [T.EXPENSE_CREATED]: 'medium',
  [T.EXPENSE_RECEIPT_UPLOADED]: 'low',
  [T.EXPENSE_UPDATED]: 'medium',
  [T.EXPENSE_VERIFIED]: 'medium',
  [T.EXPENSE_REJECTED]: 'high',
  [T.LARGE_EXPENSE_RECORDED]: 'high',
  [T.DAILY_EXPENSE_SUMMARY]: 'low',
  [T.LEGAL_CASE_ASSIGNED]: 'medium',
  [T.LEGAL_DOCUMENT_UPLOADED]: 'low',
  [T.LEGAL_STATUS_UPDATED]: 'medium',
  [T.LEGAL_CASE_COMPLETED]: 'medium',
  [T.LEGAL_CASE_OVERDUE]: 'high',
  [T.DAILY_LEGAL_SUMMARY]: 'low',
  [T.ATTENDANCE_LOG]: 'low',
}

// Central creator for system-triggered notifications (§9). Fire-and-forget:
// a delivery failure must never break the triggering action.
export async function notify({ firm = null, recipient, type, title, message = '', entityType, entityId, priority } = {}) {
  if (!recipient) return null
  try {
    return await Notification.create({
      firm, recipient, type, title, message, entityType, entityId,
      priority: priority || PRIORITY_BY_TYPE[type] || 'medium',
    })
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[notify] failed:', err.message)
    return null
  }
}

// Notify many recipients of the same event.
export async function notifyMany(recipients, payload) {
  const ids = [...new Set(recipients.filter(Boolean).map(String))]
  return Promise.all(ids.map((recipient) => notify({ ...payload, recipient })))
}

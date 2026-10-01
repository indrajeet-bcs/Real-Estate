// Central enums and role/permission definitions used across models and RBAC.

export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  SUB_ADMIN: 'sub_admin',
  SALES_EXECUTIVE: 'sales_executive',
}

export const ROLE_VALUES = Object.values(ROLES)

// Role rank — higher number = more authority. Used for "can manage" checks.
export const ROLE_RANK = {
  [ROLES.SALES_EXECUTIVE]: 1,
  [ROLES.SUB_ADMIN]: 2,
  [ROLES.ADMIN]: 3,
  [ROLES.SUPER_ADMIN]: 4,
}

// Customer / lead lifecycle status (Section 6, 11). The first block is the core
// pipeline; the second adds the full V1 status set (Customers spec) — additive so
// existing reports/scoping keep working.
export const CUSTOMER_STATUS = {
  NEW: 'new',
  IN_PROGRESS: 'in_progress',
  FOLLOW_UP_DUE: 'follow_up_due',
  BOOKED: 'booked',
  LOST: 'lost',
  // V1 status set
  ACTIVE: 'active',
  INTERESTED: 'interested',
  NEGOTIATION: 'negotiation',
  SITE_VISIT_SCHEDULED: 'site_visit_scheduled',
  SITE_VISIT_COMPLETED: 'site_visit_completed',
  BOOKING_CANCELLED: 'booking_cancelled',
  HOLD: 'hold',
  CLOSED: 'closed',
  // My Leads pipeline stages (Employee spec §My Leads · Lead Stages)
  QUALIFIED: 'qualified',
  CONVERTED: 'converted',
}

// Ordered lead pipeline shown in the Employee "My Leads" tab (spec §Lead Stages).
export const LEAD_STAGES = [
  CUSTOMER_STATUS.NEW,
  CUSTOMER_STATUS.IN_PROGRESS, // "Contacted"
  CUSTOMER_STATUS.FOLLOW_UP_DUE, // "Follow-up"
  CUSTOMER_STATUS.INTERESTED,
  CUSTOMER_STATUS.SITE_VISIT_SCHEDULED,
  CUSTOMER_STATUS.SITE_VISIT_COMPLETED,
  CUSTOMER_STATUS.NEGOTIATION,
  CUSTOMER_STATUS.QUALIFIED,
  CUSTOMER_STATUS.CONVERTED,
  CUSTOMER_STATUS.LOST,
]

export const LEAD_SOURCES = ['walk_in', 'website', 'referral', 'social_media', 'call', 'portal', 'bulk_import', 'other']

// Follow-up (Section 6 + Follow-Up spec status set).
export const FOLLOWUP_STATUS = {
  SCHEDULED: 'scheduled',
  PENDING: 'pending',
  COMPLETED: 'completed',
  MISSED: 'missed',
  RESCHEDULED: 'rescheduled',
  CANCELLED: 'cancelled',
  CLOSED: 'closed',
}

export const PRIORITY = ['low', 'medium', 'high']
export const INTEREST_LEVEL = ['cold', 'warm', 'hot']

// Site visits (Section 6/9). `conducted` is the completed state (shown as
// "Completed"); confirmed & in_progress are additive intermediate states.
export const VISIT_STATUS = {
  SCHEDULED: 'scheduled',
  CONFIRMED: 'confirmed',
  IN_PROGRESS: 'in_progress',
  CONDUCTED: 'conducted',
  RESCHEDULED: 'rescheduled',
  CANCELLED: 'cancelled',
  MISSED: 'missed',
}

// Visit type + post-visit interest levels (Employee spec §Site Visit).
export const VISIT_TYPES = ['first_visit', 'revisit', 'final_visit', 'virtual', 'other']
export const VISIT_INTEREST = ['highly_interested', 'interested', 'needs_follow_up', 'not_interested']

// Inventory / units (Section 6/10). First block is the core lifecycle; the
// second adds the full V1 status set (Unit Management spec) — additive.
export const UNIT_STATUS = {
  AVAILABLE: 'available',
  RESERVED: 'reserved',
  BOOKED: 'booked',
  BLOCKED: 'blocked',
  LOCKED: 'locked', // Admin-flow port: temporary hold for a lead (auto-expires)
  // V1 additions
  TOKEN: 'token',
  HOLD: 'hold',
  SOLD: 'sold',
  REGISTERED: 'registered',
  POSSESSION: 'possession',
}

// Booking lifecycle (Section 6 + Booking Registers correction spec).
export const BOOKING_STATUS = {
  DRAFT: 'draft', // saved but not submitted (Employee spec §Create Booking · Save Draft)
  RESERVED: 'reserved', // submitted, pending approval
  CONFIRMED: 'confirmed',
  CANCELLED: 'cancelled',
  SALE_COMPLETED: 'sale_completed', // final state once registration completes
}

// Payment progress on a booking (spec §Booking Registers · Payment Status).
export const PAYMENT_STATUS = {
  PENDING: 'pending',
  PARTIAL: 'partial',
  COMPLETED: 'completed',
}

// Registration progress — kept inside the booking (spec: no separate module).
export const REGISTRATION_STATUS = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
}

// Discount detail enums (spec §Discount Information).
export const DISCOUNT_GIVEN_BY = ['admin', 'sub_admin', 'builder_sales_executive']
export const DISCOUNT_SOURCE = ['firm', 'builder', 'combined']

export const PAYMENT_MODE = ['cash', 'cheque', 'bank_transfer', 'upi', 'card', 'loan', 'other']

// Attendance auto-classification (Section 9).
export const ATTENDANCE_STATUS = {
  ON_TIME: 'on_time',
  LATE: 'late',
  HALF_DAY: 'half_day',
  ABSENT: 'absent',
  LEAVE: 'leave', // day covered by an approved leave (Employee spec §Leave)
}

// Leave types (Employee spec §Apply for Leave). Older values kept for back-compat.
export const LEAVE_TYPES = ['casual', 'sick', 'earned', 'half_day', 'work_from_home', 'other', 'privilege', 'maternity']

// Notification event types (Section 9).
export const NOTIFICATION_TYPES = {
  LEAD_ASSIGNED: 'lead_assigned',
  FOLLOWUP_DUE: 'followup_due',
  FOLLOWUP_MISSED: 'followup_missed',
  VISIT_REMINDER: 'visit_reminder',
  BOOKING_COMPLETED: 'booking_completed',
  ATTENDANCE_LOG: 'attendance_log',
  UNAUTHORIZED_ATTEMPT: 'unauthorized_attempt',
  LEAVE_REQUEST: 'leave_request', // Branch-admin port
  LEAVE_DECISION: 'leave_decision',
  LEAD_TRANSFER_REQUEST: 'lead_transfer_request', // Employee requests a lead transfer
  LEAD_TRANSFER_DECISION: 'lead_transfer_decision',
  TASK_ASSIGNED: 'task_assigned', // Admin/Sub-Admin assigned a task
  TASK_UPDATE: 'task_update', // progress / comment / completion on a task
  // Marketing module (§Notifications)
  MARKETING_TASK_ASSIGNED: 'marketing_task_assigned',
  MARKETING_TASK_UPDATE: 'marketing_task_update',
  MARKETING_TASK_REASSIGNED: 'marketing_task_reassigned',
  CAMPAIGN_STARTED: 'campaign_started',
  CAMPAIGN_COMPLETED: 'campaign_completed',
  // Payment module (§Notifications)
  PAYMENT_RECORDED: 'payment_recorded',
  PAYMENT_RECEIPT_UPLOADED: 'payment_receipt_uploaded',
  PAYMENT_EDITED: 'payment_edited',
  PAYMENT_VERIFIED: 'payment_verified',
  DAILY_COLLECTION_SUMMARY: 'daily_collection_summary',
  LARGE_PAYMENT_RECEIVED: 'large_payment_received',
  // Expense module (§Notifications)
  EXPENSE_CREATED: 'expense_created',
  EXPENSE_RECEIPT_UPLOADED: 'expense_receipt_uploaded',
  EXPENSE_UPDATED: 'expense_updated',
  EXPENSE_VERIFIED: 'expense_verified',
  EXPENSE_REJECTED: 'expense_rejected',
  LARGE_EXPENSE_RECORDED: 'large_expense_recorded',
  DAILY_EXPENSE_SUMMARY: 'daily_expense_summary',
  // Legal module (§Notifications)
  LEGAL_CASE_ASSIGNED: 'legal_case_assigned',
  LEGAL_DOCUMENT_UPLOADED: 'legal_document_uploaded',
  LEGAL_STATUS_UPDATED: 'legal_status_updated',
  LEGAL_CASE_COMPLETED: 'legal_case_completed',
  LEGAL_CASE_OVERDUE: 'legal_case_overdue',
  DAILY_LEGAL_SUMMARY: 'daily_legal_summary',
}

// Audit log actions (Section 10/15).
export const AUDIT_ACTIONS = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  STATUS_CHANGE: 'status_change',
  LOGIN: 'login',
  LOGOUT: 'logout',
  UNAUTHORIZED: 'unauthorized_attempt',
  ASSIGN: 'assign',
  TRANSFER: 'transfer',
  IMPORT: 'import',
}

// Modules — used for permission gating (Section 14) and audit log filtering.
export const MODULES = {
  FIRM: 'firm',
  USER: 'user',
  BRANCH: 'branch', // Admin-flow port: first-class regional branches
  BUILDER: 'builder',
  PROJECT: 'project',
  UNIT: 'unit',
  LEAD: 'lead',
  CUSTOMER: 'customer',
  FOLLOWUP: 'followup',
  VISIT: 'visit',
  BOOKING: 'booking',
  COMMISSION: 'commission', // Admin-flow port: brokerage rule engine
  LEAVE: 'leave', // Branch-admin port: leave requests & approvals
  ATTENDANCE: 'attendance',
  REPORT: 'report',
  AUDIT: 'audit',
  SETTINGS: 'settings',
  MARKETING: 'marketing', // Marketing module: tasks + campaigns
  PAYMENT: 'payment', // Payment module: customer payment records
  EXPENSE: 'expense', // Expense Management module: company expenses
  LEGAL: 'legal', // Legal Management module: post-booking legal cases
  LOAN: 'loan', // Loan module: post-booking home-loan tracking
  REGISTRATION: 'registration', // Registration module: sale-deed registration tracking
  POSSESSION: 'possession', // Possession module: handover tracking
  ROLE: 'role', // Custom-role engine: role definitions + permission builder
}

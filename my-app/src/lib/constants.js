// Mirrors the backend role identifiers so the UI can gate navigation (§14).
export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  SUB_ADMIN: 'sub_admin',
  SALES_EXECUTIVE: 'sales_executive',
}

export const ROLE_LABELS = {
  [ROLES.SUPER_ADMIN]: 'Super Admin',
  [ROLES.ADMIN]: 'Admin',
  [ROLES.SUB_ADMIN]: 'Sub-Admin',
  [ROLES.SALES_EXECUTIVE]: 'Sales Executive',
}

// Where each role lands after login.
export const ROLE_HOME = {
  [ROLES.SUPER_ADMIN]: '/super-admin',
  [ROLES.ADMIN]: '/admin',
  [ROLES.SUB_ADMIN]: '/sub-admin',
  [ROLES.SALES_EXECUTIVE]: '/executive',
}

// Customer / lead lifecycle status — mirrors the backend enum.
export const CUSTOMER_STATUS = {
  NEW: 'new',
  IN_PROGRESS: 'in_progress',
  FOLLOW_UP_DUE: 'follow_up_due',
  BOOKED: 'booked',
  LOST: 'lost',
  ACTIVE: 'active',
  INTERESTED: 'interested',
  NEGOTIATION: 'negotiation',
  SITE_VISIT_SCHEDULED: 'site_visit_scheduled',
  SITE_VISIT_COMPLETED: 'site_visit_completed',
  BOOKING_CANCELLED: 'booking_cancelled',
  HOLD: 'hold',
  CLOSED: 'closed',
  QUALIFIED: 'qualified',
  CONVERTED: 'converted',
}

// Ordered lead pipeline for the Employee "My Leads" tab (mirrors backend
// LEAD_STAGES). Label overrides where the stored status differs from the
// spec's display name.
export const LEAD_STAGES = [
  'new',
  'in_progress',
  'follow_up_due',
  'interested',
  'site_visit_scheduled',
  'site_visit_completed',
  'negotiation',
  'qualified',
  'converted',
  'lost',
]

export const LEAD_STAGE_LABELS = {
  new: 'New',
  in_progress: 'Contacted',
  follow_up_due: 'Follow-up',
  interested: 'Interested',
  site_visit_scheduled: 'Site Visit Scheduled',
  site_visit_completed: 'Site Visit Completed',
  negotiation: 'Negotiation',
  qualified: 'Qualified',
  converted: 'Converted',
  lost: 'Lost',
}

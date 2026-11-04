import { ROLES, MODULES } from './constants.js'

// Actions a role may perform per module. This backs both server-side
// enforcement (§10) and the "Permission-based UI visibility" requirement (§14) —
// the frontend fetches the effective permission set to show/hide navigation.
//
// Action vocabulary: 'view' | 'create' | 'edit' | 'delete' | 'assign' | 'export'
// A '*' means all actions on that module.

const { SUPER_ADMIN, ADMIN, SUB_ADMIN, SALES_EXECUTIVE } = ROLES

export const ROLE_PERMISSIONS = {
  [SUPER_ADMIN]: {
    [MODULES.FIRM]: ['*'], // onboard/edit/deactivate firms + admins
    [MODULES.USER]: ['view'], // sees admins; manages via firm module
    [MODULES.BUILDER]: ['view'], // view-only across firms (name only)
    [MODULES.PROJECT]: ['view'], // view-only across firms (name only)
    [MODULES.REPORT]: ['view', 'export'], // all reports across all firms
    [MODULES.AUDIT]: ['view'],
    [MODULES.SETTINGS]: ['*'], // permissions, session config, templates
  },

  [ADMIN]: {
    [MODULES.USER]: ['view', 'create', 'edit', 'delete'], // sub-admins
    // Admin-flow port (Company Owner): actions are expanded per phase.
    // Phase 0 seeds view-only slots for the net-new modules; later phases
    // add create/edit/assign/approve as each screen is implemented.
    [MODULES.BRANCH]: ['view', 'create', 'edit', 'delete'], // Phase 1 ✅ (+ targets/comparison/delete)
    [MODULES.BUILDER]: ['view', 'create', 'edit', 'delete'],
    [MODULES.PROJECT]: ['view', 'create', 'edit', 'delete'],
    [MODULES.UNIT]: ['view', 'create', 'edit', 'delete'],
    [MODULES.CUSTOMER]: ['view', 'edit'], // Phase 4 ✅ (KYC, ownership)
    [MODULES.LEAD]: ['view', 'create', 'assign'], // Phase 4 ✅
    [MODULES.FOLLOWUP]: ['view'],
    [MODULES.VISIT]: ['view', 'create', 'edit'],
    [MODULES.BOOKING]: ['view', 'create', 'edit'], // Phase 5 ✅
    [MODULES.COMMISSION]: ['view', 'create', 'edit', 'delete'], // Phase 6 ✅
    [MODULES.LEAVE]: ['view', 'approve'], // Branch-admin port: oversight
    [MODULES.ATTENDANCE]: ['view'],
    [MODULES.REPORT]: ['view', 'export'], // branch/revenue reports, own firm
    [MODULES.AUDIT]: ['view'],
    [MODULES.MARKETING]: ['*'], // Marketing module: full access (Company Owner)
    [MODULES.PAYMENT]: ['*'], // Payment module: full access + verify/delete/export
    [MODULES.EXPENSE]: ['*'], // Expense module: full access + verify/delete/export
    [MODULES.LEGAL]: ['*'], // Legal module: full access + assign/verify/delete/export
    [MODULES.LOAN]: ['view', 'create', 'edit', 'delete', 'export'], // Loan tracking
    [MODULES.REGISTRATION]: ['view', 'create', 'edit', 'delete', 'export'], // Registration tracking
    [MODULES.POSSESSION]: ['view', 'create', 'edit', 'delete', 'export'], // Possession tracking
    [MODULES.ROLE]: ['view', 'create', 'edit', 'delete'], // Custom-role engine (Admin)
    [MODULES.TASK]: ['view', 'create', 'edit', 'delete', 'assign'], // Task Management: assign & track executive tasks
  },

  [SUB_ADMIN]: {
    [MODULES.USER]: ['view', 'create', 'edit'], // sales executives
    [MODULES.BUILDER]: ['view'],
    [MODULES.PROJECT]: ['view'],
    [MODULES.UNIT]: ['view', 'edit'], // Branch-admin port: hold/release units
    [MODULES.LEAD]: ['view', 'create', 'edit', 'assign', 'import'],
    [MODULES.CUSTOMER]: ['view', 'edit'], // manage customer info + change owner (spec)
    [MODULES.FOLLOWUP]: ['view', 'create', 'edit'], // manage/assign branch follow-ups (spec)
    [MODULES.VISIT]: ['view', 'create', 'edit'], // schedule, oversight, flag missed
    [MODULES.BOOKING]: ['view', 'edit'], // Branch-admin port: verify/confirm bookings
    [MODULES.LEAVE]: ['view', 'approve'], // Branch-admin port: approve team leave
    [MODULES.ATTENDANCE]: ['view'],
    [MODULES.REPORT]: ['view', 'export'], // team performance + attendance
    [MODULES.AUDIT]: ['view'], // branch audit logs (spec)
    // Marketing: Branch Admin / Team Leader — assign + reassign team tasks, manage
    // campaigns, view branch/team reports. 'assign' unlocks the Team Tasks console.
    [MODULES.MARKETING]: ['view', 'create', 'edit', 'assign', 'delete'],
    // Payment: Branch Admin / Finance — record, edit, verify, export branch payments.
    // (Finance role maps here or to Admin; 'verify' gates payment verification.)
    [MODULES.PAYMENT]: ['view', 'create', 'edit', 'export', 'verify'],
    // Expense: Branch Admin / Finance / Team Leader — create/edit/verify/export
    // (+ delete for Finance). Remove 'delete' per-user for a pure Branch Admin.
    // 'verify' gates expense verification; 'edit' also gates category management.
    [MODULES.EXPENSE]: ['view', 'create', 'edit', 'export', 'verify', 'delete'],
    [MODULES.TASK]: ['view', 'create', 'edit', 'delete', 'assign'], // Task Management: assign & track executive tasks
    // Legal: Legal team + Branch Admin / Team Leader. 'assign' = assign legal
    // executive; 'verify' = verify documents. Pure Branch Admin can have
    // verify/delete removed per-user (they mainly assign + monitor).
    [MODULES.LEGAL]: ['view', 'create', 'edit', 'assign', 'verify', 'export', 'delete'],
    [MODULES.LOAN]: ['view', 'create', 'edit', 'export'], // Branch loan tracking
    [MODULES.REGISTRATION]: ['view', 'create', 'edit', 'export'], // Branch registration tracking
    [MODULES.POSSESSION]: ['view', 'create', 'edit', 'export'], // Branch possession tracking
  },

  [SALES_EXECUTIVE]: {
    [MODULES.BUILDER]: ['view'],
    [MODULES.PROJECT]: ['view'],
    [MODULES.UNIT]: ['view'],
    [MODULES.CUSTOMER]: ['view', 'edit'], // assigned customers only (scoped in query)
    [MODULES.LEAD]: ['view', 'edit'],
    [MODULES.FOLLOWUP]: ['view', 'create', 'edit'],
    [MODULES.VISIT]: ['view', 'create', 'edit'],
    [MODULES.BOOKING]: ['view', 'create', 'edit'],
    [MODULES.LEAVE]: ['view', 'create'], // Branch-admin port: request leave
    [MODULES.ATTENDANCE]: ['view', 'create'], // own check-in/out
    [MODULES.REPORT]: ['view'], // personal stats only
    // Marketing: Marketing / CRM Exec / Sales Exec / Telecaller — create & manage
    // their OWN self-tasks. Grant 'assign' per-user (override) to let a Marketing
    // user create assigned tasks (spec §Marketing · "if permission granted").
    [MODULES.MARKETING]: ['view', 'create', 'edit'],
    // Payment: CRM/Sales Executive — view own assigned-customer payments and add
    // entries "if permitted". Remove 'create' per-user to make it view-only.
    [MODULES.PAYMENT]: ['view', 'create'],
    // Expense: Marketing / CRM / Sales Executive — create self expenses "if
    // permitted", view own only. Remove 'create' per-user to make it view-only.
    [MODULES.EXPENSE]: ['view', 'create'],
    // Legal: CRM / Sales Executive — view their assigned customers' legal status
    // only (read-only; the Legal team drives the process).
    [MODULES.LEGAL]: ['view'],
    // Loan / Registration / Possession: executives track their assigned customers'
    // cases (create + update, no delete).
    [MODULES.LOAN]: ['view', 'create', 'edit'],
    [MODULES.REGISTRATION]: ['view', 'create', 'edit'],
    [MODULES.POSSESSION]: ['view', 'create', 'edit'],
    [MODULES.TASK]: ['view', 'create', 'edit'], // Task Management: view assigned tasks & update status
  },
}

// Resolve the effective permissions for a user: per-user overrides (if any)
// merged over role defaults.
export function effectivePermissions(user) {
  const base = ROLE_PERMISSIONS[user.role] || {}
  const cr = user.customRole
  let result = { ...base }

  if (cr && typeof cr === 'object' && cr.status === 'active' && cr.permissions && Object.keys(cr.permissions).length > 0) {
    // Merge custom role permissions over base role defaults
    for (const [mod, actions] of Object.entries(cr.permissions)) {
      if (Array.isArray(actions) && actions.length > 0) {
        result[mod] = actions
      }
    }
  }

  // Per-user overrides (highest precedence).
  if (user.permissions && user.permissions.size > 0) {
    for (const [mod, actions] of user.permissions.entries()) result[mod] = actions
  }

  // Core operational modules: Sub-Admin, Admin, and Sales Executive must always be able to schedule/manage visits
  if ([ROLES.ADMIN, ROLES.SUB_ADMIN, ROLES.SALES_EXECUTIVE].includes(user.role)) {
    if (!result[MODULES.VISIT] || !result[MODULES.VISIT].includes('create')) {
      result[MODULES.VISIT] = Array.from(new Set([...(result[MODULES.VISIT] || ['view']), 'create', 'edit']))
    }
  }

  return result
}

export function can(user, module, action) {
  if (!user) return false
  if (user.role === ROLES.SUPER_ADMIN) return true

  // Sub-Admins, Admins, and Sales Executives can always view, create, and edit visits
  if ([ROLES.ADMIN, ROLES.SUB_ADMIN, ROLES.SALES_EXECUTIVE].includes(user.role) && module === MODULES.VISIT) {
    if (['view', 'create', 'edit'].includes(action)) return true
  }

  const perms = effectivePermissions(user)
  const allowed = perms[module]
  if (!allowed) {
    const fallback = ROLE_PERMISSIONS[user.role]?.[module]
    if (fallback) {
      return fallback.includes('*') || fallback.includes(action)
    }
    return false
  }
  return allowed.includes('*') || allowed.includes(action)
}

import { ROLES } from '../config/constants.js'

// Builds the base query filter enforcing multi-tenant isolation. Every
// firm-scoped query must spread this so a firm can never read another's data.
//
//  - Super Admin: no firm filter (platform-wide, mostly view-only).
//  - Admin / Sub-Admin: locked to their own firm.
//  - Sales Executive: locked to their firm AND (for owned resources) to self.
export function firmScope(user) {
  if (user.role === ROLES.SUPER_ADMIN) return {}
  return { firm: user.firm }
}

// For resources an executive only owns a slice of (their assigned customers,
// their follow-ups). Sub-admin/admin see the whole firm.
export function ownershipScope(user, ownerField = 'assignedTo') {
  if (user.role === ROLES.SALES_EXECUTIVE) {
    return { firm: user.firm, [ownerField]: user._id }
  }
  return firmScope(user)
}

// Attach the acting user's firm to a new document (super admin may pass one).
export function firmForWrite(user, bodyFirm) {
  if (user.role === ROLES.SUPER_ADMIN) return bodyFirm || null
  return user.firm
}

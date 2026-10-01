import { ApiError } from '../utils/ApiError.js'
import { can } from '../config/permissions.js'
import { ROLE_RANK } from '../config/constants.js'
import { writeAudit } from './audit.js'
import { AUDIT_ACTIONS } from '../config/constants.js'

// Restrict a route to specific roles.
export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user) return next(ApiError.unauthorized())
    if (!roles.includes(req.user.role)) {
      writeAudit({
        req,
        action: AUDIT_ACTIONS.UNAUTHORIZED,
        module: 'user',
        description: `Role ${req.user.role} attempted a route restricted to ${roles.join(', ')}`,
        success: false,
      })
      return next(ApiError.forbidden('Your role cannot access this resource'))
    }
    next()
  }
}

// Gate a route by module + action against the permission matrix (§14).
// On denial, logs an unauthorized attempt to the audit log (§15 edge case).
export function requirePermission(module, action) {
  return (req, _res, next) => {
    if (!req.user) return next(ApiError.unauthorized())
    if (!can(req.user, module, action)) {
      writeAudit({
        req,
        action: AUDIT_ACTIONS.UNAUTHORIZED,
        module,
        description: `Blocked ${action} on ${module} for role ${req.user.role}`,
        success: false,
      })
      return next(ApiError.forbidden(`Not permitted to ${action} ${module}`))
    }
    next()
  }
}

// Ensure the acting user outranks the target role (e.g. a sub-admin cannot
// create an admin). Reads the target role from req.body.role by default.
export function requireHigherRankThan(getTargetRole = (req) => req.body.role) {
  return (req, _res, next) => {
    const targetRole = getTargetRole(req)
    if (!targetRole) return next()
    if ((ROLE_RANK[req.user.role] || 0) <= (ROLE_RANK[targetRole] || 0)) {
      return next(ApiError.forbidden('Cannot manage a user at or above your role'))
    }
    next()
  }
}



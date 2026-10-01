import AuditLog from '../models/AuditLog.js'

// Fire-and-forget writer for the audit trail (§10). Never throws into the
// request path — a logging failure must not break the action.
export async function writeAudit({
  req,
  action,
  module,
  targetId = null,
  targetLabel = '',
  description = '',
  meta = undefined,
  success = true,
}) {
  try {
    const actor = req?.user
    await AuditLog.create({
      firm: actor?.firm || null,
      actor: actor?._id || null,
      actorRole: actor?.role,
      action,
      module,
      targetId,
      targetLabel,
      description,
      meta,
      success,
      ip: req?.ip,
      userAgent: req?.headers?.['user-agent'],
    })
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[audit] failed to write log:', err.message)
  }
}

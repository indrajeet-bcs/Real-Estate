import CommissionRule from '../models/CommissionRule.js'
import Firm from '../models/Firm.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from '../utils/ApiError.js'
import { ok, created } from '../utils/apiResponse.js'
import { writeAudit } from '../middleware/audit.js'
import { AUDIT_ACTIONS, MODULES } from '../config/constants.js'
import { firmScope } from '../middleware/tenantScope.js'

// Deactivate any OTHER active rule sharing the same scope, so at most one rule is
// active per scope at a time (spec §Row Actions).
async function deactivateSameScope(firm, rule) {
  const filter = { firm, active: true, _id: { $ne: rule._id }, builder: rule.builder || null, project: rule.project || null }
  await CommissionRule.updateMany(filter, { $set: { active: false } })
}

// GET /api/commissions — rules + the firm's payout split (for the sandbox).
export const listCommissionRules = asyncHandler(async (req, res) => {
  const [rules, firm] = await Promise.all([
    CommissionRule.find(firmScope(req.user)).populate('builder', 'name').populate('project', 'name').sort({ createdAt: 1 }).lean(),
    Firm.findById(req.user.firm).select('commissionSplit').lean(),
  ])
  return ok(res, rules, 'Commission rules fetched', { split: firm?.commissionSplit || { office: 60, executive: 25, branch: 15 } })
})

// POST /api/commissions
export const createCommissionRule = asyncHandler(async (req, res) => {
  const rule = await CommissionRule.create({
    ...req.body,
    builder: req.body.builder || null,
    project: req.body.project || null,
    firm: req.user.firm,
    createdBy: req.user._id,
  })
  if (rule.active) await deactivateSameScope(req.user.firm, rule)
  writeAudit({ req, action: AUDIT_ACTIONS.CREATE, module: MODULES.COMMISSION, targetId: rule._id, targetLabel: rule.name, description: `Created commission rule ${rule.name}` })
  return created(res, rule, 'Commission rule created')
})

// PATCH /api/commissions/:id
export const updateCommissionRule = asyncHandler(async (req, res) => {
  const patch = { ...req.body }
  if (patch.builder !== undefined) patch.builder = patch.builder || null
  if (patch.project !== undefined) patch.project = patch.project || null
  const rule = await CommissionRule.findOneAndUpdate(
    { _id: req.params.id, ...firmScope(req.user) },
    patch,
    { new: true, runValidators: true }
  )
  if (!rule) throw ApiError.notFound('Commission rule not found')
  if (rule.active) await deactivateSameScope(req.user.firm, rule)
  writeAudit({ req, action: AUDIT_ACTIONS.UPDATE, module: MODULES.COMMISSION, targetId: rule._id, targetLabel: rule.name, description: `Updated commission rule ${rule.name}` })
  return ok(res, rule, 'Commission rule updated')
})

// PATCH /api/commissions/:id/status — activate/deactivate.
export const toggleCommissionRule = asyncHandler(async (req, res) => {
  const rule = await CommissionRule.findOne({ _id: req.params.id, ...firmScope(req.user) })
  if (!rule) throw ApiError.notFound('Commission rule not found')
  rule.active = req.body.active
  await rule.save()
  if (rule.active) await deactivateSameScope(req.user.firm, rule)
  writeAudit({ req, action: AUDIT_ACTIONS.STATUS_CHANGE, module: MODULES.COMMISSION, targetId: rule._id, targetLabel: rule.name, description: `${rule.active ? 'Activated' : 'Deactivated'} rule ${rule.name}` })
  return ok(res, rule, `Rule ${rule.active ? 'activated' : 'deactivated'}`)
})

// DELETE /api/commissions/:id
export const deleteCommissionRule = asyncHandler(async (req, res) => {
  const rule = await CommissionRule.findOneAndDelete({ _id: req.params.id, ...firmScope(req.user) })
  if (!rule) throw ApiError.notFound('Commission rule not found')
  writeAudit({ req, action: AUDIT_ACTIONS.DELETE, module: MODULES.COMMISSION, targetId: rule._id, targetLabel: rule.name, description: `Deleted commission rule ${rule.name}` })
  return ok(res, { _id: rule._id }, 'Commission rule deleted')
})

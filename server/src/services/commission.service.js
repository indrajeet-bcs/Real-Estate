import CommissionRule from '../models/CommissionRule.js'
import Project from '../models/Project.js'

// Auto-detect the applicable ACTIVE commission rule for a booking and compute the
// brokerage on a given sale value (spec §Commission · Connected Business Rules).
// Specificity: a project-scoped rule beats a builder-scoped rule beats an
// all-builders rule. Falls back to the legacy per-project commissionRate when no
// rule matches, so bookings always accrue brokerage.
export async function resolveCommission(firm, projectId, saleValue) {
  const value = Number(saleValue) || 0
  const project = await Project.findOne({ _id: projectId, firm }).select('builder commissionRate').lean()
  const builderId = project?.builder || null

  const rules = await CommissionRule.find({ firm, active: true }).lean()
  const projectRule = rules.find((r) => r.project && String(r.project) === String(projectId))
  const builderRule = rules.find((r) => !r.project && r.builder && builderId && String(r.builder) === String(builderId))
  const globalRule = rules.find((r) => !r.project && !r.builder)
  const rule = projectRule || builderRule || globalRule

  if (!rule) {
    const rate = project?.commissionRate || 0
    return { brokerage: Math.round(value * (rate / 100)), rate, ruleId: null, ruleName: null }
  }

  const base = value * ((rule.baseRate || 0) / 100)
  const additional = rule.targetThreshold > 0 && value >= rule.targetThreshold
    ? value * ((rule.acceleratorRate || 0) / 100)
    : 0
  return { brokerage: Math.round(base + additional), rate: rule.baseRate, ruleId: rule._id, ruleName: rule.name }
}

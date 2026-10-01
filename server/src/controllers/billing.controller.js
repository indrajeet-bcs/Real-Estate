import Plan from '../models/Plan.js'
import Subscription from '../models/Subscription.js'
import Invoice from '../models/Invoice.js'
import Transaction from '../models/Transaction.js'
import BillingSettings from '../models/BillingSettings.js'
import Firm from '../models/Firm.js'
import User from '../models/User.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from '../utils/ApiError.js'
import { ok, created } from '../utils/apiResponse.js'
import { ROLES } from '../config/constants.js'

const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '—'

// ─── Plans ───────────────────────────────────────────────────────────────────
export const listPlans = asyncHandler(async (req, res) => {
  const plans = await Plan.find({}).sort({ displayOrder: 1, monthlyPrice: 1 }).lean()
  const counts = await Subscription.aggregate([
    { $match: { status: { $in: ['active', 'trial'] } } },
    { $group: { _id: '$plan', n: { $sum: 1 } } },
  ])
  const map = Object.fromEntries(counts.map((c) => [String(c._id), c.n]))
  return ok(res, plans.map((p) => ({ ...p, id: String(p._id), subscribers: map[String(p._id)] || 0 })), 'Plans fetched')
})

export const getPlan = asyncHandler(async (req, res) => {
  const p = await Plan.findById(req.params.id).lean()
  if (!p) throw ApiError.notFound('Plan not found')
  const subscribers = await Subscription.countDocuments({ plan: p._id, status: { $in: ['active', 'trial'] } })
  return ok(res, { ...p, id: String(p._id), subscribers })
})

export const createPlan = asyncHandler(async (req, res) => {
  const plan = await Plan.create({ ...req.body, createdBy: req.user._id })
  return created(res, { ...plan.toObject(), id: String(plan._id), subscribers: 0 }, 'Plan created')
})

export const updatePlan = asyncHandler(async (req, res) => {
  const plan = await Plan.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true })
  if (!plan) throw ApiError.notFound('Plan not found')
  return ok(res, { ...plan.toObject(), id: String(plan._id) }, 'Plan updated')
})

export const deletePlan = asyncHandler(async (req, res) => {
  const plan = await Plan.findById(req.params.id)
  if (!plan) throw ApiError.notFound('Plan not found')
  const inUse = await Subscription.countDocuments({ plan: plan._id, status: { $in: ['active', 'trial'] } })
  if (inUse) throw ApiError.badRequest(`Cannot delete — ${inUse} active subscription(s) use this plan. Archive it instead.`)
  plan.status = 'archived'
  await plan.save()
  return ok(res, { id: String(plan._id) }, 'Plan archived')
})

// ─── Subscriptions (billing records) ─────────────────────────────────────────
async function adminForFirms(firmIds) {
  const admins = await User.find({ firm: { $in: firmIds }, role: ROLES.ADMIN }).select('name email firm').lean()
  const map = {}
  for (const a of admins) if (!map[String(a.firm)]) map[String(a.firm)] = a
  return map
}

export const listSubscriptions = asyncHandler(async (req, res) => {
  const subs = await Subscription.find({}).populate('firm', 'name status gstNumber address').sort({ createdAt: -1 }).lean()
  const firmIds = subs.map((s) => s.firm?._id).filter(Boolean)
  const [admins, latestInvoices] = await Promise.all([
    adminForFirms(firmIds),
    Invoice.aggregate([{ $sort: { createdAt: -1 } }, { $group: { _id: '$subscription', inv: { $first: '$$ROOT' } } }]),
  ])
  const invMap = Object.fromEntries(latestInvoices.map((i) => [String(i._id), i.inv]))

  const rows = subs.map((s) => {
    const inv = invMap[String(s._id)]
    const admin = admins[String(s.firm?._id)]
    return {
      id: String(s._id),
      company: s.firm?.name || '—', logo: initials(s.firm?.name),
      adminName: admin?.name || '—', adminEmail: admin?.email || '—', companyStatus: s.firm?.status || 'active',
      plan: s.planName, cycle: s.cycle,
      subStart: s.startDate, renewal: s.renewalDate, subStatus: s.status,
      amount: s.amount, gst: inv?.gst || 0, total: inv?.total || s.amount,
      invoice: inv?.invoiceNumber || '—', due: inv?.dueDate || s.renewalDate,
      paidOn: inv?.paidOn || null, paymentMethod: inv?.paymentMethod || s.gateway,
      status: inv?.status || (s.status === 'active' ? 'paid' : 'pending'),
      gstNo: s.firm?.gstNumber || '', address: s.firm?.address || '',
    }
  })
  return ok(res, rows, 'Subscriptions fetched')
})

export const getSubscription = asyncHandler(async (req, res) => {
  const s = await Subscription.findById(req.params.id).populate('firm', 'name status gstNumber address contactEmail contactPhone').populate('plan').lean()
  if (!s) throw ApiError.notFound('Subscription not found')
  const [admin, invoices] = await Promise.all([
    User.findOne({ firm: s.firm?._id, role: ROLES.ADMIN }).select('name email').lean(),
    Invoice.find({ subscription: s._id }).sort({ createdAt: -1 }).lean(),
  ])
  return ok(res, {
    id: String(s._id),
    company: s.firm?.name, companyStatus: s.firm?.status, gstNo: s.firm?.gstNumber, address: s.firm?.address,
    contactEmail: s.firm?.contactEmail, contactPhone: s.firm?.contactPhone,
    adminName: admin?.name, adminEmail: admin?.email,
    plan: s.planName, planDetail: s.plan, cycle: s.cycle, amount: s.amount,
    subStatus: s.status, subStart: s.startDate, renewal: s.renewalDate, gateway: s.gateway,
    invoices: invoices.map((i) => ({ ...i, id: i.invoiceNumber })),
  })
})

// ─── Invoices ─────────────────────────────────────────────────────────────────
export const listInvoices = asyncHandler(async (req, res) => {
  const invoices = await Invoice.find({}).populate('firm', 'name gstNumber address').sort({ createdAt: -1 }).limit(500).lean()
  return ok(res, invoices.map((i) => ({
    id: i.invoiceNumber, _id: String(i._id), company: i.firm?.name || '—', logo: initials(i.firm?.name),
    plan: i.planName, cycle: i.cycle, invDate: i.invoiceDate, dueDate: i.dueDate,
    amount: i.amount, gst: i.gst, total: i.total, status: i.status, paidOn: i.paidOn,
    gstNo: i.gstNo || i.firm?.gstNumber || '', address: i.billingAddress || i.firm?.address || '',
  })), 'Invoices fetched')
})

// ─── Transactions ─────────────────────────────────────────────────────────────
export const listTransactions = asyncHandler(async (req, res) => {
  const txns = await Transaction.find({}).populate('firm', 'name').sort({ date: -1 }).limit(500).lean()
  return ok(res, txns.map((t) => ({
    id: t.transactionId, company: t.firm?.name || '—', logo: initials(t.firm?.name),
    invoice: t.invoiceNumber, gateway: t.gateway, amount: t.amount, date: t.date, status: t.status, ref: t.reference,
  })), 'Transactions fetched')
})

// ─── Billing overview (dashboard) ─────────────────────────────────────────────
export const billingOverview = asyncHandler(async (req, res) => {
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
  const twelveAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1)

  const [
    totalPlans, activeSubs, trialSubs, expiring, failedPayments,
    mrrAgg, planDist, subGrowthAgg, invoiceTrendAgg, recentTxns, renewalAgg,
  ] = await Promise.all([
    Plan.countDocuments({ status: 'active' }),
    Subscription.countDocuments({ status: 'active' }),
    Subscription.countDocuments({ status: 'trial' }),
    Subscription.countDocuments({ status: 'active', renewalDate: { $gte: monthStart, $lte: monthEnd } }),
    Invoice.countDocuments({ status: 'failed' }),
    // MRR: normalise yearly to monthly.
    Subscription.aggregate([
      { $match: { status: 'active' } },
      { $group: { _id: null, mrr: { $sum: { $cond: [{ $eq: ['$cycle', 'yearly'] }, { $divide: ['$amount', 12] }, '$amount'] } } } },
    ]),
    Subscription.aggregate([{ $group: { _id: '$planName', n: { $sum: 1 } } }, { $sort: { n: -1 } }]),
    Subscription.aggregate([
      { $match: { createdAt: { $gte: twelveAgo } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, n: { $sum: 1 } } },
    ]),
    Invoice.aggregate([
      { $match: { status: 'paid', paidOn: { $gte: twelveAgo } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$paidOn' } }, total: { $sum: '$total' } } },
    ]),
    Transaction.find({}).populate('firm', 'name').sort({ date: -1 }).limit(8).lean(),
    Invoice.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
  ])

  const mrr = Math.round(mrrAgg[0]?.mrr || 0)
  const arr = mrr * 12
  const growthMap = Object.fromEntries(subGrowthAgg.map((g) => [g._id, g.n]))
  const revMap = Object.fromEntries(invoiceTrendAgg.map((g) => [g._id, g.total]))
  const subGrowth = [], mrrTrend = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleString('en-IN', { month: 'short' })
    subGrowth.push({ month: label, value: growthMap[key] || 0 })
    mrrTrend.push({ month: label, value: revMap[key] || 0 })
  }
  const invByStatus = Object.fromEntries(renewalAgg.map((r) => [r._id, r.n]))
  const totalDecided = (invByStatus.paid || 0) + (invByStatus.failed || 0)
  const renewalRate = totalDecided ? Math.round(((invByStatus.paid || 0) / totalDecided) * 1000) / 10 : 0

  return ok(res, {
    kpis: { totalPlans, activeSubs, trialSubs, mrr, arr, expiring, failedPayments, renewalRate },
    subGrowth, mrrTrend,
    subscriptionDistribution: planDist.map((p) => ({ label: p._id || 'Unknown', value: p.n })),
    recentActivity: recentTxns.map((t) => ({
      id: t.transactionId, company: t.firm?.name || '—', invoice: t.invoiceNumber,
      amount: t.amount, gateway: t.gateway, status: t.status, at: t.date,
    })),
  })
})

// ─── Billing settings (singleton) ─────────────────────────────────────────────
async function getSettingsDoc() {
  let s = await BillingSettings.findOne({ key: 'global' })
  if (!s) s = await BillingSettings.create({ key: 'global' })
  return s
}
export const getBillingSettings = asyncHandler(async (req, res) => {
  const s = await getSettingsDoc()
  return ok(res, s.toObject())
})
export const updateBillingSettings = asyncHandler(async (req, res) => {
  const s = await getSettingsDoc()
  const fields = ['currency', 'gstPercent', 'invoicePrefix', 'companyName', 'companyGstNo', 'billingEmail', 'gateways', 'autoCharge', 'sendReminders', 'reminderDaysBefore']
  for (const f of fields) if (req.body[f] !== undefined) s[f] = f === 'gateways' ? { ...s.gateways?.toObject?.(), ...req.body[f] } : req.body[f]
  await s.save()
  return ok(res, s.toObject(), 'Billing settings saved')
})

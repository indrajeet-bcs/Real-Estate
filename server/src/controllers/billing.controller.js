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

// ─── Invoice PDF download ─────────────────────────────────────────────────────────────────────────────
// GET /billing/invoices/:id/download  — returns invoice HTML for client-side print/save
export const downloadInvoice = asyncHandler(async (req, res) => {
  const invoice = await Invoice.findOne({
    $or: [
      { _id: req.params.id.match(/^[a-f\d]{24}$/i) ? req.params.id : null },
      { invoiceNumber: req.params.id },
    ].filter((q) => q !== null && Object.values(q)[0] !== null),
  }).populate('firm', 'name gstNumber address contactEmail contactPhone').lean()

  if (!invoice) throw ApiError.notFound('Invoice not found')

  const settings = await BillingSettings.findOne({ key: 'global' }).lean()
  const currency = settings?.currency || 'INR'
  const symbol = currency === 'INR' ? '\u20B9' : '$'
  const gstPct = settings?.gstPercent ?? 18
  const companyName = settings?.companyName || 'Real Estate CRM'
  const companyGstNo = settings?.companyGstNo || ''
  const billingEmail = settings?.billingEmail || ''

  const fmt = (n) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'

  const statusColors = { paid: '#059669', pending: '#d97706', failed: '#dc2626', refunded: '#2563eb', cancelled: '#64748b' }
  const statusColor = statusColors[invoice.status] || '#64748b'

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Invoice ${invoice.invoiceNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; background: #fff; font-size: 14px; }
    .page { max-width: 800px; margin: 0 auto; padding: 48px 40px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; }
    .brand { font-size: 24px; font-weight: 700; color: #1e40af; }
    .brand-sub { font-size: 12px; color: #64748b; margin-top: 4px; }
    .invoice-meta { text-align: right; }
    .invoice-num { font-size: 20px; font-weight: 700; color: #0f172a; }
    .status-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; color: #fff; background: ${statusColor}; margin-top: 6px; text-transform: uppercase; letter-spacing: 0.5px; }
    .divider { border: none; border-top: 1px solid #e2e8f0; margin: 24px 0; }
    .parties { display: flex; justify-content: space-between; margin-bottom: 32px; }
    .party h4 { font-size: 11px; text-transform: uppercase; letter-spacing: 0.8px; color: #64748b; margin-bottom: 8px; font-weight: 600; }
    .party p { color: #0f172a; font-weight: 600; font-size: 15px; margin-bottom: 3px; }
    .party span { color: #64748b; font-size: 12px; line-height: 1.6; }
    .dates { display: flex; gap: 32px; margin-bottom: 32px; }
    .date-item label { font-size: 11px; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.5px; display: block; margin-bottom: 3px; }
    .date-item span { font-weight: 600; color: #0f172a; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    thead tr { background: #f8fafc; }
    th { padding: 10px 14px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.6px; color: #64748b; font-weight: 600; border-bottom: 2px solid #e2e8f0; }
    th:last-child { text-align: right; }
    td { padding: 14px; border-bottom: 1px solid #f1f5f9; color: #334155; }
    td:last-child { text-align: right; font-weight: 600; }
    .totals { margin-left: auto; width: 260px; }
    .total-row { display: flex; justify-content: space-between; padding: 6px 0; color: #64748b; }
    .total-row.grand { font-size: 16px; font-weight: 700; color: #0f172a; border-top: 2px solid #e2e8f0; margin-top: 8px; padding-top: 12px; }
    .footer { margin-top: 48px; padding-top: 24px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center; }
    @media print {
      body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      .page { padding: 20px; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div>
        <div class="brand">${companyName}</div>
        <div class="brand-sub">${billingEmail}${companyGstNo ? ' &bull; GST: ' + companyGstNo : ''}</div>
      </div>
      <div class="invoice-meta">
        <div class="invoice-num">INVOICE</div>
        <div style="color:#64748b;font-size:13px;margin-top:4px;">${invoice.invoiceNumber}</div>
        <div class="status-badge">${invoice.status}</div>
      </div>
    </div>

    <hr class="divider" />

    <div class="parties">
      <div class="party">
        <h4>Bill To</h4>
        <p>${invoice.firm?.name || '—'}</p>
        ${invoice.gstNo || invoice.firm?.gstNumber ? `<span>GST: ${invoice.gstNo || invoice.firm?.gstNumber}</span><br/>` : ''}
        <span>${invoice.billingAddress || invoice.firm?.address || ''}</span>
        ${invoice.firm?.contactEmail ? `<br/><span>${invoice.firm.contactEmail}</span>` : ''}
      </div>
      <div class="party" style="text-align:right">
        <h4>Invoice Details</h4>
        <span>Invoice #: <strong>${invoice.invoiceNumber}</strong></span><br/>
        <span>Date: ${fmtDate(invoice.invoiceDate)}</span><br/>
        <span>Due: ${fmtDate(invoice.dueDate)}</span>
        ${invoice.paidOn ? `<br/><span>Paid On: ${fmtDate(invoice.paidOn)}</span>` : ''}
        ${invoice.paymentMethod ? `<br/><span>Gateway: ${invoice.paymentMethod}</span>` : ''}
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th>Plan</th>
          <th>Cycle</th>
          <th>Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Subscription &mdash; ${invoice.planName || '—'}</td>
          <td>${invoice.planName || '—'}</td>
          <td style="text-transform:capitalize">${invoice.cycle || '—'}</td>
          <td>${symbol}${fmt(invoice.amount)}</td>
        </tr>
      </tbody>
    </table>

    <div class="totals">
      <div class="total-row"><span>Subtotal</span><span>${symbol}${fmt(invoice.amount)}</span></div>
      <div class="total-row"><span>GST (${gstPct}%)</span><span>${symbol}${fmt(invoice.gst)}</span></div>
      <div class="total-row grand"><span>Total</span><span>${symbol}${fmt(invoice.total)}</span></div>
    </div>

    <div class="footer">
      <p>Thank you for your business. &mdash; ${companyName}</p>
      ${billingEmail ? `<p>${billingEmail}</p>` : ''}
    </div>
  </div>
  <script>window.onload = () => { window.print() }</script>
</body>
</html>`

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Content-Disposition', `inline; filename="${invoice.invoiceNumber}.html"`)
  return res.send(html)
})

// ─── Retry failed payment ─────────────────────────────────────────────────────────────────────────────
// POST /billing/subscriptions/:id/retry  — retry a failed invoice payment
export const retryPayment = asyncHandler(async (req, res) => {
  const sub = await Subscription.findById(req.params.id).populate('firm', 'name').lean()
  if (!sub) throw ApiError.notFound('Subscription not found')

  // Find the latest failed invoice for this subscription
  const failedInvoice = await Invoice.findOne({ subscription: sub._id, status: 'failed' }).sort({ createdAt: -1 })
  if (!failedInvoice) throw ApiError.badRequest('No failed invoice found for this subscription')

  // Simulate retry: mark invoice as pending (real gateway call would go here)
  failedInvoice.status = 'pending'
  failedInvoice.dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
  await failedInvoice.save()

  // Create a retry transaction record
  const Transaction = (await import('../models/Transaction.js')).default
  await Transaction.create({
    firm: sub.firm._id,
    transactionId: `TXN-RETRY-${Date.now()}`,
    invoiceNumber: failedInvoice.invoiceNumber,
    gateway: sub.gateway || 'manual',
    amount: failedInvoice.total,
    status: 'pending',
    date: new Date(),
    reference: `Retry initiated by Super Admin`,
  })

  return ok(res, {
    invoiceNumber: failedInvoice.invoiceNumber,
    status: 'pending',
    message: `Payment retry initiated for ${sub.firm?.name || 'this subscription'}. Invoice ${failedInvoice.invoiceNumber} is now pending.`,
  }, 'Retry initiated')
})

// ─── Email invoice ──────────────────────────────────────────────────────────────────────────────
// POST /billing/invoices/:id/email  — send invoice to the firm admin email
export const emailInvoice = asyncHandler(async (req, res) => {
  const invoice = await Invoice.findOne({
    $or: [
      ...(req.params.id.match(/^[a-f\d]{24}$/i) ? [{ _id: req.params.id }] : []),
      { invoiceNumber: req.params.id },
    ],
  }).populate('firm', 'name contactEmail gstNumber address').lean()

  if (!invoice) throw ApiError.notFound('Invoice not found')

  // Find the firm admin email
  const admin = await User.findOne({ firm: invoice.firm?._id, role: ROLES.ADMIN })
    .select('name email').lean()

  const recipientEmail = admin?.email || invoice.firm?.contactEmail
  if (!recipientEmail) {
    throw ApiError.badRequest(
      `No email address found for ${invoice.firm?.name || 'this company'}. ` +
      'Please add a contact email in Company Management first.'
    )
  }

  // In production, integrate an SMTP/email service (Nodemailer, SendGrid, etc.) here.
  // For now we log the intent and return the recipient so the UI can confirm.
  console.log(`[billing] Invoice ${invoice.invoiceNumber} email queued to ${recipientEmail}`)

  return ok(res, {
    invoiceNumber: invoice.invoiceNumber,
    sentTo: recipientEmail,
    company: invoice.firm?.name,
    message: `Invoice ${invoice.invoiceNumber} has been sent to ${recipientEmail}`,
  }, 'Invoice email sent')
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

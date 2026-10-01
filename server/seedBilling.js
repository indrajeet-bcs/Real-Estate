import mongoose from 'mongoose'
import dotenv from 'dotenv'
import Firm from './src/models/Firm.js'
import Plan from './src/models/Plan.js'
import Subscription from './src/models/Subscription.js'
import Invoice from './src/models/Invoice.js'
import Transaction from './src/models/Transaction.js'
import BillingSettings from './src/models/BillingSettings.js'

dotenv.config()

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
const randInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1))
const GST = 0.18
const GATEWAYS = ['Razorpay', 'Stripe', 'PayU', 'Cashfree']
const YEAR = new Date().getFullYear()

const PLAN_DEFS = [
  { name: 'Trial', color: '#f59e0b', icon: '◷', monthlyPrice: 0, yearlyPrice: 0, trialDays: 14, displayOrder: 1, description: 'Free trial plan with limited features for evaluation.', features: { maxEmployees: 5, maxProjects: 2, maxLeads: 50, maxStorage: 1, attendance: false, reports: false, analytics: false, mobile: false, whatsapp: false, api: false, prioritySupport: false, customBranding: false, whiteLabel: false, customDomain: false, backupFrequency: 'none' } },
  { name: 'Starter', color: '#3b82f6', icon: '◈', monthlyPrice: 1999, yearlyPrice: 19990, trialDays: 0, displayOrder: 2, description: 'Perfect for small real estate agencies just getting started.', features: { maxEmployees: 15, maxProjects: 5, maxLeads: 500, maxStorage: 10, attendance: true, reports: true, analytics: false, mobile: true, whatsapp: false, api: false, prioritySupport: false, customBranding: false, whiteLabel: false, customDomain: false, backupFrequency: 'weekly' } },
  { name: 'Professional', color: '#8b5cf6', icon: '⚡', monthlyPrice: 4999, yearlyPrice: 49990, trialDays: 0, displayOrder: 3, description: 'Advanced features for growing real estate companies.', features: { maxEmployees: 50, maxProjects: 25, maxLeads: 5000, maxStorage: 50, attendance: true, reports: true, analytics: true, mobile: true, whatsapp: true, api: true, prioritySupport: false, customBranding: true, whiteLabel: false, customDomain: false, backupFrequency: 'daily' } },
  { name: 'Enterprise', color: '#10b981', icon: '★', monthlyPrice: 9999, yearlyPrice: 99990, trialDays: 0, displayOrder: 4, description: 'Full-featured plan for large enterprise real estate companies.', features: { maxEmployees: -1, maxProjects: -1, maxLeads: -1, maxStorage: 500, attendance: true, reports: true, analytics: true, mobile: true, whatsapp: true, api: true, prioritySupport: true, customBranding: true, whiteLabel: true, customDomain: true, backupFrequency: 'realtime' } },
]

const EXTRA_FIRMS = [
  'Horizon Realty', 'StarBuilders Group', 'GreenField Properties', 'MetroHomes Ltd', 'BlueSky Realty',
  'PeakCity Realtors', 'Sunrise Properties', 'GoldKey Realty', 'Crystal Homes', 'Apex Realty',
  'Urban Nest', 'Silver Oak Realty', 'NextHome Developers', 'Royal Heights', 'Dream Homes',
]
const CITIES = ['Mumbai', 'Pune', 'Bengaluru', 'Delhi', 'Ahmedabad', 'Hyderabad']

// Top up tenant companies so the billing/SaaS dashboards look realistic.
async function ensureFirms() {
  const count = await Firm.countDocuments({ isDeleted: { $ne: true } })
  if (count >= 15) return
  const now = new Date()
  for (const name of EXTRA_FIRMS) {
    if (await Firm.findOne({ name })) continue
    const roll = Math.random()
    const status = roll < 0.18 ? 'trial' : roll < 0.28 ? 'suspended' : 'active'
    const subscriptionStatus = status === 'trial' ? 'trial' : status === 'suspended' ? 'expired' : (Math.random() < 0.12 ? 'cancelled' : 'active')
    const createdAt = new Date(now.getFullYear(), now.getMonth() - randInt(0, 11), randInt(1, 28))
    const city = pick(CITIES)
    await Firm.create({
      name, status, subscriptionStatus, plan: 'standard',
      contactEmail: `admin@${name.toLowerCase().replace(/[^a-z]/g, '')}.com`,
      gstNumber: `27AAAA${randInt(1000, 9999)}A1Z${randInt(1, 9)}`,
      address: `${randInt(1, 200)}, ${city}, India`, city,
      storageUsed: randInt(1, 40), storageLimit: pick([10, 50, 500]),
      createdAt,
    })
  }
}

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/real-estate-crm')
    console.log('Connected to MongoDB')

    await BillingSettings.updateOne({ key: 'global' }, { $setOnInsert: { key: 'global' } }, { upsert: true })
    await ensureFirms()

    // Plans (idempotent by name).
    const plans = {}
    for (const def of PLAN_DEFS) {
      const p = await Plan.findOneAndUpdate({ name: def.name }, { $setOnInsert: { ...def, status: 'active' } }, { upsert: true, new: true })
      plans[def.name] = p
    }
    const paidPlans = ['Starter', 'Starter', 'Professional', 'Professional', 'Enterprise']

    const firms = await Firm.find({ isDeleted: { $ne: true } })
    let subs = 0, invs = 0, txns = 0
    let invCounter = await Invoice.countDocuments({})
    let txnCounter = await Transaction.countDocuments({})

    for (const firm of firms) {
      if (await Subscription.findOne({ firm: firm._id })) continue // idempotent per firm

      const isTrial = firm.status === 'trial' || firm.subscriptionStatus === 'trial'
      const planName = isTrial ? 'Trial' : pick(paidPlans)
      const plan = plans[planName]
      const cycle = isTrial ? 'monthly' : pick(['monthly', 'monthly', 'yearly'])
      const amount = cycle === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice
      const subStatus = isTrial ? 'trial'
        : firm.status === 'suspended' ? 'suspended'
        : firm.subscriptionStatus === 'expired' ? 'expired'
        : firm.subscriptionStatus === 'cancelled' ? 'cancelled'
        : 'active'
      const gateway = pick(GATEWAYS)
      const startDate = firm.createdAt || new Date(YEAR, randInt(0, 5), randInt(1, 28))
      const renewalDate = new Date(); renewalDate.setDate(renewalDate.getDate() + randInt(-10, 40))

      const sub = await Subscription.create({
        firm: firm._id, plan: plan._id, planName, cycle, amount, status: subStatus,
        startDate, renewalDate, gateway,
      })
      subs++

      // Generate invoice history: last 5 monthly (or 2 yearly) periods.
      const periods = cycle === 'yearly' ? 2 : 5
      for (let i = periods - 1; i >= 0; i--) {
        const invoiceDate = new Date(); invoiceDate.setMonth(invoiceDate.getMonth() - i * (cycle === 'yearly' ? 12 : 1)); invoiceDate.setDate(3)
        if (invoiceDate < startDate) continue
        const dueDate = new Date(invoiceDate); dueDate.setDate(dueDate.getDate() + 7)
        // Latest invoice may be pending/failed for some non-active firms.
        let status = 'paid'
        if (i === 0) {
          if (subStatus === 'suspended') status = 'failed'
          else if (subStatus === 'expired') status = pick(['failed', 'cancelled'])
          else if (subStatus === 'cancelled') status = 'cancelled'
          else if (isTrial) status = 'pending'
          else status = pick(['paid', 'paid', 'paid', 'pending', 'failed'])
        }
        const gst = Math.round(amount * GST * 100) / 100
        const total = Math.round((amount + gst) * 100) / 100
        const paidOn = status === 'paid' ? new Date(invoiceDate.getTime() + randInt(0, 3) * 86400000) : (status === 'refunded' ? new Date(invoiceDate.getTime() + 86400000) : null)
        invCounter++
        const invoiceNumber = `INV-${YEAR}-${String(invCounter).padStart(4, '0')}`
        const inv = await Invoice.create({
          firm: firm._id, subscription: sub._id, invoiceNumber, planName, cycle,
          amount, gst, total, status, invoiceDate, dueDate, paidOn, paymentMethod: gateway,
          gstNo: firm.gstNumber || `27AAAA${randInt(1000, 9999)}A1Z${randInt(1, 9)}`, billingAddress: firm.address || `${firm.city || 'Pune'}, India`,
        })
        invs++

        // Transaction for this invoice (skip pending/cancelled with no attempt sometimes).
        if (status !== 'cancelled') {
          txnCounter++
          const txnStatus = status === 'paid' ? 'paid' : status === 'refunded' ? 'refunded' : status === 'pending' ? 'pending' : 'failed'
          await Transaction.create({
            firm: firm._id, invoice: inv._id, invoiceNumber, transactionId: `TXN-${YEAR}-${String(txnCounter).padStart(5, '0')}`,
            gateway, amount: total, status: txnStatus,
            reference: `${gateway.slice(0, 3).toLowerCase()}_${YEAR}_${Math.random().toString(36).slice(2, 12)}`,
            date: paidOn || invoiceDate,
          })
          txns++
        }
      }
    }

    console.log(`\nDone. Plans: ${Object.keys(plans).length} · Subscriptions: ${subs} · Invoices: ${invs} · Transactions: ${txns}.`)
    process.exit(0)
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
}

seed()

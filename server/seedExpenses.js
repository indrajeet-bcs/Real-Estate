import mongoose from 'mongoose'
import dotenv from 'dotenv'
import Firm from './src/models/Firm.js'
import User from './src/models/User.js'
import Branch from './src/models/Branch.js'
import AuditLog from './src/models/AuditLog.js'
import Expense from './src/models/Expense.js'
import ExpenseCategory from './src/models/ExpenseCategory.js'
import { MODULES, AUDIT_ACTIONS } from './src/config/constants.js'
import { EXPENSE_PAYMENT_METHODS, DEPARTMENTS, DEFAULT_CATEGORIES } from './src/config/expense.js'

dotenv.config()

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
const randInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1))
const daysAgo = (d) => new Date(Date.now() - d * 86400000)

// Rough amount ranges per category (₹) to keep demo numbers believable.
const AMOUNTS = {
  'Office Rent': [40000, 120000], Electricity: [5000, 25000], Internet: [1500, 6000], 'Water Bill': [800, 4000],
  Fuel: [2000, 12000], Travel: [3000, 30000], Marketing: [10000, 150000], Event: [20000, 200000],
  'Staff Welfare': [2000, 20000], 'Office Supplies': [1000, 15000], Maintenance: [2000, 25000], Repairs: [1500, 40000],
  'Client Meeting': [1000, 8000], Refreshments: [500, 5000], Miscellaneous: [500, 10000],
}

function weightedStatus() {
  const r = Math.random()
  if (r < 0.5) return 'verified'
  if (r < 0.78) return 'submitted'
  if (r < 0.88) return 'draft'
  if (r < 0.95) return 'rejected'
  return 'cancelled'
}

async function seedFirm(firm) {
  if (await Expense.countDocuments({ firm: firm._id }) > 0) { console.log(`  · ${firm.name}: already has expenses — skipped`); return 0 }

  // Ensure default categories.
  if (await ExpenseCategory.countDocuments({ firm: firm._id }) === 0) {
    await ExpenseCategory.insertMany(DEFAULT_CATEGORIES.map((c) => ({ ...c, firm: firm._id })), { ordered: false }).catch(() => {})
  }
  const categories = await ExpenseCategory.find({ firm: firm._id }).lean()
  const users = await User.find({ firm: firm._id, isActive: true }).lean()
  if (users.length === 0 || categories.length === 0) { console.log(`  · ${firm.name}: no users/categories — skipped`); return 0 }
  const managers = users.filter((u) => ['admin', 'sub_admin'].includes(u.role))
  const verifier = managers[0] || users[0]
  const branches = await Branch.find({ firm: firm._id }).select('name').lean()
  const branchNames = branches.length ? branches.map((b) => b.name) : ['Head Office']

  const COUNT = randInt(34, 44)
  let seq = 0, receiptSeq = 0, made = 0
  for (let i = 0; i < COUNT; i++) {
    const cat = pick(categories)
    const range = AMOUNTS[cat.name] || [1000, 20000]
    const amount = randInt(range[0], range[1])
    const creator = pick(users)
    const status = weightedStatus()
    const when = daysAgo(randInt(0, 150))
    const method = pick(EXPENSE_PAYMENT_METHODS)
    const dept = cat.group === 'marketing' ? 'Marketing' : pick(DEPARTMENTS)
    seq += 1
    const hasReceipt = Math.random() < 0.45
    if (hasReceipt) receiptSeq += 1

    const activity = [{ type: status === 'draft' ? 'created' : 'submitted', note: `Expense ${status}`, actor: creator._id, actorName: creator.name, at: when }]
    let verifiedBy, verifiedByName, verifiedAt
    if (status === 'verified') { verifiedBy = verifier._id; verifiedByName = verifier.name; verifiedAt = when; activity.push({ type: 'verified', note: 'Verified', actor: verifier._id, actorName: verifier.name, at: when }) }
    if (status === 'rejected') activity.push({ type: 'rejected', note: 'Insufficient documentation', actor: verifier._id, actorName: verifier.name, at: when })

    const expense = await Expense.create({
      firm: firm._id, expenseCode: `EXP-${String(seq).padStart(4, '0')}`,
      title: `${cat.name}${dept ? ` — ${dept}` : ''}`,
      category: cat._id, categoryName: cat.name, categoryGroup: cat.group,
      expenseDate: when, branch: pick(branchNames), department: dept, amount, paymentMethod: method,
      paidTo: Math.random() < 0.6 ? pick(['Reliance Digital', 'MSEB', 'Airtel', 'Local Vendor', 'Indian Oil', 'Zomato', 'Print House']) : '',
      referenceNumber: ['bank_transfer', 'upi', 'cheque'].includes(method) ? `REF${randInt(10000, 99999)}${seq}` : '',
      description: `${cat.name} expense for ${firm.name}.`,
      status,
      createdBy: creator._id, createdByName: creator.name, createdByRole: creator.role,
      verifiedBy, verifiedByName, verifiedAt,
      rejectReason: status === 'rejected' ? 'Insufficient documentation' : '',
      receipt: hasReceipt ? { receiptNumber: `RCPT-E${String(receiptSeq).padStart(4, '0')}`, fileName: 'receipt.pdf', fileUrl: '/uploads/demo-receipt.pdf', mimeType: 'application/pdf', uploadedBy: creator._id, uploadedByName: creator.name, uploadedAt: when } : undefined,
      activity,
    })
    await AuditLog.create({ firm: firm._id, actor: creator._id, actorRole: creator.role, action: AUDIT_ACTIONS.CREATE, module: MODULES.EXPENSE, targetId: expense._id, targetLabel: expense.expenseCode, description: `Created expense ${expense.expenseCode} "${expense.title}" of ₹${amount}`, createdAt: when })
    if (status === 'verified') await AuditLog.create({ firm: firm._id, actor: verifier._id, actorRole: verifier.role, action: AUDIT_ACTIONS.STATUS_CHANGE, module: MODULES.EXPENSE, targetId: expense._id, targetLabel: expense.expenseCode, description: `Expense ${expense.expenseCode} → verified`, createdAt: when })
    made += 1
  }
  console.log(`  ✓ ${firm.name}: ${categories.length} categories, ${made} expenses`)
  return made
}

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/real-estate-crm')
    console.log('Connected to MongoDB')
    const firmIds = await User.distinct('firm', { firm: { $ne: null } })
    const firms = await Firm.find({ _id: { $in: firmIds }, isDeleted: { $ne: true } })
    if (firms.length === 0) { console.log('No live firms with users found — run seedDemo first.'); return }
    let total = 0
    for (const firm of firms) total += await seedFirm(firm)
    console.log(`\nDone. Seeded ${total} expenses across ${firms.length} firm(s).`)
  } catch (err) {
    console.error('Seed failed:', err)
    process.exitCode = 1
  } finally {
    await mongoose.disconnect()
  }
}

seed()

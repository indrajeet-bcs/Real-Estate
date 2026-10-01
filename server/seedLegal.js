import mongoose from 'mongoose'
import dotenv from 'dotenv'
import Firm from './src/models/Firm.js'
import User from './src/models/User.js'
import Booking from './src/models/Booking.js'
import Customer from './src/models/Customer.js'
import Unit from './src/models/Unit.js'
import Project from './src/models/Project.js'
import AuditLog from './src/models/AuditLog.js'
import LegalCase from './src/models/LegalCase.js'
import { MODULES, AUDIT_ACTIONS } from './src/config/constants.js'
import { AGREEMENT_TYPES, DEFAULT_DOCUMENT_TYPES } from './src/config/legal.js'

dotenv.config()

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
const randInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1))
const daysFromNow = (d) => new Date(Date.now() + d * 86400000)

const STATUS_FLOW = ['new', 'documents_pending', 'verification_in_progress', 'agreement_preparation', 'ready_for_registration', 'completed']

// Ensure ~8 bookings exist so legal cases have variety.
async function ensureBookings(firm) {
  const have = await Booking.countDocuments({ firm: firm._id })
  if (have >= 8) return
  const customers = await Customer.find({ firm: firm._id }).select('name assignedTo').limit(20).lean()
  const units = await Unit.find({ firm: firm._id, status: 'available' }).select('unitNumber project basePrice price').limit(12).lean()
  const admin = await User.findOne({ firm: firm._id, role: 'admin' }).select('_id').lean()
  const need = 8 - have
  let made = 0
  for (let i = 0; i < Math.min(need, customers.length, units.length); i++) {
    const cust = customers[i], unit = units[i]
    const amount = unit.basePrice || unit.price || randInt(2500000, 9000000)
    try {
      await Booking.create({ firm: firm._id, customer: cust._id, project: unit.project, unit: unit._id, bookingAmount: Math.round(amount * 0.1), totalValue: amount, status: 'confirmed', paymentStatus: 'pending', bookedBy: cust.assignedTo || admin?._id, bookingDate: daysFromNow(-randInt(20, 120)) })
      await Unit.updateOne({ _id: unit._id }, { $set: { status: 'booked' } })
      made += 1
    } catch { /* unit conflict */ }
  }
  if (made) console.log(`  + ${firm.name}: created ${made} demo bookings`)
}

function buildDocuments(status) {
  const finished = ['ready_for_registration', 'completed'].includes(status)
  const verifying = ['verification_in_progress', 'agreement_preparation'].includes(status)
  return DEFAULT_DOCUMENT_TYPES.map((d) => {
    let st = 'pending'
    if (finished) st = d.mandatory ? 'verified' : pick(['verified', 'received', 'pending'])
    else if (verifying) st = d.mandatory ? pick(['verified', 'received']) : pick(['received', 'pending', 'missing'])
    else if (status === 'documents_pending') st = pick(['received', 'pending', 'pending'])
    const hasFile = ['received', 'verified'].includes(st) && Math.random() < 0.7
    return { type: d.name, mandatory: d.mandatory, status: st, ...(hasFile ? { fileName: 'document.pdf', fileUrl: '/uploads/demo-doc.pdf', mimeType: 'application/pdf', uploadedAt: daysFromNow(-randInt(1, 20)) } : {}) }
  })
}

async function seedFirm(firm) {
  if (await LegalCase.countDocuments({ firm: firm._id }) > 0) { console.log(`  · ${firm.name}: already has legal cases — skipped`); return 0 }
  await ensureBookings(firm)
  const bookings = await Booking.find({ firm: firm._id, status: { $ne: 'cancelled' } })
    .populate({ path: 'customer', select: 'name assignedTo', populate: { path: 'assignedTo', select: 'name branch' } })
    .populate('project', 'name').populate('unit', 'unitNumber').lean()
  if (bookings.length === 0) { console.log(`  · ${firm.name}: no bookings — skipped`); return 0 }
  const legals = await User.find({ firm: firm._id, isActive: true }).lean()
  const admin = legals.find((u) => u.role === 'admin') || legals[0]

  let seq = 0, made = 0
  for (const bk of bookings) {
    const status = Math.random() < 0.12 ? 'cancelled' : pick(STATUS_FLOW)
    const legalExec = pick(legals)
    const exec = bk.customer?.assignedTo
    seq += 1
    const created = daysFromNow(-randInt(5, 90))
    const documents = buildDocuments(status)
    const agreementStatus = ['ready_for_registration'].includes(status) ? 'ready' : ['agreement_preparation'].includes(status) ? 'in_preparation' : status === 'completed' ? 'ready' : 'not_started'

    const activity = [{ type: 'created', note: 'Legal case created', actor: admin._id, actorName: admin.name, at: created }]
    if (legalExec) activity.push({ type: 'assigned', note: `Assigned to ${legalExec.name}`, actor: admin._id, actorName: admin.name, at: created })
    if (status === 'completed') activity.push({ type: 'completed', note: 'Legal process completed', actor: legalExec._id, actorName: legalExec.name, at: daysFromNow(-randInt(1, 5)) })

    const legalCase = await LegalCase.create({
      firm: firm._id, caseCode: `LEG-${String(seq).padStart(4, '0')}`,
      booking: bk._id, customer: bk.customer?._id, customerName: bk.customer?.name,
      project: bk.project?._id || null, projectName: bk.project?.name || '',
      unit: bk.unit?._id || null, unitNumber: bk.unit?.unitNumber || '',
      branch: exec?.branch || '', assignedTo: exec?._id || null,
      legalExecutive: legalExec._id, legalExecutiveName: legalExec.name,
      agreementType: pick(AGREEMENT_TYPES), agreementStatus,
      agreementNumber: agreementStatus === 'ready' ? `AGR-${randInt(10000, 99999)}` : '',
      status,
      expectedCompletionDate: daysFromNow(randInt(-15, 30)),
      completedAt: status === 'completed' ? daysFromNow(-randInt(1, 5)) : undefined,
      remarks: 'Auto-seeded demo legal case.',
      documents,
      createdBy: admin._id, createdByName: admin.name,
      createdAt: created,
      activity,
    })
    await AuditLog.create({ firm: firm._id, actor: admin._id, actorRole: admin.role, action: AUDIT_ACTIONS.CREATE, module: MODULES.LEGAL, targetId: legalCase._id, targetLabel: legalCase.caseCode, description: `Created legal case ${legalCase.caseCode} for ${legalCase.customerName}`, createdAt: created })
    if (status === 'completed') await AuditLog.create({ firm: firm._id, actor: legalExec._id, actorRole: legalExec.role, action: AUDIT_ACTIONS.STATUS_CHANGE, module: MODULES.LEGAL, targetId: legalCase._id, targetLabel: legalCase.caseCode, description: `Legal case ${legalCase.caseCode} → completed`, createdAt: daysFromNow(-randInt(1, 5)) })
    made += 1
  }
  console.log(`  ✓ ${firm.name}: ${made} legal cases`)
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
    console.log(`\nDone. Seeded ${total} legal cases across ${firms.length} firm(s).`)
  } catch (err) {
    console.error('Seed failed:', err)
    process.exitCode = 1
  } finally {
    await mongoose.disconnect()
  }
}

seed()

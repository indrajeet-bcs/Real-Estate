import Customer from '../models/Customer.js'
import User from '../models/User.js'
import FollowUp from '../models/FollowUp.js'
import SiteVisit from '../models/SiteVisit.js'
import Booking from '../models/Booking.js'
import ImportBatch from '../models/ImportBatch.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from '../utils/ApiError.js'
import { ok, created } from '../utils/apiResponse.js'
import { paginate } from '../utils/paginate.js'
import { writeAudit } from '../middleware/audit.js'
import { notify } from '../services/notification.service.js'
import { AUDIT_ACTIONS, MODULES, ROLES, CUSTOMER_STATUS, NOTIFICATION_TYPES, BOOKING_STATUS, FOLLOWUP_STATUS, VISIT_STATUS } from '../config/constants.js'
import { ownershipScope, firmScope } from '../middleware/tenantScope.js'

const OPEN_LEAD_STATUSES = [CUSTOMER_STATUS.NEW, CUSTOMER_STATUS.IN_PROGRESS, CUSTOMER_STATUS.FOLLOW_UP_DUE]

// GET /api/customers — executives see their assigned customers; sub-admin/admin
// see the whole firm (§5 monitoring, §4 all-clients).
export const listCustomers = asyncHandler(async (req, res) => {
  const { page, limit, search, status, assignedTo, priority } = req.query
  const filter = { ...ownershipScope(req.user, 'assignedTo') }
  if (status && status !== 'all') filter.status = status
  if (priority && priority !== 'all') filter.priority = priority
  if (assignedTo && req.user.role !== ROLES.SALES_EXECUTIVE) filter.assignedTo = assignedTo
  if (req.query.unassigned === 'true' && req.user.role !== ROLES.SALES_EXECUTIVE) filter.assignedTo = null
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { mobile: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
    ]
  }

  const { data, meta } = await paginate(Customer, filter, {
    page,
    limit,
    select: '-notes -activity -documents',
    populate: { path: 'assignedTo', select: 'name email' },
  })

  // Attach last/next follow-up + latest booking status for the returned page
  // (spec §Customer List columns). Aggregated once for all rows on the page.
  const ids = data.map((c) => c._id)
  if (ids.length) {
    const now = new Date()
    const [lastFu, nextFu, latestBookings] = await Promise.all([
      FollowUp.aggregate([
        { $match: { customer: { $in: ids }, status: FOLLOWUP_STATUS.COMPLETED } },
        { $sort: { scheduledAt: -1 } },
        { $group: { _id: '$customer', at: { $first: '$scheduledAt' } } },
      ]),
      FollowUp.aggregate([
        { $match: { customer: { $in: ids }, status: FOLLOWUP_STATUS.SCHEDULED, scheduledAt: { $gte: now } } },
        { $sort: { scheduledAt: 1 } },
        { $group: { _id: '$customer', at: { $first: '$scheduledAt' } } },
      ]),
      Booking.aggregate([
        { $match: { customer: { $in: ids } } },
        { $sort: { createdAt: -1 } },
        { $group: { _id: '$customer', status: { $first: '$status' } } },
      ]),
    ])
    const map = (arr, key) => Object.fromEntries(arr.map((x) => [String(x._id), x[key]]))
    const last = map(lastFu, 'at')
    const next = map(nextFu, 'at')
    const bk = map(latestBookings, 'status')
    for (const c of data) {
      c.lastFollowUp = last[String(c._id)] || null
      c.nextFollowUp = next[String(c._id)] || null
      c.bookingStatus = bk[String(c._id)] || null
    }
  }

  return ok(res, data, 'Customers fetched', meta)
})

// GET /api/customers/:id — full Customer 360° profile (§6).
export const getCustomer = asyncHandler(async (req, res) => {
  const filter = { _id: req.params.id, ...firmScope(req.user) }
  // Executives can only open their own assigned customers.
  if (req.user.role === ROLES.SALES_EXECUTIVE) filter.assignedTo = req.user._id

  const customer = await Customer.findOne(filter)
    .populate('assignedTo', 'name email branch')
    .populate('interestedProjects.project', 'name location')
    .lean()
  if (!customer) throw ApiError.notFound('Customer not found')

  // Aggregate the related timelines shown on the profile.
  const [followUps, visits, bookings] = await Promise.all([
    FollowUp.find({ customer: customer._id }).sort({ scheduledAt: -1 }).lean(),
    SiteVisit.find({ customer: customer._id }).populate('project', 'name').sort({ scheduledAt: -1 }).lean(),
    Booking.find({ customer: customer._id }).populate('unit', 'unitNumber').populate('project', 'name').sort({ createdAt: -1 }).lean(),
  ])

  return ok(res, { customer, followUps, visits, bookings })
})

// POST /api/customers — manual lead entry (§5). Deduplicates on mobile per firm.
export const createCustomer = asyncHandler(async (req, res) => {
  const dupe = await Customer.findOne({ firm: req.user.firm, mobile: req.body.mobile })
  if (dupe) throw ApiError.conflict('A customer with this mobile already exists in your firm', { existingId: dupe._id })

  const assignedTo =
    req.user.role === ROLES.SALES_EXECUTIVE ? req.user._id : req.body.assignedTo || null

  // Pull transient Add-New-Lead helpers out of the persisted body (§Add New Lead).
  const { note, interestedProject, ...fields } = req.body

  const customer = await Customer.create({
    ...fields,
    firm: req.user.firm,
    assignedTo,
    assignedAt: assignedTo ? new Date() : undefined,
    status: CUSTOMER_STATUS.NEW,
    createdBy: req.user._id,
  })
  if (interestedProject) {
    customer.interestedProjects.push({ project: interestedProject })
  }
  if (note && note.trim()) {
    customer.notes.push({ type: 'general', text: note.trim(), createdBy: req.user._id })
  }
  customer.logActivity('created', `Lead created by ${req.user.name}`, req.user._id)
  await customer.save()

  writeAudit({ req, action: AUDIT_ACTIONS.CREATE, module: MODULES.CUSTOMER, targetId: customer._id, targetLabel: customer.name, description: `Created lead ${customer.name}` })

  if (assignedTo) {
    notify({
      firm: req.user.firm,
      recipient: assignedTo,
      type: NOTIFICATION_TYPES.LEAD_ASSIGNED,
      title: 'New lead assigned',
      message: `${customer.name} has been assigned to you`,
      entityType: 'customer',
      entityId: customer._id,
    })
  }
  return created(res, customer, 'Customer created')
})

// PATCH /api/customers/:id — edit personal info.
export const updateCustomer = asyncHandler(async (req, res) => {
  const filter = { _id: req.params.id, ...firmScope(req.user) }
  if (req.user.role === ROLES.SALES_EXECUTIVE) filter.assignedTo = req.user._id
  const customer = await Customer.findOne(filter)
  if (!customer) throw ApiError.notFound('Customer not found')

  Object.assign(customer, req.body)
  customer.logActivity('updated', `Profile updated by ${req.user.name}`, req.user._id)
  await customer.save()

  writeAudit({ req, action: AUDIT_ACTIONS.UPDATE, module: MODULES.CUSTOMER, targetId: customer._id, targetLabel: customer.name, description: `Updated ${customer.name}` })
  return ok(res, customer, 'Customer updated')
})

// POST /api/customers/:id/notes — add a call/meeting/general note.
export const addNote = asyncHandler(async (req, res) => {
  const customer = await findOwned(req)
  customer.notes.push({ ...req.body, createdBy: req.user._id })
  customer.logActivity('note_added', `${req.body.type} note added`, req.user._id)
  // First contact moves a New lead to In Progress.
  if (customer.status === CUSTOMER_STATUS.NEW) customer.status = CUSTOMER_STATUS.IN_PROGRESS
  await customer.save()
  return created(res, customer.notes.at(-1), 'Note added')
})

// POST /api/customers/:id/interests — tag interest in a project (multi allowed, §15).
export const addInterest = asyncHandler(async (req, res) => {
  const customer = await findOwned(req)
  const already = customer.interestedProjects.some((i) => String(i.project) === req.body.project)
  if (already) throw ApiError.conflict('Project already tagged as interested')
  customer.interestedProjects.push(req.body)
  customer.logActivity('interest_tagged', 'Interested project tagged', req.user._id, { project: req.body.project })
  await customer.save()
  return created(res, customer.interestedProjects, 'Interest added')
})

// DELETE /api/customers/:id/interests/:interestId
export const removeInterest = asyncHandler(async (req, res) => {
  const customer = await findOwned(req)
  customer.interestedProjects = customer.interestedProjects.filter(
    (i) => String(i._id) !== req.params.interestId
  )
  await customer.save()
  return ok(res, customer.interestedProjects, 'Interest removed')
})

// POST /api/customers/:id/documents — attach an uploaded file's metadata.
export const addDocument = asyncHandler(async (req, res) => {
  const customer = await findOwned(req)
  if (!req.file) throw ApiError.badRequest('No file uploaded')
  const doc = {
    label: req.body.label || req.file.originalname,
    fileName: req.file.originalname,
    fileUrl: `/uploads/${req.file.filename}`,
    mimeType: req.file.mimetype,
    size: req.file.size,
    uploadedBy: req.user._id,
  }
  customer.documents.push(doc)
  customer.logActivity('document_uploaded', doc.label, req.user._id)
  await customer.save()
  return created(res, customer.documents.at(-1), 'Document uploaded')
})

// PATCH /api/customers/:id/status — status change with audit (§10) + reopen rule.
export const changeStatus = asyncHandler(async (req, res) => {
  const customer = await findOwned(req)
  const { status, lostReason } = req.body
  const prev = customer.status
  customer.status = status
  if (status === CUSTOMER_STATUS.LOST) customer.lostReason = lostReason
  customer.logActivity('status_changed', `${prev} → ${status}`, req.user._id)
  await customer.save()
  writeAudit({ req, action: AUDIT_ACTIONS.STATUS_CHANGE, module: MODULES.CUSTOMER, targetId: customer._id, targetLabel: customer.name, description: `Status ${prev} → ${status}` })
  return ok(res, customer, 'Status updated')
})

// POST /api/customers/:id/reopen — re-engage a Lost customer as a NEW
// opportunity, preserving the original's history (Edge Case §15).
export const reopenCustomer = asyncHandler(async (req, res) => {
  const original = await findOwned(req)
  if (original.status !== CUSTOMER_STATUS.LOST) {
    throw ApiError.badRequest('Only a Lost customer can be reopened')
  }
  const fresh = await Customer.create({
    firm: original.firm,
    name: original.name,
    mobile: original.mobile,
    altMobile: original.altMobile,
    email: original.email,
    address: original.address,
    occupation: original.occupation,
    source: original.source,
    status: CUSTOMER_STATUS.NEW,
    assignedTo: original.assignedTo || req.user._id,
    assignedAt: new Date(),
    reopenedFrom: original._id,
    createdBy: req.user._id,
  })
  fresh.logActivity('reopened', `Reopened from lost opportunity ${original._id}`, req.user._id)
  await fresh.save()
  writeAudit({ req, action: AUDIT_ACTIONS.CREATE, module: MODULES.CUSTOMER, targetId: fresh._id, targetLabel: fresh.name, description: `Reopened ${fresh.name} as a new opportunity` })
  return created(res, fresh, 'Customer reopened as a new opportunity')
})

// POST /api/customers/:id/convert — convert a qualified lead into a customer
// (Employee spec §Convert to Customer). Lead & customer share one record, so the
// full history is preserved automatically; this only advances the lifecycle
// stage after enforcing the "qualified only" rule.
export const convertLead = asyncHandler(async (req, res) => {
  const customer = await findOwned(req)
  if (customer.status === CUSTOMER_STATUS.CONVERTED) {
    throw ApiError.badRequest('This lead has already been converted')
  }
  if (customer.status !== CUSTOMER_STATUS.QUALIFIED) {
    throw ApiError.badRequest('Only a qualified lead can be converted to a customer')
  }
  const prev = customer.status
  customer.status = CUSTOMER_STATUS.CONVERTED
  customer.convertedAt = new Date()
  customer.logActivity('converted', 'Lead converted to customer', req.user._id)
  await customer.save()
  writeAudit({ req, action: AUDIT_ACTIONS.STATUS_CHANGE, module: MODULES.CUSTOMER, targetId: customer._id, targetLabel: customer.name, description: `Converted lead ${customer.name} (${prev} → converted)` })
  return ok(res, customer, 'Lead converted to customer')
})

// POST /api/customers/assign — individual or bulk round-robin (§5).
export const assignCustomers = asyncHandler(async (req, res) => {
  const { customerIds, executiveId, executiveIds } = req.body

  // Resolve the target executive pool and validate they belong to the firm.
  const targetIds = executiveId ? [executiveId] : executiveIds
  if (!targetIds?.length) throw ApiError.badRequest('Provide executiveId or executiveIds')

  const execs = await User.find({
    _id: { $in: targetIds },
    firm: req.user.firm,
    role: ROLES.SALES_EXECUTIVE,
    isActive: true,
  }).select('_id name')
  if (execs.length !== targetIds.length) throw ApiError.badRequest('One or more executives are invalid')

  // Round-robin assignment across the pool.
  const customers = await Customer.find({ _id: { $in: customerIds }, firm: req.user.firm })
  let idx = 0
  const notifyCounts = new Map()
  for (const c of customers) {
    const exec = execs[idx % execs.length]
    c.assignedTo = exec._id
    c.assignedAt = new Date()
    c.logActivity('assigned', `Assigned to ${exec.name}`, req.user._id)
    await c.save()
    notifyCounts.set(String(exec._id), (notifyCounts.get(String(exec._id)) || 0) + 1)
    idx++
  }

  // Notify each executive of their new leads.
  for (const [execId, count] of notifyCounts) {
    notify({
      firm: req.user.firm,
      recipient: execId,
      type: NOTIFICATION_TYPES.LEAD_ASSIGNED,
      title: 'New leads assigned',
      message: `${count} new lead(s) assigned to you`,
    })
  }

  writeAudit({ req, action: AUDIT_ACTIONS.ASSIGN, module: MODULES.LEAD, description: `Assigned ${customers.length} leads to ${execs.length} executive(s)` })
  return ok(res, { assigned: customers.length }, `${customers.length} leads assigned`)
})

// POST /api/customers/:id/transfer — transfer lead ownership (Admin/Sub-Admin).
// Moves the lead + its pending follow-ups & future site visits to a new employee,
// records transfer history, logs activity + audit, and notifies the new owner
// (spec §Lead Transfer).
export const transferLead = asyncHandler(async (req, res) => {
  const { newEmployee, reason, remarks } = req.body
  const customer = await Customer.findOne({ _id: req.params.id, ...firmScope(req.user) })
  if (!customer) throw ApiError.notFound('Lead not found')

  const target = await User.findOne({ _id: newEmployee, firm: req.user.firm, role: ROLES.SALES_EXECUTIVE, isActive: true }).select('name')
  if (!target) throw ApiError.badRequest('Select an active sales executive to transfer to')
  if (String(customer.assignedTo) === String(target._id)) throw ApiError.badRequest('Lead is already assigned to that employee')

  const prevId = customer.assignedTo || null
  const prev = prevId ? await User.findById(prevId).select('name') : null

  customer.assignedTo = target._id
  customer.assignedAt = new Date()
  customer.transferHistory.push({
    previousEmployee: prevId,
    previousEmployeeName: prev?.name || 'Unassigned',
    newEmployee: target._id,
    newEmployeeName: target.name,
    transferredBy: req.user._id,
    transferredByName: req.user.name,
    reason,
    remarks,
  })
  customer.logActivity('lead_transferred', `Transferred from ${prev?.name || 'pool'} to ${target.name}`, req.user._id, { reason })
  await customer.save()

  // Move pending follow-ups and future scheduled visits to the new owner.
  const now = new Date()
  const [fu, sv] = await Promise.all([
    FollowUp.updateMany({ customer: customer._id, status: FOLLOWUP_STATUS.SCHEDULED }, { $set: { assignedTo: target._id } }),
    SiteVisit.updateMany({ customer: customer._id, status: VISIT_STATUS.SCHEDULED, scheduledAt: { $gte: now } }, { $set: { assignedTo: target._id } }),
  ])

  notify({
    firm: req.user.firm,
    recipient: target._id,
    type: NOTIFICATION_TYPES.LEAD_ASSIGNED,
    title: 'Lead transferred to you',
    message: `${customer.name} was transferred to you`,
    entityType: 'customer',
    entityId: customer._id,
  })

  writeAudit({ req, action: AUDIT_ACTIONS.TRANSFER, module: MODULES.LEAD, targetId: customer._id, targetLabel: customer.name, description: `Transferred lead ${customer.name} to ${target.name}` })
  return ok(res, { customer, reassignedFollowUps: fu.modifiedCount, reassignedVisits: sv.modifiedCount }, 'Lead transferred')
})

// POST /api/customers/distribute — auto-allocate all unassigned leads across
// active executives via one of three algorithms (Admin-flow port).
export const distributeLeads = asyncHandler(async (req, res) => {
  const { algorithm } = req.body

  const unassigned = await Customer.find({
    firm: req.user.firm,
    assignedTo: null,
    status: { $in: OPEN_LEAD_STATUSES },
  })
  if (!unassigned.length) return ok(res, { assigned: 0, byExecutive: [] }, 'No unassigned leads to distribute')

  const execs = await User.find({ firm: req.user.firm, role: ROLES.SALES_EXECUTIVE, isActive: true }).select('_id name')
  if (!execs.length) throw ApiError.badRequest('No active executives to assign to')

  const ids = execs.map((e) => e._id)
  const [counts, perf] = await Promise.all([
    Customer.aggregate([
      { $match: { assignedTo: { $in: ids }, status: { $in: OPEN_LEAD_STATUSES } } },
      { $group: { _id: '$assignedTo', c: { $sum: 1 } } },
    ]),
    Booking.aggregate([
      { $match: { bookedBy: { $in: ids }, status: BOOKING_STATUS.CONFIRMED } },
      { $group: { _id: '$bookedBy', rev: { $sum: { $ifNull: ['$totalValue', '$bookingAmount'] } } } },
    ]),
  ])
  // Current open-lead load and a performance score (revenue) per executive.
  const load = Object.fromEntries(execs.map((e) => [String(e._id), 0]))
  counts.forEach((r) => { load[String(r._id)] = r.c })
  const score = Object.fromEntries(execs.map((e) => [String(e._id), 1]))
  perf.forEach((r) => { score[String(r._id)] = (r.rev || 0) + 1 })

  const pick = (i) => {
    if (algorithm === 'load_balanced') {
      return execs.slice().sort((a, b) => load[String(a._id)] - load[String(b._id)])[0]
    }
    if (algorithm === 'performance') {
      // Favor higher performers while still balancing (score per current load).
      return execs.slice().sort((a, b) =>
        (score[String(b._id)] / (load[String(b._id)] + 1)) - (score[String(a._id)] / (load[String(a._id)] + 1)))[0]
    }
    return execs[i % execs.length] // round_robin
  }

  const notifyCounts = new Map()
  let i = 0
  for (const c of unassigned) {
    const exec = pick(i)
    c.assignedTo = exec._id
    c.assignedAt = new Date()
    c.logActivity('assigned', `Auto-allocated to ${exec.name} (${algorithm})`, req.user._id)
    await c.save()
    load[String(exec._id)] += 1
    notifyCounts.set(String(exec._id), (notifyCounts.get(String(exec._id)) || 0) + 1)
    i++
  }

  for (const [execId, count] of notifyCounts) {
    notify({ firm: req.user.firm, recipient: execId, type: NOTIFICATION_TYPES.LEAD_ASSIGNED, title: 'New leads assigned', message: `${count} new lead(s) auto-allocated to you` })
  }
  writeAudit({ req, action: AUDIT_ACTIONS.ASSIGN, module: MODULES.LEAD, description: `Auto-distributed ${unassigned.length} leads via ${algorithm}` })

  const byExecutive = execs
    .filter((e) => notifyCounts.has(String(e._id)))
    .map((e) => ({ name: e.name, count: notifyCounts.get(String(e._id)) }))
  return ok(res, { assigned: unassigned.length, byExecutive }, `Distributed ${unassigned.length} leads via ${algorithm}`)
})

// POST /api/customers/import — bulk import with validation engine (§5).
// Splits rows into successful / duplicate (mobile match) / failed (missing
// mandatory fields).
export const importCustomers = asyncHandler(async (req, res) => {
  const { rows, fileName, columnMapping } = req.body

  const batch = await ImportBatch.create({
    firm: req.user.firm,
    fileName,
    columnMapping,
    totalRows: rows.length,
    importedBy: req.user._id,
    status: 'processing',
  })

  // Existing mobiles in the firm for dedup.
  const existing = await Customer.find({ firm: req.user.firm }).select('mobile').lean()
  const existingMobiles = new Set(existing.map((c) => String(c.mobile).trim()))
  const seenInBatch = new Set()

  const toCreate = []
  const duplicateRows = []
  const failedRows = []

  for (const row of rows) {
    const name = (row.name || '').toString().trim()
    const mobile = (row.mobile || '').toString().trim()

    // Failed: missing mandatory fields.
    if (!name || !mobile) {
      failedRows.push({ row, reason: 'Missing mandatory field (name and mobile required)' })
      continue
    }
    // Duplicate: mobile already exists (in DB or earlier in this batch).
    if (existingMobiles.has(mobile) || seenInBatch.has(mobile)) {
      duplicateRows.push({ row, reason: 'Mobile number already exists' })
      continue
    }
    seenInBatch.add(mobile)
    toCreate.push({
      firm: req.user.firm,
      name,
      mobile,
      email: row.email?.toString().trim() || undefined,
      address: row.address?.toString().trim() || undefined,
      source: 'bulk_import',
      status: CUSTOMER_STATUS.NEW,
      importBatch: batch._id,
      createdBy: req.user._id,
    })
  }

  const inserted = toCreate.length ? await Customer.insertMany(toCreate) : []

  batch.successfulCount = inserted.length
  batch.duplicateCount = duplicateRows.length
  batch.failedCount = failedRows.length
  batch.duplicateRows = duplicateRows
  batch.failedRows = failedRows
  batch.status = 'completed'
  await batch.save()

  writeAudit({
    req,
    action: AUDIT_ACTIONS.IMPORT,
    module: MODULES.LEAD,
    targetId: batch._id,
    description: `Imported ${inserted.length} leads (${duplicateRows.length} dup, ${failedRows.length} failed)`,
  })

  return created(
    res,
    {
      batchId: batch._id,
      successful: inserted.length,
      duplicates: duplicateRows,
      failed: failedRows,
    },
    'Import processed'
  )
})

// Shared helper: load a customer the actor is allowed to act on.
async function findOwned(req) {
  const filter = { _id: req.params.id, ...firmScope(req.user) }
  if (req.user.role === ROLES.SALES_EXECUTIVE) filter.assignedTo = req.user._id
  const customer = await Customer.findOne(filter)
  if (!customer) throw ApiError.notFound('Customer not found')
  return customer
}

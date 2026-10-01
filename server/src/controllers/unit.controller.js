import Unit from '../models/Unit.js'
import Project from '../models/Project.js'
import Customer from '../models/Customer.js'
import Booking from '../models/Booking.js'
import Firm from '../models/Firm.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from '../utils/ApiError.js'
import { ok, created } from '../utils/apiResponse.js'
import { paginate } from '../utils/paginate.js'
import { writeAudit } from '../middleware/audit.js'
import { AUDIT_ACTIONS, MODULES, UNIT_STATUS, BOOKING_STATUS } from '../config/constants.js'
import { firmScope } from '../middleware/tenantScope.js'

// Auto-expiry: release any locks whose window has elapsed (lazy — runs on read).
async function releaseExpiredLocks(user) {
  await Unit.updateMany(
    { ...firmScope(user), status: UNIT_STATUS.LOCKED, lockedUntil: { $lte: new Date() } },
    { $set: { status: UNIT_STATUS.AVAILABLE, lockedForCustomer: null, lockedUntil: null, lockReason: null, lockedBy: null } }
  )
}

// GET /api/units — firm inventory grid with the full filter set + per-unit
// booking info (customer, sales executive, booking date) attached at read time.
export const listUnits = asyncHandler(async (req, res) => {
  await releaseExpiredLocks(req.user)

  const {
    page, limit, project, status, search,
    propertyType, configuration, tower, floor, availability, bookingStatus, assignedExec,
    priceMin, priceMax, areaMin, areaMax,
  } = req.query
  const filter = { ...firmScope(req.user) }
  if (project) filter.project = project
  if (status) filter.status = status
  if (availability) filter.status = availability
  if (search) filter.unitNumber = { $regex: search, $options: 'i' }
  if (propertyType) filter.propertyType = { $regex: propertyType, $options: 'i' }
  if (configuration) filter.$or = [{ configuration: { $regex: configuration, $options: 'i' } }, { unitType: { $regex: configuration, $options: 'i' } }]
  if (tower) filter.tower = { $regex: tower, $options: 'i' }
  if (floor) filter.floor = { $regex: floor, $options: 'i' }
  if (assignedExec) filter.reservedBy = assignedExec
  if (priceMin || priceMax) {
    filter.$expr = filter.$expr || {}
    const priceField = { $ifNull: ['$currentPrice', { $ifNull: ['$basePrice', '$price'] }] }
    const conds = []
    if (priceMin) conds.push({ $gte: [priceField, Number(priceMin)] })
    if (priceMax) conds.push({ $lte: [priceField, Number(priceMax)] })
    filter.$expr = { $and: conds }
  }
  if (areaMin || areaMax) {
    filter.areaSqft = {}
    if (areaMin) filter.areaSqft.$gte = Number(areaMin)
    if (areaMax) filter.areaSqft.$lte = Number(areaMax)
  }

  const { data, meta } = await paginate(Unit, filter, {
    page,
    limit,
    sort: { unitNumber: 1 },
    populate: [
      { path: 'project', select: 'name builder' },
      { path: 'lockedForCustomer', select: 'name mobile' },
      { path: 'bookedFor', select: 'name mobile' },
      { path: 'reservedBy', select: 'name' },
    ],
  })

  // Attach booking info (id, date, executive) for booked/reserved units.
  const activeIds = data.filter((u) => u.status === UNIT_STATUS.BOOKED || u.status === UNIT_STATUS.RESERVED).map((u) => u._id)
  let bookingMap = {}
  if (activeIds.length) {
    const bookings = await Booking.find({ unit: { $in: activeIds }, status: { $ne: BOOKING_STATUS.CANCELLED } })
      .populate('customer', 'name').populate('bookedBy', 'name').select('unit customer bookedBy status createdAt').lean()
    bookingMap = Object.fromEntries(bookings.map((b) => [String(b.unit), b]))
  }
  let out = data.map((u) => {
    const b = bookingMap[String(u._id)]
    return {
      ...u,
      customerName: u.bookedFor?.name || u.lockedForCustomer?.name || b?.customer?.name || null,
      salesExecutive: u.reservedBy?.name || b?.bookedBy?.name || null,
      bookingId: b?._id || null,
      bookingDate: b?.createdAt || null,
    }
  })
  if (bookingStatus) out = out.filter((u) => (bookingStatus === 'booked' ? u.status === UNIT_STATUS.BOOKED : u.status === bookingStatus))

  return ok(res, out, 'Units fetched', meta)
})

// GET /api/units/stats — the four inventory KPI cards.
export const inventoryStats = asyncHandler(async (req, res) => {
  await releaseExpiredLocks(req.user)
  const agg = await Unit.aggregate([
    { $match: { ...firmScope(req.user) } },
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ])
  const m = Object.fromEntries(agg.map((r) => [r._id, r.count]))
  const total = agg.reduce((s, r) => s + r.count, 0)
  return ok(res, {
    totalProperties: total,
    available: m[UNIT_STATUS.AVAILABLE] || 0,
    booked: m[UNIT_STATUS.BOOKED] || 0,
    reservedLocked: (m[UNIT_STATUS.RESERVED] || 0) + (m[UNIT_STATUS.LOCKED] || 0),
    // Full per-status breakdown (spec §Inventory Dashboard KPI cards).
    byStatus: {
      available: m[UNIT_STATUS.AVAILABLE] || 0,
      reserved: m[UNIT_STATUS.RESERVED] || 0,
      booked: m[UNIT_STATUS.BOOKED] || 0,
      sold: m[UNIT_STATUS.SOLD] || 0,
      hold: (m[UNIT_STATUS.HOLD] || 0) + (m[UNIT_STATUS.LOCKED] || 0),
      token: m[UNIT_STATUS.TOKEN] || 0,
      registered: m[UNIT_STATUS.REGISTERED] || 0,
      possession: m[UNIT_STATUS.POSSESSION] || 0,
      blocked: m[UNIT_STATUS.BLOCKED] || 0,
    },
  }, 'Inventory stats')
})

// POST /api/units/:id/lock — temporary hold for a lead (Admin-flow port).
export const lockUnit = asyncHandler(async (req, res) => {
  const unit = await Unit.findOne({ _id: req.params.id, ...firmScope(req.user) })
  if (!unit) throw ApiError.notFound('Unit not found')
  if (unit.status !== UNIT_STATUS.AVAILABLE) throw ApiError.badRequest('Only available units can be locked')

  const { customer, reason, hours } = req.body
  const cust = await Customer.findOne({ _id: customer, ...firmScope(req.user) })
  if (!cust) throw ApiError.badRequest('Lead not found in your firm')

  const firm = await Firm.findById(req.user.firm).select('inventoryLockHours').lean()
  const lockHours = hours || firm?.inventoryLockHours || 48

  unit.status = UNIT_STATUS.LOCKED
  unit.lockedForCustomer = cust._id
  unit.lockedUntil = new Date(Date.now() + lockHours * 3600 * 1000)
  unit.lockReason = reason
  unit.lockedBy = req.user._id
  await unit.save()

  writeAudit({ req, action: AUDIT_ACTIONS.STATUS_CHANGE, module: MODULES.UNIT, targetId: unit._id, targetLabel: unit.unitNumber, description: `Locked unit ${unit.unitNumber} for ${cust.name} (${lockHours}h): ${reason}` })
  return ok(res, unit, `Unit locked for ${lockHours} hours`)
})

// POST /api/units/:id/release — manual lock release.
export const releaseUnit = asyncHandler(async (req, res) => {
  const unit = await Unit.findOne({ _id: req.params.id, ...firmScope(req.user) })
  if (!unit) throw ApiError.notFound('Unit not found')
  if (unit.status !== UNIT_STATUS.LOCKED) throw ApiError.badRequest('Unit is not locked')

  unit.status = UNIT_STATUS.AVAILABLE
  unit.lockedForCustomer = null
  unit.lockedUntil = null
  unit.lockReason = undefined
  unit.lockedBy = null
  await unit.save()

  writeAudit({ req, action: AUDIT_ACTIONS.STATUS_CHANGE, module: MODULES.UNIT, targetId: unit._id, targetLabel: unit.unitNumber, description: `Released lock on unit ${unit.unitNumber}` })
  return ok(res, unit, 'Unit released')
})

// POST /api/units/:id/transfer — move a lead's holding from this unit to another
// available unit before booking confirmation (spec §Unit Transfer). Preserves a
// complete transfer history on both units and re-points any reserved booking.
export const transferUnit = asyncHandler(async (req, res) => {
  const { newUnit: newUnitId, reason } = req.body
  const from = await Unit.findOne({ _id: req.params.id, ...firmScope(req.user) })
  if (!from) throw ApiError.notFound('Unit not found')

  const HELD = [UNIT_STATUS.RESERVED, UNIT_STATUS.LOCKED, UNIT_STATUS.TOKEN, UNIT_STATUS.HOLD]
  if (!HELD.includes(from.status)) throw ApiError.badRequest('Only reserved/held units can be transferred before booking confirmation')

  const to = await Unit.findOne({ _id: newUnitId, ...firmScope(req.user) })
  if (!to) throw ApiError.notFound('Target unit not found')
  if (String(to._id) === String(from._id)) throw ApiError.badRequest('Choose a different target unit')
  if (to.status !== UNIT_STATUS.AVAILABLE) throw ApiError.badRequest('Target unit must be available')

  // A confirmed booking cannot be transferred (spec: only before confirmation).
  const booking = await Booking.findOne({ unit: from._id, status: { $ne: BOOKING_STATUS.CANCELLED } })
  if (booking && booking.status === BOOKING_STATUS.CONFIRMED) throw ApiError.badRequest('Cannot transfer a unit with a confirmed booking')

  const entry = (direction) => ({
    direction, reason, by: req.user._id, byName: req.user.name,
    fromUnit: from._id, fromUnitNumber: from.unitNumber, toUnit: to._id, toUnitNumber: to.unitNumber,
  })

  // Move the holding to the new unit.
  to.status = from.status
  to.reservedBy = from.reservedBy
  to.bookedFor = from.bookedFor
  to.lockedForCustomer = from.lockedForCustomer
  to.lockedUntil = from.lockedUntil
  to.lockReason = from.lockReason
  to.lockedBy = from.lockedBy
  to.transferHistory.push(entry('in'))
  await to.save()

  // Free the old unit.
  from.status = UNIT_STATUS.AVAILABLE
  from.reservedBy = null
  from.bookedFor = null
  from.lockedForCustomer = null
  from.lockedUntil = null
  from.lockReason = undefined
  from.lockedBy = null
  from.transferHistory.push(entry('out'))
  await from.save()

  // Re-point any active (reserved) booking to the new unit.
  if (booking) { booking.unit = to._id; await booking.save() }

  writeAudit({ req, action: AUDIT_ACTIONS.TRANSFER, module: MODULES.UNIT, targetId: from._id, targetLabel: from.unitNumber, description: `Transferred holding from ${from.unitNumber} to ${to.unitNumber}` })
  return ok(res, { from, to }, `Unit transferred from ${from.unitNumber} to ${to.unitNumber}`)
})

// GET /api/units/:id — full property details page (spec §Property Details).
export const getUnit = asyncHandler(async (req, res) => {
  const unit = await Unit.findOne({ _id: req.params.id, ...firmScope(req.user) })
    .populate({ path: 'project', select: 'name builder', populate: { path: 'builder', select: 'name' } })
    .populate('lockedForCustomer', 'name mobile')
    .populate('bookedFor', 'name mobile')
    .populate('reservedBy', 'name')
    .populate('lockedBy', 'name')
    .lean()
  if (!unit) throw ApiError.notFound('Unit not found')

  const booking = await Booking.findOne({ unit: unit._id, status: { $ne: BOOKING_STATUS.CANCELLED } })
    .populate('customer', 'name mobile').populate('bookedBy', 'name').lean()

  const base = unit.basePrice ?? unit.price ?? 0
  const current = unit.currentPrice ?? base
  const finalPrice = booking?.totalValue ?? Math.round(current * (1 - (unit.discount || 0) / 100))

  // Property timeline: Added → Reserved → Locked → Booked → Registered → Sold.
  const timeline = [{ label: 'Property added', at: unit.createdAt, done: true }]
  if (unit.status === UNIT_STATUS.LOCKED) timeline.push({ label: 'Locked', at: unit.lockedUntil, done: true })
  if (unit.status === UNIT_STATUS.RESERVED || booking) timeline.push({ label: 'Reserved', at: booking?.createdAt, done: true })
  if (booking?.status === BOOKING_STATUS.CONFIRMED) {
    timeline.push({ label: 'Booked', at: booking.createdAt, done: true })
    if (booking.reraVerified) timeline.push({ label: 'Registered', at: booking.updatedAt, done: true })
  }
  if (unit.status === UNIT_STATUS.BOOKED) timeline.push({ label: 'Sold', at: booking?.updatedAt, done: true })

  return ok(res, {
    unit,
    builder: unit.project?.builder || null,
    pricing: { basePrice: base, currentPrice: current, discount: unit.discount || 0, finalPrice },
    booking: booking ? {
      id: booking._id,
      customerName: booking.customer?.name,
      salesExecutive: booking.bookedBy?.name,
      bookingDate: booking.createdAt,
      registrationStatus: booking.reraVerified ? 'completed' : booking.status === BOOKING_STATUS.CONFIRMED ? 'in_progress' : 'pending',
      status: booking.status,
    } : null,
    lock: unit.status === UNIT_STATUS.LOCKED ? {
      lockedByName: unit.lockedBy?.name || null,
      lockedForName: unit.lockedForCustomer?.name || null,
      lockedUntil: unit.lockedUntil,
      lockReason: unit.lockReason,
    } : null,
    timeline,
  }, 'Unit details')
})

export const createUnit = asyncHandler(async (req, res) => {
  const project = await Project.findOne({ _id: req.body.project, ...firmScope(req.user) })
  if (!project) throw ApiError.badRequest('Project not found in your firm')

  const unit = await Unit.create({
    ...req.body,
    firm: req.user.firm,
    status: UNIT_STATUS.AVAILABLE,
    createdBy: req.user._id,
  })
  writeAudit({ req, action: AUDIT_ACTIONS.CREATE, module: MODULES.UNIT, targetId: unit._id, targetLabel: unit.unitNumber, description: `Created unit ${unit.unitNumber}` })
  return created(res, unit, 'Unit created')
})

export const updateUnit = asyncHandler(async (req, res) => {
  // Reassigning the unit's project is only allowed while it isn't held/booked,
  // and only to a project inside the caller's firm.
  if (req.body.project) {
    const current = await Unit.findOne({ _id: req.params.id, ...firmScope(req.user) }).select('status project')
    if (!current) throw ApiError.notFound('Unit not found')
    if (String(current.project) !== String(req.body.project)) {
      if (current.status !== UNIT_STATUS.AVAILABLE) {
        throw ApiError.badRequest('Only an available unit can be moved to another project')
      }
      const proj = await Project.findOne({ _id: req.body.project, ...firmScope(req.user) }).select('_id')
      if (!proj) throw ApiError.badRequest('Selected project is not in your firm')
    }
  }

  const unit = await Unit.findOneAndUpdate(
    { _id: req.params.id, ...firmScope(req.user) },
    req.body,
    { new: true, runValidators: true }
  ).catch((err) => {
    if (err.code === 11000) throw ApiError.conflict('That unit number already exists in the target project')
    throw err
  })
  if (!unit) throw ApiError.notFound('Unit not found')
  writeAudit({ req, action: AUDIT_ACTIONS.UPDATE, module: MODULES.UNIT, targetId: unit._id, targetLabel: unit.unitNumber, description: `Updated unit ${unit.unitNumber}` })
  return ok(res, unit, 'Unit updated')
})

// Bulk create units for a project (e.g. seeding a tower's inventory).
export const bulkCreateUnits = asyncHandler(async (req, res) => {
  const { project, units } = req.body
  const proj = await Project.findOne({ _id: project, ...firmScope(req.user) })
  if (!proj) throw ApiError.badRequest('Project not found in your firm')

  const docs = units.map((u) => ({
    ...u,
    project,
    firm: req.user.firm,
    status: UNIT_STATUS.AVAILABLE,
    createdBy: req.user._id,
  }))
  const createdUnits = await Unit.insertMany(docs, { ordered: false }).catch((err) => {
    // Some rows may duplicate existing unitNumbers — return what succeeded.
    if (err.insertedDocs) return err.insertedDocs
    throw err
  })
  writeAudit({ req, action: AUDIT_ACTIONS.CREATE, module: MODULES.UNIT, targetId: proj._id, description: `Bulk-created ${createdUnits.length} units for ${proj.name}` })
  return created(res, { inserted: createdUnits.length }, `${createdUnits.length} units created`)
})

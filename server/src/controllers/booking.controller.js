import Booking from '../models/Booking.js'
import Unit from '../models/Unit.js'
import Customer from '../models/Customer.js'
import User from '../models/User.js'
import Branch from '../models/Branch.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from '../utils/ApiError.js'
import { ok, created } from '../utils/apiResponse.js'
import { paginate } from '../utils/paginate.js'
import { writeAudit } from '../middleware/audit.js'
import { notify, notifyMany } from '../services/notification.service.js'
import {
  AUDIT_ACTIONS, MODULES, ROLES, UNIT_STATUS, BOOKING_STATUS, CUSTOMER_STATUS, NOTIFICATION_TYPES,
  PAYMENT_STATUS, REGISTRATION_STATUS,
} from '../config/constants.js'
import { ownershipScope, firmScope } from '../middleware/tenantScope.js'
import { resolveCommission } from '../services/commission.service.js'

// Payment status derived from paid-to-date vs the authoritative sale value.
function derivePaymentStatus(paid, total) {
  if (total > 0 && paid >= total) return PAYMENT_STATUS.COMPLETED
  if (paid > 0) return PAYMENT_STATUS.PARTIAL
  return PAYMENT_STATUS.PENDING
}

// The sale value that drives payments & brokerage: discounted final if a
// discount breakdown exists, else the stored totalValue.
function saleValueOf(booking) {
  return booking.discount?.finalSaleAmount || booking.totalValue || 0
}

// GET /api/bookings
export const listBookings = asyncHandler(async (req, res) => {
  const { page, limit, status, pendingRequests } = req.query
  const filter = { ...ownershipScope(req.user, 'bookedBy') }
  if (status) filter.status = status
  // Sub-Admin/Admin approval queue (spec §Approval Flow).
  if (pendingRequests === 'discount') filter['discountRequest.status'] = 'pending'
  if (pendingRequests === 'cancellation') filter['cancellationRequest.status'] = 'pending'
  const { data, meta } = await paginate(Booking, filter, {
    page,
    limit,
    sort: { createdAt: -1 },
    populate: [
      { path: 'customer', select: 'name mobile' },
      { path: 'unit', select: 'unitNumber' },
      { path: 'project', select: 'name' },
      { path: 'builder', select: 'name' },
      { path: 'bookedBy', select: 'name branch' },
    ],
  })
  return ok(res, data, 'Bookings fetched', meta)
})

// Compute the discount breakdown from a raw input (spec §Discount Section).
function computeDiscount(input, fallbackSale = 0) {
  const saleAmount = Number(input.saleAmount) || fallbackSale || 0
  const firmDiscount = Number(input.firmDiscount) || 0
  const builderDiscount = Number(input.builderDiscount) || 0
  const totalDiscount = firmDiscount + builderDiscount
  const finalSaleAmount = Math.max(0, saleAmount - totalDiscount)
  return { saleAmount, firmDiscount, builderDiscount, totalDiscount, finalSaleAmount }
}

export const getBooking = asyncHandler(async (req, res) => {
  const filter = { _id: req.params.id, ...firmScope(req.user) }
  if (req.user.role === ROLES.SALES_EXECUTIVE) filter.bookedBy = req.user._id
  const booking = await Booking.findOne(filter)
    .populate('customer', 'name mobile email address kycStatus propertyType configuration preferredLocation')
    .populate('unit', 'unitNumber unitType configuration propertyType tower floor areaSqft price basePrice')
    .populate({ path: 'project', select: 'name builder propertyType', populate: { path: 'builder', select: 'name' } })
    .populate('builder', 'name')
    .populate('bookedBy', 'name email branch')
    .populate('payments.recordedBy', 'name')
    .populate('documents.uploadedBy', 'name')
    .populate('discountHistory.actor', 'name')
    .lean()
  if (!booking) throw ApiError.notFound('Booking not found')

  // Assigned Sub-Admin (spec §Assigned Team) = the branch manager of the
  // executive who owns the booking.
  let assignedSubAdmin = null
  if (booking.bookedBy?.branch) {
    const branch = await Branch.findOne({ firm: booking.firm, name: booking.bookedBy.branch })
      .populate('adminUser', 'name email')
      .lean()
    assignedSubAdmin = branch?.adminUser || null
  }

  return ok(res, { ...booking, assignedSubAdmin })
})

// POST /api/bookings — CRITICAL: double-booking prevention (§10).
// The unit must be available; the atomic status flip + unique partial index
// guarantee two concurrent bookings can't both succeed.
export const createBooking = asyncHandler(async (req, res) => {
  const {
    customer, project, unit, builder, bookingAmount, paymentMode, totalValue, paymentMilestones,
    appliedDiscount, amountReceived, tokenAmount, reraVerified, bookingSource, bookingDate, notes, draft, discount,
  } = req.body

  // Booking rule: the customer must already exist in the CRM (spec §Business Rules).
  const customerDoc = await Customer.findOne({ _id: customer, ...firmScope(req.user) })
  if (!customerDoc) throw ApiError.notFound('Customer not found')
  if (req.user.role === ROLES.SALES_EXECUTIVE && String(customerDoc.assignedTo) !== String(req.user._id)) {
    throw ApiError.forbidden('Customer is not assigned to you')
  }

  const isDraft = !!draft

  // A submitted booking atomically claims the unit (double-booking block, §10).
  // A draft leaves inventory untouched (employees cannot allocate units).
  let claimed
  if (isDraft) {
    claimed = await Unit.findOne({ _id: unit, firm: req.user.firm }).select('status unitNumber price basePrice currentPrice')
    if (!claimed) throw ApiError.notFound('Unit not found')
  } else {
    claimed = await Unit.findOneAndUpdate(
      { _id: unit, firm: req.user.firm, status: UNIT_STATUS.AVAILABLE },
      { $set: { status: UNIT_STATUS.RESERVED, reservedBy: req.user._id, bookedFor: customer } },
      { new: true }
    )
    if (!claimed) {
      const existing = await Unit.findOne({ _id: unit, firm: req.user.firm }).select('status unitNumber')
      if (!existing) throw ApiError.notFound('Unit not found')
      writeAudit({ req, action: AUDIT_ACTIONS.STATUS_CHANGE, module: MODULES.BOOKING, targetId: unit, description: `Blocked double-booking of unit ${existing.unitNumber}`, success: false })
      throw ApiError.conflict(`Unit ${existing.unitNumber} is already reserved — cannot proceed`)
    }
  }

  const discPct = appliedDiscount || 0
  const baseValue = totalValue || claimed.price || claimed.currentPrice || claimed.basePrice || 0
  const finalValue = Math.round(baseValue * (1 - discPct / 100))
  const commission = await resolveCommission(req.user.firm, project, finalValue)
  const paidNow = tokenAmount ?? amountReceived ?? 0

  let booking
  try {
    booking = await Booking.create({
      firm: req.user.firm,
      customer,
      project,
      builder: builder || undefined,
      unit,
      bookingAmount,
      paymentMode,
      bookingSource: bookingSource || 'direct',
      bookingDate: bookingDate || new Date(),
      notes,
      totalValue: finalValue,
      appliedDiscount: discPct,
      amountReceived: paidNow,
      paymentStatus: derivePaymentStatus(paidNow, finalValue),
      commissionEarned: commission.brokerage,
      commissionRule: commission.ruleId,
      commissionRuleName: commission.ruleName,
      reraVerified: reraVerified || false,
      paymentMilestones: paymentMilestones || [],
      status: isDraft ? BOOKING_STATUS.DRAFT : BOOKING_STATUS.RESERVED,
      bookedBy: req.user._id,
      timeline: [{ type: 'created', note: isDraft ? 'Draft booking created' : 'Booking submitted for approval' }],
    })
  } catch (err) {
    if (!isDraft) await Unit.findByIdAndUpdate(unit, { status: UNIT_STATUS.AVAILABLE, reservedBy: null, bookedFor: null })
    if (err.code === 11000) throw ApiError.conflict('Unit was just booked by someone else')
    throw err
  }

  // Optional discount request captured during creation (spec §Discount Section).
  if (discount && (Number(discount.firmDiscount) || Number(discount.builderDiscount))) {
    if (!discount.remarks || !discount.remarks.trim()) {
      // Non-fatal: keep the booking, but skip an incomplete discount request.
    } else {
      const d = computeDiscount(discount, finalValue)
      booking.discountRequest = {
        status: 'pending', ...d,
        givenBy: discount.givenBy,
        builderSalesExecutive: discount.givenBy === 'builder_sales_executive' ? discount.builderSalesExecutive : undefined,
        source: discount.source,
        remarks: discount.remarks,
        supportingDocument: discount.supportingDocument,
        requestedBy: req.user._id,
        requestedByName: req.user.name,
      }
      booking.timeline.push({ type: 'discount_requested', note: `Discount of ₹${d.totalDiscount} requested` })
      await booking.save()
    }
  }

  customerDoc.logActivity(isDraft ? 'booking_drafted' : 'booking_created', isDraft ? 'Draft booking created' : `Booking submitted for unit ${claimed.unitNumber}`, req.user._id)
  await customerDoc.save()

  // Notify the branch manager that a booking awaits approval.
  if (!isDraft && req.user.manager) {
    notify({
      firm: req.user.firm, recipient: req.user.manager, type: NOTIFICATION_TYPES.BOOKING_COMPLETED,
      title: 'Booking pending approval', message: `${req.user.name} submitted a booking for ${customerDoc.name}`,
      entityType: 'booking', entityId: booking._id,
    })
  }

  writeAudit({ req, action: AUDIT_ACTIONS.CREATE, module: MODULES.BOOKING, targetId: booking._id, targetLabel: customerDoc.name, description: isDraft ? `Drafted booking for ${customerDoc.name}` : `Booked unit ${claimed.unitNumber} for ${customerDoc.name}` })
  return created(res, booking, isDraft ? 'Draft saved' : 'Booking submitted for approval')
})

// POST /api/bookings/:id/submit — submit a draft for approval (spec §Submit
// Booking). Atomically claims the unit and moves the booking to Reserved.
export const submitBooking = asyncHandler(async (req, res) => {
  const booking = await findEditableBooking(req)
  if (booking.status !== BOOKING_STATUS.DRAFT) throw ApiError.badRequest('Only a draft booking can be submitted')

  const claimed = await Unit.findOneAndUpdate(
    { _id: booking.unit, firm: req.user.firm, status: UNIT_STATUS.AVAILABLE },
    { $set: { status: UNIT_STATUS.RESERVED, reservedBy: req.user._id, bookedFor: booking.customer } },
    { new: true }
  )
  if (!claimed) {
    const existing = await Unit.findOne({ _id: booking.unit, firm: req.user.firm }).select('unitNumber')
    throw ApiError.conflict(`Unit ${existing?.unitNumber || ''} is no longer available — cannot submit`)
  }

  booking.status = BOOKING_STATUS.RESERVED
  booking.timeline.push({ type: 'submitted', note: 'Booking submitted for approval' })
  await booking.save()

  const customer = await Customer.findById(booking.customer)
  customer?.logActivity('booking_created', `Booking submitted for unit ${claimed.unitNumber}`, req.user._id)
  await customer?.save()

  if (req.user.manager) {
    notify({ firm: booking.firm, recipient: req.user.manager, type: NOTIFICATION_TYPES.BOOKING_COMPLETED, title: 'Booking pending approval', message: `${req.user.name} submitted a booking`, entityType: 'booking', entityId: booking._id })
  }
  writeAudit({ req, action: AUDIT_ACTIONS.STATUS_CHANGE, module: MODULES.BOOKING, targetId: booking._id, description: 'Draft submitted for approval' })
  return ok(res, booking, 'Booking submitted for approval')
})

// PATCH /api/bookings/:id/status — Reserved → Confirmed → Cancelled (§6).
export const updateBookingStatus = asyncHandler(async (req, res) => {
  const filter = { _id: req.params.id, ...firmScope(req.user) }
  if (req.user.role === ROLES.SALES_EXECUTIVE) filter.bookedBy = req.user._id
  const booking = await Booking.findOne(filter)
  if (!booking) throw ApiError.notFound('Booking not found')

  const { status, cancelReason } = req.body
  const prev = booking.status
  booking.status = status
  if (status === BOOKING_STATUS.CANCELLED) booking.cancelReason = cancelReason
  await booking.save()

  // Reflect the change on the unit + customer.
  if (status === BOOKING_STATUS.CONFIRMED || status === BOOKING_STATUS.SALE_COMPLETED) {
    await Unit.findByIdAndUpdate(booking.unit, { status: UNIT_STATUS.BOOKED })
    await Customer.findByIdAndUpdate(booking.customer, { status: CUSTOMER_STATUS.BOOKED })
  } else if (status === BOOKING_STATUS.CANCELLED) {
    // Free the unit back to available.
    await Unit.findByIdAndUpdate(booking.unit, { status: UNIT_STATUS.AVAILABLE, reservedBy: null, bookedFor: null })
  }

  // On completion (confirmed), notify executive + sub-admins + admin (§9).
  if (status === BOOKING_STATUS.CONFIRMED) {
    const staff = await User.find({
      firm: booking.firm,
      role: { $in: [ROLES.SUB_ADMIN, ROLES.ADMIN] },
      isActive: true,
    }).select('_id')
    notifyMany([booking.bookedBy, ...staff.map((s) => s._id)], {
      firm: booking.firm,
      type: NOTIFICATION_TYPES.BOOKING_COMPLETED,
      title: 'Booking confirmed',
      message: 'A booking has been confirmed',
      entityType: 'booking',
      entityId: booking._id,
    })
    const customer = await Customer.findById(booking.customer)
    customer?.logActivity('booking_confirmed', 'Booking confirmed', req.user._id)
    await customer?.save()
  }

  writeAudit({ req, action: AUDIT_ACTIONS.STATUS_CHANGE, module: MODULES.BOOKING, targetId: booking._id, description: `Booking ${prev} → ${status}` })
  return ok(res, booking, `Booking ${status}`)
})

// PATCH /api/bookings/:id/milestones/:milestoneId — mark a payment paid.
export const setMilestonePaid = asyncHandler(async (req, res) => {
  const filter = { _id: req.params.id, ...firmScope(req.user) }
  if (req.user.role === ROLES.SALES_EXECUTIVE) filter.bookedBy = req.user._id
  const booking = await Booking.findOne(filter)
  if (!booking) throw ApiError.notFound('Booking not found')

  const milestone = booking.paymentMilestones.id(req.params.milestoneId)
  if (!milestone) throw ApiError.notFound('Milestone not found')
  milestone.paid = req.body.paid
  milestone.paidDate = req.body.paid ? new Date() : undefined
  await booking.save()
  return ok(res, booking, 'Milestone updated')
})

// Load a firm-scoped booking the caller may act on (executives: own only).
async function findEditableBooking(req) {
  const filter = { _id: req.params.id, ...firmScope(req.user) }
  if (req.user.role === ROLES.SALES_EXECUTIVE) filter.bookedBy = req.user._id
  const booking = await Booking.findOne(filter)
  if (!booking) throw ApiError.notFound('Booking not found')
  return booking
}

// PATCH /api/bookings/:id/transfer — reassign a booking to another executive
// (spec §Booking Transfer, Sub-Admin/Admin only). Records transfer history.
export const transferBooking = asyncHandler(async (req, res) => {
  const booking = await findEditableBooking(req)
  const { newExecutive, reason } = req.body

  const target = await User.findOne({ _id: newExecutive, firm: req.user.firm, role: ROLES.SALES_EXECUTIVE, isActive: true }).select('name')
  if (!target) throw ApiError.badRequest('Select an active sales executive')
  if (String(booking.bookedBy) === String(target._id)) throw ApiError.badRequest('Booking is already with that executive')

  const prev = await User.findById(booking.bookedBy).select('name')
  booking.transferHistory.push({
    previousExecutive: booking.bookedBy,
    previousExecutiveName: prev?.name || '—',
    newExecutive: target._id,
    newExecutiveName: target.name,
    transferredBy: req.user._id,
    transferredByName: req.user.name,
    reason,
  })
  booking.bookedBy = target._id
  await booking.save()

  notify({
    firm: booking.firm,
    recipient: target._id,
    type: NOTIFICATION_TYPES.BOOKING_COMPLETED,
    title: 'Booking transferred to you',
    message: 'A booking has been transferred to you',
    entityType: 'booking',
    entityId: booking._id,
  })
  writeAudit({ req, action: AUDIT_ACTIONS.TRANSFER, module: MODULES.BOOKING, targetId: booking._id, description: `Booking transferred to ${target.name}` })
  return ok(res, booking, 'Booking transferred')
})

// PATCH /api/bookings/:id — edit booking fields (spec §Edit / §Edit Draft
// Bookings). Employees can only edit their own drafts; inventory-affecting fields
// (project/unit) are editable while still a draft.
export const updateBooking = asyncHandler(async (req, res) => {
  const booking = await findEditableBooking(req)
  const isExec = req.user.role === ROLES.SALES_EXECUTIVE
  if (isExec && booking.status !== BOOKING_STATUS.DRAFT) {
    throw ApiError.badRequest('Only draft bookings can be edited. Use Record Payment or Request Discount instead.')
  }
  const { bookingSource, paymentMode, bookingAmount, bookingDate, notes, tokenAmount, project, unit } = req.body
  if (bookingSource !== undefined) booking.bookingSource = bookingSource
  if (paymentMode !== undefined) booking.paymentMode = paymentMode
  if (bookingAmount !== undefined) booking.bookingAmount = bookingAmount
  if (bookingDate !== undefined) booking.bookingDate = bookingDate
  if (notes !== undefined) booking.notes = notes
  if (tokenAmount !== undefined) booking.amountReceived = tokenAmount
  // Project/unit can only be swapped on a draft (no live reservation held).
  if (booking.status === BOOKING_STATUS.DRAFT) {
    if (project !== undefined) booking.project = project
    if (unit !== undefined) booking.unit = unit
  }
  booking.paymentStatus = derivePaymentStatus(booking.amountReceived, saleValueOf(booking))
  booking.timeline.push({ type: 'updated', note: 'Booking details updated' })
  await booking.save()
  writeAudit({ req, action: AUDIT_ACTIONS.UPDATE, module: MODULES.BOOKING, targetId: booking._id, description: 'Booking details updated' })
  return ok(res, booking, 'Booking updated')
})

// POST /api/bookings/:id/discount-request — employee raises a discount request
// (spec §Request Discount). Stored pending until a Sub-Admin/Admin approves.
export const requestDiscount = asyncHandler(async (req, res) => {
  const booking = await findEditableBooking(req)
  if (booking.discountRequest?.status === 'pending') throw ApiError.conflict('A discount request is already pending on this booking')
  const b = req.body
  if (!b.remarks || !b.remarks.trim()) throw ApiError.badRequest('Discount remarks are mandatory')
  const d = computeDiscount(b, saleValueOf(booking))

  booking.discountRequest = {
    status: 'pending', ...d,
    givenBy: b.givenBy,
    builderSalesExecutive: b.givenBy === 'builder_sales_executive' ? b.builderSalesExecutive : undefined,
    source: b.source,
    remarks: b.remarks,
    supportingDocument: b.supportingDocument,
    requestedBy: req.user._id,
    requestedByName: req.user.name,
  }
  booking.timeline.push({ type: 'discount_requested', note: `Discount of ₹${d.totalDiscount} requested` })
  await booking.save()

  await Customer.updateOne({ _id: booking.customer }, { $push: { activity: { action: 'discount_requested', description: `Discount of ₹${d.totalDiscount} requested on booking`, actor: req.user._id, at: new Date() } } })
  if (req.user.manager) notify({ firm: booking.firm, recipient: req.user.manager, type: NOTIFICATION_TYPES.BOOKING_COMPLETED, title: 'Discount approval requested', message: `${req.user.name} requested a discount`, entityType: 'booking', entityId: booking._id })
  writeAudit({ req, action: AUDIT_ACTIONS.UPDATE, module: MODULES.BOOKING, targetId: booking._id, description: `Requested discount (₹${d.totalDiscount})` })
  return ok(res, booking, 'Discount request submitted for approval')
})

// PATCH /api/bookings/:id/discount-request — Sub-Admin/Admin approve/reject
// (spec §Approval Flow · Employees cannot approve discounts).
export const decideDiscountRequest = asyncHandler(async (req, res) => {
  const booking = await Booking.findOne({ _id: req.params.id, ...firmScope(req.user) })
  if (!booking) throw ApiError.notFound('Booking not found')
  if (booking.discountRequest?.status !== 'pending') throw ApiError.badRequest('No pending discount request')
  const { decision, note } = req.body
  const dr = booking.discountRequest

  dr.decidedBy = req.user._id
  dr.decidedByName = req.user.name
  dr.decidedAt = new Date()
  dr.decisionNote = note

  if (decision === 'approve') {
    dr.status = 'approved'
    // Apply the discount to the live booking + recompute brokerage/payment.
    booking.discount = {
      saleAmount: dr.saleAmount, givenBy: dr.givenBy, builderSalesExecutive: dr.builderSalesExecutive, source: dr.source,
      firmDiscount: dr.firmDiscount, builderDiscount: dr.builderDiscount, totalDiscount: dr.totalDiscount,
      finalSaleAmount: dr.finalSaleAmount, remarks: dr.remarks, supportingDocument: dr.supportingDocument,
      updatedBy: req.user._id, updatedAt: new Date(),
    }
    booking.totalValue = dr.finalSaleAmount
    booking.appliedDiscount = dr.saleAmount > 0 ? Number(((dr.totalDiscount / dr.saleAmount) * 100).toFixed(2)) : 0
    const commission = await resolveCommission(booking.firm, booking.project, dr.finalSaleAmount)
    booking.commissionEarned = commission.brokerage
    booking.commissionRule = commission.ruleId
    booking.commissionRuleName = commission.ruleName
    booking.paymentStatus = derivePaymentStatus(booking.amountReceived, dr.finalSaleAmount)
    booking.discountHistory.push({
      action: 'added', actor: req.user._id, actorName: req.user.name,
      givenBy: dr.givenBy, builderSalesExecutive: dr.builderSalesExecutive, source: dr.source,
      saleAmount: dr.saleAmount, firmDiscount: dr.firmDiscount, builderDiscount: dr.builderDiscount,
      totalDiscount: dr.totalDiscount, finalSaleAmount: dr.finalSaleAmount, remarks: dr.remarks,
      updatedValue: { totalDiscount: dr.totalDiscount, finalSaleAmount: dr.finalSaleAmount },
    })
    booking.timeline.push({ type: 'discount_approved', note: `Discount of ₹${dr.totalDiscount} approved` })
  } else {
    dr.status = 'rejected'
    booking.timeline.push({ type: 'discount_rejected', note: 'Discount request rejected' })
  }
  await booking.save()

  notify({ firm: booking.firm, recipient: dr.requestedBy, type: NOTIFICATION_TYPES.BOOKING_COMPLETED, title: `Discount ${dr.status}`, message: `Your discount request was ${dr.status}`, entityType: 'booking', entityId: booking._id })
  writeAudit({ req, action: AUDIT_ACTIONS.UPDATE, module: MODULES.BOOKING, targetId: booking._id, description: `Discount request ${dr.status}` })
  return ok(res, booking, `Discount request ${dr.status}`)
})

// POST /api/bookings/:id/cancellation-request — employee requests cancellation
// (spec §Request Booking Cancellation). Employees cannot cancel directly.
export const requestCancellation = asyncHandler(async (req, res) => {
  const booking = await findEditableBooking(req)
  if ([BOOKING_STATUS.CANCELLED, BOOKING_STATUS.DRAFT].includes(booking.status)) throw ApiError.badRequest('This booking cannot be cancelled')
  if (booking.cancellationRequest?.status === 'pending') throw ApiError.conflict('A cancellation request is already pending')

  booking.cancellationRequest = {
    status: 'pending', reason: req.body.reason, remarks: req.body.remarks,
    requestedBy: req.user._id, requestedByName: req.user.name,
  }
  booking.timeline.push({ type: 'cancellation_requested', note: req.body.reason })
  await booking.save()

  await Customer.updateOne({ _id: booking.customer }, { $push: { activity: { action: 'cancellation_requested', description: `Booking cancellation requested: ${req.body.reason}`, actor: req.user._id, at: new Date() } } })
  if (req.user.manager) notify({ firm: booking.firm, recipient: req.user.manager, type: NOTIFICATION_TYPES.BOOKING_COMPLETED, title: 'Cancellation approval requested', message: `${req.user.name} requested a booking cancellation`, entityType: 'booking', entityId: booking._id })
  writeAudit({ req, action: AUDIT_ACTIONS.UPDATE, module: MODULES.BOOKING, targetId: booking._id, description: 'Requested booking cancellation' })
  return ok(res, booking, 'Cancellation request submitted for approval')
})

// PATCH /api/bookings/:id/cancellation-request — Sub-Admin/Admin approve/reject.
export const decideCancellation = asyncHandler(async (req, res) => {
  const booking = await Booking.findOne({ _id: req.params.id, ...firmScope(req.user) })
  if (!booking) throw ApiError.notFound('Booking not found')
  if (booking.cancellationRequest?.status !== 'pending') throw ApiError.badRequest('No pending cancellation request')
  const { decision, note } = req.body
  const cr = booking.cancellationRequest

  cr.decidedBy = req.user._id
  cr.decidedByName = req.user.name
  cr.decidedAt = new Date()
  cr.decisionNote = note

  if (decision === 'approve') {
    cr.status = 'approved'
    booking.status = BOOKING_STATUS.CANCELLED
    booking.cancelReason = cr.reason
    booking.timeline.push({ type: 'cancelled', note: `Cancellation approved: ${cr.reason}` })
    await Unit.findByIdAndUpdate(booking.unit, { status: UNIT_STATUS.AVAILABLE, reservedBy: null, bookedFor: null })
    const customer = await Customer.findById(booking.customer)
    customer?.logActivity('booking_cancelled', `Booking cancelled: ${cr.reason}`, req.user._id)
    await customer?.save()
  } else {
    cr.status = 'rejected'
    booking.timeline.push({ type: 'cancellation_rejected', note: 'Cancellation request rejected' })
  }
  await booking.save()

  notify({ firm: booking.firm, recipient: cr.requestedBy, type: NOTIFICATION_TYPES.BOOKING_COMPLETED, title: `Cancellation ${cr.status}`, message: `Your cancellation request was ${cr.status}`, entityType: 'booking', entityId: booking._id })
  writeAudit({ req, action: AUDIT_ACTIONS.STATUS_CHANGE, module: MODULES.BOOKING, targetId: booking._id, description: `Cancellation request ${cr.status}` })
  return ok(res, booking, `Cancellation request ${cr.status}`)
})

// POST /api/bookings/:id/documents — upload a booking document (spec §Documents).
export const addBookingDocument = asyncHandler(async (req, res) => {
  const booking = await findEditableBooking(req)
  if (!req.file) throw ApiError.badRequest('No file uploaded')
  const doc = {
    label: req.body.label || req.file.originalname,
    category: req.body.category || 'other',
    fileName: req.file.originalname,
    fileUrl: `/uploads/${req.file.filename}`,
    uploadedBy: req.user._id,
  }
  booking.documents.push(doc)
  booking.timeline.push({ type: 'document_uploaded', note: doc.label })
  await booking.save()
  await Customer.updateOne({ _id: booking.customer }, { $push: { activity: { action: 'document_uploaded', description: `Booking document uploaded: ${doc.label}`, actor: req.user._id, at: new Date() } } })
  writeAudit({ req, action: AUDIT_ACTIONS.UPDATE, module: MODULES.BOOKING, targetId: booking._id, description: `Uploaded document ${doc.label}` })
  return created(res, booking.documents.at(-1), 'Document uploaded')
})

// PATCH /api/bookings/:id/discount — set or update the discount breakdown
// (spec §Discount Information). Recomputes sale value + brokerage and appends a
// Discount History entry with previous/updated values on edits.
export const updateDiscount = asyncHandler(async (req, res) => {
  const booking = await findEditableBooking(req)
  const b = req.body

  const saleAmount = Number(b.saleAmount) || booking.totalValue || 0
  const firmDiscount = Number(b.firmDiscount) || 0
  const builderDiscount = Number(b.builderDiscount) || 0
  const totalDiscount = firmDiscount + builderDiscount
  const finalSaleAmount = Math.max(0, saleAmount - totalDiscount)

  const prev = booking.discount ? booking.discount.toObject() : null
  const isUpdate = !!prev

  booking.discount = {
    saleAmount,
    givenBy: b.givenBy,
    builderSalesExecutive: b.givenBy === 'builder_sales_executive' ? b.builderSalesExecutive : undefined,
    source: b.source,
    firmDiscount,
    builderDiscount,
    totalDiscount,
    finalSaleAmount,
    remarks: b.remarks,
    supportingDocument: b.supportingDocument,
    updatedBy: req.user._id,
    updatedAt: new Date(),
  }

  // Reflect into the authoritative sale value + brokerage accrual (re-detects
  // the applicable commission rule on the new final value).
  booking.totalValue = finalSaleAmount
  booking.appliedDiscount = saleAmount > 0 ? Number(((totalDiscount / saleAmount) * 100).toFixed(2)) : 0
  const commission = await resolveCommission(booking.firm, booking.project, finalSaleAmount)
  booking.commissionEarned = commission.brokerage
  booking.commissionRule = commission.ruleId
  booking.commissionRuleName = commission.ruleName
  booking.paymentStatus = derivePaymentStatus(booking.amountReceived, finalSaleAmount)

  booking.discountHistory.push({
    action: isUpdate ? 'updated' : 'added',
    actor: req.user._id,
    actorName: req.user.name,
    givenBy: b.givenBy,
    builderSalesExecutive: b.builderSalesExecutive,
    source: b.source,
    saleAmount,
    firmDiscount,
    builderDiscount,
    totalDiscount,
    finalSaleAmount,
    remarks: b.remarks,
    previousValue: prev
      ? { firmDiscount: prev.firmDiscount, builderDiscount: prev.builderDiscount, totalDiscount: prev.totalDiscount, finalSaleAmount: prev.finalSaleAmount }
      : undefined,
    updatedValue: { firmDiscount, builderDiscount, totalDiscount, finalSaleAmount },
  })

  await booking.save()
  writeAudit({ req, action: AUDIT_ACTIONS.UPDATE, module: MODULES.BOOKING, targetId: booking._id, description: `Discount ${isUpdate ? 'updated' : 'applied'} (₹${totalDiscount})` })
  return ok(res, booking, 'Discount saved')
})

// DELETE /api/bookings/:id/discount — remove the discount, restoring the base
// sale value + brokerage and recording the removal in Discount History.
export const removeDiscount = asyncHandler(async (req, res) => {
  const booking = await findEditableBooking(req)
  if (!booking.discount) throw ApiError.badRequest('No discount to remove')

  const prev = booking.discount.toObject()
  const restore = prev.saleAmount || booking.totalValue || 0

  booking.discountHistory.push({
    action: 'removed',
    actor: req.user._id,
    actorName: req.user.name,
    saleAmount: prev.saleAmount,
    firmDiscount: prev.firmDiscount,
    builderDiscount: prev.builderDiscount,
    totalDiscount: prev.totalDiscount,
    finalSaleAmount: restore,
    previousValue: { totalDiscount: prev.totalDiscount, finalSaleAmount: prev.finalSaleAmount },
    updatedValue: { totalDiscount: 0, finalSaleAmount: restore },
  })

  booking.set('discount', undefined)
  booking.totalValue = restore
  booking.appliedDiscount = 0
  const commission = await resolveCommission(booking.firm, booking.project, restore)
  booking.commissionEarned = commission.brokerage
  booking.commissionRule = commission.ruleId
  booking.commissionRuleName = commission.ruleName
  booking.paymentStatus = derivePaymentStatus(booking.amountReceived, restore)

  await booking.save()
  writeAudit({ req, action: AUDIT_ACTIONS.UPDATE, module: MODULES.BOOKING, targetId: booking._id, description: 'Discount removed' })
  return ok(res, booking, 'Discount removed')
})

// POST /api/bookings/:id/payments — record a payment entry (spec §Payment Info).
export const addPayment = asyncHandler(async (req, res) => {
  const booking = await findEditableBooking(req)
  const { date, amount, mode, reference, receiptNumber, receiptUrl, remarks } = req.body

  booking.payments.push({ date, amount, mode, reference, receiptNumber, receiptUrl, remarks, recordedBy: req.user._id })
  booking.amountReceived = (booking.amountReceived || 0) + Number(amount)
  booking.paymentStatus = derivePaymentStatus(booking.amountReceived, saleValueOf(booking))
  booking.timeline.push({ type: 'payment_recorded', note: `Payment of ₹${amount} recorded` })

  await booking.save()
  await Customer.updateOne({ _id: booking.customer }, { $push: { activity: { action: 'payment_recorded', description: `Payment of ₹${amount} recorded on booking`, actor: req.user._id, at: new Date() } } })
  writeAudit({ req, action: AUDIT_ACTIONS.UPDATE, module: MODULES.BOOKING, targetId: booking._id, description: `Payment recorded (₹${amount})` })
  return ok(res, booking, 'Payment recorded')
})

// PATCH /api/bookings/:id/registration — update registration progress kept inside
// the booking. Completing it on a confirmed booking marks the sale complete.
export const updateRegistration = asyncHandler(async (req, res) => {
  const booking = await findEditableBooking(req)
  const { registrationStatus, registrationDate, agreementNumber, registrationRemarks } = req.body

  if (registrationStatus !== undefined) booking.registrationStatus = registrationStatus
  if (registrationDate !== undefined) booking.registrationDate = registrationDate || null
  if (agreementNumber !== undefined) booking.agreementNumber = agreementNumber
  if (registrationRemarks !== undefined) booking.registrationRemarks = registrationRemarks

  if (booking.registrationStatus === REGISTRATION_STATUS.COMPLETED && booking.status === BOOKING_STATUS.CONFIRMED) {
    booking.status = BOOKING_STATUS.SALE_COMPLETED
    if (!booking.registrationDate) booking.registrationDate = new Date()
  }

  await booking.save()
  writeAudit({ req, action: AUDIT_ACTIONS.STATUS_CHANGE, module: MODULES.BOOKING, targetId: booking._id, description: `Registration → ${booking.registrationStatus}` })
  return ok(res, booking, 'Registration updated')
})

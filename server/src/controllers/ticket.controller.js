import Ticket from '../models/Ticket.js'
import TicketCategory from '../models/TicketCategory.js'
import SupportMember from '../models/SupportMember.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from '../utils/ApiError.js'
import { ok, created } from '../utils/apiResponse.js'
import { ROLES, AUDIT_ACTIONS } from '../config/constants.js'
import { writeAudit } from '../middleware/audit.js'

// --- Categories ---

export const getCategories = asyncHandler(async (req, res) => {
  const categories = await TicketCategory.find().sort({ createdAt: -1 }).lean()
  return ok(res, categories, 'Categories fetched')
})

export const createCategory = asyncHandler(async (req, res) => {
  const { name } = req.body
  if (!name || !name.trim()) throw ApiError.badRequest('Category name is required')
  const cleanName = name.trim()
  const exists = await TicketCategory.findOne({ name: { $regex: new RegExp(`^${cleanName}$`, 'i') } })
  if (exists) throw ApiError.conflict('Category name already exists')
  const category = await TicketCategory.create({ name: cleanName })
  writeAudit({
    req,
    action: AUDIT_ACTIONS.CREATE,
    module: 'ticket_category',
    targetId: category._id,
    targetLabel: category.name,
    description: `Ticket category "${category.name}" created by ${req.user.name} (${req.user.role})`,
  })
  return created(res, category, 'Category created')
})

export const updateCategory = asyncHandler(async (req, res) => {
  const { name } = req.body
  if (!name || !name.trim()) throw ApiError.badRequest('Category name is required')
  const cleanName = name.trim()
  const exists = await TicketCategory.findOne({
    _id: { $ne: req.params.id },
    name: { $regex: new RegExp(`^${cleanName}$`, 'i') },
  })
  if (exists) throw ApiError.conflict('Category name already exists')
  const category = await TicketCategory.findByIdAndUpdate(req.params.id, { name: cleanName }, { new: true })
  if (!category) throw ApiError.notFound('Category not found')
  writeAudit({
    req,
    action: AUDIT_ACTIONS.UPDATE,
    module: 'ticket_category',
    targetId: category._id,
    targetLabel: category.name,
    description: `Ticket category updated to "${category.name}" by ${req.user.name}`,
  })
  return ok(res, category, 'Category updated')
})

export const toggleCategory = asyncHandler(async (req, res) => {
  const { isActive } = req.body
  const category = await TicketCategory.findByIdAndUpdate(req.params.id, { isActive }, { new: true })
  if (!category) throw ApiError.notFound('Category not found')
  return ok(res, category, 'Category toggled')
})

export const deleteCategory = asyncHandler(async (req, res) => {
  const category = await TicketCategory.findById(req.params.id)
  if (!category) throw ApiError.notFound('Category not found')

  // Unlink category from any tickets currently assigned to it so tickets are not lost
  await Ticket.updateMany({ category: category._id }, { $unset: { category: 1 } })

  await TicketCategory.findByIdAndDelete(category._id)
  writeAudit({
    req,
    action: AUDIT_ACTIONS.DELETE,
    module: 'ticket_category',
    targetId: category._id,
    targetLabel: category.name,
    description: `Ticket category "${category.name}" deleted by ${req.user.name} (${req.user.role})`,
  })
  return ok(res, null, 'Category deleted successfully')
})

// --- Support Members ---

export const listMembers = asyncHandler(async (req, res) => {
  const members = await SupportMember.find().sort({ createdAt: -1 }).lean()
  return ok(res, members, 'Support members fetched')
})

export const createMember = asyncHandler(async (req, res) => {
  const { name, role, email, mobile } = req.body
  const exists = await SupportMember.findOne({ email })
  if (exists) throw ApiError.conflict('Member email already exists')
  const member = await SupportMember.create({ name, role, email, mobile })
  return created(res, member, 'Member created')
})

export const updateMember = asyncHandler(async (req, res) => {
  const { name, role, email, mobile } = req.body
  const member = await SupportMember.findByIdAndUpdate(req.params.id, { name, role, email, mobile }, { new: true })
  if (!member) throw ApiError.notFound('Member not found')
  return ok(res, member, 'Member updated')
})

export const deactivateMember = asyncHandler(async (req, res) => {
  const member = await SupportMember.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true })
  if (!member) throw ApiError.notFound('Member not found')
  return ok(res, member, 'Member deactivated')
})

export const toggleMemberStatus = asyncHandler(async (req, res) => {
  const { isActive } = req.body
  const member = await SupportMember.findByIdAndUpdate(req.params.id, { isActive }, { new: true })
  if (!member) throw ApiError.notFound('Member not found')
  return ok(res, member, `Member ${isActive ? 'activated' : 'deactivated'}`)
})

// --- Tickets ---

// Non-super-admins are scoped to their own firm's tickets.
const firmScope = (req) => (req.user.role === ROLES.SUPER_ADMIN ? {} : { firm: req.user.firm })

export const listTickets = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, search, status, priority, category, firm, assignedTo } = req.query

  const filter = { ...firmScope(req) }

  if (search) {
    filter.$or = [
      { ticketId: { $regex: search, $options: 'i' } },
      { subject: { $regex: search, $options: 'i' } }
    ]
  }

  if (status && status !== 'all') filter.status = status
  if (priority && priority !== 'all') filter.priority = priority
  if (category && category !== 'all') filter.category = category
  // Super Admin may filter by any firm; others are already firm-locked above.
  if (req.user.role === ROLES.SUPER_ADMIN && firm && firm !== 'all') filter.firm = firm
  if (assignedTo && assignedTo !== 'all') filter.assignedTo = assignedTo

  // KPIs (scoped to the same firm filter as the list).
  const kpisData = await Ticket.aggregate([
    { $match: { ...firmScope(req) } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        open: { $sum: { $cond: [{ $eq: ['$status', 'Open'] }, 1, 0] } },
        inProgress: { $sum: { $cond: [{ $eq: ['$status', 'In Progress'] }, 1, 0] } },
        resolved: { $sum: { $cond: [{ $eq: ['$status', 'Resolved'] }, 1, 0] } },
        closed: { $sum: { $cond: [{ $eq: ['$status', 'Closed'] }, 1, 0] } },
      }
    }
  ])
  const kpis = kpisData[0] || { total: 0, open: 0, inProgress: 0, resolved: 0, closed: 0 }

  const [items, total] = await Promise.all([
    Ticket.find(filter)
      .populate('firm', 'name companyId')
      .populate('category', 'name')
      .populate('assignedTo', 'name email')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .lean(),
    Ticket.countDocuments(filter)
  ])

  // If search matches firm name, we might miss some since firm is populated after find.
  // We'd ideally do an aggregation or simple separate query for firm names, but for a simple V1 this is ok.
  // Let's refine search to include firm name search if possible.
  
  return ok(res, items, 'Tickets fetched', {
    page: Number(page),
    limit: Number(limit),
    total,
    pages: Math.ceil(total / limit),
    kpis
  })
})

// Scope a single-ticket operation to the caller's firm (Super Admin: any).
const ownFilter = (req) => ({ _id: req.params.id, ...firmScope(req) })

export const getTicket = asyncHandler(async (req, res) => {
  const ticket = await Ticket.findOne(ownFilter(req))
    .populate('firm', 'name companyId contactEmail contactPhone region')
    .populate('category', 'name')
    .populate('assignedTo', 'name email')
    .populate('resolvedBy', 'name role')
    .populate('closedBy', 'name role')
    .populate('reopenedBy', 'name role')
    .populate('internalNotes.addedBy', 'name role')
    .lean()

  if (!ticket) throw ApiError.notFound('Ticket not found')
  return ok(res, ticket)
})

export const createTicket = asyncHandler(async (req, res) => {
  // Non-super users always file under their own firm; Super Admin passes firm explicitly.
  const firm = req.user.role === ROLES.SUPER_ADMIN ? req.body.firm : req.user.firm
  if (!firm) throw ApiError.badRequest('A firm is required to create a ticket')
  if (!req.body.category) throw ApiError.badRequest('Category is required to create a ticket')
  const ticket = await Ticket.create({ ...req.body, firm, createdBy: req.user._id })
  return created(res, ticket, 'Ticket created')
})

export const updateTicket = asyncHandler(async (req, res) => {
  const ticket = await Ticket.findOneAndUpdate(ownFilter(req), req.body, { new: true })
  if (!ticket) throw ApiError.notFound('Ticket not found')
  return ok(res, ticket, 'Ticket updated')
})

export const changeTicketStatus = asyncHandler(async (req, res) => {
  const { status, remark, note } = req.body
  if (!status) throw ApiError.badRequest('Status is required')

  const validStatuses = ['Open', 'In Progress', 'Waiting for Customer', 'Resolved', 'Closed']
  if (!validStatuses.includes(status)) {
    throw ApiError.badRequest(`Invalid status. Must be one of: ${validStatuses.join(', ')}`)
  }

  const resolutionText = (remark || note || '').trim()

  const ticket = await Ticket.findOne(ownFilter(req))
  if (!ticket) throw ApiError.notFound('Ticket not found')

  const previousStatus = ticket.status
  const isReopening = (previousStatus === 'Resolved' || previousStatus === 'Closed') && (status === 'Open' || status === 'In Progress')

  if ((status === 'Resolved' || status === 'Closed') && !resolutionText) {
    throw ApiError.badRequest(`A mandatory description/remark is required when marking a ticket as ${status}`)
  }

  if (isReopening && !resolutionText) {
    throw ApiError.badRequest('A mandatory description/remark is required when reopening a ticket')
  }

  ticket.status = status

  if (isReopening) {
    ticket.reopenedAt = new Date()
    ticket.reopenedBy = req.user._id
    ticket.reopenReason = resolutionText
    ticket.resolvedAt = undefined
    ticket.resolvedBy = undefined
    ticket.closedAt = undefined
    ticket.closedBy = undefined
    ticket.internalNotes.push({
      note: `[Reopened from ${previousStatus}] ${resolutionText}`,
      addedBy: req.user._id,
      createdAt: new Date(),
    })
  } else if (status === 'Resolved') {
    ticket.resolutionNote = resolutionText
    ticket.resolvedAt = new Date()
    ticket.resolvedBy = req.user._id
    ticket.internalNotes.push({
      note: `[Resolved] ${resolutionText}`,
      addedBy: req.user._id,
      createdAt: new Date(),
    })
  } else if (status === 'Closed') {
    ticket.closedAt = new Date()
    ticket.closedBy = req.user._id
    if (!ticket.resolutionNote) {
      ticket.resolutionNote = resolutionText
    }
    ticket.internalNotes.push({
      note: `[Closed] ${resolutionText}`,
      addedBy: req.user._id,
      createdAt: new Date(),
    })
  } else if (resolutionText) {
    ticket.internalNotes.push({
      note: `[Status changed to ${status}] ${resolutionText}`,
      addedBy: req.user._id,
      createdAt: new Date(),
    })
  }

  await ticket.save()

  writeAudit({
    req,
    action: AUDIT_ACTIONS.STATUS_CHANGE,
    module: 'ticket',
    targetId: ticket._id,
    targetLabel: ticket.ticketId,
    description: isReopening
      ? `Ticket ${ticket.ticketId} reopened from ${previousStatus} to ${status}: ${resolutionText}`
      : `Ticket ${ticket.ticketId} status changed from ${previousStatus} to ${status}${resolutionText ? `: ${resolutionText}` : ''}`,
  })

  const populated = await Ticket.findById(ticket._id)
    .populate('firm', 'name companyId contactEmail contactPhone region')
    .populate('category', 'name')
    .populate('assignedTo', 'name email')
    .populate('resolvedBy', 'name role')
    .populate('closedBy', 'name role')
    .populate('reopenedBy', 'name role')
    .populate('internalNotes.addedBy', 'name role')
    .lean()

  return ok(res, populated, `Ticket status changed to ${status}`)
})

export const assignTicket = asyncHandler(async (req, res) => {
  const { assignedTo } = req.body
  const ticket = await Ticket.findOneAndUpdate(ownFilter(req), { assignedTo }, { new: true }).populate('assignedTo', 'name email')
  if (!ticket) throw ApiError.notFound('Ticket not found')
  return ok(res, ticket, 'Ticket assigned')
})

export const addInternalNote = asyncHandler(async (req, res) => {
  const { note } = req.body
  const ticket = await Ticket.findOneAndUpdate(
    ownFilter(req),
    { $push: { internalNotes: { note, addedBy: req.user._id } } },
    { new: true }
  ).populate('internalNotes.addedBy', 'name role')
  if (!ticket) throw ApiError.notFound('Ticket not found')
  return ok(res, ticket, 'Internal note added')
})

export const deleteTicket = asyncHandler(async (req, res) => {
  const ticket = await Ticket.findOne(ownFilter(req))
  if (!ticket) throw ApiError.notFound('Ticket not found')

  if (ticket.status !== 'Closed') {
    throw ApiError.badRequest('Only closed tickets can be deleted')
  }

  await Ticket.findByIdAndDelete(ticket._id)

  writeAudit({
    req,
    action: AUDIT_ACTIONS.DELETE,
    module: 'ticket',
    targetId: ticket._id,
    targetLabel: ticket.ticketId,
    description: `Ticket ${ticket.ticketId} deleted by ${req.user.name} (${req.user.role})`,
  })

  return ok(res, null, 'Ticket deleted successfully')
})

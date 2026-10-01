import Role from '../models/Role.js'
import User from '../models/User.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from '../utils/ApiError.js'
import { ok, created } from '../utils/apiResponse.js'
import { ROLE_VALUES } from '../config/constants.js'

// UI designer module id → backend enforcement module key(s).
const MOD_MAP = {
  MOD_02: ['lead', 'customer'], MOD_03: ['customer'], MOD_04: ['visit'], MOD_05: ['builder'],
  MOD_06: ['project', 'unit'], MOD_08: ['booking'], MOD_09: ['payment'], MOD_10: ['expense'],
  MOD_11: ['commission'], MOD_12: ['branch'], MOD_13: ['user'], MOD_14: ['attendance', 'leave'],
  MOD_15: ['legal'], MOD_16: ['loan'], MOD_17: ['registration'], MOD_18: ['possession'],
  MOD_20: ['marketing'], MOD_21: ['report'],
}

// Translate the permission-designer selections into a real enforcement map that
// can() understands: 'manage' → full access, 'view' → read-only.
function deriveEnforcement(designer = {}) {
  const perms = {}
  const ma = designer.moduleAccess || {}
  for (const [modId, level] of Object.entries(ma)) {
    if (!level || level === 'none') continue
    const keys = MOD_MAP[modId]
    if (!keys) continue
    const actions = level === 'manage' ? ['*'] : ['view']
    for (const k of keys) perms[k] = actions
  }
  return perms
}

const firmScope = (req) => ({ firm: req.user.firm })

async function withUserCounts(roles) {
  const counts = await User.aggregate([
    { $match: { customRole: { $ne: null } } },
    { $group: { _id: '$customRole', n: { $sum: 1 } } },
  ])
  const map = Object.fromEntries(counts.map((c) => [String(c._id), c.n]))
  return roles.map((r) => ({ ...r, users: map[String(r._id)] || 0 }))
}

// GET /api/roles
export const listRoles = asyncHandler(async (req, res) => {
  const roles = await Role.find(firmScope(req)).populate('reportsTo', 'name').sort({ type: 1, name: 1 }).lean()
  return ok(res, await withUserCounts(roles), 'Roles fetched')
})

// GET /api/roles/:id
export const getRole = asyncHandler(async (req, res) => {
  const role = await Role.findOne({ _id: req.params.id, ...firmScope(req) }).populate('reportsTo', 'name').lean()
  if (!role) throw ApiError.notFound('Role not found')
  const users = await User.countDocuments({ customRole: role._id })
  return ok(res, { ...role, users })
})

// POST /api/roles
export const createRole = asyncHandler(async (req, res) => {
  const { name, description, category, baseRole, reportsTo, designer } = req.body
  if (!name || !name.trim()) throw ApiError.badRequest('Role name is required')
  if (!ROLE_VALUES.includes(baseRole)) throw ApiError.badRequest('A valid base role is required')
  const exists = await Role.findOne({ firm: req.user.firm, name: name.trim() })
  if (exists) throw ApiError.conflict('A role with this name already exists')
  const role = await Role.create({
    firm: req.user.firm, name: name.trim(), description: description || '',
    category: category || 'Operational', baseRole, reportsTo: reportsTo || null,
    type: 'custom', isSystem: false,
    designer: designer || {}, permissions: deriveEnforcement(designer),
    createdBy: req.user._id,
  })
  return created(res, role, 'Role created')
})

// PATCH /api/roles/:id — edit identity and/or designer selections.
export const updateRole = asyncHandler(async (req, res) => {
  const role = await Role.findOne({ _id: req.params.id, ...firmScope(req) })
  if (!role) throw ApiError.notFound('Role not found')

  const { name, description, category, reportsTo, baseRole, status, designer } = req.body
  if (name !== undefined) {
    const dup = await Role.findOne({ firm: req.user.firm, name: name.trim(), _id: { $ne: role._id } })
    if (dup) throw ApiError.conflict('A role with this name already exists')
    role.name = name.trim()
  }
  if (description !== undefined) role.description = description
  if (category !== undefined) role.category = category
  if (reportsTo !== undefined) role.reportsTo = reportsTo || null
  if (status !== undefined) role.status = status
  // baseRole can only change on custom roles.
  if (baseRole !== undefined && !role.isSystem && ROLE_VALUES.includes(baseRole)) role.baseRole = baseRole
  if (designer !== undefined) {
    role.designer = { ...role.designer, ...designer }
    role.permissions = deriveEnforcement(role.designer)
    role.markModified('designer'); role.markModified('permissions')
  }
  await role.save()
  return ok(res, role, 'Role updated')
})

// PATCH /api/roles/:id/status
export const setRoleStatus = asyncHandler(async (req, res) => {
  const role = await Role.findOneAndUpdate(
    { _id: req.params.id, ...firmScope(req) },
    { status: req.body.status === 'inactive' ? 'inactive' : 'active' },
    { new: true }
  )
  if (!role) throw ApiError.notFound('Role not found')
  return ok(res, role, 'Role status updated')
})

// DELETE /api/roles/:id — blocked for system roles or roles with users.
export const deleteRole = asyncHandler(async (req, res) => {
  const role = await Role.findOne({ _id: req.params.id, ...firmScope(req) })
  if (!role) throw ApiError.notFound('Role not found')
  if (role.isSystem) throw ApiError.badRequest('System roles cannot be deleted')
  const assigned = await User.countDocuments({ customRole: role._id })
  if (assigned > 0) throw ApiError.badRequest(`Cannot delete — ${assigned} user(s) are assigned this role. Reassign them first.`)
  await role.deleteOne()
  return ok(res, { _id: role._id }, 'Role deleted')
})

// GET /api/roles/:id/users — users assigned to this role.
export const listRoleUsers = asyncHandler(async (req, res) => {
  const users = await User.find({ customRole: req.params.id, firm: req.user.firm }, 'name email role branch isActive').lean()
  return ok(res, users, 'Role users fetched')
})

// GET /api/roles/assignable/users — firm users that can be assigned a role.
export const listAssignableUsers = asyncHandler(async (req, res) => {
  const users = await User.find({ firm: req.user.firm, role: { $ne: 'admin' } }, 'name email role branch customRole isActive').lean()
  return ok(res, users, 'Assignable users fetched')
})

// POST /api/roles/:id/assign — assign users to this role (also aligns their enum
// tier to the role's baseRole). Body: { userIds: [] }.
export const assignUsers = asyncHandler(async (req, res) => {
  const role = await Role.findOne({ _id: req.params.id, ...firmScope(req) })
  if (!role) throw ApiError.notFound('Role not found')
  const ids = Array.isArray(req.body.userIds) ? req.body.userIds : []
  if (ids.length === 0) throw ApiError.badRequest('No users provided')
  const result = await User.updateMany(
    { _id: { $in: ids }, firm: req.user.firm },
    { $set: { customRole: role._id, role: role.baseRole } }
  )
  return ok(res, { assigned: result.modifiedCount }, 'Users assigned')
})

// POST /api/roles/:id/unassign — remove users from this role. Body: { userIds: [] }.
export const unassignUsers = asyncHandler(async (req, res) => {
  const ids = Array.isArray(req.body.userIds) ? req.body.userIds : []
  const result = await User.updateMany(
    { _id: { $in: ids }, firm: req.user.firm, customRole: req.params.id },
    { $set: { customRole: null } }
  )
  return ok(res, { unassigned: result.modifiedCount }, 'Users unassigned')
})

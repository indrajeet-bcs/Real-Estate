import { z } from 'zod'
import { ROLES } from '../config/constants.js'

// A manager can only create roles strictly below them; enforced again in the
// controller via role rank. Sub-admin and executive are the creatable roles.
export const createUserSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum([ROLES.SUB_ADMIN, ROLES.SALES_EXECUTIVE]),
  phone: z.string().optional(),
  branch: z.string().optional(),
  team: z.string().optional(),
  manager: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  employeeId: z.string().optional(),
  designation: z.string().optional(),
  joiningDate: z.coerce.date().optional(),
  targetRevenue: z.coerce.number().min(0).optional(),
  targetSales: z.coerce.number().min(0).optional(),
})

export const updateUserSchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().optional(),
  branch: z.string().optional(),
  team: z.string().optional(),
  manager: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  designation: z.string().optional(),
  joiningDate: z.coerce.date().optional(),
  targetRevenue: z.coerce.number().min(0).optional(),
  targetSales: z.coerce.number().min(0).optional(),
  permissions: z.record(z.array(z.string())).optional(),
})

export const listUsersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(500).default(20),
  search: z.string().optional(),
  role: z.enum([ROLES.SUB_ADMIN, ROLES.SALES_EXECUTIVE, ROLES.ADMIN]).optional(),
  status: z.enum(['active', 'inactive', 'all']).default('all'),
  branch: z.string().optional(),
  withMetrics: z.enum(['true', 'false']).optional(),
})

// Transfer an employee to another branch (Admin Employee spec §Transfer).
export const transferUserSchema = z.object({
  branch: z.string().min(1, 'Destination branch is required'),
  newManager: z.string().regex(/^[0-9a-fA-F]{24}$/).optional().or(z.literal('')),
  transferDate: z.coerce.date().optional(),
  reason: z.string().optional(),
  transferLeads: z.coerce.boolean().optional(),
  transferTasks: z.coerce.boolean().optional(),
  // Backward-compatible with the earlier 3-step wizard.
  leadAction: z.enum(['retain', 'reassign']).optional(),
})

// Disabling a user: if they hold active leads, a reassignTo target is required
// (Edge Case §15 — mandatory reassignment before disable).
export const deactivateUserSchema = z.object({
  reassignTo: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
})

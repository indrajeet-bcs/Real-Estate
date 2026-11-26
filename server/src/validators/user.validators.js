import { z } from 'zod'
import { ROLES } from '../config/constants.js'
import { optionalIndianMobileSchema } from '../utils/phoneValidation.js'

// A manager can only create roles strictly below them; enforced again in the
// controller via role rank. Sub-admin and executive are the creatable roles.
export const createUserSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  email: z.string().email('Valid email is required'),
  password: z.string().min(8, 'Password must be at least 8 characters').optional().or(z.literal('')),
  role: z.enum([ROLES.SUB_ADMIN, ROLES.SALES_EXECUTIVE, ROLES.ADMIN]),
  phone: optionalIndianMobileSchema,
  branch: z.string().optional().or(z.literal('')),
  team: z.string().optional().or(z.literal('')),
  manager: z.string().regex(/^[0-9a-fA-F]{24}$/).optional().nullable().or(z.literal('')),
  employeeId: z.string().optional().or(z.literal('')),
  designation: z.string().optional().or(z.literal('')),
  department: z.string().optional().or(z.literal('')),
  joiningDate: z.preprocess((val) => (val === '' || val === null ? undefined : val), z.coerce.date().optional()),
  targetRevenue: z.preprocess((val) => (val === '' || val === null ? 0 : val), z.coerce.number().min(0).optional()),
  targetSales: z.preprocess((val) => (val === '' || val === null ? 0 : val), z.coerce.number().min(0).optional()),
  dob: z.preprocess((val) => (val === '' || val === null ? undefined : val), z.coerce.date().optional()),
  gender: z.string().optional().or(z.literal('')),
  address: z.string().optional().or(z.literal('')),
  emergencyContactName: z.string().optional().or(z.literal('')),
  emergencyContactNumber: optionalIndianMobileSchema,
})

export const updateUserSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  password: z.string().min(8, 'Password must be at least 8 characters').optional().or(z.literal('')),
  phone: optionalIndianMobileSchema,
  branch: z.string().optional().or(z.literal('')),
  team: z.string().optional().or(z.literal('')),
  manager: z.string().regex(/^[0-9a-fA-F]{24}$/).optional().nullable().or(z.literal('')),
  employeeId: z.string().optional().or(z.literal('')),
  designation: z.string().optional().or(z.literal('')),
  department: z.string().optional().or(z.literal('')),
  joiningDate: z.preprocess((val) => (val === '' || val === null ? undefined : val), z.coerce.date().optional()),
  targetRevenue: z.preprocess((val) => (val === '' || val === null ? 0 : val), z.coerce.number().min(0).optional()),
  targetSales: z.preprocess((val) => (val === '' || val === null ? 0 : val), z.coerce.number().min(0).optional()),
  dob: z.preprocess((val) => (val === '' || val === null ? undefined : val), z.coerce.date().optional()),
  gender: z.string().optional().or(z.literal('')),
  address: z.string().optional().or(z.literal('')),
  emergencyContactName: z.string().optional().or(z.literal('')),
  emergencyContactNumber: optionalIndianMobileSchema,
  role: z.enum([ROLES.SUB_ADMIN, ROLES.SALES_EXECUTIVE, ROLES.ADMIN]).optional(),
  permissions: z.record(z.array(z.string())).optional(),
})

export const deleteUserSchema = z.object({
  reassignTo: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
}).optional().default({})

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

import { z } from 'zod'

export const createFirmSchema = z.object({
  name: z.string().min(2, 'Firm name is required'),
  plan: z.string().optional(),
  billingCycle: z.string().optional(),
  region: z.string().optional(),
  branches: z.array(z.string()).optional(),
  contactEmail: z.string().email().optional().or(z.literal('')),
  contactPhone: z.string().optional(),
  // Admin account created alongside the firm (the firm owner).
  admin: z.object({
    name: z.string().min(2, 'Admin name is required'),
    email: z.string().email(),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    phone: z.string().optional(),
  }),
})

export const updateFirmSchema = z.object({
  name: z.string().min(2).optional(),
  plan: z.string().optional(),
  region: z.string().optional(),
  branches: z.array(z.string()).optional(),
  contactEmail: z.string().email().optional().or(z.literal('')),
  contactPhone: z.string().optional(),
})

export const listFirmsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  status: z.enum(['active', 'trial', 'suspended', 'deleted', 'all']).default('all'),
  plan: z.string().optional(),
  subscriptionStatus: z.enum(['active', 'trial', 'expired', 'cancelled', 'all']).optional(),
  billingCycle: z.enum(['monthly', 'yearly', 'all']).optional(),
  // For sorting by creation date
  sortBy: z.enum(['newest', 'oldest']).default('newest'),
})

export const bulkFirmActionSchema = z.object({
  action: z.enum(['suspend', 'activate', 'export', 'assign_plan', 'restore', 'delete_permanent']),
  firmIds: z.array(z.string()).min(1, 'Select at least one firm'),
  reason: z.string().optional(), // For suspend
  plan: z.string().optional(), // For assign_plan
})

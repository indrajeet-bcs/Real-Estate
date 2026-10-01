import { z } from 'zod'
import { objectId } from '../utils/validators.common.js'

export const createBranchSchema = z.object({
  name: z.string().min(2, 'Branch name is required'),
  code: z.string().optional(),
  region: z.string().optional(),
  city: z.string().optional(),
  address: z.string().optional(),
  contactNumber: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  adminUser: objectId.optional().or(z.literal('')),
  monthlyTarget: z.coerce.number().min(0).optional(),
  salesTarget: z.coerce.number().min(0).optional(),
  bookingTarget: z.coerce.number().min(0).optional(),
  targetPeriod: z.enum(['monthly', 'quarterly', 'yearly']).optional(),
})

export const updateBranchSchema = z.object({
  name: z.string().min(2).optional(),
  code: z.string().optional(),
  region: z.string().optional(),
  city: z.string().optional(),
  address: z.string().optional(),
  contactNumber: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  adminUser: objectId.optional().or(z.literal('')).or(z.null()),
  monthlyTarget: z.coerce.number().min(0).optional(),
})

export const setBranchTargetsSchema = z.object({
  monthlyTarget: z.coerce.number().min(0).optional(),
  salesTarget: z.coerce.number().min(0).optional(),
  bookingTarget: z.coerce.number().min(0).optional(),
  targetPeriod: z.enum(['monthly', 'quarterly', 'yearly']).optional(),
  targetStartDate: z.coerce.date().optional().or(z.literal('')),
  targetEndDate: z.coerce.date().optional().or(z.literal('')),
  targetRemarks: z.string().max(500).optional().or(z.literal('')),
})

export const setBranchStatusSchema = z.object({
  status: z.enum(['active', 'disabled']),
})

export const listBranchesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(100),
  search: z.string().optional(),
  city: z.string().optional(),
  status: z.enum(['active', 'disabled', 'all']).default('all'),
})

import { z } from 'zod'
import { CUSTOMER_STATUS, LEAD_SOURCES, INTEREST_LEVEL } from '../config/constants.js'

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id')

export const createCustomerSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  mobile: z.string().regex(/^[6-9]\d{9}$/, 'Must be a valid 10-digit mobile number starting with 6, 7, 8, or 9'),
  altMobile: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().optional(),
  occupation: z.string().optional(),
  budgetMin: z.coerce.number().optional(),
  budgetMax: z.coerce.number().optional(),
  // Property requirement (Employee spec §Add New Lead / Property Requirement).
  propertyType: z.string().optional(),
  configuration: z.string().optional(),
  preferredLocation: z.string().optional(),
  source: z.enum(LEAD_SOURCES).optional(),
  assignedTo: objectId.optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  kycStatus: z.enum(['pending', 'complete', 'rejected']).optional(),
  reraDocSigned: z.boolean().optional(),
  // Transient helpers accepted only on create (Add New Lead form).
  note: z.string().optional(), // initial note captured with the lead
  interestedProject: objectId.optional(), // tag a project interest immediately
})

export const updateCustomerSchema = createCustomerSchema
  .partial()
  .omit({ assignedTo: true, note: true, interestedProject: true })

export const listCustomersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(500).default(20),
  search: z.string().optional(),
  status: z.enum([...Object.values(CUSTOMER_STATUS), 'all']).default('all'),
  priority: z.enum(['low', 'medium', 'high', 'all']).optional(),
  assignedTo: objectId.optional(),
  unassigned: z.enum(['true', 'false']).optional(), // Branch-admin port: pool
})

export const addNoteSchema = z.object({
  type: z.enum(['call', 'meeting', 'general']).default('general'),
  text: z.string().min(1, 'Note text is required'),
  outcome: z.string().optional(),
})

export const interestSchema = z.object({
  project: objectId,
  interestLevel: z.enum(INTEREST_LEVEL).default('warm'),
  notes: z.string().optional(),
})

export const changeStatusSchema = z.object({
  status: z.enum(Object.values(CUSTOMER_STATUS)),
  lostReason: z.string().optional(),
})

// Individual or bulk assignment (§5). Bulk supports round-robin across a set of
// executives.
export const assignSchema = z.object({
  customerIds: z.array(objectId).min(1),
  executiveId: objectId.optional(), // individual
  executiveIds: z.array(objectId).optional(), // bulk round-robin
})

// Lead ownership transfer (spec §Lead Transfer) — reason mandatory.
export const transferLeadSchema = z.object({
  newEmployee: objectId,
  reason: z.string().min(1, 'Transfer reason is required'),
  remarks: z.string().optional().or(z.literal('')),
})

// Auto lead-distribution across active executives (Admin-flow port).
export const distributeSchema = z.object({
  algorithm: z.enum(['round_robin', 'performance', 'load_balanced']).default('round_robin'),
})

// Bulk import: client parses the CSV/Excel to rows, sends rows + mapping. The
// validation engine (dedup on mobile, mandatory-field check) runs server-side.
export const importSchema = z.object({
  fileName: z.string().optional(),
  columnMapping: z.record(z.string()).optional(),
  rows: z.array(z.record(z.any())).min(1, 'No rows to import'),
})

import { z } from 'zod'
import { AGREEMENT_TYPES, AGREEMENT_STATUS, LEGAL_STATUS, DOCUMENT_STATUS } from '../config/legal.js'

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id')
const optId = objectId.optional().or(z.literal(''))
const optStr = z.string().optional().or(z.literal(''))
const optDate = z.coerce.date().optional().or(z.literal(''))

export const createCaseSchema = z.object({
  booking: objectId, // §Validations: must be linked to a valid booking
  legalExecutive: optId,
  agreementType: z.enum(AGREEMENT_TYPES).optional(),
  expectedCompletionDate: optDate,
  remarks: optStr,
})

export const updateCaseSchema = z.object({
  legalExecutive: optId,
  agreementType: z.enum(AGREEMENT_TYPES).optional(),
  agreementStatus: z.enum(AGREEMENT_STATUS).optional(),
  agreementNumber: optStr,
  agreementDate: optDate,
  expectedCompletionDate: optDate,
  remarks: optStr,
})

export const assignSchema = z.object({
  legalExecutive: objectId,
  note: optStr,
})

export const statusSchema = z.object({
  status: z.enum(LEGAL_STATUS),
  note: optStr,
})

export const addDocumentSchema = z.object({
  type: z.string().min(2, 'Document type is required'),
  mandatory: z.boolean().optional(),
})

export const updateDocumentSchema = z.object({
  status: z.enum(DOCUMENT_STATUS).optional(),
  remarks: optStr,
})

export const listCasesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(20),
  search: optStr,
  status: z.enum([...LEGAL_STATUS, 'overdue', 'all']).optional(),
  branch: optStr,
  project: optId,
  legalExecutive: optId,
  agreementType: z.enum([...AGREEMENT_TYPES, 'all']).optional(),
  dateFrom: optDate,
  dateTo: optDate,
  sortBy: z.enum(['newest', 'oldest', 'due']).default('newest'),
})

export const analyticsSchema = z.object({
  branch: optStr,
  project: optId,
  legalExecutive: optId,
  status: z.enum([...LEGAL_STATUS, 'all']).optional(),
  dateFrom: optDate,
  dateTo: optDate,
})

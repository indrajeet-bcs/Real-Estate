import { z } from 'zod'

// Reusable query schema for list endpoints.
export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(500).default(20),
  search: z.string().optional(),
})

export const objectId = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, 'Invalid id')

import { z } from 'zod'
import { objectId } from '../utils/validators.common.js'

export const createCommissionRuleSchema = z.object({
  name: z.string().min(2, 'Rule name is required'),
  builder: objectId.optional().or(z.literal('')),
  project: objectId.optional().or(z.literal('')),
  baseRate: z.coerce.number().min(0).max(100),
  targetThreshold: z.coerce.number().min(0).optional(),
  acceleratorRate: z.coerce.number().min(0).max(100).optional(),
  active: z.boolean().optional(),
})

export const updateCommissionRuleSchema = createCommissionRuleSchema.partial()

export const toggleCommissionRuleSchema = z.object({
  active: z.boolean(),
})

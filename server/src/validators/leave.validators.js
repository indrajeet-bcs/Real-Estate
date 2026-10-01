import { z } from 'zod'
import { LEAVE_TYPES } from '../config/constants.js'

export const createLeaveSchema = z.object({
  type: z.enum(LEAVE_TYPES).default('casual'),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  reason: z.string().min(3, 'A reason is required'),
})

export const rejectLeaveSchema = z.object({
  note: z.string().optional(),
})

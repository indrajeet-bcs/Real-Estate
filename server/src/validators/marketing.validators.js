import { z } from 'zod'
import {
  MARKETING_TYPES,
  MARKETING_CHANNEL,
  MARKETING_TASK_STATUS,
  MARKETING_PRIORITY,
  CAMPAIGN_STATUS,
} from '../config/marketing.js'

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id')
const optId = objectId.optional().or(z.literal(''))
const optDate = z.coerce.date().optional().or(z.literal(''))

// ── Tasks ────────────────────────────────────────────────────────────────────
export const createTaskSchema = z.object({
  title: z.string().min(2, 'Task title is required'),
  marketingType: z.enum(MARKETING_TYPES),
  channel: z.enum(Object.values(MARKETING_CHANNEL)).optional(), // auto-derived from type if absent
  campaign: optId,
  relatedProject: optId,
  relatedBuilder: optId,
  branch: z.string().optional().or(z.literal('')),
  description: z.string().optional().or(z.literal('')),
  priority: z.enum(MARKETING_PRIORITY).optional(),
  dueDate: optDate,
  estimatedBudget: z.coerce.number().min(0).optional(),
  // Empty / absent => Self Task (owner becomes the creator).
  assignTo: optId,
  // Managers may create a task straight into Draft; employees default to pending.
  status: z.enum(['draft', 'pending']).optional(),
})

export const updateTaskSchema = z.object({
  title: z.string().min(2).optional(),
  marketingType: z.enum(MARKETING_TYPES).optional(),
  channel: z.enum(Object.values(MARKETING_CHANNEL)).optional(),
  campaign: optId,
  relatedProject: optId,
  relatedBuilder: optId,
  branch: z.string().optional().or(z.literal('')),
  description: z.string().optional().or(z.literal('')),
  priority: z.enum(MARKETING_PRIORITY).optional(),
  dueDate: optDate,
  estimatedBudget: z.coerce.number().min(0).optional(),
})

export const progressSchema = z.object({
  progress: z.coerce.number().min(0).max(100).optional(),
  status: z.enum(['pending', 'in_progress', 'on_hold']).optional(),
  note: z.string().optional().or(z.literal('')),
})

export const statusSchema = z.object({
  status: z.enum(MARKETING_TASK_STATUS),
  note: z.string().optional().or(z.literal('')),
})

export const completeSchema = z.object({
  completionRemarks: z.string().optional().or(z.literal('')),
})

export const reassignSchema = z.object({
  assignTo: objectId,
  reason: z.string().optional().or(z.literal('')),
})

export const dueDateSchema = z.object({
  dueDate: z.coerce.date(),
  reason: z.string().optional().or(z.literal('')),
})

export const remarkSchema = z.object({
  text: z.string().min(1, 'Remark cannot be empty'),
})

export const linkSchema = z.object({
  url: z.string().url('Enter a valid URL'),
  label: z.string().optional().or(z.literal('')),
})

export const listTasksSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(20),
  scope: z.enum(['mine', 'team']).default('mine'),
  status: z.enum([...MARKETING_TASK_STATUS, 'overdue', 'all']).optional(),
  priority: z.enum([...MARKETING_PRIORITY, 'all']).optional(),
  channel: z.enum([...Object.values(MARKETING_CHANNEL), 'all']).optional(),
  marketingType: z.string().optional(),
  campaign: optId,
  branch: z.string().optional(),
  assignedTo: optId,
  taskType: z.enum(['assigned', 'self', 'all']).optional(),
  dateFrom: optDate,
  dateTo: optDate,
  search: z.string().optional(),
  sortBy: z.enum(['newest', 'oldest', 'due']).default('newest'),
})

// ── Campaigns ────────────────────────────────────────────────────────────────
export const createCampaignSchema = z.object({
  name: z.string().min(2, 'Campaign name is required'),
  description: z.string().optional().or(z.literal('')),
  budget: z.coerce.number().min(0).optional(),
  startDate: optDate,
  endDate: optDate,
  branch: z.string().optional().or(z.literal('')),
  builder: optId,
  project: optId,
  status: z.enum(CAMPAIGN_STATUS).optional(),
})

export const updateCampaignSchema = createCampaignSchema.partial()

// ── Reports / dashboard filters ──────────────────────────────────────────────
export const analyticsSchema = z.object({
  scope: z.enum(['mine', 'team']).default('team'),
  branch: z.string().optional(),
  employee: optId,
  campaign: optId,
  channel: z.enum([...Object.values(MARKETING_CHANNEL), 'all']).optional(),
  marketingType: z.string().optional(),
  status: z.string().optional(),
  dateFrom: optDate,
  dateTo: optDate,
})

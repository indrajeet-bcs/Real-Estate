import { z } from 'zod'
import { EXPENSE_PAYMENT_METHODS, EXPENSE_STATUS, CATEGORY_GROUPS } from '../config/expense.js'

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id')
const optId = objectId.optional().or(z.literal(''))
const optStr = z.string().optional().or(z.literal(''))
const optDate = z.coerce.date().optional().or(z.literal(''))

export const createExpenseSchema = z.object({
  title: z.string().min(2, 'Expense title is required'),
  category: objectId,
  expenseDate: z.coerce.date({ required_error: 'Expense date is required' }),
  branch: optStr,
  department: optStr,
  project: optId,
  amount: z.coerce.number().positive('Amount must be greater than zero'),
  paymentMethod: z.enum(EXPENSE_PAYMENT_METHODS),
  paidTo: optStr,
  referenceNumber: optStr,
  description: optStr,
  status: z.enum(['draft', 'submitted']).optional(),
})

export const updateExpenseSchema = z.object({
  title: z.string().min(2).optional(),
  category: optId,
  expenseDate: z.coerce.date().optional(),
  branch: optStr,
  department: optStr,
  project: optId,
  amount: z.coerce.number().positive('Amount must be greater than zero').optional(),
  paymentMethod: z.enum(EXPENSE_PAYMENT_METHODS).optional(),
  paidTo: optStr,
  referenceNumber: optStr,
  description: optStr,
})

export const statusSchema = z.object({
  status: z.enum(EXPENSE_STATUS),
  note: optStr,
})

export const listExpensesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(20),
  search: optStr,
  status: z.enum([...EXPENSE_STATUS, 'all']).optional(),
  method: z.enum([...EXPENSE_PAYMENT_METHODS, 'all']).optional(),
  branch: optStr,
  department: optStr,
  category: optId,
  employee: optId,
  hasReceipt: z.enum(['true', 'false']).optional(),
  dateFrom: optDate,
  dateTo: optDate,
  sortBy: z.enum(['newest', 'oldest', 'amount_high', 'amount_low']).default('newest'),
})

export const analyticsSchema = z.object({
  branch: optStr,
  department: optStr,
  category: optId,
  employee: optId,
  method: z.enum([...EXPENSE_PAYMENT_METHODS, 'all']).optional(),
  status: z.enum([...EXPENSE_STATUS, 'all']).optional(),
  dateFrom: optDate,
  dateTo: optDate,
})

export const createCategorySchema = z.object({
  name: z.string().min(2, 'Category name is required'),
  group: z.enum(CATEGORY_GROUPS).optional(),
})

export const updateCategorySchema = z.object({
  name: z.string().min(2).optional(),
  group: z.enum(CATEGORY_GROUPS).optional(),
  active: z.boolean().optional(),
})

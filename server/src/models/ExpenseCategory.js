import mongoose from 'mongoose'
import { CATEGORY_GROUPS } from '../config/expense.js'

const { Schema, model } = mongoose

// A configurable expense category (§Expense Categories). Firm-scoped; default set
// is provisioned per firm on first use. `group: 'marketing'` feeds the Marketing
// Expenses KPI. Soft-disabled via `active` rather than deleted when in use.
const expenseCategorySchema = new Schema(
  {
    firm: { type: Schema.Types.ObjectId, ref: 'Firm', required: true, index: true },
    name: { type: String, required: true, trim: true },
    group: { type: String, enum: CATEGORY_GROUPS, default: 'general' },
    active: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
)

expenseCategorySchema.index({ firm: 1, name: 1 }, { unique: true })

export default model('ExpenseCategory', expenseCategorySchema)

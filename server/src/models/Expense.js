import mongoose from 'mongoose'
import { EXPENSE_PAYMENT_METHODS, EXPENSE_STATUS } from '../config/expense.js'

const { Schema, model } = mongoose

// Current receipt attached to an expense (§Receipts). Replacing swaps this object.
const receiptSchema = new Schema(
  {
    receiptNumber: { type: String, trim: true },
    fileName: String,
    fileUrl: String,
    mimeType: String,
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    uploadedByName: { type: String, trim: true },
    uploadedAt: { type: Date, default: () => new Date() },
  },
  { _id: false }
)

// Timeline entry powering the Expense Timeline + Audit History (§Expense Details).
const activitySchema = new Schema(
  {
    type: { type: String, trim: true }, // created | submitted | edited | receipt_uploaded | receipt_replaced | verified | rejected | cancelled | status_changed
    note: { type: String, trim: true },
    actor: { type: Schema.Types.ObjectId, ref: 'User' },
    actorName: { type: String, trim: true },
    at: { type: Date, default: () => new Date() },
  },
  { _id: true }
)

// A recorded company expense (§Expense Management). Standalone (not booking-linked).
const expenseSchema = new Schema(
  {
    firm: { type: Schema.Types.ObjectId, ref: 'Firm', required: true, index: true },
    expenseCode: { type: String, trim: true, index: true }, // EXP-000N

    title: { type: String, required: true, trim: true },
    category: { type: Schema.Types.ObjectId, ref: 'ExpenseCategory', required: true, index: true },
    categoryName: { type: String, trim: true }, // denormalized for lists/reports
    categoryGroup: { type: String, trim: true, default: 'general', index: true }, // 'general' | 'marketing'

    expenseDate: { type: Date, required: true, index: true },
    branch: { type: String, trim: true, index: true },
    department: { type: String, trim: true, index: true },
    project: { type: Schema.Types.ObjectId, ref: 'Project', default: null },
    projectName: { type: String, trim: true },

    amount: { type: Number, required: true, min: [1, 'Amount must be greater than zero'] },
    paymentMethod: { type: String, enum: EXPENSE_PAYMENT_METHODS, default: 'cash', index: true },
    paidTo: { type: String, trim: true },
    referenceNumber: { type: String, trim: true, index: true },
    description: { type: String, trim: true },

    status: { type: String, enum: EXPENSE_STATUS, default: 'submitted', index: true },
    receipt: { type: receiptSchema, default: undefined },

    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    createdByName: { type: String, trim: true },
    createdByRole: { type: String, trim: true },

    verifiedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    verifiedByName: { type: String, trim: true },
    verifiedAt: { type: Date },
    rejectReason: { type: String, trim: true },
    cancelReason: { type: String, trim: true },

    // Soft delete (§Validations: soft delete should be used).
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date },
    deletedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },

    activity: { type: [activitySchema], default: [] },
  },
  { timestamps: true }
)

expenseSchema.index({ firm: 1, status: 1 })
expenseSchema.index({ firm: 1, expenseDate: -1 })
expenseSchema.index({ firm: 1, category: 1 })

export default model('Expense', expenseSchema)

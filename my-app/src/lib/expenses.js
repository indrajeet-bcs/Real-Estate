// Expense module option lists — mirror server/src/config/expense.js so forms +
// filters render without a config round-trip. (GET /expenses/config also exists.)

export const PAYMENT_METHODS = ['cash', 'upi', 'bank_transfer', 'cheque', 'debit_card', 'credit_card', 'other']
export const EXPENSE_STATUSES = ['draft', 'submitted', 'verified', 'rejected', 'cancelled']
export const DEPARTMENTS = ['Sales', 'Marketing', 'Finance', 'Operations', 'Administration', 'HR', 'IT']
export const RECEIPT_ACCEPT = '.pdf,.jpg,.jpeg,.png'

// Expense Management module configuration (§Payment Methods / §Status / §Categories).
// Lists live here (not hard-coded in model enums where they may grow) so future
// methods / categories / departments can be added through configuration — a V1
// requirement. The model validates against these.

export const EXPENSE_PAYMENT_METHODS = ['cash', 'upi', 'bank_transfer', 'cheque', 'debit_card', 'credit_card', 'other']

// draft → submitted → verified | rejected ; cancelled is terminal.
export const EXPENSE_STATUS = ['draft', 'submitted', 'verified', 'rejected', 'cancelled']

// Statuses that count toward "recorded spend" (draft/rejected/cancelled excluded).
export const COUNTED_STATUSES = ['submitted', 'verified']

// Suggested departments for the Department field + department-wise reports.
export const DEPARTMENTS = ['Sales', 'Marketing', 'Finance', 'Operations', 'Administration', 'HR', 'IT']

// Category grouping — 'marketing' categories feed the "Marketing Expenses" KPI.
export const CATEGORY_GROUPS = ['general', 'marketing']

// Default categories provisioned per-firm on first use (§Expense Categories).
export const DEFAULT_CATEGORIES = [
  { name: 'Office Rent', group: 'general' },
  { name: 'Electricity', group: 'general' },
  { name: 'Internet', group: 'general' },
  { name: 'Water Bill', group: 'general' },
  { name: 'Fuel', group: 'general' },
  { name: 'Travel', group: 'general' },
  { name: 'Marketing', group: 'marketing' },
  { name: 'Event', group: 'marketing' },
  { name: 'Staff Welfare', group: 'general' },
  { name: 'Office Supplies', group: 'general' },
  { name: 'Maintenance', group: 'general' },
  { name: 'Repairs', group: 'general' },
  { name: 'Client Meeting', group: 'general' },
  { name: 'Refreshments', group: 'general' },
  { name: 'Miscellaneous', group: 'general' },
]

export const RECEIPT_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png']
export const RECEIPT_MAX_MB = 10

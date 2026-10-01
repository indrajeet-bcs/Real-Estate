// Payment module configuration (§Payment Methods / §Payment Status / §Receipts).
// Method + status lists live here (not hard-coded in the model enum) so future
// methods can be added through configuration — V1 requirement "Allow future
// payment methods through configuration". The model validates against these.

export const PAYMENT_METHODS = [
  'cash',
  'cheque',
  'bank_transfer',
  'upi',
  'debit_card',
  'credit_card',
  'demand_draft',
]

export const PAYMENT_STATUS = ['pending', 'received', 'verified', 'cancelled', 'refunded']

// Statuses that count toward the amount actually collected on a booking.
export const COLLECTED_STATUSES = ['received', 'verified']

// Receipt upload rules (§Receipts · Validations).
export const RECEIPT_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png']
export const RECEIPT_MAX_MB = 10

// Fields that are relevant per method — drives the Add Payment form + light
// server-side validation. All are optional in V1 (kept flexible for scale).
export const METHOD_FIELDS = {
  cash: [],
  cheque: ['chequeNumber', 'chequeDate', 'bankName'],
  bank_transfer: ['transactionId', 'bankName'],
  upi: ['upiId', 'transactionId'],
  debit_card: ['transactionId', 'bankName'],
  credit_card: ['transactionId', 'bankName'],
  demand_draft: ['referenceNumber', 'bankName'],
}

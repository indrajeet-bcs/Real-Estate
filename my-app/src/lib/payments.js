// Payment module option lists — mirrors server/src/config/payment.js so the Add
// Payment form + filters render without a config round-trip. (The API also
// exposes GET /payments/config.)

export const PAYMENT_METHODS = ['cash', 'cheque', 'bank_transfer', 'upi', 'debit_card', 'credit_card', 'demand_draft']
export const PAYMENT_STATUSES = ['pending', 'received', 'verified', 'cancelled', 'refunded']

// Which extra fields matter for each method (drives conditional form inputs).
export const METHOD_FIELDS = {
  cash: [],
  cheque: ['chequeNumber', 'chequeDate', 'bankName'],
  bank_transfer: ['transactionId', 'bankName'],
  upi: ['upiId', 'transactionId'],
  debit_card: ['transactionId', 'bankName'],
  credit_card: ['transactionId', 'bankName'],
  demand_draft: ['referenceNumber', 'bankName'],
}

export const RECEIPT_ACCEPT = '.pdf,.jpg,.jpeg,.png'

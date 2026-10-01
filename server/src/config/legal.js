// Legal Management module configuration (§Legal Status / §Document Status /
// §Customer Documents). Lists live here (not hard-coded in model enums where the
// checklist may grow) so future document types / agreement types can be added
// through configuration — a V1 requirement. The model validates against these.

export const AGREEMENT_TYPES = ['sale_agreement', 'agreement_to_sell', 'lease_deed', 'construction_agreement', 'other']

export const AGREEMENT_STATUS = ['not_started', 'in_preparation', 'ready']

// new → documents_pending → verification_in_progress → agreement_preparation →
// ready_for_registration → completed ; cancelled is terminal.
export const LEGAL_STATUS = [
  'new',
  'documents_pending',
  'verification_in_progress',
  'agreement_preparation',
  'ready_for_registration',
  'completed',
  'cancelled',
]

// Statuses considered "open" (drive Overdue + pending widgets).
export const OPEN_LEGAL_STATUSES = ['new', 'documents_pending', 'verification_in_progress', 'agreement_preparation', 'ready_for_registration']

export const DOCUMENT_STATUS = ['pending', 'received', 'verified', 'rejected', 'missing']

// Default document checklist provisioned per case (§Customer Documents).
// `mandatory` drives the "mandatory documents validated" rule when completing.
export const DEFAULT_DOCUMENT_TYPES = [
  { name: 'PAN Card', mandatory: true },
  { name: 'Aadhaar Card', mandatory: true },
  { name: 'Passport', mandatory: false },
  { name: 'Driving License', mandatory: false },
  { name: 'Photograph', mandatory: true },
  { name: 'Address Proof', mandatory: true },
  { name: 'Income Proof', mandatory: false },
  { name: 'Bank Statement', mandatory: false },
  { name: 'Sale Agreement', mandatory: false },
  { name: 'Booking Form', mandatory: true },
  { name: 'Other Supporting Documents', mandatory: false },
]

export const RECEIPT_MIME_TYPES = [
  'application/pdf', 'image/jpeg', 'image/png',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]
export const RECEIPT_MAX_MB = 10

// Is a case overdue right now? (open + expected completion date passed)
export function isOverdue(legalCase) {
  if (!legalCase?.expectedCompletionDate) return false
  if (!OPEN_LEGAL_STATUSES.includes(legalCase.status)) return false
  return new Date(legalCase.expectedCompletionDate).getTime() < Date.now()
}

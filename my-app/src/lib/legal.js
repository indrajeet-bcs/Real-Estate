// Legal module option lists — mirror server/src/config/legal.js so forms + filters
// render without a config round-trip. (GET /legal/config also exists.)

export const AGREEMENT_TYPES = ['sale_agreement', 'agreement_to_sell', 'lease_deed', 'construction_agreement', 'other']
export const AGREEMENT_STATUSES = ['not_started', 'in_preparation', 'ready']
export const LEGAL_STATUSES = ['new', 'documents_pending', 'verification_in_progress', 'agreement_preparation', 'ready_for_registration', 'completed', 'cancelled']
export const DOCUMENT_STATUSES = ['pending', 'received', 'verified', 'rejected', 'missing']
export const DOC_ACCEPT = '.pdf,.jpg,.jpeg,.png,.doc,.docx'

// The forward status a case can move to from its current one (for the Update Status action).
export const NEXT_STATUS = {
  new: ['documents_pending', 'cancelled'],
  documents_pending: ['verification_in_progress', 'cancelled'],
  verification_in_progress: ['agreement_preparation', 'documents_pending', 'cancelled'],
  agreement_preparation: ['ready_for_registration', 'verification_in_progress', 'cancelled'],
  ready_for_registration: ['completed', 'agreement_preparation', 'cancelled'],
  completed: [],
  cancelled: [],
}

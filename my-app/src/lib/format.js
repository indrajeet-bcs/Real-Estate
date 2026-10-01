// Presentation helpers shared across pages.

export function formatDate(value, withTime = false) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  const opts = { year: 'numeric', month: 'short', day: 'numeric' }
  if (withTime) Object.assign(opts, { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleString('en-IN', opts)
}

export function formatMoney(n) {
  if (n == null || n === '') return '—'
  return '₹' + Number(n).toLocaleString('en-IN')
}

export function titleCase(s) {
  if (!s) return ''
  return s
    .toString()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

// Export an array of flat objects to a downloaded CSV file. Keys of the first
// row become the header. Values are CSV-escaped. No dependency.
export function exportRowsToCsv(filename, rows) {
  if (!rows || rows.length === 0) return
  const headers = Object.keys(rows[0])
  const esc = (v) => {
    const s = v == null ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = [headers.join(','), ...rows.map((r) => headers.map((h) => esc(r[h])).join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// Tailwind classes for a status pill, keyed by status value (light theme).
export const STATUS_COLORS = {
  // customer
  new: 'bg-sky-50 text-sky-700 border-sky-200',
  in_progress: 'bg-amber-50 text-amber-700 border-amber-200',
  follow_up_due: 'bg-violet-50 text-violet-700 border-violet-200',
  booked: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  lost: 'bg-red-50 text-red-700 border-red-200',
  // V1 customer statuses
  active: 'bg-sky-50 text-sky-700 border-sky-200',
  interested: 'bg-blue-50 text-blue-700 border-blue-200',
  negotiation: 'bg-amber-50 text-amber-700 border-amber-200',
  site_visit_scheduled: 'bg-violet-50 text-violet-700 border-violet-200',
  site_visit_completed: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  booking_cancelled: 'bg-red-50 text-red-700 border-red-200',
  hold: 'bg-orange-50 text-orange-700 border-orange-200',
  closed: 'bg-slate-100 text-slate-600 border-slate-200',
  qualified: 'bg-teal-50 text-teal-700 border-teal-200',
  converted: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  // follow-up / visit / booking
  scheduled: 'bg-sky-50 text-sky-700 border-sky-200',
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  conducted: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  confirmed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  missed: 'bg-red-50 text-red-700 border-red-200',
  rescheduled: 'bg-amber-50 text-amber-700 border-amber-200',
  cancelled: 'bg-slate-100 text-slate-500 border-slate-200',
  reserved: 'bg-amber-50 text-amber-700 border-amber-200',
  sale_completed: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  partial: 'bg-amber-50 text-amber-700 border-amber-200',
  // attendance
  on_time: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  late: 'bg-amber-50 text-amber-700 border-amber-200',
  half_day: 'bg-orange-50 text-orange-700 border-orange-200',
  absent: 'bg-red-50 text-red-700 border-red-200',
  // unit
  available: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  blocked: 'bg-slate-100 text-slate-500 border-slate-200',
  locked: 'bg-amber-50 text-amber-700 border-amber-200',
  token: 'bg-sky-50 text-sky-700 border-sky-200',
  sold: 'bg-violet-50 text-violet-700 border-violet-200',
  registered: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  possession: 'bg-teal-50 text-teal-700 border-teal-200',
  // compliance / construction (Admin-flow port)
  compliant: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  pending_review: 'bg-amber-50 text-amber-700 border-amber-200',
  non_compliant: 'bg-red-50 text-red-700 border-red-200',
  pre_launch: 'bg-violet-50 text-violet-700 border-violet-200',
  under_construction: 'bg-sky-50 text-sky-700 border-sky-200',
  ready_to_move: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  // KYC (Admin-flow port)
  complete: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  // marketing task + campaign statuses
  draft: 'bg-slate-100 text-slate-600 border-slate-200',
  on_hold: 'bg-orange-50 text-orange-700 border-orange-200',
  overdue: 'bg-red-50 text-red-700 border-red-200',
  planned: 'bg-sky-50 text-sky-700 border-sky-200',
  paused: 'bg-amber-50 text-amber-700 border-amber-200',
  // payment statuses
  received: 'bg-sky-50 text-sky-700 border-sky-200',
  verified: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  refunded: 'bg-violet-50 text-violet-700 border-violet-200',
  // expense statuses
  submitted: 'bg-sky-50 text-sky-700 border-sky-200',
  // legal statuses + document statuses
  documents_pending: 'bg-orange-50 text-orange-700 border-orange-200',
  verification_in_progress: 'bg-amber-50 text-amber-700 border-amber-200',
  agreement_preparation: 'bg-violet-50 text-violet-700 border-violet-200',
  ready_for_registration: 'bg-teal-50 text-teal-700 border-teal-200',
  missing: 'bg-red-50 text-red-700 border-red-200',
}

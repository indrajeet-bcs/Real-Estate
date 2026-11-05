import { useState, useEffect, useCallback } from 'react'
import { Card, Button, StatusBadge } from '../../components/ui.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { ticketsApi } from '../../api/resources.js'
import { formatDate, titleCase } from '../../lib/format.js'

// Live ticket detail (was mock-driven). Loads GET /api/tickets/:id, posts notes
// to /:id/notes, and changes status via /:id/status. The activity timeline is
// the ticket's real internalNotes.
const priorityCls = (p) =>
  p === 'Critical' ? 'bg-red-100 text-red-700' : p === 'High' ? 'bg-orange-100 text-orange-700' : p === 'Medium' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700'

export default function TicketDetailModal({ ticketId, onClose, onChanged }) {
  const { user } = useAuth()
  const toast = useToast()
  const canDelete = user?.role === 'admin' || user?.role === 'sub_admin' || user?.role === 'super_admin'
  const [ticket, setTicket] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [remark, setRemark] = useState('')
  const [saving, setSaving] = useState(false)
  const [busyStatus, setBusyStatus] = useState(false)
  const [statusModal, setStatusModal] = useState(null) // 'Resolved' | 'Closed' | null
  const [statusRemark, setStatusRemark] = useState('')
  const [statusError, setStatusError] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await ticketsApi.get(ticketId)
      setTicket(res.data.data)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load ticket')
    } finally {
      setLoading(false)
    }
  }, [ticketId])

  useEffect(() => { load() }, [load])

  const addRemark = async () => {
    if (!remark.trim()) return
    setSaving(true)
    try {
      const res = await ticketsApi.addNote(ticketId, remark.trim())
      setTicket(res.data.data)
      setRemark('')
      toast.success('Note added')
      onChanged?.()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add note')
    } finally {
      setSaving(false)
    }
  }

  const handleConfirmStatus = async () => {
    if (!statusRemark.trim()) {
      setStatusError(
        statusModal === 'Resolved'
          ? 'Resolution details / remarks are required.'
          : statusModal === 'Closed'
          ? 'Closing remarks are required.'
          : 'Reopening reason / follow-up notes are required.'
      )
      return
    }
    setBusyStatus(true)
    try {
      await ticketsApi.changeStatus(ticketId, { status: statusModal, remark: statusRemark.trim() })
      toast.success(statusModal === 'Open' ? `Ticket ${ticket?.ticketId || ''} reopened successfully` : `Ticket marked as ${statusModal}`)
      setStatusModal(null)
      setStatusRemark('')
      setStatusError('')
      await load()
      onChanged?.()
    } catch (err) {
      toast.error(err.response?.data?.message || `Failed to change status to ${statusModal}`)
    } finally {
      setBusyStatus(false)
    }
  }

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deletingTicket, setDeletingTicket] = useState(false)

  const handleConfirmDelete = async () => {
    setDeletingTicket(true)
    try {
      await ticketsApi.remove(ticketId)
      toast.success(`Ticket ${ticket?.ticketId} deleted successfully`)
      setShowDeleteConfirm(false)
      onChanged?.()
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete ticket')
    } finally {
      setDeletingTicket(false)
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
        <div className="rounded-xl bg-white p-6 shadow-xl">Loading ticket details…</div>
      </div>
    )
  }
  if (error || !ticket) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm" onClick={onClose}>
        <div className="rounded-xl bg-white p-6 text-sm text-red-600 shadow-xl">{error || 'Ticket not found'}</div>
      </div>
    )
  }

  const notes = ticket.internalNotes || []
  const closed = ticket.status === 'Closed'
  const resolvedOrClosed = ticket.status === 'Resolved' || ticket.status === 'Closed'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-900/50 backdrop-blur-sm sm:p-4">
      <div className="flex h-full w-full flex-col overflow-hidden bg-white shadow-2xl sm:max-w-4xl sm:rounded-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold text-slate-900">{ticket.ticketId}</h2>
              <StatusBadge status={ticket.status} />
              <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${priorityCls(ticket.priority)}`}>{ticket.priority}</span>
            </div>
            <p className="mt-1 text-sm font-medium text-slate-600">{ticket.subject}</p>
          </div>
          <div className="flex items-center gap-2">
            {!resolvedOrClosed && (
              <Button
                size="sm"
                variant="secondary"
                disabled={busyStatus}
                onClick={() => { setStatusModal('Resolved'); setStatusRemark(''); setStatusError('') }}
              >
                Mark as Resolve
              </Button>
            )}
            {ticket.status === 'Resolved' && (
              <Button
                size="sm"
                variant="secondary"
                disabled={busyStatus}
                onClick={() => { setStatusModal('Closed'); setStatusRemark(''); setStatusError('') }}
              >
                Close
              </Button>
            )}
            {resolvedOrClosed && (
              <Button
                size="sm"
                variant="secondary"
                disabled={busyStatus}
                onClick={() => { setStatusModal('Open'); setStatusRemark(''); setStatusError('') }}
              >
                Reopen Ticket
              </Button>
            )}
            {ticket.status === 'Closed' && canDelete && (
              <Button
                size="sm"
                variant="danger"
                disabled={busyStatus}
                onClick={() => setShowDeleteConfirm(true)}
              >
                Delete Ticket
              </Button>
            )}
            <button onClick={onClose} className="ml-2 rounded-full p-2 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700">✕</button>
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-1 flex-col md:flex-row overflow-hidden">
          {/* Context */}
          <div className="w-full md:w-2/5 overflow-y-auto border-b md:border-b-0 md:border-r border-slate-200 bg-slate-50/50 p-6">
            <h4 className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Ticket Context</h4>
            <div className="space-y-4">
              {ticket.firm?.name && (
                <Card className="p-4 shadow-sm">
                  <div className="mb-2 text-xs font-medium text-slate-500">Company</div>
                  <div className="font-semibold text-slate-900">{ticket.firm.name}</div>
                  {ticket.firm.contactEmail && <div className="text-sm text-slate-500">{ticket.firm.contactEmail}</div>}
                </Card>
              )}
              <Card className="space-y-2 p-4 shadow-sm">
                <Row label="Category" value={ticket.category?.name || '—'} />
                <Row label="Priority" value={ticket.priority} />
                <Row label="Status" value={ticket.status} />
                <Row label="Assigned To" value={ticket.assignedTo?.name || 'Unassigned'} />
                {ticket.reopenedAt && <Row label="Reopened" value={formatDate(ticket.reopenedAt, true)} />}
                {ticket.resolvedAt && <Row label="Resolved" value={formatDate(ticket.resolvedAt, true)} />}
                {ticket.closedAt && <Row label="Closed" value={formatDate(ticket.closedAt, true)} />}
                <Row label="Created" value={formatDate(ticket.createdAt, true)} />
              </Card>
            </div>
          </div>

          {/* Thread */}
          <div className="flex flex-1 w-full md:w-3/5 flex-col overflow-hidden bg-white">
            <div className="flex-1 overflow-y-auto p-6">
              {ticket.reopenReason && !resolvedOrClosed && (
                <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50/80 p-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-800">
                      <span className="text-amber-600 font-bold">↻</span> Reopened for Follow-up
                    </div>
                    {ticket.reopenedAt && (
                      <span className="text-xs text-amber-600">
                        {formatDate(ticket.reopenedAt, true)}
                      </span>
                    )}
                  </div>
                  <div className="whitespace-pre-wrap text-sm text-slate-800 font-medium">
                    {ticket.reopenReason}
                  </div>
                  {ticket.reopenedBy?.name && (
                    <div className="mt-2 text-xs text-slate-500">
                      Reopened by: <span className="font-semibold text-slate-700">{ticket.reopenedBy.name}</span>
                      {ticket.reopenedBy.role && <span> · {titleCase(ticket.reopenedBy.role.replace('_', ' '))}</span>}
                    </div>
                  )}
                </div>
              )}

              {ticket.resolutionNote && (
                <div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50/80 p-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-800">
                      <span className="text-emerald-600 font-bold">✓</span> Resolution Details
                    </div>
                    {ticket.resolvedAt && (
                      <span className="text-xs text-emerald-600">
                        {formatDate(ticket.resolvedAt, true)}
                      </span>
                    )}
                  </div>
                  <div className="whitespace-pre-wrap text-sm text-slate-800 font-medium">
                    {ticket.resolutionNote}
                  </div>
                  {ticket.resolvedBy?.name && (
                    <div className="mt-2 text-xs text-slate-500">
                      Resolved by: <span className="font-semibold text-slate-700">{ticket.resolvedBy.name}</span>
                      {ticket.resolvedBy.role && <span> · {titleCase(ticket.resolvedBy.role.replace('_', ' '))}</span>}
                    </div>
                  )}
                </div>
              )}

              <div className="mb-8 rounded-lg border border-blue-100 bg-blue-50/50 p-4">
                <div className="mb-2 text-xs font-bold uppercase tracking-wider text-blue-800">Original Description</div>
                <div className="whitespace-pre-wrap text-sm text-slate-800">{ticket.description}</div>
              </div>

              <h4 className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Activity / Notes</h4>
              {notes.length === 0 ? (
                <p className="text-sm text-slate-400">No notes yet.</p>
              ) : (
                <div className="relative ml-3 space-y-6 border-l-2 border-slate-200 pl-6">
                  {notes.map((item) => (
                    <div key={item._id} className="relative">
                      <div className="absolute -left-[31px] top-1 h-3.5 w-3.5 rounded-full border-2 border-white bg-slate-400" />
                      <div className="text-sm font-medium text-slate-900">
                        {item.addedBy?.name || 'User'} {item.addedBy?.role && <span className="font-normal text-slate-500">· {titleCase(item.addedBy.role.replace('_', ' '))}</span>}
                      </div>
                      <div className="mb-1 text-xs text-slate-400">{formatDate(item.createdAt, true)}</div>
                      <div className="mt-2 rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm text-slate-700">{item.note}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {!closed && (
              <div className="flex gap-3 border-t border-slate-200 bg-slate-50 p-4">
                <input
                  type="text" placeholder="Add a note or update…"
                  className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  value={remark} onChange={(e) => setRemark(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addRemark()}
                />
                <Button onClick={addRemark} loading={saving}>Post</Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mandatory Resolution / Closing Remarks Modal */}
      {statusModal && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-sm"
          onClick={() => { setStatusModal(null); setStatusRemark(''); setStatusError('') }}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50">
              <h3 className="font-semibold text-slate-900">
                {statusModal === 'Resolved'
                  ? `Mark as Resolve — ${ticket.ticketId}`
                  : statusModal === 'Closed'
                  ? `Close Ticket — ${ticket.ticketId}`
                  : `Reopen Ticket — ${ticket.ticketId}`}
              </h3>
              <button
                onClick={() => { setStatusModal(null); setStatusRemark(''); setStatusError('') }}
                className="text-slate-400 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-600">
                {statusModal === 'Resolved'
                  ? 'Please record details regarding how this ticket was resolved, actions taken, and the solution provided to the customer/user. This description is mandatory.'
                  : statusModal === 'Closed'
                  ? 'Please record closing remarks and confirmation details regarding this ticket closure. This description is mandatory.'
                  : 'Please explain the reason for reopening this ticket for further follow-up or additional actions. This description is mandatory.'}
              </p>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  {statusModal === 'Resolved'
                    ? 'Resolution Details / Remarks *'
                    : statusModal === 'Closed'
                    ? 'Closing Remarks *'
                    : 'Reopening Reason / Follow-up Notes *'}
                </label>
                <textarea
                  rows={4}
                  value={statusRemark}
                  onChange={(e) => {
                    setStatusRemark(e.target.value)
                    if (e.target.value.trim()) setStatusError('')
                  }}
                  placeholder={
                    statusModal === 'Resolved'
                      ? 'Describe in detail how this ticket was resolved, steps taken, or solution given...'
                      : statusModal === 'Closed'
                      ? 'Enter closing remarks, summary, or resolution confirmation...'
                      : 'Enter why this ticket is being reopened, further follow-up required...'
                  }
                  className={`w-full rounded-lg border p-3 text-sm outline-none transition focus:ring-1 ${
                    statusError
                      ? 'border-red-400 focus:border-red-500 focus:ring-red-500'
                      : 'border-slate-300 focus:border-blue-500 focus:ring-blue-500'
                  }`}
                  autoFocus
                />
                {statusError && <p className="mt-1 text-xs font-medium text-red-600">{statusError}</p>}
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 px-6 py-4 bg-slate-50">
              <Button
                variant="ghost"
                onClick={() => { setStatusModal(null); setStatusRemark(''); setStatusError('') }}
              >
                Cancel
              </Button>
              <Button
                variant={statusModal === 'Resolved' ? 'success' : 'primary'}
                disabled={busyStatus}
                loading={busyStatus}
                onClick={handleConfirmStatus}
              >
                {statusModal === 'Resolved' ? 'Confirm Resolution' : statusModal === 'Closed' ? 'Confirm & Close' : 'Confirm Reopen'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation popup */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-slate-900">Confirm Delete</h3>
            <p className="mt-2 text-sm text-slate-500">
              Are you sure you want to permanently delete ticket <span className="font-semibold text-slate-700">{ticket?.ticketId}</span>? This action cannot be undone.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deletingTicket}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deletingTicket}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-50"
              >
                {deletingTicket ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Row({ label, value }) {
  return <div className="flex justify-between text-sm"><span className="text-slate-500">{label}</span><span className="font-medium text-slate-900">{value}</span></div>
}

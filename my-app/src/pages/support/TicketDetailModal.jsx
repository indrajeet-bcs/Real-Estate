import { useState, useEffect, useCallback } from 'react'
import { Card, Button, StatusBadge } from '../../components/ui.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import { ticketsApi } from '../../api/resources.js'
import { formatDate, titleCase } from '../../lib/format.js'

// Live ticket detail (was mock-driven). Loads GET /api/tickets/:id, posts notes
// to /:id/notes, and changes status via /:id/status. The activity timeline is
// the ticket's real internalNotes.
const priorityCls = (p) =>
  p === 'Critical' ? 'bg-red-100 text-red-700' : p === 'High' ? 'bg-orange-100 text-orange-700' : p === 'Medium' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700'

export default function TicketDetailModal({ ticketId, onClose, onChanged }) {
  const toast = useToast()
  const [ticket, setTicket] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [remark, setRemark] = useState('')
  const [saving, setSaving] = useState(false)
  const [busyStatus, setBusyStatus] = useState(false)

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

  const changeStatus = async (status) => {
    if (status === 'Resolved' && !window.confirm('Mark this ticket as Resolved?')) return
    setBusyStatus(true)
    try {
      await ticketsApi.changeStatus(ticketId, status)
      toast.success(`Status changed to ${status}`)
      await load()
      onChanged?.()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to change status')
    } finally {
      setBusyStatus(false)
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
            {!resolvedOrClosed && <Button size="sm" variant="secondary" disabled={busyStatus} onClick={() => changeStatus('Resolved')}>Mark Resolved</Button>}
            {ticket.status === 'Resolved' && <Button size="sm" variant="secondary" disabled={busyStatus} onClick={() => changeStatus('Closed')}>Close</Button>}
            <button onClick={onClose} className="ml-2 rounded-full p-2 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700">✕</button>
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">
          {/* Context */}
          <div className="w-2/5 overflow-y-auto border-r border-slate-200 bg-slate-50/50 p-6">
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
                <Row label="Created" value={formatDate(ticket.createdAt, true)} />
              </Card>
            </div>
          </div>

          {/* Thread */}
          <div className="flex w-3/5 flex-col overflow-hidden bg-white">
            <div className="flex-1 overflow-y-auto p-6">
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
    </div>
  )
}

function Row({ label, value }) {
  return <div className="flex justify-between text-sm"><span className="text-slate-500">{label}</span><span className="font-medium text-slate-900">{value}</span></div>
}

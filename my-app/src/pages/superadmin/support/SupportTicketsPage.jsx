import { useState, useCallback } from 'react'
import { ticketsApi, ticketCategoriesApi, firmsApi, supportMembersApi } from '../../../api/resources.js'
import { useFetch } from '../../../hooks/useFetch.js'
import { useDebounce } from '../../../hooks/useDebounce.js'
import { useToast } from '../../../context/ToastContext.jsx'
import { formatDate } from '../../../lib/format.js'
import { PageHeader, Button, Input, Select, Pagination, Loader, ErrorState, Card, Modal, Textarea } from '../../../components/ui.jsx'

function StatusBadge({ status }) {
  const colors = {
    'Open': 'bg-blue-50 text-blue-700 border-blue-200',
    'In Progress': 'bg-amber-50 text-amber-700 border-amber-200',
    'Waiting for Customer': 'bg-purple-50 text-purple-700 border-purple-200',
    'Resolved': 'bg-emerald-50 text-emerald-700 border-emerald-200',
    'Closed': 'bg-slate-100 text-slate-600 border-slate-200',
  }
  const cls = colors[status] || colors['Open']
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${cls}`}>{status}</span>
}

function PriorityBadge({ priority }) {
  const colors = {
    'Low': 'bg-slate-100 text-slate-600',
    'Medium': 'bg-blue-100 text-blue-700',
    'High': 'bg-orange-100 text-orange-700',
    'Critical': 'bg-rose-100 text-rose-700 font-bold',
  }
  return <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${colors[priority] || colors['Medium']}`}>{priority}</span>
}

export default function SupportTicketsPage() {
  const toast = useToast()

  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [searchInput, setSearchInput] = useState('')
  const search = useDebounce(searchInput)

  const [filters, setFilters] = useState({
    status: 'all',
    priority: 'all',
    category: 'all',
    firm: 'all'
  })

  // Action Modals
  const [actionModal, setActionModal] = useState(null)
  const [selectedTicket, setSelectedTicket] = useState(null)
  const [note, setNote] = useState('')
  const [newStatus, setNewStatus] = useState('')
  const [assigneeId, setAssigneeId] = useState('')

  // Data fetching
  const { data: categories } = useFetch(useCallback(() => ticketCategoriesApi.list(), []))
  const { data: firms } = useFetch(useCallback(() => firmsApi.list({ limit: 100 }), []))
  const { data: members } = useFetch(useCallback(() => supportMembersApi.list(), []))

  const fetchFn = useCallback(() => ticketsApi.list({ page, limit, search, ...filters }), [page, limit, search, filters])
  const { data, meta, loading, error, refetch } = useFetch(fetchFn)

  const handleFilterChange = (k, v) => {
    setPage(1)
    setFilters(prev => ({ ...prev, [k]: v }))
  }

  const handleAction = async (type) => {
    try {
      if (type === 'note') {
        await ticketsApi.addNote(selectedTicket._id, note)
        toast.success('Internal note added')
      } else if (type === 'status') {
        const isReopen = (selectedTicket.status === 'Resolved' || selectedTicket.status === 'Closed') && (newStatus === 'Open' || newStatus === 'In Progress')
        if ((newStatus === 'Resolved' || newStatus === 'Closed' || isReopen) && !note.trim()) {
          toast.error(
            isReopen
              ? 'Please provide reopening reason / follow-up notes before saving'
              : `Please provide ${newStatus === 'Resolved' ? 'resolution details' : 'closing remarks'} before saving`
          )
          return
        }
        await ticketsApi.changeStatus(selectedTicket._id, { status: newStatus, remark: note.trim() })
        toast.success(isReopen ? 'Ticket reopened successfully' : `Status updated to ${newStatus}`)
      } else if (type === 'reply') {
        if (!note.trim()) { toast.error('Please enter a reply'); return }
        await ticketsApi.addNote(selectedTicket._id, note)
        toast.success('Reply posted to the ticket thread')
      } else if (type === 'assign') {
        if (!assigneeId) {
          toast.error('Please select a support member')
          return
        }
        await ticketsApi.assign(selectedTicket._id, assigneeId)
        toast.success('Ticket assigned successfully')
      }
      refetch()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action failed')
    } finally {
      setActionModal(null)
      setSelectedTicket(null)
      setNote('')
      setAssigneeId('')
    }
  }

  const openModal = (type, ticket) => {
    setSelectedTicket(ticket)
    setActionModal(type)
    if (type === 'status') setNewStatus(ticket.status)
    if (type === 'assign') setAssigneeId(ticket.assignedTo?._id || '')
  }

  const [ticketToDelete, setTicketToDelete] = useState(null)
  const [deletingTicket, setDeletingTicket] = useState(false)

  const handleConfirmDeleteTicket = async () => {
    if (!ticketToDelete) return
    setDeletingTicket(true)
    try {
      await ticketsApi.remove(ticketToDelete._id)
      toast.success(`Ticket ${ticketToDelete.ticketId} deleted successfully`)
      if (actionModal === 'view') setActionModal(null)
      setTicketToDelete(null)
      refetch()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete ticket')
    } finally {
      setDeletingTicket(false)
    }
  }

  const kpis = meta?.kpis || {}
  const tickets = data || []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Support Tickets"
        subtitle="Manage and resolve tenant support requests."
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Total Tickets', val: kpis.total },
          { label: 'Open', val: kpis.open },
          { label: 'In Progress', val: kpis.inProgress },
          { label: 'Resolved', val: kpis.resolved },
          { label: 'Closed', val: kpis.closed },
        ].map(k => (
          <Card key={k.label} className="p-4 text-center">
            <div className="text-2xl font-bold text-slate-800">{k.val ?? '-'}</div>
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500 mt-1">{k.label}</div>
          </Card>
        ))}
      </div>

      {/* Search & Filters */}
      <div className="flex flex-wrap gap-3 items-end bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex-1 min-w-[200px]">
          <Input 
            placeholder="Search by Ticket ID or Subject..." 
            value={searchInput} 
            onChange={(e) => { setPage(1); setSearchInput(e.target.value) }} 
          />
        </div>
        <div className="w-40">
          <Select value={filters.status} onChange={(e) => handleFilterChange('status', e.target.value)}>
            <option value="all">All Statuses</option>
            <option value="Open">Open</option>
            <option value="In Progress">In Progress</option>
            <option value="Waiting for Customer">Waiting for Customer</option>
            <option value="Resolved">Resolved</option>
            <option value="Closed">Closed</option>
          </Select>
        </div>
        <div className="w-32">
          <Select value={filters.priority} onChange={(e) => handleFilterChange('priority', e.target.value)}>
            <option value="all">All Priorities</option>
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
            <option value="Critical">Critical</option>
          </Select>
        </div>
        <div className="w-40">
          <Select value={filters.category} onChange={(e) => handleFilterChange('category', e.target.value)}>
            <option value="all">All Categories</option>
            {(categories || []).map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
          </Select>
        </div>
        <div className="w-40">
          <Select value={filters.firm} onChange={(e) => handleFilterChange('firm', e.target.value)}>
            <option value="all">All Companies</option>
            {(firms || []).map(f => <option key={f._id} value={f._id}>{f.name}</option>)}
          </Select>
        </div>
      </div>

      {/* Table */}
      {loading ? <Loader /> : error ? <ErrorState message={error} onRetry={refetch} /> : (
        <div className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500 font-semibold tracking-wide">
                <tr>
                  <th className="px-4 py-3">Ticket ID</th>
                  <th className="px-4 py-3">Company</th>
                  <th className="px-4 py-3">Subject</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3">Assigned To</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Updated</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tickets.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="py-16 text-center text-slate-500">No tickets found.</td>
                  </tr>
                ) : (
                  tickets.map(t => (
                    <tr key={t._id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-700">{t.ticketId}</td>
                      <td className="px-4 py-3 font-medium text-slate-800">{t.firm?.name || 'Unknown'}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900 truncate max-w-[200px]" title={t.subject}>{t.subject}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{t.category?.name || '—'}</td>
                      <td className="px-4 py-3"><PriorityBadge priority={t.priority} /></td>
                      <td className="px-4 py-3 text-slate-600">{t.assignedTo?.name || 'Unassigned'}</td>
                      <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                      <td className="px-4 py-3 text-xs text-slate-500">{formatDate(t.updatedAt)}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="secondary" onClick={() => openModal('view', t)}>View</Button>
                          <Select 
                            className="!py-1 !text-xs !w-24 bg-white"
                            value=""
                            onChange={(e) => {
                              if (e.target.value === 'status') openModal('status', t)
                              if (e.target.value === 'note') openModal('note', t)
                              if (e.target.value === 'reply') handleAction('reply')
                              if (e.target.value === 'assign') openModal('assign', t)
                              if (e.target.value === 'reopen') {
                                setSelectedTicket(t)
                                setNewStatus('Open')
                                setNote('')
                                setActionModal('status')
                              }
                              if (e.target.value === 'delete') setTicketToDelete(t)
                            }}
                          >
                            <option value="" disabled>Actions...</option>
                            <option value="reply">Reply</option>
                            <option value="status">Change Status</option>
                            <option value="assign">Assign</option>
                            <option value="note">Add Note</option>
                            {(t.status === 'Resolved' || t.status === 'Closed') && <option value="reopen">Reopen Ticket</option>}
                            {t.status === 'Closed' && <option value="delete">Delete Ticket</option>}
                          </Select>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="px-4 border-t border-slate-200">
             <Pagination meta={meta} onPage={setPage} onPageSize={(n) => { setLimit(n); setPage(1) }} />
          </div>
        </div>
      )}

      {/* Modals */}
      {actionModal === 'note' && (
        <Modal 
          open 
          title={`Add Internal Note: ${selectedTicket?.ticketId}`} 
          onClose={() => setActionModal(null)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setActionModal(null)}>Cancel</Button>
              <Button variant="primary" onClick={() => handleAction('note')} disabled={!note.trim()}>Add Note</Button>
            </>
          }
        >
          <Textarea 
            label="Internal Note" 
            placeholder="This note will only be visible to staff..." 
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </Modal>
      )}

      {actionModal === 'status' && (
        <Modal 
          open 
          title={newStatus === 'Open' && (selectedTicket?.status === 'Resolved' || selectedTicket?.status === 'Closed') ? `Reopen Ticket: ${selectedTicket?.ticketId}` : `Update Status: ${selectedTicket?.ticketId}`} 
          onClose={() => setActionModal(null)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setActionModal(null)}>Cancel</Button>
              <Button variant="primary" onClick={() => handleAction('status')}>Save</Button>
            </>
          }
        >
          <div className="space-y-4">
            <Select label="Status" value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>
              <option value="Open">Open</option>
              <option value="In Progress">In Progress</option>
              <option value="Waiting for Customer">Waiting for Customer</option>
              <option value="Resolved">Resolved</option>
              <option value="Closed">Closed</option>
            </Select>

            {((newStatus === 'Resolved' || newStatus === 'Closed') ||
              ((selectedTicket?.status === 'Resolved' || selectedTicket?.status === 'Closed') && (newStatus === 'Open' || newStatus === 'In Progress'))) && (
              <div>
                <Textarea
                  label={
                    newStatus === 'Resolved'
                      ? "Resolution Details / Remarks *"
                      : newStatus === 'Closed'
                      ? "Closing Remarks *"
                      : "Reopening Reason / Follow-up Notes *"
                  }
                  placeholder={
                    newStatus === 'Resolved'
                      ? "Describe in detail how this ticket was resolved..."
                      : newStatus === 'Closed'
                      ? "Enter closing remarks regarding this ticket..."
                      : "Describe why this ticket is being reopened for further follow-up..."
                  }
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  required
                />
                <p className="mt-1 text-xs font-medium text-amber-600">
                  * Mandatory: {newStatus === 'Open' || newStatus === 'In Progress' ? 'Reason for reopening this ticket is required.' : `Details regarding how the ticket was ${newStatus.toLowerCase()} are required.`}
                </p>
              </div>
            )}
          </div>
        </Modal>
      )}

      {actionModal === 'assign' && (
        <Modal 
          open 
          title={`Assign Ticket: ${selectedTicket?.ticketId}`} 
          onClose={() => setActionModal(null)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setActionModal(null)}>Cancel</Button>
              <Button variant="primary" onClick={() => handleAction('assign')}>Assign</Button>
            </>
          }
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-600">Select a support member to handle this ticket.</p>
            <Select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
              <option value="" disabled>Search & Select Member...</option>
              {(members || []).filter(m => m.isActive).map(m => (
                <option key={m._id} value={m._id}>{m.name} ({m.role})</option>
              ))}
            </Select>
          </div>
        </Modal>
      )}

      {actionModal === 'view' && (
        <Modal 
          open 
          wide
          title={`Ticket Details: ${selectedTicket?.ticketId}`} 
          onClose={() => setActionModal(null)}
          footer={
            <div className="flex items-center justify-between w-full">
              <div className="flex gap-2">
                {selectedTicket?.status !== 'Resolved' && selectedTicket?.status !== 'Closed' && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setActionModal('status')
                      setNewStatus('Resolved')
                      setNote('')
                    }}
                  >
                    Mark as Resolve
                  </Button>
                )}
                {selectedTicket?.status === 'Resolved' && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setActionModal('status')
                      setNewStatus('Closed')
                      setNote('')
                    }}
                  >
                    Close
                  </Button>
                )}
                {(selectedTicket?.status === 'Resolved' || selectedTicket?.status === 'Closed') && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setActionModal('status')
                      setNewStatus('Open')
                      setNote('')
                    }}
                  >
                    Reopen Ticket
                  </Button>
                )}
                {selectedTicket?.status === 'Closed' && (
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => setTicketToDelete(selectedTicket)}
                  >
                    Delete Ticket
                  </Button>
                )}
              </div>
              <Button onClick={() => setActionModal(null)}>Close Window</Button>
            </div>
          }
        >
          <div className="space-y-4">
            <h3 className="text-xl font-bold">{selectedTicket?.subject}</h3>
            <div className="grid grid-cols-2 gap-4 text-sm bg-slate-50 p-4 rounded border border-slate-200">
              <div><span className="text-slate-500">Company:</span> <span className="font-medium">{selectedTicket?.firm?.name}</span></div>
              <div><span className="text-slate-500">Category:</span> <span className="font-medium">{selectedTicket?.category?.name || '—'}</span></div>
              <div><span className="text-slate-500">Status:</span> <StatusBadge status={selectedTicket?.status} /></div>
              <div><span className="text-slate-500">Priority:</span> <PriorityBadge priority={selectedTicket?.priority} /></div>
              <div className="col-span-2"><span className="text-slate-500">Assigned To:</span> <span className="font-medium">{selectedTicket?.assignedTo?.name || 'Unassigned'}</span></div>
            </div>

            {selectedTicket?.resolutionNote && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 p-4">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                    <span className="text-emerald-600 font-bold">✓</span> Resolution Details
                  </span>
                  {selectedTicket.resolvedAt && (
                    <span className="text-xs text-emerald-600 font-medium">
                      {formatDate(selectedTicket.resolvedAt, true)}
                    </span>
                  )}
                </div>
                <p className="whitespace-pre-wrap text-sm text-slate-800 font-medium">{selectedTicket.resolutionNote}</p>
                {selectedTicket.resolvedBy?.name && (
                  <div className="mt-2 text-xs text-slate-500">
                    Resolved by: <span className="font-semibold text-slate-700">{selectedTicket.resolvedBy.name}</span>
                  </div>
                )}
              </div>
            )}

            <div>
              <h4 className="font-semibold mb-2">Description</h4>
              <p className="whitespace-pre-wrap text-sm text-slate-700 bg-white p-4 border border-slate-200 rounded">{selectedTicket?.description}</p>
            </div>
            {selectedTicket?.internalNotes?.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2 text-blue-800">Internal Notes</h4>
                <div className="space-y-2">
                  {selectedTicket.internalNotes.map((n, i) => (
                    <div key={i} className="text-sm bg-blue-50 border border-blue-100 p-3 rounded">
                      <div className="text-xs text-slate-500 mb-1">{formatDate(n.createdAt)}</div>
                      {n.note}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Delete ticket confirmation popup */}
      {ticketToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-slate-900">Confirm Delete</h3>
            <p className="mt-2 text-sm text-slate-500">
              Are you sure you want to permanently delete ticket <span className="font-semibold text-slate-700">{ticketToDelete.ticketId}</span>? This action cannot be undone.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setTicketToDelete(null)}
                disabled={deletingTicket}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteTicket}
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

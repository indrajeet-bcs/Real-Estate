import { useState, useCallback } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { customersApi, projectsApi, followupsApi, usersApi } from '../../api/resources.js'
import { useFetch } from '../../hooks/useFetch.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import { CUSTOMER_STATUS } from '../../lib/constants.js'
import { formatDate, formatMoney, titleCase } from '../../lib/format.js'
import {
  Card, Button, Input, Textarea, Select, StatusBadge, Modal,
  Loader, ErrorState,
} from '../../components/ui.jsx'

const TABS = ['Overview', 'Notes', 'Interested Projects', 'Documents', 'Follow-ups', 'Visits', 'Bookings', 'EMI Planner', 'Activity']

// Option lists for the Customer Information edit form (mirror the Add Lead form).
const PROPERTY_TYPES = ['apartment', 'villa', 'plot', 'commercial', 'penthouse', 'row_house']
const CONFIGS = ['1 RK', '1 BHK', '2 BHK', '3 BHK', '4 BHK', '4+ BHK', 'Plot', 'Office']
const SOURCES = ['walk_in', 'website', 'referral', 'social_media', 'call', 'portal', 'other']

export default function CustomerProfilePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { can } = useAuth()
  const initialTab = TABS.includes(searchParams.get('tab')) ? searchParams.get('tab') : 'Overview'
  const [tab, setTab] = useState(initialTab)
  const [transferring, setTransferring] = useState(false)

  const { data, loading, error, refetch } = useFetch(
    useCallback(() => customersApi.get(id), [id])
  )

  if (loading) return <Loader />
  if (error) return <ErrorState message={error} onRetry={refetch} />

  const { customer, followUps, visits, bookings } = data
  const editable = can('customer', 'edit')
  const canTransfer = can('lead', 'assign') // Admin & Sub-Admin

  return (
    <div>
      <button onClick={() => navigate(-1)} className="mb-4 text-sm text-slate-600 hover:text-slate-900">← Back</button>

      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-slate-900">{customer.name}</h1>
            <StatusBadge status={customer.status} />
          </div>
          <p className="mt-1 text-sm text-slate-600">
            {customer.mobile} {customer.email && `· ${customer.email}`} · Source: {titleCase(customer.source)}
          </p>
          {customer.assignedTo && (
            <p className="text-xs text-slate-500">Assigned to {customer.assignedTo.name}</p>
          )}
        </div>
        <div className="flex gap-2">
          {canTransfer && <Button variant="secondary" onClick={() => setTransferring(true)}>Transfer</Button>}
          {editable && <StatusActions customer={customer} onDone={refetch} />}
        </div>
      </div>

      {transferring && <TransferCustomerModal customer={customer} onClose={() => setTransferring(false)} onDone={() => { setTransferring(false); refetch() }} />}

      {/* Tabs */}
      <div className="mb-6 flex flex-wrap gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm transition ${
              tab === t ? 'border-b-2 border-blue-500 text-slate-900' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Overview' && <OverviewTab customer={customer} editable={editable} onDone={refetch} />}
      {tab === 'Notes' && <NotesTab customer={customer} editable={editable} onDone={refetch} />}
      {tab === 'Interested Projects' && <InterestsTab customer={customer} editable={editable} onDone={refetch} />}
      {tab === 'Documents' && <DocumentsTab customer={customer} editable={editable} onDone={refetch} />}
      {tab === 'Follow-ups' && <FollowUpsTab customer={customer} followUps={followUps} editable={editable} onDone={refetch} />}
      {tab === 'Visits' && <RelatedList items={visits} type="visit" />}
      {tab === 'Bookings' && <BookingsTab bookings={bookings} />}
      {tab === 'EMI Planner' && <EmiPlannerTab customer={customer} editable={editable} onDone={refetch} />}
      {tab === 'Activity' && <ActivityTab activity={customer.activity} />}
    </div>
  )
}

// --- Overview ---
function OverviewTab({ customer, editable, onDone }) {
  const [editing, setEditing] = useState(false)
  const rows = [
    ['Mobile', customer.mobile],
    ['Alt Mobile', customer.altMobile],
    ['Email', customer.email],
    ['Address', customer.address],
    ['Occupation', customer.occupation],
    ['Budget', customer.budgetMin || customer.budgetMax ? `${formatMoney(customer.budgetMin)} – ${formatMoney(customer.budgetMax)}` : null],
    ['Property Type', customer.propertyType ? titleCase(customer.propertyType) : null],
    ['Configuration', customer.configuration],
    ['Preferred Location', customer.preferredLocation],
    ['Source', titleCase(customer.source)],
    ['Created', formatDate(customer.createdAt, true)],
  ]
  // Assignment details (spec §Lead Details Section 6). Branch is derived from
  // the assigned executive's branch; sub-admin is the branch manager.
  const assignment = [
    ['Assigned Employee', customer.assignedTo?.name],
    ['Branch', customer.assignedTo?.branch],
    ['Assigned On', customer.assignedAt ? formatDate(customer.assignedAt) : null],
    ['KYC Status', customer.kycStatus ? titleCase(customer.kycStatus) : null],
  ]
  const transfers = customer.transferHistory || []
  return (
    <div className="space-y-6">
      {editing && (
        <EditCustomerModal
          customer={customer}
          onClose={() => setEditing(false)}
          onDone={() => { setEditing(false); onDone?.() }}
        />
      )}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-6 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Customer Information</h3>
            {editable && <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>Edit</Button>}
          </div>
          <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
            {rows.map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
                <dd className="mt-1 text-sm text-slate-800">{value || '—'}</dd>
              </div>
            ))}
          </dl>
        </Card>
        <Card className="p-6">
          <h3 className="mb-4 text-sm font-semibold text-slate-900">Assignment Details</h3>
          <dl className="space-y-3">
            {assignment.map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
                <dd className="mt-0.5 text-sm text-slate-800">{value || <span className="text-slate-400">Unassigned</span>}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>

      {/* Transfer History (spec §Lead Transfer) */}
      {transfers.length > 0 && (
        <Card className="p-6">
          <h3 className="mb-4 text-sm font-semibold text-slate-900">Transfer History</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="py-2 pr-4 font-medium">Date &amp; Time</th>
                  <th className="py-2 pr-4 font-medium">Previous Employee</th>
                  <th className="py-2 pr-4 font-medium">New Employee</th>
                  <th className="py-2 pr-4 font-medium">Transferred By</th>
                  <th className="py-2 pr-4 font-medium">Reason</th>
                  <th className="py-2 font-medium">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[...transfers].reverse().map((t) => (
                  <tr key={t._id}>
                    <td className="py-2 pr-4 text-slate-500">{formatDate(t.at, true)}</td>
                    <td className="py-2 pr-4 text-slate-700">{t.previousEmployeeName || '—'}</td>
                    <td className="py-2 pr-4 font-medium text-slate-800">{t.newEmployeeName || '—'}</td>
                    <td className="py-2 pr-4 text-slate-700">{t.transferredByName || '—'}</td>
                    <td className="py-2 pr-4 text-slate-600">{t.reason || '—'}</td>
                    <td className="py-2 text-slate-600">{t.remarks || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}

// --- Edit core customer information (all roles with customer:edit) ---
function EditCustomerModal({ customer, onClose, onDone }) {
  const toast = useToast()
  const [form, setForm] = useState({
    name: customer.name || '',
    mobile: customer.mobile || '',
    altMobile: customer.altMobile || '',
    email: customer.email || '',
    address: customer.address || '',
    occupation: customer.occupation || '',
    budgetMin: customer.budgetMin || '',
    budgetMax: customer.budgetMax || '',
    propertyType: customer.propertyType || '',
    configuration: customer.configuration || '',
    preferredLocation: customer.preferredLocation || '',
    source: customer.source || '',
  })
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const valid = form.name.trim().length >= 2 && form.mobile.trim().length >= 7

  async function save() {
    if (!valid) { toast.error('Name and a valid mobile are required'); return }
    setBusy(true)
    try {
      await customersApi.update(customer._id, {
        name: form.name,
        mobile: form.mobile,
        altMobile: form.altMobile || undefined,
        email: form.email || '',
        address: form.address || undefined,
        occupation: form.occupation || undefined,
        budgetMin: form.budgetMin !== '' ? Number(form.budgetMin) : undefined,
        budgetMax: form.budgetMax !== '' ? Number(form.budgetMax) : undefined,
        propertyType: form.propertyType || undefined,
        configuration: form.configuration || undefined,
        preferredLocation: form.preferredLocation || undefined,
        source: form.source || undefined,
      })
      toast.success('Customer information updated')
      onDone()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={onClose} wide title={`Edit — ${customer.name}`} footer={
      <>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={save} disabled={busy || !valid}>Save Changes</Button>
      </>
    }>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Name *" value={form.name} onChange={set('name')} />
        <Input label="Mobile *" value={form.mobile} onChange={set('mobile')} />
        <Input label="Alt Mobile" value={form.altMobile} onChange={set('altMobile')} />
        <Input label="Email" type="email" value={form.email} onChange={set('email')} />
        <Input label="Occupation" value={form.occupation} onChange={set('occupation')} />
        <Input label="Preferred Location" value={form.preferredLocation} onChange={set('preferredLocation')} />
        <Input label="Budget (min ₹)" type="number" value={form.budgetMin} onChange={set('budgetMin')} />
        <Input label="Budget (max ₹)" type="number" value={form.budgetMax} onChange={set('budgetMax')} />
        <Select label="Property Type" value={form.propertyType} onChange={set('propertyType')}>
          <option value="">Select…</option>
          {PROPERTY_TYPES.map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}
        </Select>
        <Select label="Configuration" value={form.configuration} onChange={set('configuration')}>
          <option value="">Select…</option>
          {CONFIGS.map((c) => <option key={c} value={c}>{c}</option>)}
        </Select>
        <Select label="Source" value={form.source} onChange={set('source')}>
          <option value="">Select…</option>
          {SOURCES.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
        </Select>
        <div className="sm:col-span-2">
          <Textarea label="Address" value={form.address} onChange={set('address')} />
        </div>
      </div>
    </Modal>
  )
}

// --- Transfer customer to another employee (Admin/Sub-Admin) ---
function TransferCustomerModal({ customer, onClose, onDone }) {
  const toast = useToast()
  const [form, setForm] = useState({ newEmployee: '', reason: '', remarks: '' })
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const { data: execs } = useFetch(useCallback(() => usersApi.list({ role: 'sales_executive', status: 'active', limit: 200 }), []))

  async function save() {
    setBusy(true)
    try {
      const res = await customersApi.transfer(customer._id, form)
      const d = res.data.data
      toast.success(`Customer transferred${d?.reassignedFollowUps ? ` · ${d.reassignedFollowUps} follow-up(s) moved` : ''}`)
      onDone()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={`Transfer — ${customer.name}`} footer={
      <>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={save} disabled={busy || !form.newEmployee || !form.reason.trim()}>Confirm Transfer</Button>
      </>
    }>
      <p className="mb-3 text-sm text-slate-600">Currently with <strong>{customer.assignedTo?.name || 'the pool'}</strong>. Pending follow-ups &amp; future site visits move to the new employee; ownership history is preserved.</p>
      <div className="space-y-4">
        <Select label="New Employee" value={form.newEmployee} onChange={set('newEmployee')}>
          <option value="">Select an executive…</option>
          {(execs || []).filter((e) => e._id !== customer.assignedTo?._id).map((e) => <option key={e._id} value={e._id}>{e.name} · {e.email}</option>)}
        </Select>
        <Input label="Transfer Reason" value={form.reason} onChange={set('reason')} placeholder="Why is this customer being transferred?" />
        <Input label="Remarks (optional)" value={form.remarks} onChange={set('remarks')} />
      </div>
    </Modal>
  )
}

// --- Status actions (change status, reopen if lost) ---
function StatusActions({ customer, onDone }) {
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState(customer.status)
  const [lostReason, setLostReason] = useState('')
  const [busy, setBusy] = useState(false)

  async function save() {
    setBusy(true)
    try {
      await customersApi.changeStatus(customer._id, { status, lostReason })
      toast.success('Status updated')
      setOpen(false)
      onDone()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed')
    } finally {
      setBusy(false)
    }
  }

  async function reopen() {
    setBusy(true)
    try {
      const res = await customersApi.reopen(customer._id)
      toast.success('Reopened as new opportunity')
      onDone()
      return res
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex gap-2">
      {customer.status === CUSTOMER_STATUS.LOST && (
        <Button variant="secondary" onClick={reopen} disabled={busy}>Reopen</Button>
      )}
      <Button variant="secondary" onClick={() => setOpen(true)}>Change Status</Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Change Status"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={busy}>Save</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
            {Object.values(CUSTOMER_STATUS).map((s) => (
              <option key={s} value={s}>{titleCase(s)}</option>
            ))}
          </Select>
          {status === CUSTOMER_STATUS.LOST && (
            <Input label="Lost reason" value={lostReason} onChange={(e) => setLostReason(e.target.value)} />
          )}
        </div>
      </Modal>
    </div>
  )
}

// --- Notes ---
function NotesTab({ customer, editable, onDone }) {
  const toast = useToast()
  const [text, setText] = useState('')
  const [type, setType] = useState('call')
  const [busy, setBusy] = useState(false)

  async function add() {
    if (!text.trim()) return
    setBusy(true)
    try {
      await customersApi.addNote(customer._id, { type, text })
      setText('')
      toast.success('Note added')
      onDone()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      {editable && (
        <Card className="p-4">
          <div className="mb-3 flex gap-3">
            <div className="w-40">
              <Select value={type} onChange={(e) => setType(e.target.value)}>
                <option value="call">Call</option>
                <option value="meeting">Meeting</option>
                <option value="general">General</option>
              </Select>
            </div>
          </div>
          <Textarea placeholder="Add a note…" value={text} onChange={(e) => setText(e.target.value)} />
          <div className="mt-3 text-right">
            <Button onClick={add} disabled={busy}>Add Note</Button>
          </div>
        </Card>
      )}
      {(customer.notes || []).slice().reverse().map((n) => (
        <Card key={n._id} className="p-4">
          <div className="mb-1 flex items-center gap-2">
            <StatusBadge status={n.type} />
            <span className="text-xs text-slate-500">{formatDate(n.createdAt, true)}</span>
          </div>
          <p className="text-sm text-slate-800">{n.text}</p>
        </Card>
      ))}
      {(!customer.notes || customer.notes.length === 0) && <EmptyHint text="No notes yet" />}
    </div>
  )
}

// --- Interested Projects ---
function InterestsTab({ customer, editable, onDone }) {
  const toast = useToast()
  const { data: projects } = useFetch(useCallback(() => projectsApi.list({ limit: 100 }), []))
  const [project, setProject] = useState('')
  const [level, setLevel] = useState('warm')

  async function add() {
    if (!project) return
    try {
      await customersApi.addInterest(customer._id, { project, interestLevel: level })
      toast.success('Interest tagged')
      onDone()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed')
    }
  }
  async function remove(interestId) {
    await customersApi.removeInterest(customer._id, interestId)
    onDone()
  }

  return (
    <div className="space-y-4">
      {editable && (
        <Card className="flex flex-wrap items-end gap-3 p-4">
          <div className="w-64">
            <Select label="Project" value={project} onChange={(e) => setProject(e.target.value)}>
              <option value="">Select project…</option>
              {(projects || []).map((p) => (
                <option key={p._id} value={p._id}>{p.name}</option>
              ))}
            </Select>
          </div>
          <div className="w-40">
            <Select label="Interest" value={level} onChange={(e) => setLevel(e.target.value)}>
              {['cold', 'warm', 'hot'].map((l) => <option key={l} value={l}>{titleCase(l)}</option>)}
            </Select>
          </div>
          <Button onClick={add}>Tag Interest</Button>
        </Card>
      )}
      {(customer.interestedProjects || []).map((i) => (
        <Card key={i._id} className="flex items-center justify-between p-4">
          <div>
            <div className="font-medium text-slate-900">{i.project?.name || 'Project'}</div>
            <div className="text-xs text-slate-500">{i.project?.location}</div>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={i.interestLevel} />
            {editable && <button onClick={() => remove(i._id)} className="text-xs text-red-600 hover:text-red-300">Remove</button>}
          </div>
        </Card>
      ))}
      {(!customer.interestedProjects || customer.interestedProjects.length === 0) && <EmptyHint text="No interested projects tagged" />}
    </div>
  )
}

// --- Documents ---
function DocumentsTab({ customer, editable, onDone }) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)

  async function upload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const fd = new FormData()
    fd.append('file', file)
    fd.append('label', file.name)
    setBusy(true)
    try {
      await customersApi.uploadDocument(customer._id, fd)
      toast.success('Document uploaded')
      onDone()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed')
    } finally {
      setBusy(false)
      e.target.value = ''
    }
  }

  return (
    <div className="space-y-4">
      {editable && (
        <Card className="p-4">
          <label className="text-sm text-slate-700">
            <span className="mb-2 block">Upload a document (PDF, image, DOC — max 10MB)</span>
            <input type="file" onChange={upload} disabled={busy} className="text-sm text-slate-600" />
          </label>
        </Card>
      )}
      {(customer.documents || []).map((d) => (
        <Card key={d._id} className="flex items-center justify-between p-4">
          <div>
            <div className="font-medium text-slate-900">{d.label}</div>
            <div className="text-xs text-slate-500">{formatDate(d.uploadedAt)}</div>
          </div>
          <a href={d.fileUrl} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:text-blue-700">
            View
          </a>
        </Card>
      ))}
      {(!customer.documents || customer.documents.length === 0) && <EmptyHint text="No documents uploaded" />}
    </div>
  )
}

// --- Follow-ups (inline schedule + list) ---
function FollowUpsTab({ customer, followUps, editable, onDone }) {
  const toast = useToast()
  const [when, setWhen] = useState('')
  const [notes, setNotes] = useState('')

  async function schedule() {
    if (!when) return
    try {
      await followupsApi.create({ customer: customer._id, scheduledAt: when, notes })
      toast.success('Follow-up scheduled')
      setWhen(''); setNotes('')
      onDone()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed')
    }
  }

  return (
    <div className="space-y-4">
      {editable && (
        <Card className="flex flex-wrap items-end gap-3 p-4">
          <Input label="Date & time" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
          <div className="flex-1"><Input label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
          <Button onClick={schedule}>Schedule</Button>
        </Card>
      )}
      {(followUps || []).map((f) => (
        <Card key={f._id} className="flex items-center justify-between p-4">
          <div>
            <div className="text-sm text-slate-900">{formatDate(f.scheduledAt, true)}</div>
            <div className="text-xs text-slate-500">{f.notes || f.outcomeNotes || '—'}</div>
          </div>
          <StatusBadge status={f.status} />
        </Card>
      ))}
      {(!followUps || followUps.length === 0) && <EmptyHint text="No follow-ups" />}
    </div>
  )
}

function RelatedList({ items, type }) {
  if (!items || items.length === 0) return <EmptyHint text={`No ${type}s`} />
  return (
    <div className="space-y-3">
      {items.map((v) => (
        <Card key={v._id} className="flex items-center justify-between p-4">
          <div>
            <div className="text-sm text-slate-900">{v.project?.name || '—'}</div>
            <div className="text-xs text-slate-500">{formatDate(v.scheduledAt, true)}</div>
          </div>
          <StatusBadge status={v.status} />
        </Card>
      ))}
    </div>
  )
}

function BookingsTab({ bookings }) {
  if (!bookings || bookings.length === 0) return <EmptyHint text="No bookings" />
  return (
    <div className="space-y-3">
      {bookings.map((b) => (
        <Card key={b._id} className="flex items-center justify-between p-4">
          <div>
            <div className="text-sm text-slate-900">
              {b.project?.name} · Unit {b.unit?.unitNumber}
            </div>
            <div className="text-xs text-slate-500">{formatMoney(b.bookingAmount)} · {formatDate(b.createdAt)}</div>
          </div>
          <StatusBadge status={b.status} />
        </Card>
      ))}
    </div>
  )
}

function ActivityTab({ activity }) {
  if (!activity || activity.length === 0) return <EmptyHint text="No activity yet" />
  return (
    <div className="relative space-y-4 border-l border-slate-200 pl-6">
      {activity.slice().reverse().map((a) => (
        <div key={a._id} className="relative">
          <span className="absolute -left-[27px] top-1 h-2.5 w-2.5 rounded-full bg-blue-600" />
          <div className="text-sm text-slate-800">{titleCase(a.action)}</div>
          <div className="text-xs text-slate-500">{a.description} · {formatDate(a.at, true)}</div>
        </div>
      ))}
    </div>
  )
}

function EmptyHint({ text }) {
  return <div className="rounded-xl border border-slate-200 py-10 text-center text-sm text-slate-500">{text}</div>
}

// --- EMI Planner (Sales-Exec flow §E3) ---
// Client-side EMI calculator. The exec can save the estimate as a customer note
// so it appears on the timeline for follow-up conversations.
const inrFull = (n) => `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`

function EmiPlannerTab({ customer, editable, onDone }) {
  const toast = useToast()
  const [price, setPrice] = useState('')
  const [downPct, setDownPct] = useState(20)
  const [rate, setRate] = useState(8.5)
  const [years, setYears] = useState(20)
  const [busy, setBusy] = useState(false)

  const P = Number(price) || 0
  const down = Math.round((P * (Number(downPct) || 0)) / 100)
  const principal = Math.max(0, P - down)
  const r = (Number(rate) || 0) / 12 / 100
  const n = (Number(years) || 0) * 12

  let emi = 0
  if (principal > 0 && n > 0) {
    emi = r === 0 ? principal / n : (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
  }
  const totalPayable = emi * n
  const totalInterest = Math.max(0, totalPayable - principal)
  const valid = P > 0 && principal > 0 && n > 0

  async function saveAsNote() {
    if (!valid) return
    setBusy(true)
    const text =
      `EMI Estimate — Property ${inrFull(P)}, Down payment ${downPct}% (${inrFull(down)}), ` +
      `Loan ${inrFull(principal)} @ ${rate}% for ${years} yrs → EMI ${inrFull(emi)}/mo. ` +
      `Total payable ${inrFull(totalPayable)} (interest ${inrFull(totalInterest)}).`
    try {
      await customersApi.addNote(customer._id, { type: 'general', text })
      toast.success('EMI estimate saved to notes')
      onDone()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="p-5">
        <h3 className="mb-4 text-sm font-semibold text-slate-900">Loan Details</h3>
        <div className="space-y-4">
          <Input label="Property Price (₹)" type="number" min="0" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="e.g. 8500000" />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Down Payment (%)" type="number" min="0" max="100" value={downPct} onChange={(e) => setDownPct(e.target.value)} />
            <Input label="Interest Rate (% p.a.)" type="number" min="0" step="0.1" value={rate} onChange={(e) => setRate(e.target.value)} />
          </div>
          <Input label="Tenure (years)" type="number" min="1" max="40" value={years} onChange={(e) => setYears(e.target.value)} />
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="mb-4 text-sm font-semibold text-slate-900">Estimate</h3>
        {!valid ? (
          <p className="py-10 text-center text-sm text-slate-400">Enter a property price to calculate.</p>
        ) : (
          <>
            <div className="rounded-xl bg-blue-50 p-4 text-center">
              <div className="text-xs uppercase tracking-wide text-blue-700">Monthly EMI</div>
              <div className="mt-1 text-3xl font-bold text-blue-700">{inrFull(emi)}</div>
            </div>
            <dl className="mt-4 space-y-2 text-sm">
              <Row label="Down Payment" value={inrFull(down)} />
              <Row label="Loan Amount" value={inrFull(principal)} />
              <Row label="Total Interest" value={inrFull(totalInterest)} />
              <Row label="Total Payable" value={inrFull(totalPayable)} strong />
            </dl>
            {editable && (
              <div className="mt-4 text-right">
                <Button onClick={saveAsNote} disabled={busy}>Save estimate to notes</Button>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  )
}

function Row({ label, value, strong }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
      <dt className="text-slate-500">{label}</dt>
      <dd className={strong ? 'font-semibold text-slate-900' : 'font-medium text-slate-700'}>{value}</dd>
    </div>
  )
}

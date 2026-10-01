import { useState, useEffect, useCallback, useMemo } from 'react'
import { attendanceApi } from '../../api/resources.js'
import { useFetch } from '../../hooks/useFetch.js'
import { useToast } from '../../context/ToastContext.jsx'
import { formatDate } from '../../lib/format.js'
import {
  PageHeader, Card, StatCard, Button, Input, Select, Table, Modal, Loader, ErrorState,
} from '../../components/ui.jsx'

// Office policy (would come from Admin office settings in a full build).
const OFFICE_HOURS = '10:00 AM – 06:30 PM'
const OFFICE_HOURS_PER_DAY = 8

const STATUS_META = {
  on_time: { label: 'Present', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  late: { label: 'Late', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  half_day: { label: 'Half-Day', cls: 'bg-orange-50 text-orange-700 border-orange-200' },
  absent: { label: 'Absent', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
  leave: { label: 'On Leave', cls: 'bg-violet-50 text-violet-700 border-violet-200' },
}
const StatusPill = ({ s }) => {
  const m = STATUS_META[s] || { label: s, cls: 'bg-slate-100 text-slate-600 border-slate-200' }
  return <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${m.cls}`}>{m.label}</span>
}

const dayKey = (d) => { const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, '0'); const dd = String(d.getDate()).padStart(2, '0'); return `${y}-${m}-${dd}` }
const hm = (min) => (min ? `${Math.floor(min / 60)}h ${min % 60}m` : '—')
const time = (d) => (d ? new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—')
const locText = (g) => (g ? (g.address || (g.lat != null ? `${Number(g.lat).toFixed(4)}, ${Number(g.lng).toFixed(4)}` : '—')) : '—')

function getLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(undefined)
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy, address: `${p.coords.latitude.toFixed(5)}, ${p.coords.longitude.toFixed(5)}` }),
      () => resolve(undefined),
      { enableHighAccuracy: true, timeout: 8000 }
    )
  })
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function MyAttendancePage() {
  const [month, setMonth] = useState(dayKey(new Date()).slice(0, 7)) // YYYY-MM
  const [statusFilter, setStatusFilter] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [action, setAction] = useState(null) // 'in' | 'out'
  const [correctFor, setCorrectFor] = useState(null)
  const [detailsFor, setDetailsFor] = useState(null)

  const { data, loading, error, refetch } = useFetch(useCallback(() => attendanceApi.me({ limit: 400 }), []))
  const rows = data || []
  const todayKey = dayKey(new Date())
  const today = rows.find((r) => r.date === todayKey)

  // Summary for the selected month.
  const monthRows = rows.filter((r) => r.date?.startsWith(month))
  const kpis = {
    present: monthRows.filter((r) => r.checkInAt && r.status !== 'absent').length,
    absent: monthRows.filter((r) => r.status === 'absent').length,
    late: monthRows.filter((r) => r.status === 'late').length,
    minutes: monthRows.reduce((s, r) => s + (r.workedMinutes || 0), 0),
  }

  const filtered = useMemo(() => {
    let out = rows
    if (month) out = out.filter((r) => r.date?.startsWith(month))
    if (statusFilter !== 'all') out = out.filter((r) => r.status === statusFilter)
    if (from) out = out.filter((r) => r.date >= from)
    if (to) out = out.filter((r) => r.date <= to)
    return [...out].sort((a, b) => (a.date < b.date ? 1 : -1)) // latest first
  }, [rows, month, statusFilter, from, to])

  const checkedIn = !!today?.checkInAt
  const checkedOut = !!today?.checkOutAt

  const columns = [
    { key: 'date', header: 'Date', render: (r) => formatDate(r.date) },
    { key: 'in', header: 'Check-In', render: (r) => time(r.checkInAt) },
    { key: 'out', header: 'Check-Out', render: (r) => time(r.checkOutAt) },
    { key: 'hours', header: 'Working Hours', render: (r) => hm(r.workedMinutes) },
    { key: 'status', header: 'Status', render: (r) => <StatusPill s={r.status} /> },
    { key: 'loc', header: 'Location', render: (r) => <span className="text-xs text-slate-500">{locText(r.checkInLocation)}</span> },
    { key: 'remarks', header: 'Remarks', render: (r) => <span className="text-xs text-slate-500">{r.checkInRemarks || r.checkOutRemarks || '—'}</span> },
    { key: 'actions', header: '', render: (r) => (
      <div className="flex justify-end gap-1.5">
        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setDetailsFor(r) }}>View</Button>
        <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); setCorrectFor(r.date) }}>Correction</Button>
      </div>
    ) },
  ]

  return (
    <div>
      <PageHeader title="Attendance" subtitle="Manage your daily attendance, track working hours, and view attendance history." />

      {/* Summary cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Present Days" value={kpis.present} hint="This month" />
        <StatCard label="Absent Days" value={kpis.absent} hint="This month" />
        <StatCard label="Late Check-Ins" value={kpis.late} hint="This month" />
        <StatCard label="Total Working Hours" value={`${Math.floor(kpis.minutes / 60)}h`} hint="This month" />
      </div>

      {/* Today's Attendance */}
      <Card className="mb-6 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">Today's Attendance</h3>
          <span className="text-xs text-slate-500">{formatDate(new Date())}</span>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <Field label="Current Status" value={today ? <StatusPill s={today.status} /> : <span className="text-slate-400">Not marked</span>} />
          <Field label="Check-In Time" value={time(today?.checkInAt)} />
          <Field label="Check-Out Time" value={time(today?.checkOutAt)} />
          <Field label="Total Working Hours" value={hm(today?.workedMinutes)} />
          <Field label="Office Working Hours" value={<span className="text-sm text-slate-700">{OFFICE_HOURS}</span>} />
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          {!checkedIn && <Button variant="success" onClick={() => setAction('in')}>📍 Check-In</Button>}
          {checkedIn && !checkedOut && <Button onClick={() => setAction('out')}>Check-Out</Button>}
          {checkedOut && <span className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">✓ Attendance completed for today — read-only</span>}
          <span className="text-xs text-slate-500">GPS location is captured automatically on check-in and check-out.</span>
        </div>
      </Card>

      {/* Attendance History */}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <h3 className="mr-auto text-sm font-semibold text-slate-900">Attendance History</h3>
        <div className="w-40"><Input label="Month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></div>
        <div className="w-40">
          <Select label="Status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All</option>
            {Object.keys(STATUS_META).map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
          </Select>
        </div>
        <div className="w-40"><Input label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div className="w-40"><Input label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
      </div>

      {loading ? <Loader /> : error ? <ErrorState message={error} onRetry={refetch} /> : (
        <Table columns={columns} rows={filtered} empty="No attendance records for this period." onRowClick={(r) => setDetailsFor(r)} />
      )}

      {action && <MarkModal kind={action} record={today} onClose={() => setAction(null)} onDone={() => { setAction(null); refetch() }} />}
      {correctFor != null && <CorrectionModal defaultDate={correctFor} onClose={() => setCorrectFor(null)} onDone={() => { setCorrectFor(null); refetch() }} />}
      {detailsFor && <DetailsModal record={detailsFor} onClose={() => setDetailsFor(null)} />}
    </div>
  )
}

function Field({ label, value }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1 text-sm font-medium text-slate-800">{value}</div>
    </div>
  )
}

// ─── Check-In / Check-Out (spec §Check-In / §Check-Out) ─────────────────────────
function MarkModal({ kind, record, onClose, onDone }) {
  const toast = useToast()
  const [geo, setGeo] = useState(null)
  const [locating, setLocating] = useState(true)
  const [remarks, setRemarks] = useState('')
  const [selfie, setSelfie] = useState(null)
  const [busy, setBusy] = useState(false)
  const isIn = kind === 'in'

  useEffect(() => { getLocation().then((g) => { setGeo(g); setLocating(false) }) }, []) // capture GPS on mount

  const projectedMin = !isIn && record?.checkInAt ? Math.max(0, Math.round((Date.now() - new Date(record.checkInAt)) / 60000)) : 0

  // Read + downscale a selfie to a small JPEG data URL (max 640px) so it stays well under the size cap.
  async function onSelfie(e) {
    const file = e.target.files?.[0]
    if (!file) { setSelfie(null); return }
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result)
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      const img = await new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = dataUrl })
      const scale = Math.min(1, 640 / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale); canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
      setSelfie(canvas.toDataURL('image/jpeg', 0.7))
    } catch { toast.error('Could not read image') }
  }

  async function submit() {
    setBusy(true)
    try {
      if (isIn) await attendanceApi.checkIn(geo || undefined, remarks || undefined, selfie || undefined)
      else await attendanceApi.checkOut(geo || undefined, remarks || undefined)
      toast.success(isIn ? 'Checked in' : 'Checked out')
      onDone()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed')
    } finally { setBusy(false) }
  }

  return (
    <Modal open onClose={onClose} title={isIn ? 'Check-In' : 'Check-Out'}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant={isIn ? 'success' : 'primary'} onClick={submit} disabled={busy}>{isIn ? 'Check-In' : 'Check-Out'}</Button></>}
    >
      <div className="space-y-4 text-sm">
        <div className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
          <div className="flex justify-between"><span className="text-slate-500">Date</span><span className="font-medium">{formatDate(new Date())}</span></div>
          <div className="mt-1 flex justify-between"><span className="text-slate-500">{isIn ? 'Check-In' : 'Check-Out'} Time</span><span className="font-medium">{new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span></div>
          <div className="mt-1 flex justify-between"><span className="text-slate-500">GPS Location</span><span className="font-medium">{locating ? 'Locating…' : geo ? geo.address : 'Unavailable'}</span></div>
          {!isIn && <div className="mt-1 flex justify-between"><span className="text-slate-500">Working Hours</span><span className="font-medium">{hm(projectedMin)}</span></div>}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Remarks (optional)</label>
          <textarea rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
        </div>
        {isIn && (
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Selfie (optional)</label>
            <input type="file" accept="image/*" capture="user" onChange={onSelfie}
              className="block w-full text-sm text-slate-500 file:mr-3 file:rounded-md file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100" />
            {selfie && <img src={selfie} alt="check-in selfie" className="mt-2 h-24 w-24 rounded-lg border border-slate-200 object-cover" />}
          </div>
        )}
        {isIn && <p className="text-xs text-slate-500">You can check in once per working day. Status is calculated automatically per company policy.</p>}
        {!isIn && <p className="text-xs text-slate-500">Total working hours are calculated automatically. After check-out, today's attendance becomes read-only.</p>}
      </div>
    </Modal>
  )
}

// ─── Attendance Details (spec §Attendance Details) ──────────────────────────────
function DetailsModal({ record: r, onClose }) {
  return (
    <Modal open onClose={onClose} title={`Attendance — ${formatDate(r.date)}`} footer={<Button variant="secondary" onClick={onClose}>Close</Button>}>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
        {[
          ['Attendance Date', formatDate(r.date)],
          ['Check-In Time', time(r.checkInAt)],
          ['Check-Out Time', time(r.checkOutAt)],
          ['Working Hours', hm(r.workedMinutes)],
          ['Attendance Status', <StatusPill key="status" s={r.status} />],
          ['GPS Check-In Location', locText(r.checkInLocation)],
          ['GPS Check-Out Location', locText(r.checkOutLocation)],
          ['Check-In Remarks', r.checkInRemarks || '—'],
          ['Check-Out Remarks', r.checkOutRemarks || '—'],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
            <dd className="mt-0.5 text-sm text-slate-800">{value}</dd>
          </div>
        ))}
        {r.checkInPhoto && (
          <div className="col-span-2">
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Check-In Selfie</dt>
            <dd className="mt-1"><img src={r.checkInPhoto} alt="check-in selfie" className="h-28 w-28 rounded-lg border border-slate-200 object-cover" /></dd>
          </div>
        )}
      </dl>
    </Modal>
  )
}

// ─── Request Correction (kept — routes to Sub-Admin approval; not a direct edit) ─
function CorrectionModal({ defaultDate, onClose, onDone }) {
  const toast = useToast()
  const [form, setForm] = useState({ date: defaultDate || '', requestedCheckInAt: '', requestedCheckOutAt: '', reason: '' })
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function save() {
    setBusy(true)
    try {
      await attendanceApi.submitCorrection({
        date: form.date,
        requestedCheckInAt: form.requestedCheckInAt || undefined,
        requestedCheckOutAt: form.requestedCheckOutAt || undefined,
        reason: form.reason,
      })
      toast.success('Correction request submitted')
      onDone()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed')
    } finally { setBusy(false) }
  }

  return (
    <Modal open onClose={onClose} title="Request Attendance Correction"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={busy || !form.date || !form.reason.trim()}>Submit Request</Button></>}
    >
      <p className="mb-3 text-xs text-slate-500">You can't edit attendance directly. A correction request is sent to your Sub-Admin for approval.</p>
      <div className="space-y-4">
        <Input label="Date" type="date" value={form.date} onChange={set('date')} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Requested Check-In" type="datetime-local" value={form.requestedCheckInAt} onChange={set('requestedCheckInAt')} />
          <Input label="Requested Check-Out" type="datetime-local" value={form.requestedCheckOutAt} onChange={set('requestedCheckOutAt')} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Reason</label>
          <textarea rows={3} value={form.reason} onChange={set('reason')} placeholder="Explain the correction needed"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
        </div>
      </div>
    </Modal>
  )
}

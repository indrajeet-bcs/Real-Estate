import { useState, useEffect, useCallback, useMemo } from 'react'
import { attendanceApi } from '../../api/resources.js'
import { useFetch } from '../../hooks/useFetch.js'
import { useToast } from '../../context/ToastContext.jsx'
import { formatDate, exportRowsToCsv } from '../../lib/format.js'
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
const locText = (g) => {
  if (!g) return '—'
  let addr = g.address || ''
  if (/[\u0900-\u097F]/.test(addr)) {
    addr = addr.replace(/[\u0900-\u097F]+/g, '').replace(/^[,\s-]+|[,\s-]+$/g, '').replace(/(\s*,\s*)+/g, ', ').trim()
  }
  if (addr) return addr
  if (g.lat != null && g.lng != null) return `${Number(g.lat).toFixed(4)}, ${Number(g.lng).toFixed(4)}`
  return '—'
}

async function getReverseAddress(lat, lng) {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=en`, {
      headers: { 'Accept-Language': 'en' },
      signal: AbortSignal.timeout(2500)
    })
    if (res.ok) {
      const data = await res.json()
      const addr = data.address || {}
      const parts = [
        addr.suburb || addr.neighbourhood || addr.road,
        addr.city || addr.town || addr.county,
        addr.state
      ].filter(Boolean)
      let text = parts.length > 0 ? parts.join(', ') : (data.display_name ? data.display_name.split(',').slice(0, 3).join(', ') : '')
      text = text.replace(/[\u0900-\u097F]+/g, '').replace(/^[,\s-]+|[,\s-]+$/g, '').replace(/(\s*,\s*)+/g, ', ').trim()
      if (text) return text
    }
  } catch {
    // Fall back to coordinates
  }
  return `${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}`
}

function getLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(undefined)
    navigator.geolocation.getCurrentPosition(
      async (p) => {
        const lat = p.coords.latitude
        const lng = p.coords.longitude
        const address = await getReverseAddress(lat, lng)
        resolve({
          lat,
          lng,
          accuracy: p.coords.accuracy,
          address
        })
      },
      () => resolve(undefined),
      { enableHighAccuracy: true, timeout: 8000 }
    )
  })
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function MyAttendancePage() {
  const toast = useToast()
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
    { key: 'in', header: 'Check-In Time', render: (r) => time(r.checkInAt) },
    { key: 'inLoc', header: 'Check-In Location', render: (r) => (
      r.checkInLocation ? (
        <div className="flex items-center gap-1.5 text-xs text-slate-700">
          <span className="material-symbols-outlined text-[15px] text-emerald-600 shrink-0">location_on</span>
          <span className="truncate max-w-[150px]" title={locText(r.checkInLocation)}>{locText(r.checkInLocation)}</span>
          {r.checkInLocation.lat != null && (
            <a href={`https://www.google.com/maps?q=${r.checkInLocation.lat},${r.checkInLocation.lng}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-blue-600 hover:text-blue-800 shrink-0" title="Open in Google Maps">
              <span className="material-symbols-outlined text-[14px]">open_in_new</span>
            </a>
          )}
        </div>
      ) : <span className="text-slate-400 text-xs">—</span>
    ) },
    { key: 'out', header: 'Check-Out Time', render: (r) => time(r.checkOutAt) },
    { key: 'outLoc', header: 'Check-Out Location', render: (r) => (
      r.checkOutLocation ? (
        <div className="flex items-center gap-1.5 text-xs text-slate-700">
          <span className="material-symbols-outlined text-[15px] text-blue-600 shrink-0">location_on</span>
          <span className="truncate max-w-[150px]" title={locText(r.checkOutLocation)}>{locText(r.checkOutLocation)}</span>
          {r.checkOutLocation.lat != null && (
            <a href={`https://www.google.com/maps?q=${r.checkOutLocation.lat},${r.checkOutLocation.lng}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-blue-600 hover:text-blue-800 shrink-0" title="Open in Google Maps">
              <span className="material-symbols-outlined text-[14px]">open_in_new</span>
            </a>
          )}
        </div>
      ) : <span className="text-slate-400 text-xs">—</span>
    ) },
    { key: 'hours', header: 'Working Hours', render: (r) => hm(r.workedMinutes) },
    { key: 'status', header: 'Status', render: (r) => <StatusPill s={r.status} /> },
    { key: 'remarks', header: 'Remarks', render: (r) => <span className="text-xs text-slate-500">{r.checkInRemarks || r.checkOutRemarks || '—'}</span> },
    { key: 'actions', header: '', render: (r) => (
      <div className="flex justify-end gap-1.5">
        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setDetailsFor(r) }}>View</Button>
        <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); setCorrectFor(r.date) }}>Correction</Button>
      </div>
    ) },
  ]

  const handleExportCsv = () => {
    if (!filtered || filtered.length === 0) {
      toast.info('No attendance records to download')
      return
    }
    exportRowsToCsv('my-attendance.csv', filtered.map((r) => ({
      'Date': formatDate(r.date) || r.date || '—',
      'Check-In': time(r.checkInAt),
      'Check-Out': time(r.checkOutAt),
      'Working Hours': hm(r.workedMinutes),
      'Status': STATUS_META[r.status]?.label || r.status || '—',
      'Location': locText(r.checkInLocation),
      'Remarks': r.checkInRemarks || r.checkOutRemarks || '—',
    })))
    toast.success('Attendance records downloaded successfully (CSV)')
  }

  return (
    <div>
      <PageHeader
        title="Attendance"
        subtitle="Manage your daily attendance, track working hours, and view attendance history."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={handleExportCsv}
              disabled={!filtered.length}
              className="inline-flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[18px]">download</span>
              <span>Download CSV</span>
            </Button>
          </div>
        }
      />

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

        {/* Check-In and Check-Out Location Display */}
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 rounded-xl bg-slate-50 p-3.5 border border-slate-200">
          <div className="rounded-lg bg-white p-3 border border-slate-200/80 shadow-2xs">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[17px] text-emerald-600">location_on</span>
              Check-In Location
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-slate-800">
                {today?.checkInAt ? locText(today?.checkInLocation) : <span className="text-slate-400 italic font-normal">Not checked in yet</span>}
              </span>
              {today?.checkInLocation?.lat != null && (
                <a
                  href={`https://www.google.com/maps?q=${today.checkInLocation.lat},${today.checkInLocation.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 text-xs text-blue-600 hover:text-blue-700 hover:underline font-semibold"
                  title="Open in Google Maps"
                >
                  <span>View Map</span>
                  <span className="material-symbols-outlined text-[13px]">open_in_new</span>
                </a>
              )}
            </div>
          </div>

          <div className="rounded-lg bg-white p-3 border border-slate-200/80 shadow-2xs">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[17px] text-blue-600">location_on</span>
              Check-Out Location
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-slate-800">
                {today?.checkOutAt ? locText(today?.checkOutLocation) : (checkedIn ? <span className="text-amber-600 italic font-medium">Pending Check-Out</span> : <span className="text-slate-400 italic font-normal">—</span>)}
              </span>
              {today?.checkOutLocation?.lat != null && (
                <a
                  href={`https://www.google.com/maps?q=${today.checkOutLocation.lat},${today.checkOutLocation.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 text-xs text-blue-600 hover:text-blue-700 hover:underline font-semibold"
                  title="Open in Google Maps"
                >
                  <span>View Map</span>
                  <span className="material-symbols-outlined text-[13px]">open_in_new</span>
                </a>
              )}
            </div>
          </div>
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

  const detectLocation = () => {
    setLocating(true)
    getLocation().then((g) => {
      setGeo(g)
      setLocating(false)
    })
  }

  useEffect(() => {
    detectLocation()
  }, []) // capture GPS on mount

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
          <div className="mt-2 flex items-start justify-between gap-3 border-t border-slate-200/70 pt-2">
            <span className="text-slate-500 flex items-center gap-1 font-medium">
              <span className="material-symbols-outlined text-[16px] text-blue-600">my_location</span>
              Captured Location
            </span>
            <div className="text-right max-w-[240px]">
              {locating ? (
                <span className="inline-flex items-center gap-1 text-blue-600 font-medium">
                  <span className="material-symbols-outlined text-[16px] animate-spin">sync</span>
                  Detecting GPS…
                </span>
              ) : geo ? (
                <div className="flex flex-col items-end">
                  <span className="font-medium text-slate-800 flex items-center gap-1 text-right">
                    <span className="material-symbols-outlined text-[15px] text-emerald-600">location_on</span>
                    {geo.address}
                  </span>
                  {geo.lat != null && (
                    <a
                      href={`https://www.google.com/maps?q=${geo.lat},${geo.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-blue-600 hover:underline flex items-center gap-0.5 mt-0.5"
                    >
                      <span>View on Google Maps</span>
                      <span className="material-symbols-outlined text-[12px]">open_in_new</span>
                    </a>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-end">
                  <span className="text-amber-700 font-medium text-xs">GPS permission not granted or unavailable</span>
                  <button
                    type="button"
                    onClick={detectLocation}
                    className="text-[11px] text-blue-600 hover:underline mt-0.5 inline-flex items-center gap-0.5 font-medium cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[12px]">refresh</span> Retry GPS
                  </button>
                </div>
              )}
            </div>
          </div>
          {!isIn && <div className="mt-2 flex justify-between border-t border-slate-200/70 pt-2"><span className="text-slate-500">Working Hours</span><span className="font-medium">{hm(projectedMin)}</span></div>}
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
          ['GPS Check-In Location', r.checkInLocation ? (
            <div className="flex flex-wrap items-center gap-2">
              <span>{locText(r.checkInLocation)}</span>
              {r.checkInLocation.lat != null && (
                <a href={`https://www.google.com/maps?q=${r.checkInLocation.lat},${r.checkInLocation.lng}`} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-xs flex items-center gap-0.5">
                  <span className="material-symbols-outlined text-[13px]">open_in_new</span> Map
                </a>
              )}
            </div>
          ) : '—'],
          ['GPS Check-Out Location', r.checkOutLocation ? (
            <div className="flex flex-wrap items-center gap-2">
              <span>{locText(r.checkOutLocation)}</span>
              {r.checkOutLocation.lat != null && (
                <a href={`https://www.google.com/maps?q=${r.checkOutLocation.lat},${r.checkOutLocation.lng}`} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-xs flex items-center gap-0.5">
                  <span className="material-symbols-outlined text-[13px]">open_in_new</span> Map
                </a>
              )}
            </div>
          ) : '—'],
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

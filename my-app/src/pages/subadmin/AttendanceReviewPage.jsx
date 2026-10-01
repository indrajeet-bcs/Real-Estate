import { useState, useCallback, useMemo } from 'react'
import { attendanceApi, usersApi } from '../../api/resources.js'
import { useFetch } from '../../hooks/useFetch.js'
import { formatDate, titleCase } from '../../lib/format.js'
import { PageHeader, StatCard, Button, Input, Select, Table, StatusBadge, Modal, Loader, ErrorState } from '../../components/ui.jsx'

function hours(min) { return min ? `${Math.floor(min / 60)}h ${min % 60}m` : '—' }
function locText(loc) { return loc?.address || (loc?.lat != null ? `${loc.lat.toFixed(4)}, ${loc.lng?.toFixed(4)}` : '—') }

function csv(name, rows) {
  const blob = new Blob([rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')], { type: 'text/csv' })
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url)
}

// Team attendance review (spec §Attendance Tab): KPIs, filters, GPS + details.
export default function AttendanceReviewPage() {
  const [date, setDate] = useState('')
  const [status, setStatus] = useState('')
  const [user, setUser] = useState('')
  const [search, setSearch] = useState('')
  const [detail, setDetail] = useState(null)

  const { data, loading, error, refetch } = useFetch(
    useCallback(() => attendanceApi.review({ date: date || undefined, status: status || undefined, user: user || undefined, limit: 500 }), [date, status, user])
  )
  const { data: execs } = useFetch(useCallback(() => usersApi.list({ role: 'sales_executive', status: 'active', limit: 200 }), []))

  const rows = useMemo(() => {
    let out = data || []
    if (search.trim()) { const q = search.toLowerCase(); out = out.filter((r) => [r.user?.name, r.user?.employeeId].some((v) => (v || '').toLowerCase().includes(q))) }
    return out
  }, [data, search])

  const kpis = useMemo(() => {
    const all = data || []
    const c = (s) => all.filter((r) => r.status === s).length
    return {
      present: all.filter((r) => r.status !== 'absent').length,
      onTime: c('on_time'),
      late: c('late'),
      halfDay: c('half_day'),
      absent: c('absent'),
    }
  }, [data])

  const columns = [
    { key: 'name', header: 'Employee', render: (r) => (
      <div><div className="font-medium text-slate-900">{r.user?.name || '—'}</div><div className="text-xs text-slate-500">{r.user?.employeeId || '—'}</div></div>
    ) },
    { key: 'date', header: 'Date' },
    { key: 'in', header: 'Check-In', render: (r) => r.checkInAt ? formatDate(r.checkInAt, true) : '—' },
    { key: 'out', header: 'Check-Out', render: (r) => r.checkOutAt ? formatDate(r.checkOutAt, true) : '—' },
    { key: 'hrs', header: 'Working Hours', render: (r) => hours(r.workedMinutes) },
    { key: 'inLoc', header: 'Check-In Location', render: (r) => <span className="text-xs text-slate-600">{locText(r.checkInLocation)}</span> },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'actions', header: '', render: (r) => <Button size="sm" variant="ghost" onClick={() => setDetail(r)}>View</Button> },
  ]

  function exportCsv() {
    const header = ['Employee', 'Employee ID', 'Date', 'Check-In', 'Check-Out', 'Working Hours', 'Check-In Location', 'Check-Out Location', 'Status']
    csv('attendance.csv', [header, ...rows.map((r) => [r.user?.name, r.user?.employeeId, r.date, r.checkInAt, r.checkOutAt, hours(r.workedMinutes), locText(r.checkInLocation), locText(r.checkOutLocation), r.status])])
  }

  return (
    <div>
      <PageHeader title="Attendance" subtitle="Team attendance — check-in/out, GPS locations & status." actions={<Button variant="secondary" onClick={exportCsv} disabled={!rows.length}>Export</Button>} />

      {/* KPI cards */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatCard label="Present" value={kpis.present} />
        <StatCard label="On Time" value={kpis.onTime} />
        <StatCard label="Late" value={kpis.late} />
        <StatCard label="Half Day" value={kpis.halfDay} />
        <StatCard label="Absent" value={kpis.absent} />
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="w-48"><Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        <div className="w-48"><Select label="Employee" value={user} onChange={(e) => setUser(e.target.value)}><option value="">All</option>{(execs || []).map((x) => <option key={x._id} value={x._id}>{x.name}</option>)}</Select></div>
        <div className="w-44"><Select label="Status" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All</option>{['on_time', 'late', 'half_day', 'absent'].map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}</Select></div>
        <div className="w-52"><Input label="Search" placeholder="Name or Employee ID" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
      </div>

      {loading ? <Loader /> : error ? <ErrorState message={error} onRetry={refetch} /> : (
        <Table columns={columns} rows={rows} empty="No attendance records" />
      )}

      {detail && <AttendanceDetail record={detail} onClose={() => setDetail(null)} />}
    </div>
  )
}

function Field({ label, value }) { return <div><dt className="text-xs uppercase tracking-wide text-slate-400">{label}</dt><dd className="mt-0.5 text-sm text-slate-800">{value || '—'}</dd></div> }

function AttendanceDetail({ record, onClose }) {
  return (
    <Modal open onClose={onClose} wide title={`Attendance — ${record.user?.name || ''}`} footer={<Button variant="secondary" onClick={onClose}>Close</Button>}>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
        <Field label="Employee" value={record.user?.name} />
        <Field label="Employee ID" value={record.user?.employeeId} />
        <Field label="Branch" value={record.user?.branch} />
        <Field label="Date" value={record.date} />
        <Field label="Check-In Time" value={record.checkInAt ? formatDate(record.checkInAt, true) : '—'} />
        <Field label="Check-Out Time" value={record.checkOutAt ? formatDate(record.checkOutAt, true) : '—'} />
        <Field label="Total Working Hours" value={hours(record.workedMinutes)} />
        <Field label="Status" value={<StatusBadge status={record.status} />} />
        <div />
        <Field label="Check-In Address" value={record.checkInLocation?.address} />
        <Field label="Check-In Lat/Lng" value={record.checkInLocation?.lat != null ? `${record.checkInLocation.lat}, ${record.checkInLocation.lng}` : '—'} />
        <div />
        <Field label="Check-Out Address" value={record.checkOutLocation?.address} />
        <Field label="Check-Out Lat/Lng" value={record.checkOutLocation?.lat != null ? `${record.checkOutLocation.lat}, ${record.checkOutLocation.lng}` : '—'} />
      </dl>
      <p className="mt-4 text-xs text-slate-400">Selfie verification is not captured in this build. Employees mark attendance from the field — no geofencing is applied.</p>
    </Modal>
  )
}

import { useState, useCallback, useMemo } from 'react'
import { usersApi, customersApi, attendanceApi, leavesApi } from '../../api/resources.js'
import { useFetch } from '../../hooks/useFetch.js'
import { formatDate, titleCase } from '../../lib/format.js'
import { PageHeader, Card, Button, Table, StatCard, StatusBadge, Modal, Loader, ErrorState } from '../../components/ui.jsx'

const inr = (n) => {
  const v = Number(n) || 0
  if (v >= 1e7) return `₹${(v / 1e7).toFixed(2)} Cr`
  if (v >= 1e5) return `₹${(v / 1e5).toFixed(2)} L`
  return `₹${v.toLocaleString('en-IN')}`
}

// Derived health signals from the data we actually have (no invented ratings).
function health(u) {
  const leads = u.activeLeadsCount || 0
  const bookings = u.bookingsCount || 0
  const conversion = bookings + leads > 0 ? Math.round((bookings / (bookings + leads)) * 100) : 0
  const attendance = u.attendanceRate // may be null
  // Composite: attendance 40% + conversion 60% (attendance treated as neutral 60 if unknown).
  const score = Math.round((attendance ?? 60) * 0.4 + conversion * 0.6)
  return { conversion, attendance, score }
}

function Bar({ label, value }) {
  const v = Math.max(0, Math.min(100, value ?? 0))
  const color = v >= 70 ? 'bg-emerald-500' : v >= 40 ? 'bg-amber-500' : 'bg-red-500'
  return (
    <div>
      <div className="mb-1 flex justify-between text-[11px] text-slate-500"><span>{label}</span><span>{value == null ? '—' : `${value}%`}</span></div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200"><div className={`h-full rounded-full ${color}`} style={{ width: `${v}%` }} /></div>
    </div>
  )
}

export default function SalesTeamPage() {
  const [inspect, setInspect] = useState(null)
  const { data, loading, error, refetch } = useFetch(
    useCallback(() => usersApi.list({ role: 'sales_executive', withMetrics: 'true', limit: 100 }), [])
  )

  return (
    <div>
      <PageHeader title="Sales Team Logs" subtitle="Executive roster & health cards" />
      {loading ? <Loader /> : error ? <ErrorState message={error} onRetry={refetch} /> : (
        (data || []).length === 0 ? <Card className="p-10 text-center text-sm text-slate-400">No executives found.</Card> : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data.map((u) => {
              const h = health(u)
              return (
                <Card key={u._id} className="p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-semibold text-slate-900">{u.name}</div>
                      <div className="text-xs text-slate-500">{u.branch || 'No branch'}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] uppercase tracking-wide text-slate-400">Health</div>
                      <div className={`text-lg font-bold ${h.score >= 70 ? 'text-emerald-600' : h.score >= 40 ? 'text-amber-600' : 'text-red-600'}`}>{h.score}</div>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="rounded-lg bg-slate-50 p-2"><div className="text-slate-500">Leads</div><div className="font-semibold text-slate-800">{u.activeLeadsCount || 0}</div></div>
                    <div className="rounded-lg bg-slate-50 p-2"><div className="text-slate-500">Bookings</div><div className="font-semibold text-slate-800">{u.bookingsCount || 0}</div></div>
                    <div className="rounded-lg bg-slate-50 p-2"><div className="text-slate-500">Revenue</div><div className="font-semibold text-slate-800">{inr(u.revenueGenerated)}</div></div>
                  </div>
                  <div className="mt-3 space-y-2">
                    <Bar label="Attendance (30d)" value={h.attendance} />
                    <Bar label="Conversion" value={h.conversion} />
                  </div>
                  <Button size="sm" variant="secondary" className="mt-4 w-full" onClick={() => setInspect(u)}>Open Health Card</Button>
                </Card>
              )
            })}
          </div>
        )
      )}
      {inspect && <Inspector exec={inspect} onClose={() => setInspect(null)} />}
    </div>
  )
}

function Inspector({ exec, onClose }) {
  const [tab, setTab] = useState('overview')
  const h = useMemo(() => health(exec), [exec])
  return (
    <Modal open onClose={onClose} title={`${exec.name} · Health Card`} wide>
      <div className="mb-4 flex flex-wrap gap-2">
        {['overview', 'leads', 'attendance', 'leaves'].map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${tab === t ? 'bg-blue-600 text-white' : 'border border-slate-300 bg-white text-slate-600 hover:bg-slate-50'}`}>{titleCase(t)}</button>
        ))}
      </div>
      {tab === 'overview' && (
        <div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Health Score" value={h.score} />
            <StatCard label="Active Leads" value={exec.activeLeadsCount || 0} />
            <StatCard label="Bookings" value={exec.bookingsCount || 0} />
            <StatCard label="Revenue" value={inr(exec.revenueGenerated)} />
          </div>
          <div className="mt-4 space-y-3">
            <Bar label="Attendance (last 30 days)" value={h.attendance} />
            <Bar label="Lead → booking conversion" value={h.conversion} />
          </div>
        </div>
      )}
      {tab === 'leads' && <ExecLeads execId={exec._id} />}
      {tab === 'attendance' && <ExecAttendance execId={exec._id} />}
      {tab === 'leaves' && <ExecLeaves execId={exec._id} />}
    </Modal>
  )
}

function ExecLeads({ execId }) {
  const { data, loading } = useFetch(useCallback(() => customersApi.list({ assignedTo: execId, limit: 100 }), [execId]))
  if (loading) return <Loader />
  return <Table columns={[
    { key: 'name', header: 'Lead', render: (r) => r.name },
    { key: 'mobile', header: 'Mobile' },
    { key: 'status', header: 'Stage', render: (r) => <StatusBadge status={r.status} /> },
  ]} rows={data || []} empty="No assigned leads" />
}

function ExecAttendance({ execId }) {
  const { data, loading } = useFetch(useCallback(() => attendanceApi.review({ user: execId, limit: 60 }), [execId]))
  if (loading) return <Loader />
  return <Table columns={[
    { key: 'date', header: 'Date' },
    { key: 'checkInAt', header: 'In', render: (r) => (r.checkInAt ? formatDate(r.checkInAt, true) : '—') },
    { key: 'checkOutAt', header: 'Out', render: (r) => (r.checkOutAt ? formatDate(r.checkOutAt, true) : '—') },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
  ]} rows={data || []} empty="No attendance records" />
}

function ExecLeaves({ execId }) {
  const { data, loading } = useFetch(useCallback(() => leavesApi.list(), []))
  if (loading) return <Loader />
  const mine = (data || []).filter((l) => String(l.employee?._id || l.employee) === String(execId))
  return <Table columns={[
    { key: 'type', header: 'Type', render: (r) => titleCase(r.type) },
    { key: 'dates', header: 'Dates', render: (r) => `${formatDate(r.startDate)} → ${formatDate(r.endDate)}` },
    { key: 'days', header: 'Days', render: (r) => r.days },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
  ]} rows={mine} empty="No leave records" />
}

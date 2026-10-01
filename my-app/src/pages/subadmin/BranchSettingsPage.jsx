import { useState, useCallback, useEffect } from 'react'
import { branchSettingsApi, usersApi, attendanceApi } from '../../api/resources.js'
import { useFetch } from '../../hooks/useFetch.js'
import { useToast } from '../../context/ToastContext.jsx'
import { formatDate, titleCase } from '../../lib/format.js'
import { PageHeader, Card, Button, Input, Loader, ErrorState } from '../../components/ui.jsx'

function downloadCsv(filename, headers, rows) {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const csv = [headers.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))].join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

export default function BranchSettingsPage() {
  const [tab, setTab] = useState('preferences')
  return (
    <div>
      <PageHeader title="Reports & Settings" subtitle="Branch preferences and operational reports" />
      <div className="mb-5 flex gap-2">
        <TabButton active={tab === 'preferences'} onClick={() => setTab('preferences')}>Branch Preferences</TabButton>
        <TabButton active={tab === 'reports'} onClick={() => setTab('reports')}>Operational Reports</TabButton>
      </div>
      {tab === 'preferences' ? <Preferences /> : <Reports />}
    </div>
  )
}

function TabButton({ active, onClick, children }) {
  return (
    <button onClick={onClick} className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
      active ? 'bg-blue-600 text-white shadow-sm' : 'border border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
    }`}>{children}</button>
  )
}

function Preferences() {
  const toast = useToast()
  const { data, loading, error, refetch } = useFetch(useCallback(() => branchSettingsApi.get(), []))
  const [form, setForm] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (data) setForm({
      geofenceRadius: data.geofenceRadius ?? 200,
      workingHours: data.workingHours ?? '09:00 - 18:00',
      autoRouteLeads: !!data.autoRouteLeads,
    })
  }, [data])

  async function save() {
    setBusy(true)
    try {
      await branchSettingsApi.update({
        geofenceRadius: Number(form.geofenceRadius),
        workingHours: form.workingHours,
        autoRouteLeads: form.autoRouteLeads,
      })
      toast.success('Branch settings saved')
      refetch()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed')
    } finally {
      setBusy(false)
    }
  }

  if (loading || (!form && !error)) return <Loader />
  if (error) return <ErrorState message={error} onRetry={refetch} />

  return (
    <Card className="max-w-xl p-6">
      <div className="text-sm font-semibold text-slate-700">{data.name}{data.region ? ` · ${data.region}` : ''}</div>
      <div className="mt-4 space-y-5">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Geofence radius: {form.geofenceRadius} m</label>
          <input type="range" min="50" max="500" step="10" value={form.geofenceRadius}
            onChange={(e) => setForm((f) => ({ ...f, geofenceRadius: e.target.value }))} className="w-full" />
          <div className="flex justify-between text-[10px] text-slate-400"><span>50m</span><span>500m</span></div>
        </div>
        <Input label="Working hours" value={form.workingHours}
          onChange={(e) => setForm((f) => ({ ...f, workingHours: e.target.value }))} placeholder="09:00 - 18:00" />
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={form.autoRouteLeads}
            onChange={(e) => setForm((f) => ({ ...f, autoRouteLeads: e.target.checked }))} />
          Auto-route incoming leads across active executives
        </label>
      </div>
      <Button className="mt-6" onClick={save} disabled={busy}>Save Settings</Button>
    </Card>
  )
}

function Reports() {
  const { data: team, loading: lt } = useFetch(useCallback(() => usersApi.list({ role: 'sales_executive', withMetrics: 'true', limit: 100 }), []))
  const { data: att, loading: la } = useFetch(useCallback(() => attendanceApi.review({ limit: 200 }), []))

  const exportTeam = () => downloadCsv('team-performance.csv',
    ['Executive', 'Branch', 'ActiveLeads', 'Bookings', 'Revenue', 'Attendance%'],
    (team || []).map((u) => [u.name, u.branch, u.activeLeadsCount, u.bookingsCount, u.revenueGenerated, u.attendanceRate ?? '']))
  const exportAtt = () => downloadCsv('attendance.csv',
    ['Employee', 'Date', 'Status', 'CheckIn', 'CheckOut'],
    (att || []).map((r) => [r.user?.name, r.date, r.status, r.checkInAt ? formatDate(r.checkInAt, true) : '', r.checkOutAt ? formatDate(r.checkOutAt, true) : '']))

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Card className="p-5">
        <h3 className="font-semibold text-slate-900">Team Performance</h3>
        <p className="mt-1 text-xs text-slate-500">{lt ? 'Loading…' : `${(team || []).length} executives · leads, bookings, revenue, attendance`}</p>
        <Button size="sm" variant="secondary" className="mt-4" onClick={exportTeam} disabled={lt || !(team || []).length}>Export CSV</Button>
      </Card>
      <Card className="p-5">
        <h3 className="font-semibold text-slate-900">Attendance Log</h3>
        <p className="mt-1 text-xs text-slate-500">{la ? 'Loading…' : `${(att || []).length} records · GPS punch in/out`}</p>
        <Button size="sm" variant="secondary" className="mt-4" onClick={exportAtt} disabled={la || !(att || []).length}>Export CSV</Button>
      </Card>
    </div>
  )
}

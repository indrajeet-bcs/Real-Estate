import { useCallback, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { branchesApi } from '../../api/resources.js'
import { useFetch } from '../../hooks/useFetch.js'
import { useToast } from '../../context/ToastContext.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { PageHeader, Card, StatCard, Button, Input, Select, Modal, Table, StatusBadge, Loader, ErrorState } from '../../components/ui.jsx'
import { formatDate, titleCase } from '../../lib/format.js'

function inr(n) {
  const v = Number(n) || 0
  if (v >= 1e7) return `₹${(v / 1e7).toFixed(2)} Cr`
  if (v >= 1e5) return `₹${(v / 1e5).toFixed(2)} L`
  return `₹${v.toLocaleString('en-IN')}`
}

function Progress({ label, value, target, format = (x) => x }) {
  const pct = target > 0 ? Math.min(100, Math.round((value / target) * 100)) : 0
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className="text-slate-500">{label}</span>
        <span className="text-slate-700">{format(value)} / {target > 0 ? format(target) : '—'}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
        <div className={`h-full rounded-full ${pct >= 100 ? 'bg-emerald-500' : 'bg-blue-600'}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-0.5 text-right text-[10px] text-slate-400">{target > 0 ? `${pct}%` : 'No target set'}</div>
    </div>
  )
}

export default function BranchDetailsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { can } = useAuth()
  const [targeting, setTargeting] = useState(false)
  const { data, loading, error, refetch } = useFetch(useCallback(() => branchesApi.get(id), [id]))

  if (loading) return <Loader />
  if (error) return <ErrorState message={error} onRetry={refetch} />
  if (!data) return null

  const { branch, performance, recentBookings = [], activeProjects = [], inventory = {}, attendanceSummary = {} } = data

  const inventoryOrder = ['available', 'reserved', 'locked', 'booked', 'blocked']

  return (
    <div>
      <div className="mb-4">
        <button onClick={() => navigate('/admin/branches')} className="text-sm text-slate-500 hover:text-slate-700">← Back to Branches</button>
      </div>

      <PageHeader
        title={branch.name}
        subtitle={`${branch.code || '—'} · ${branch.city || 'No city'} · ${branch.region || 'No region'}`}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge status={branch.status === 'active' ? 'approved' : 'cancelled'} />
            {can('branch', 'edit') && <Button onClick={() => setTargeting(true)}>Assign Target</Button>}
          </div>
        }
      />

      {/* Branch info + assigned sub-admin */}
      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <h3 className="mb-3 text-sm font-semibold text-slate-900">Branch Information</h3>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <Info label="Branch Name" value={branch.name} />
            <Info label="Branch Code" value={branch.code} />
            <Info label="City" value={branch.city} />
            <Info label="Region" value={branch.region} />
            <Info label="Contact" value={branch.contactNumber} />
            <Info label="Email" value={branch.email} />
            <Info label="Address" value={branch.address} />
            <Info label="Created" value={formatDate(branch.createdAt)} />
          </dl>
        </Card>
        <Card className="p-5">
          <h3 className="mb-3 text-sm font-semibold text-slate-900">Assigned Sub-Admin</h3>
          {branch.adminUser ? (
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700">
                {(branch.adminUser.name || '?').slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="font-medium text-slate-900">{branch.adminUser.name}</div>
                <div className="text-xs text-slate-500">{branch.adminUser.email}</div>
                {branch.adminUser.phone && <div className="text-xs text-slate-400">{branch.adminUser.phone}</div>}
              </div>
            </div>
          ) : <p className="text-sm text-slate-400">No sub-admin assigned.</p>}
        </Card>
      </div>

      {/* Performance summary */}
      <h3 className="mb-3 text-sm font-semibold text-slate-900">Performance Summary</h3>
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Total Revenue" value={inr(performance.revenue)} />
        <StatCard label="Total Sales" value={performance.sales} />
        <StatCard label="Total Customers" value={performance.customers} />
        <StatCard label="Total Bookings" value={performance.bookings} />
        <StatCard label="Conversion Rate" value={`${performance.conversionRate}%`} />
      </div>

      {/* Target progress + attendance */}
      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Target Progress <span className="text-xs font-normal text-slate-400">({titleCase(branch.targetPeriod || 'monthly')})</span></h3>
            <TargetStatusBadge status={branch.targetStatus} />
          </div>
          <div className="space-y-4">
            <Progress label="Revenue" value={performance.revenue} target={branch.monthlyTarget || 0} format={inr} />
            <Progress label="Sales" value={performance.sales} target={branch.salesTarget || 0} />
            <Progress label="Bookings" value={performance.bookings} target={branch.bookingTarget || 0} />
          </div>
          {(branch.targetStartDate || branch.targetEndDate || branch.targetRemarks) && (
            <div className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
              {(branch.targetStartDate || branch.targetEndDate) && (
                <p>Period: {branch.targetStartDate ? formatDate(branch.targetStartDate) : '—'} → {branch.targetEndDate ? formatDate(branch.targetEndDate) : '—'}</p>
              )}
              {branch.targetRemarks && <p className="mt-1">Remarks: <span className="text-slate-600">{branch.targetRemarks}</span></p>}
            </div>
          )}
        </Card>
        <Card className="p-5">
          <h3 className="mb-4 text-sm font-semibold text-slate-900">Attendance Summary <span className="text-xs font-normal text-slate-400">(today)</span></h3>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div><div className="text-2xl font-semibold text-slate-900">{attendanceSummary.total ?? 0}</div><div className="text-xs text-slate-500">Staff</div></div>
            <div><div className="text-2xl font-semibold text-emerald-600">{attendanceSummary.present ?? 0}</div><div className="text-xs text-slate-500">Present</div></div>
            <div><div className="text-2xl font-semibold text-red-500">{attendanceSummary.absent ?? 0}</div><div className="text-xs text-slate-500">Absent</div></div>
          </div>
          <div className="mt-4 text-center text-sm text-slate-500">
            Attendance rate: <span className="font-medium text-slate-700">{attendanceSummary.rate == null ? '—' : `${attendanceSummary.rate}%`}</span>
          </div>
        </Card>
      </div>

      {/* Property inventory summary */}
      <h3 className="mb-3 text-sm font-semibold text-slate-900">Property Inventory Summary <span className="text-xs font-normal text-slate-400">(company-wide catalog)</span></h3>
      <div className="mb-6 grid gap-4 grid-cols-2 sm:grid-cols-3 xl:grid-cols-5">
        {inventoryOrder.map((s) => (
          <Card key={s} className="p-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">{titleCase(s)}</div>
            <div className="mt-1 text-2xl font-semibold text-slate-900">{inventory[s] || 0}</div>
          </Card>
        ))}
      </div>

      {/* Active projects */}
      <h3 className="mb-3 text-sm font-semibold text-slate-900">Active Projects</h3>
      <div className="mb-6">
        <Table
          columns={[
            { key: 'name', header: 'Project', render: (p) => <span className="font-medium text-slate-900">{p.name}</span> },
            { key: 'builder', header: 'Builder', render: (p) => p.builder?.name || '—' },
            { key: 'propertyType', header: 'Type', render: (p) => titleCase(p.propertyType) || '—' },
            { key: 'constructionStatus', header: 'Stage', render: (p) => <StatusBadge status={p.constructionStatus} /> },
          ]}
          rows={activeProjects}
          empty="No active projects."
        />
      </div>

      {/* Recent bookings */}
      <h3 className="mb-3 text-sm font-semibold text-slate-900">Recent Bookings</h3>
      <div className="mb-6">
        <Table
          columns={[
            { key: 'customer', header: 'Customer', render: (b) => b.customer?.name || '—' },
            { key: 'project', header: 'Project', render: (b) => b.project?.name || '—' },
            { key: 'unit', header: 'Unit', render: (b) => b.unit?.unitNumber || '—' },
            { key: 'bookedBy', header: 'Sales Executive', render: (b) => b.bookedBy?.name || '—' },
            { key: 'date', header: 'Booking Date', render: (b) => formatDate(b.createdAt) },
            { key: 'value', header: 'Value', render: (b) => inr(b.totalValue || b.bookingAmount) },
            { key: 'status', header: 'Status', render: (b) => <StatusBadge status={b.status} /> },
          ]}
          rows={recentBookings}
          empty="No bookings yet for this branch."
        />
      </div>

      {targeting && <TargetModal branch={branch} onClose={() => setTargeting(false)} onDone={() => { setTargeting(false); refetch() }} />}
    </div>
  )
}

// Colour-coded target status pill (Not Started / In Progress / Completed / Exceeded).
export function TargetStatusBadge({ status }) {
  if (!status || status === 'No Target') return <span className="text-xs text-slate-400">No target set</span>
  const cls = {
    'Not Started': 'bg-slate-100 text-slate-600 border-slate-200',
    'In Progress': 'bg-blue-50 text-blue-700 border-blue-200',
    Completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    Exceeded: 'bg-violet-50 text-violet-700 border-violet-200',
  }[status] || 'bg-slate-100 text-slate-600 border-slate-200'
  return <span className={`inline-block rounded border px-2 py-0.5 text-xs font-medium ${cls}`}>{status}</span>
}

function Info({ label, value }) {
  return (
    <div>
      <dt className="text-xs text-slate-400">{label}</dt>
      <dd className="text-slate-700">{value || '—'}</dd>
    </div>
  )
}

function TargetModal({ branch, onClose, onDone }) {
  const toast = useToast()
  const [form, setForm] = useState({
    monthlyTarget: branch.monthlyTarget || 0,
    salesTarget: branch.salesTarget || 0,
    bookingTarget: branch.bookingTarget || 0,
    targetPeriod: branch.targetPeriod || 'monthly',
    targetStartDate: branch.targetStartDate ? String(branch.targetStartDate).slice(0, 10) : '',
    targetEndDate: branch.targetEndDate ? String(branch.targetEndDate).slice(0, 10) : '',
    targetRemarks: branch.targetRemarks || '',
  })
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function save() {
    setBusy(true)
    try {
      await branchesApi.setTargets(branch._id, {
        monthlyTarget: Number(form.monthlyTarget) || 0,
        salesTarget: Number(form.salesTarget) || 0,
        bookingTarget: Number(form.bookingTarget) || 0,
        targetPeriod: form.targetPeriod,
        targetStartDate: form.targetStartDate,
        targetEndDate: form.targetEndDate,
        targetRemarks: form.targetRemarks,
      })
      toast.success('Targets updated')
      onDone()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={onClose} wide title={`Assign Target · ${branch.name}`} footer={
      <>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={save} disabled={busy}>Save Targets</Button>
      </>
    }>
      <div className="grid gap-4 sm:grid-cols-2">
        <Select label="Target period" value={form.targetPeriod} onChange={set('targetPeriod')}>
          <option value="monthly">Monthly</option>
          <option value="quarterly">Quarterly</option>
          <option value="yearly">Yearly</option>
        </Select>
        <Input label="Revenue target (₹)" type="number" value={form.monthlyTarget} onChange={set('monthlyTarget')} />
        <Input label="Sales target (count)" type="number" value={form.salesTarget} onChange={set('salesTarget')} />
        <Input label="Booking target (count)" type="number" value={form.bookingTarget} onChange={set('bookingTarget')} />
        <Input label="Start date" type="date" value={form.targetStartDate} onChange={set('targetStartDate')} />
        <Input label="End date" type="date" value={form.targetEndDate} onChange={set('targetEndDate')} />
        <div className="sm:col-span-2">
          <Input label="Remarks (optional)" value={form.targetRemarks} onChange={set('targetRemarks')} placeholder="Context for this target period" />
        </div>
      </div>
    </Modal>
  )
}

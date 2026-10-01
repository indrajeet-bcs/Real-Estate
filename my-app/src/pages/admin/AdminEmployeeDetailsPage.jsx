import { useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { usersApi } from '../../api/resources.js'
import { useFetch } from '../../hooks/useFetch.js'
import { PageHeader, Card, StatCard, Table, StatusBadge, Loader, ErrorState } from '../../components/ui.jsx'
import { formatDate, titleCase } from '../../lib/format.js'

const inr = (n) => {
  const v = Number(n) || 0
  if (v >= 1e7) return `₹${(v / 1e7).toFixed(2)} Cr`
  if (v >= 1e5) return `₹${(v / 1e5).toFixed(2)} L`
  return `₹${v.toLocaleString('en-IN')}`
}

function Section({ title, children }) {
  return (
    <Card className="p-5">
      <h3 className="mb-3 text-sm font-semibold text-slate-900">{title}</h3>
      {children}
    </Card>
  )
}

function Field({ label, value }) {
  return (
    <div>
      <dt className="text-xs text-slate-400">{label}</dt>
      <dd className="text-slate-700">{value ?? '—'}</dd>
    </div>
  )
}

export default function AdminEmployeeDetailsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data, loading, error, refetch } = useFetch(useCallback(() => usersApi.get(id), [id]))

  if (loading) return <Loader />
  if (error) return <ErrorState message={error} onRetry={refetch} />
  if (!data) return null

  const {
    user, organization, targetSummary, salesPerformance, attendanceSummary,
    leadSummary, assignedProjects = [], transferHistory = [], recentActivities = [], activityTimeline = [],
  } = data

  return (
    <div>
      <div className="mb-4">
        <button onClick={() => navigate('/admin/employees')} className="text-sm text-slate-500 hover:text-slate-700">← Back to Employees</button>
      </div>

      <PageHeader
        title={user.name}
        subtitle={`${user.employeeId || '—'} · ${titleCase(user.role)} · ${user.branch || 'No branch'}`}
        actions={<StatusBadge status={user.isActive ? 'approved' : 'cancelled'} />}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* SECTION 1 — Personal Information */}
        <Section title="Personal Information">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <Field label="Employee Name" value={user.name} />
            <Field label="Employee ID" value={user.employeeId} />
            <Field label="Role" value={titleCase(user.role)} />
            <Field label="Designation" value={user.designation} />
            <Field label="Mobile Number" value={user.phone} />
            <Field label="Email" value={user.email} />
            <Field label="Joining Date" value={user.joiningDate ? formatDate(user.joiningDate) : '—'} />
            <Field label="Status" value={user.isActive ? 'Active' : 'Disabled'} />
          </dl>
        </Section>

        {/* SECTION 2 — Organization Details */}
        <Section title="Organization Details">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <Field label="Current Branch" value={organization.currentBranch} />
            <Field label="Assigned Sub-Admin" value={organization.assignedSubAdmin?.name} />
            <Field label="Reporting Manager" value={organization.reportingManager?.name} />
            <Field label="Previous Branch" value={organization.previousBranch} />
          </dl>
        </Section>
      </div>

      {/* SECTION 3 — Target Summary */}
      <h3 className="mb-3 mt-6 text-sm font-semibold text-slate-900">Target Summary</h3>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Assigned Target" value={inr(targetSummary.assignedTarget)} />
        <StatCard label="Achieved Target" value={inr(targetSummary.achievedTarget)} />
        <StatCard label="Remaining Target" value={inr(targetSummary.remainingTarget)} />
        <StatCard label="Achievement %" value={targetSummary.achievementPct == null ? '—' : `${targetSummary.achievementPct}%`} />
        <StatCard label="Target Status" value={<StatusBadge status={targetSummary.status} />} />
      </div>

      {/* SECTION 4 — Sales Performance */}
      <h3 className="mb-3 mt-6 text-sm font-semibold text-slate-900">Sales Performance</h3>
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Revenue" value={inr(salesPerformance.revenueGenerated)} />
        <StatCard label="Completed Sales" value={salesPerformance.completedSales} />
        <StatCard label="Customers" value={salesPerformance.customersHandled} />
        <StatCard label="Bookings" value={salesPerformance.bookings} />
        <StatCard label="Registrations" value={salesPerformance.registrations} />
        <StatCard label="Conversion" value={`${salesPerformance.conversionRate}%`} />
      </div>

      {/* SECTION 5 & 6 — Attendance + Lead summaries */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Section title="Attendance Summary (last 30 days)">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Present" value={attendanceSummary.presentDays} />
            <StatCard label="Absent" value={attendanceSummary.absentDays} />
            <StatCard label="Late Check-ins" value={attendanceSummary.lateCheckIns} />
            <StatCard label="Attendance %" value={attendanceSummary.attendancePct == null ? '—' : `${attendanceSummary.attendancePct}%`} />
          </div>
        </Section>
        <Section title="Lead Summary">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <StatCard label="Assigned" value={leadSummary.assignedLeads} />
            <StatCard label="Active" value={leadSummary.activeLeads} />
            <StatCard label="Closed" value={leadSummary.closedLeads} />
            <StatCard label="Lost" value={leadSummary.lostLeads} />
            <StatCard label="Follow-ups" value={leadSummary.followUps} />
          </div>
        </Section>
      </div>

      {/* SECTION 7 — Assigned Projects */}
      <h3 className="mb-3 mt-6 text-sm font-semibold text-slate-900">Assigned Projects</h3>
      <Table
        columns={[
          { key: 'name', header: 'Project', render: (p) => <span className="font-medium text-slate-900">{p.name}</span> },
          { key: 'builder', header: 'Builder', render: (p) => p.builder?.name || '—' },
          { key: 'propertyType', header: 'Type', render: (p) => titleCase(p.propertyType) || '—' },
          { key: 'constructionStatus', header: 'Stage', render: (p) => <StatusBadge status={p.constructionStatus} /> },
        ]}
        rows={assignedProjects}
        empty="No projects linked to this employee's bookings yet."
      />

      {/* SECTION 8 — Transfer History */}
      <h3 className="mb-3 mt-6 text-sm font-semibold text-slate-900">Transfer History</h3>
      <Table
        columns={[
          { key: 'date', header: 'Transfer Date', render: (t) => formatDate(t.date) },
          { key: 'fromBranch', header: 'From Branch', render: (t) => t.fromBranch || '—' },
          { key: 'toBranch', header: 'To Branch', render: (t) => t.toBranch || '—' },
          { key: 'prev', header: 'Previous Sub-Admin', render: (t) => t.previousManagerName || '—' },
          { key: 'new', header: 'New Sub-Admin', render: (t) => t.newManagerName || '—' },
          { key: 'approved', header: 'Approved By', render: (t) => t.approvedByName || '—' },
          { key: 'reason', header: 'Reason', render: (t) => t.reason || '—' },
        ]}
        rows={transferHistory}
        empty="Never transferred."
      />

      {/* SECTION 9 & 10 — Recent Activities + Activity Timeline */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Section title="Recent Activities">
          {recentActivities.length === 0 ? <p className="text-sm text-slate-400">No recent activity.</p> : (
            <ul className="space-y-2 text-sm">
              {recentActivities.map((a) => (
                <li key={a._id} className="flex items-start justify-between gap-3 border-b border-slate-100 pb-2">
                  <span className="text-slate-700">{a.description || `${titleCase(a.action)} · ${titleCase(a.module)}`}</span>
                  <span className="shrink-0 text-xs text-slate-400">{formatDate(a.createdAt, true)}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
        <Section title="Activity Timeline">
          <ol className="relative space-y-4 border-l border-slate-200 pl-4">
            {activityTimeline.map((t, i) => (
              <li key={i} className="relative">
                <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-blue-500" />
                <div className="text-sm font-medium text-slate-800">{t.label}</div>
                {t.meta && <div className="text-xs text-slate-500">{t.meta}</div>}
                <div className="text-xs text-slate-400">{formatDate(t.at, true)}</div>
              </li>
            ))}
          </ol>
        </Section>
      </div>
    </div>
  )
}

import { useCallback } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { buildersApi } from '../../api/resources.js'
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
  return <Card className="p-5"><h3 className="mb-3 text-sm font-semibold text-slate-900">{title}</h3>{children}</Card>
}
function Field({ label, value }) {
  return <div><dt className="text-xs text-slate-400">{label}</dt><dd className="text-slate-700">{value ?? '—'}</dd></div>
}

export default function BuilderDetailsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const backToDirectory = () => navigate(`${location.pathname.split('/builders/')[0]}?tab=directory`)
  const { data, loading, error, refetch } = useFetch(useCallback(() => buildersApi.get(id), [id]))

  if (loading) return <Loader />
  if (error) return <ErrorState message={error} onRetry={refetch} />
  if (!data) return null

  const { builder, projects = [], performance, timeline = [] } = data

  return (
    <div>
      <div className="mb-4"><button onClick={backToDirectory} className="text-sm text-slate-500 hover:text-slate-700">← Back</button></div>
      <PageHeader
        title={builder.name}
        subtitle={`${builder.city || '—'} · ${builder.contactPerson || 'No contact'}`}
        actions={<StatusBadge status={builder.isArchived ? 'cancelled' : (builder.complianceStatus || 'compliant')} />}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Builder Information">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <Field label="Builder Name" value={builder.name} />
            <Field label="Contact Person" value={builder.contactPerson} />
            <Field label="Mobile" value={builder.phone} />
            <Field label="Email" value={builder.email} />
            <Field label="City" value={builder.city} />
            <Field label="GST Number" value={builder.gstNumber} />
            <Field label="RERA Registration" value={builder.reraCert} />
            <Field label="RERA Expiry" value={builder.reraExpiry ? formatDate(builder.reraExpiry) : '—'} />
            <div className="col-span-2"><Field label="Office Address" value={builder.address} /></div>
          </dl>
        </Section>
        <Section title="Commission Details">
          <dl className="space-y-2 text-sm">
            <Field label="Commission Agreement" value={builder.commissionAgreement} />
            <Field label="Compliance" value={titleCase(builder.complianceStatus)} />
          </dl>
        </Section>
      </div>

      <h3 className="mb-3 mt-6 text-sm font-semibold text-slate-900">Business Performance</h3>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Revenue" value={inr(performance.totalRevenue)} />
        <StatCard label="Total Sales" value={performance.totalSales} />
        <StatCard label="Bookings" value={performance.bookings} />
        <StatCard label="Customers" value={performance.customers} />
      </div>

      <h3 className="mb-3 mt-6 text-sm font-semibold text-slate-900">Projects</h3>
      <Table
        columns={[
          { key: 'name', header: 'Project', render: (p) => <span className="font-medium text-slate-900">{p.name}</span> },
          { key: 'propertyType', header: 'Type', render: (p) => titleCase(p.propertyType) || '—' },
          { key: 'reraNumber', header: 'RERA', render: (p) => p.reraNumber || '—' },
          { key: 'commissionRate', header: 'Commission', render: (p) => `${p.commissionRate || 0}%` },
          { key: 'constructionStatus', header: 'Status', render: (p) => <StatusBadge status={p.constructionStatus} /> },
          { key: 'view', header: '', render: (p) => <button onClick={() => navigate(`/admin/inventory/projects/${p._id}`)} className="text-xs text-blue-600 hover:underline">View</button> },
        ]}
        rows={projects}
        empty="No projects registered for this builder."
      />

      <h3 className="mb-3 mt-6 text-sm font-semibold text-slate-900">Activity Timeline</h3>
      <Card className="p-5">
        <ol className="relative space-y-4 border-l border-slate-200 pl-4">
          {timeline.map((t, i) => (
            <li key={i} className="relative">
              <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-blue-500" />
              <div className="text-sm font-medium text-slate-800">{t.label}</div>
              <div className="text-xs text-slate-400">{formatDate(t.at, true)}</div>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  )
}

import { useCallback, useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { projectsApi } from '../../api/resources.js'
import { useFetch } from '../../hooks/useFetch.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { PageHeader, Card, StatCard, Table, StatusBadge, Button, Loader, ErrorState } from '../../components/ui.jsx'
import { formatDate, titleCase } from '../../lib/format.js'
import { AddUnitsModal } from './InventoryPage.jsx'

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

export default function ProjectDetailsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { can } = useAuth()
  const [showAdd, setShowAdd] = useState(false)
  // Projects are reached from the "Builders & Projects" tab — return there.
  const backToDirectory = () => navigate(`${location.pathname.split('/projects/')[0]}?tab=directory`)
  const { data, loading, error, refetch } = useFetch(useCallback(() => projectsApi.get(id), [id]))

  if (loading) return <Loader />
  if (error) return <ErrorState message={error} onRetry={refetch} />
  if (!data) return null

  const { project, inventory, pricing, configuration = [], sales, assignedEmployees = [] } = data

  return (
    <div>
      <div className="mb-4"><button onClick={backToDirectory} className="text-sm text-slate-500 hover:text-slate-700">← Back</button></div>
      <PageHeader
        title={project.name}
        subtitle={`${project.builder?.name || '—'} · ${project.location || project.city || '—'}`}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge status={project.constructionStatus} />
            {can('unit', 'create') && <Button onClick={() => setShowAdd(true)}>+ Add Units</Button>}
          </div>
        }
      />

      {showAdd && (
        <AddUnitsModal
          fixedProjectId={id}
          fixedProjectName={project.name}
          onClose={() => setShowAdd(false)}
          onDone={() => { setShowAdd(false); refetch() }}
        />
      )}

      {/* Project overview */}
      <Section title="Project Overview">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
          <Field label="Project Name" value={project.name} />
          <Field label="Builder" value={project.builder?.name} />
          <Field label="Location" value={project.location} />
          <Field label="Project Type" value={titleCase(project.propertyType)} />
          <Field label="RERA Number" value={project.reraNumber} />
          <Field label="Current Status" value={titleCase(project.constructionStatus)} />
          <Field label="Launch Date" value={project.launchDate ? formatDate(project.launchDate) : '—'} />
          <Field label="Possession Date" value={project.possessionDate ? formatDate(project.possessionDate) : '—'} />
          <Field label="Commission" value={`${project.commissionRate || 0}%`} />
        </dl>
      </Section>

      {/* Inventory summary */}
      <h3 className="mb-3 mt-6 text-sm font-semibold text-slate-900">Inventory Summary</h3>
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Total Units" value={inventory.total} />
        <StatCard label="Available" value={inventory.available} />
        <StatCard label="Reserved" value={inventory.reserved} />
        <StatCard label="Booked" value={inventory.booked} />
        <StatCard label="Sold" value={inventory.sold} />
      </div>

      {/* Pricing + sales */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Section title="Pricing Summary">
          <div className="grid grid-cols-3 gap-4">
            <StatCard label="Minimum" value={inr(pricing.min)} />
            <StatCard label="Maximum" value={inr(pricing.max)} />
            <StatCard label="Average" value={inr(pricing.avg)} />
          </div>
        </Section>
        <Section title="Sales Summary">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard label="Revenue" value={inr(sales.revenue)} />
            <StatCard label="Bookings" value={sales.bookings} />
            <StatCard label="Registrations" value={sales.registrations} />
            <StatCard label="Conversion" value={`${sales.conversionRate}%`} />
          </div>
        </Section>
      </div>

      {/* Configuration + amenities */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Section title="Configuration Summary">
          {configuration.length === 0 ? (
            <div className="text-sm text-slate-400">
              No units added yet.
              {can('unit', 'create') && <div className="mt-3"><Button size="sm" onClick={() => setShowAdd(true)}>+ Add Units</Button></div>}
            </div>
          ) : (
            <ul className="space-y-2 text-sm">
              {configuration.map((c) => (
                <li key={c.type} className="flex justify-between border-b border-slate-100 pb-1">
                  <span className="text-slate-600">{c.type}</span>
                  <span className="font-medium text-slate-900">{c.count} units</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
        <Section title="Amenities">
          {(project.amenities || []).length === 0 ? <p className="text-sm text-slate-400">No amenities listed.</p> : (
            <div className="flex flex-wrap gap-2">
              {project.amenities.map((a) => <span key={a} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600">{a}</span>)}
            </div>
          )}
        </Section>
      </div>

      {/* Documents */}
      <div className="mt-6">
        <Section title="Documents">
          <p className="text-sm text-slate-400">Brochure · Floor Plans · Master Layout · Price Sheet · RERA Certificate</p>
          <p className="mt-2 text-xs text-slate-400">Project document uploads are not yet enabled — coming with the document module.</p>
        </Section>
      </div>

      {/* Assigned employees */}
      <h3 className="mb-3 mt-6 text-sm font-semibold text-slate-900">Assigned Employees</h3>
      <Table
        columns={[
          { key: 'name', header: 'Employee', render: (e) => <span className="font-medium text-slate-900">{e.name}</span> },
          { key: 'role', header: 'Role', render: (e) => titleCase(e.role) },
          { key: 'branch', header: 'Branch', render: (e) => e.branch || '—' },
        ]}
        rows={assignedEmployees}
        empty="No sales executives have booked in this project yet."
      />
    </div>
  )
}

import { useState, useCallback, useMemo } from 'react'
import { buildersApi, projectsApi } from '../../api/resources.js'
import { useFetch } from '../../hooks/useFetch.js'
import { useDebounce } from '../../hooks/useDebounce.js'
import { formatDate, titleCase } from '../../lib/format.js'
import { PageHeader, Card, Input, Loader, ErrorState, StatusBadge } from '../../components/ui.jsx'

// Sales-Exec flow §E2 — read-only Builders directory. Executives browse the
// firm's builders (RERA cert, compliance) and drill into each builder's
// projects. `builder:view` is already granted to the executive role.
export default function BuildersDirectoryPage() {
  const [search, setSearch] = useState('')
  const q = useDebounce(search, 300)

  const builders = useFetch(useCallback(() => buildersApi.list({ limit: 200 }), []))

  const filtered = useMemo(() => {
    const list = builders.data || []
    const term = q.trim().toLowerCase()
    if (!term) return list
    return list.filter((b) =>
      [b.name, b.city, b.reraCert, b.contactPerson].filter(Boolean).join(' ').toLowerCase().includes(term)
    )
  }, [builders.data, q])

  return (
    <div>
      <PageHeader title="Builders Directory" subtitle="Browse the firm's builders, RERA certification and their projects." />

      <Card className="mb-4 p-3">
        <div className="max-w-sm">
          <Input placeholder="Search builder, city or RERA cert…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </Card>

      {builders.loading ? (
        <Loader />
      ) : builders.error ? (
        <ErrorState message={builders.error} onRetry={builders.refetch} />
      ) : filtered.length === 0 ? (
        <p className="py-16 text-center text-sm text-slate-400">No builders found.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((b) => <BuilderCard key={b._id} builder={b} />)}
        </div>
      )}
    </div>
  )
}

const COMPLIANCE_CLS = {
  compliant: 'bg-emerald-50 text-emerald-700',
  pending_review: 'bg-amber-50 text-amber-700',
  non_compliant: 'bg-red-50 text-red-700',
}

function BuilderCard({ builder: b }) {
  const [open, setOpen] = useState(false)
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-slate-900">{b.name}</h3>
          <p className="text-xs text-slate-500">{[b.city, b.contactPerson].filter(Boolean).join(' · ') || '—'}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${COMPLIANCE_CLS[b.complianceStatus] || 'bg-slate-100 text-slate-600'}`}>
          {titleCase(b.complianceStatus || 'unknown')}
        </span>
      </div>

      {b.about && <p className="mt-2 line-clamp-2 text-sm text-slate-600">{b.about}</p>}

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        <Field label="RERA Cert" value={b.reraCert || '—'} />
        <Field label="RERA Expiry" value={b.reraExpiry ? formatDate(b.reraExpiry) : '—'} />
        <Field label="Commission" value={b.commissionAgreement || '—'} />
        <Field label="Phone" value={b.phone || '—'} />
      </dl>

      <button
        onClick={() => setOpen((v) => !v)}
        className="mt-4 w-full rounded-lg border border-slate-200 py-1.5 text-xs font-medium text-blue-600 hover:bg-slate-50"
      >
        {open ? 'Hide projects' : 'View projects'}
      </button>

      {open && <BuilderProjects builderId={b._id} />}
    </Card>
  )
}

function Field({ label, value }) {
  return (
    <div className="min-w-0">
      <dt className="uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="truncate font-medium text-slate-700">{value}</dd>
    </div>
  )
}

function BuilderProjects({ builderId }) {
  const projects = useFetch(useCallback(() => projectsApi.list({ builder: builderId, limit: 100 }), [builderId]))
  if (projects.loading) return <div className="py-3"><Loader label="Loading projects…" /></div>
  const list = projects.data || []
  if (list.length === 0) return <p className="py-3 text-center text-xs text-slate-400">No projects registered.</p>
  return (
    <ul className="mt-3 space-y-2">
      {list.map((p) => (
        <li key={p._id} className="rounded-lg border border-slate-100 bg-slate-50 p-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-sm font-medium text-slate-800">{p.name}</span>
            {p.status && <StatusBadge status={p.status} />}
          </div>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
            {p.reraNumber && <span>RERA: {p.reraNumber}</span>}
            {p.commissionRate ? <span>Commission: {p.commissionRate}%</span> : null}
            {p.location && <span>{p.location}</span>}
          </div>
        </li>
      ))}
    </ul>
  )
}

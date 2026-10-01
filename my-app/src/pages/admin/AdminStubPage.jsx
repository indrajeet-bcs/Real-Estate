import { Link } from 'react-router-dom'
import { PageHeader, Card } from '../../components/ui.jsx'

// Placeholder for Admin (Company Owner) consoles being ported in phases from the
// rera-saas-admin-portal flow. Shows what's coming and, where useful, links to the
// existing pages that still work in the interim so nothing is lost mid-migration.
export default function AdminStubPage({ title, subtitle, phase, features = [], interimLinks = [] }) {
  return (
    <div>
      <PageHeader title={title} subtitle={subtitle} />

      <Card className="p-8">
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-700">
            Phase {phase}
          </span>
          <span className="text-sm text-slate-500">Coming soon — porting from the Company Owner flow</span>
        </div>

        {features.length > 0 && (
          <div className="mt-6">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Planned in this console</div>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-slate-600">
                  <span className="mt-0.5 text-slate-300">◦</span>
                  {f}
                </li>
              ))}
            </ul>
          </div>
        )}

        {interimLinks.length > 0 && (
          <div className="mt-8 border-t border-slate-200 pt-6">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Available now (interim)</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {interimLinks.map((l) => (
                <Link
                  key={l.to}
                  to={l.to}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
                >
                  {l.label} →
                </Link>
              ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}

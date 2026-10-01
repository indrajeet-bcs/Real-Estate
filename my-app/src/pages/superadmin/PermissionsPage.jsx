import { useCallback } from 'react'
import { settingsApi } from '../../api/resources.js'
import { useFetch } from '../../hooks/useFetch.js'
import { ROLE_LABELS } from '../../lib/constants.js'
import { titleCase } from '../../lib/format.js'
import { PageHeader, Card, Loader, ErrorState } from '../../components/ui.jsx'

// Read-only view of the role→module→action matrix (§14). Editing the live matrix
// is a future enhancement; this surfaces the effective platform rules.
export default function PermissionsPage() {
  const { data, loading, error, refetch } = useFetch(useCallback(() => settingsApi.permissions(), []))

  if (loading) return <Loader />
  if (error) return <ErrorState message={error} onRetry={refetch} />

  return (
    <div>
      <PageHeader title="Permissions & Roles" subtitle="Module visibility per role, applied platform-wide (§14)" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {Object.entries(data).map(([role, modules]) => (
          <Card key={role} className="p-5">
            <h3 className="mb-3 font-medium text-slate-900">{ROLE_LABELS[role] || titleCase(role)}</h3>
            <div className="space-y-2">
              {Object.entries(modules).map(([mod, actions]) => (
                <div key={mod} className="flex items-center justify-between border-b border-slate-200 pb-2 text-sm last:border-0">
                  <span className="text-slate-700">{titleCase(mod)}</span>
                  <div className="flex flex-wrap gap-1">
                    {actions.map((a) => (
                      <span key={a} className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                        {a === '*' ? 'all' : a}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}

import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader, Card, Button, ExportMenu, Loader, ErrorState } from '../../components/ui.jsx'
import { possessionsApi } from '../../api/resources.js'
import { useFetch } from '../../hooks/useFetch.js'
import { exportRowsToCsv } from '../../lib/format.js'

export default function PossessionReports() {
  const navigate = useNavigate()
  const { data, loading, error, refetch } = useFetch(useCallback(() => possessionsApi.reports(), []))
  const r = data || { byStatus: [], byEmployee: [], byProject: [] }

  const exportStatus = () => exportRowsToCsv('possession-status.csv', r.byStatus.map((x) => ({ Status: x._id || '—', Cases: x.cases })))
  const exportEmp = () => exportRowsToCsv('possession-employee.csv', r.byEmployee.map((x) => ({ Employee: x._id || '—', Cases: x.cases, Completed: x.completed || 0 })))
  const exportProj = () => exportRowsToCsv('possession-project.csv', r.byProject.map((x) => ({ Project: x._id || '—', Cases: x.cases })))

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <Button variant="ghost" onClick={() => navigate(-1)} className="-ml-3 mb-2">← Back to Dashboard</Button>
        <PageHeader title="Possession Reports" subtitle="Live insights across all handover cases." />
      </div>

      {loading ? <Loader /> : error ? <ErrorState message={error} onRetry={refetch} /> : (
        <div className="grid gap-6 lg:grid-cols-3">
          <ReportCard title="Status Summary" subtitle="Case count by status." onExport={exportStatus} disabled={r.byStatus.length === 0}>
            <MiniTable rows={r.byStatus} cols={[['_id', 'Status'], ['cases', 'Cases']]} />
          </ReportCard>
          <ReportCard title="Employee Performance" subtitle="Cases and completions per employee." onExport={exportEmp} disabled={r.byEmployee.length === 0}>
            <MiniTable rows={r.byEmployee} cols={[['_id', 'Employee'], ['cases', 'Cases'], ['completed', 'Completed']]} />
          </ReportCard>
          <ReportCard title="By Project" subtitle="Handover volume per project." onExport={exportProj} disabled={r.byProject.length === 0}>
            <MiniTable rows={r.byProject} cols={[['_id', 'Project'], ['cases', 'Cases']]} />
          </ReportCard>
        </div>
      )}
    </div>
  )
}

function ReportCard({ title, subtitle, onExport, disabled, children }) {
  return (
    <Card className="flex h-full flex-col p-5">
      <div className="flex-1">
        <h3 className="mb-1 text-lg font-semibold text-slate-900">{title}</h3>
        <p className="mb-4 text-sm text-slate-500">{subtitle}</p>
        <div className="mb-4">{children}</div>
      </div>
      <ExportMenu items={[{ key: 'csv', label: 'Export to CSV', onClick: onExport }]} label="Download Report" align="left" disabled={disabled} />
    </Card>
  )
}

function MiniTable({ rows, cols }) {
  if (!rows || rows.length === 0) return <p className="text-sm text-slate-400">No data yet.</p>
  return (
    <div className="overflow-hidden rounded-lg border border-slate-100">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr>{cols.map((c) => <th key={c[1]} className="px-3 py-2 font-medium">{c[1]}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row, i) => <tr key={i}>{cols.map((c) => <td key={c[1]} className="px-3 py-2 text-slate-700">{row[c[0]] ?? '—'}</td>)}</tr>)}
        </tbody>
      </table>
    </div>
  )
}

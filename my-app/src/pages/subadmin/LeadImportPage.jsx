import { useState } from 'react'
import Papa from 'papaparse'
import { customersApi } from '../../api/resources.js'
import { useToast } from '../../context/ToastContext.jsx'
import { PageHeader, Card, Button, Select, Table, StatusBadge } from '../../components/ui.jsx'

// Target customer fields the CSV columns can map to.
const TARGET_FIELDS = [
  { key: '', label: '— ignore —' },
  { key: 'name', label: 'Name (required)' },
  { key: 'mobile', label: 'Mobile (required)' },
  { key: 'email', label: 'Email' },
  { key: 'address', label: 'Address' },
]

// Four-step wizard mirroring §5: Upload → Column Mapping → Validation → Results.
export default function LeadImportPage() {
  const toast = useToast()
  const [step, setStep] = useState(1)
  const [fileName, setFileName] = useState('')
  const [headers, setHeaders] = useState([])
  const [rawRows, setRawRows] = useState([])
  const [mapping, setMapping] = useState({}) // csvColumn -> targetField
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)

  function onFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const cols = res.meta.fields || []
        setHeaders(cols)
        setRawRows(res.data)
        // Auto-map columns whose names match target fields.
        const auto = {}
        cols.forEach((c) => {
          const norm = c.toLowerCase().replace(/[^a-z]/g, '')
          if (norm.includes('name')) auto[c] = 'name'
          else if (norm.includes('mobile') || norm.includes('phone')) auto[c] = 'mobile'
          else if (norm.includes('email')) auto[c] = 'email'
          else if (norm.includes('address')) auto[c] = 'address'
          else auto[c] = ''
        })
        setMapping(auto)
        setStep(2)
      },
      error: () => toast.error('Could not parse the CSV file'),
    })
  }

  // Apply the mapping to produce normalized rows for the validation engine.
  function mappedRows() {
    return rawRows.map((row) => {
      const out = {}
      for (const [csvCol, target] of Object.entries(mapping)) {
        if (target) out[target] = row[csvCol]
      }
      return out
    })
  }

  async function runImport() {
    const hasName = Object.values(mapping).includes('name')
    const hasMobile = Object.values(mapping).includes('mobile')
    if (!hasName || !hasMobile) {
      toast.error('Map both Name and Mobile columns to continue')
      return
    }
    setBusy(true)
    try {
      const res = await customersApi.import({ fileName, columnMapping: mapping, rows: mappedRows() })
      setResult(res.data.data)
      setStep(3)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Import failed')
    } finally {
      setBusy(false)
    }
  }

  function reset() {
    setStep(1); setHeaders([]); setRawRows([]); setMapping({}); setResult(null); setFileName('')
  }

  return (
    <div>
      <PageHeader title="Lead Import" subtitle="Bulk import via CSV — validation splits duplicates & errors (§5)" />

      {/* Stepper */}
      <div className="mb-6 flex items-center gap-2 text-sm">
        {['Upload', 'Map Columns', 'Results'].map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs ${
              step >= i + 1 ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'
            }`}>{i + 1}</span>
            <span className={step >= i + 1 ? 'text-slate-900' : 'text-slate-500'}>{label}</span>
            {i < 2 && <span className="mx-2 text-slate-700">→</span>}
          </div>
        ))}
      </div>

      {step === 1 && (
        <Card className="p-8 text-center">
          <p className="mb-4 text-sm text-slate-600">Upload a CSV file with your leads. The first row must be column headers.</p>
          <input type="file" accept=".csv" onChange={onFile} className="text-sm text-slate-700" />
        </Card>
      )}

      {step === 2 && (
        <Card className="p-6">
          <p className="mb-4 text-sm text-slate-600">
            {rawRows.length} rows from <strong className="text-slate-900">{fileName}</strong>. Map each column to a field.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {headers.map((col) => (
              <div key={col} className="flex items-center gap-3">
                <span className="w-40 truncate text-sm text-slate-700" title={col}>{col}</span>
                <span className="text-slate-500">→</span>
                <Select value={mapping[col] || ''} onChange={(e) => setMapping((m) => ({ ...m, [col]: e.target.value }))}>
                  {TARGET_FIELDS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                </Select>
              </div>
            ))}
          </div>
          <div className="mt-6 flex justify-between">
            <Button variant="secondary" onClick={reset}>Start over</Button>
            <Button onClick={runImport} disabled={busy}>{busy ? 'Importing…' : 'Validate & Import'}</Button>
          </div>
        </Card>
      )}

      {step === 3 && result && (
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <ResultCard label="Imported" value={result.successful} color="text-emerald-600" />
            <ResultCard label="Duplicates" value={result.duplicates.length} color="text-amber-600" />
            <ResultCard label="Failed" value={result.failed.length} color="text-red-600" />
          </div>

          {result.duplicates.length > 0 && (
            <RejectTable title="Duplicate Rows (mobile already exists)" rows={result.duplicates} />
          )}
          {result.failed.length > 0 && (
            <RejectTable title="Failed Rows (missing mandatory fields)" rows={result.failed} />
          )}

          <Button onClick={reset}>Import another file</Button>
        </div>
      )}
    </div>
  )
}

function ResultCard({ label, value, color }) {
  return (
    <Card className="p-5 text-center">
      <div className={`text-3xl font-semibold ${color}`}>{value}</div>
      <div className="mt-1 text-xs uppercase tracking-wide text-slate-500">{label}</div>
    </Card>
  )
}

function RejectTable({ title, rows }) {
  const columns = [
    { key: 'name', header: 'Name', render: (r) => r.row?.name || '—' },
    { key: 'mobile', header: 'Mobile', render: (r) => r.row?.mobile || '—' },
    { key: 'reason', header: 'Reason', render: () => <StatusBadge status="missed" /> },
    { key: 'detail', header: 'Detail', render: (r) => <span className="text-xs text-slate-600">{r.reason}</span> },
  ]
  return (
    <div>
      <h3 className="mb-2 text-sm font-medium text-slate-700">{title}</h3>
      <Table columns={columns} rows={rows} />
    </div>
  )
}

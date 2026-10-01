import { useState, useEffect, useCallback } from 'react'
import { dailyReportsApi } from '../../api/resources.js'
import { useFetch } from '../../hooks/useFetch.js'
import { useToast } from '../../context/ToastContext.jsx'
import { formatDate } from '../../lib/format.js'
import { PageHeader, Card, Button, Input, Textarea, Loader, ErrorState } from '../../components/ui.jsx'

const todayKey = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const COUNT_FIELDS = [
  { key: 'callsCount', label: 'Calls Made' },
  { key: 'meetingsCount', label: 'Meetings' },
  { key: 'visitsCount', label: 'Site Visits' },
  { key: 'bookingsCount', label: 'Bookings' },
  { key: 'newLeadsCount', label: 'New Leads' },
]

// Sales-Exec flow §E3 — End-of-Day report. Counts pre-fill from the day's real
// activity; the exec adjusts them and adds reflection before submitting. One
// report per day (re-submitting updates it).
export default function DailyReportPage() {
  const toast = useToast()
  const date = todayKey()

  const ctx = useFetch(useCallback(() => dailyReportsApi.today({ date }), [date]))
  const history = useFetch(useCallback(() => dailyReportsApi.list({ limit: 30 }), []))

  const [form, setForm] = useState(null)
  const [busy, setBusy] = useState(false)

  // Seed the form from the submitted report if present, else from prefill counts.
  useEffect(() => {
    if (!ctx.data) return
    const r = ctx.data.report
    const p = ctx.data.prefill || {}
    setForm({
      callsCount: r?.callsCount ?? p.callsCount ?? 0,
      meetingsCount: r?.meetingsCount ?? p.meetingsCount ?? 0,
      visitsCount: r?.visitsCount ?? p.visitsCount ?? 0,
      bookingsCount: r?.bookingsCount ?? p.bookingsCount ?? 0,
      newLeadsCount: r?.newLeadsCount ?? p.newLeadsCount ?? 0,
      summary: r?.summary || '',
      challenges: r?.challenges || '',
      tomorrowPlan: r?.tomorrowPlan || '',
    })
  }, [ctx.data])

  const alreadySubmitted = !!ctx.data?.report
  const setNum = (k) => (e) => setForm((f) => ({ ...f, [k]: Math.max(0, parseInt(e.target.value || '0', 10) || 0) }))
  const setText = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function submit() {
    setBusy(true)
    try {
      await dailyReportsApi.submit({ date, ...form })
      toast.success(alreadySubmitted ? 'Report updated' : 'Report submitted')
      ctx.refetch(); history.refetch()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Daily (EOD) Report" subtitle="Wrap up your day — log your activity, note blockers and plan tomorrow." />

      {ctx.loading || !form ? (
        <Loader />
      ) : ctx.error ? (
        <ErrorState message={ctx.error} onRetry={ctx.refetch} />
      ) : (
        <div className="grid gap-5 lg:grid-cols-3">
          {/* Form */}
          <div className="space-y-5 lg:col-span-2">
            <Card className="p-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">Today's Activity <span className="text-xs font-normal text-slate-400">· {formatDate(date)}</span></h3>
                {alreadySubmitted && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">Submitted</span>}
              </div>
              <p className="mb-3 text-xs text-slate-500">Pre-filled from your logged activity — adjust if needed.</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {COUNT_FIELDS.map((f) => (
                  <Input key={f.key} label={f.label} type="number" min="0" value={form[f.key]} onChange={setNum(f.key)} />
                ))}
              </div>
            </Card>

            <Card className="p-5">
              <h3 className="mb-3 text-sm font-semibold text-slate-900">Reflection</h3>
              <div className="space-y-4">
                <Textarea label="Summary — what did you accomplish today?" rows={3} value={form.summary} onChange={setText('summary')} />
                <Textarea label="Challenges / blockers faced" rows={2} value={form.challenges} onChange={setText('challenges')} />
                <Textarea label="Plan for tomorrow" rows={2} value={form.tomorrowPlan} onChange={setText('tomorrowPlan')} />
              </div>
              <div className="mt-4 flex justify-end">
                <Button onClick={submit} disabled={busy}>{alreadySubmitted ? 'Update Report' : 'Submit Report'}</Button>
              </div>
            </Card>
          </div>

          {/* History */}
          <Card className="p-5">
            <h3 className="mb-3 text-sm font-semibold text-slate-900">Recent Reports</h3>
            {history.loading ? (
              <Loader />
            ) : (history.data || []).length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">No past reports yet.</p>
            ) : (
              <ul className="space-y-2">
                {(history.data || []).map((r) => (
                  <li key={r._id} className="rounded-lg border border-slate-200 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-800">{formatDate(r.date)}</span>
                      <span className="text-[11px] text-slate-400">{formatDate(r.submittedAt, true)}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
                      <span>📞 {r.callsCount}</span>
                      <span>🤝 {r.meetingsCount}</span>
                      <span>📍 {r.visitsCount}</span>
                      <span>✅ {r.bookingsCount}</span>
                      <span>➕ {r.newLeadsCount}</span>
                    </div>
                    {r.summary && <p className="mt-1 line-clamp-2 text-xs text-slate-600">{r.summary}</p>}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </div>
  )
}

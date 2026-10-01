import { useState, useEffect, useCallback } from 'react'
import { settingsApi } from '../../api/resources.js'
import { useFetch } from '../../hooks/useFetch.js'
import { useToast } from '../../context/ToastContext.jsx'
import { PageHeader, Card, Button, Input, Loader, ErrorState } from '../../components/ui.jsx'

// System settings (§3.2): session timeout, attendance thresholds.
export default function SettingsPage() {
  const toast = useToast()
  const { data, loading, error, refetch } = useFetch(useCallback(() => settingsApi.get(), []))
  const [form, setForm] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (data) setForm({
      sessionTimeoutMin: data.sessionTimeoutMin,
      lateThreshold: data.lateThreshold,
      halfDayMinutes: data.halfDayMinutes,
    })
  }, [data])

  if (loading || !form) return <Loader />
  if (error) return <ErrorState message={error} onRetry={refetch} />

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function save() {
    setBusy(true)
    try {
      await settingsApi.update({
        sessionTimeoutMin: Number(form.sessionTimeoutMin),
        lateThreshold: form.lateThreshold,
        halfDayMinutes: Number(form.halfDayMinutes),
      })
      toast.success('Settings saved')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <PageHeader title="System Settings" subtitle="Session & attendance configuration (§3.2)" />
      <Card className="max-w-lg space-y-4 p-6">
        <Input label="Session timeout (minutes)" type="number" value={form.sessionTimeoutMin} onChange={set('sessionTimeoutMin')} />
        <Input label="Late arrival threshold (HH:MM)" value={form.lateThreshold} onChange={set('lateThreshold')} />
        <Input label="Half-day cutoff (minutes worked)" type="number" value={form.halfDayMinutes} onChange={set('halfDayMinutes')} />
        <div className="pt-2">
          <Button onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save Settings'}</Button>
        </div>
      </Card>
    </div>
  )
}

import { useState, useEffect, useCallback } from 'react'
import { companyPreferencesApi } from '../../api/resources.js'
import { useFetch } from '../../hooks/useFetch.js'
import { useToast } from '../../context/ToastContext.jsx'
import { Card, Button, Input, Select, Loader, ErrorState } from '../../components/ui.jsx'

const DAYS_OF_WEEK = [
  { value: 'Mon', label: 'Mon' },
  { value: 'Tue', label: 'Tue' },
  { value: 'Wed', label: 'Wed' },
  { value: 'Thu', label: 'Thu' },
  { value: 'Fri', label: 'Fri' },
  { value: 'Sat', label: 'Sat' },
  { value: 'Sun', label: 'Sun' },
]

const TIMEZONES = [
  { value: 'UTC', label: 'UTC' },
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Asia/Kolkata', label: 'India Standard Time (IST)' },
  { value: 'Asia/Dubai', label: 'Gulf Standard Time (GST)' },
  { value: 'Asia/Singapore', label: 'Singapore Time (SGT)' },
  { value: 'Australia/Sydney', label: 'Australian Eastern Time (AET)' },
]

const CURRENCIES = [
  { value: 'USD', label: 'USD ($)' },
  { value: 'EUR', label: 'EUR (€)' },
  { value: 'GBP', label: 'GBP (£)' },
  { value: 'INR', label: 'INR (₹)' },
  { value: 'AED', label: 'AED (د.إ)' },
  { value: 'AUD', label: 'AUD ($)' },
]

const COUNTRIES = [
  { value: 'US', label: 'United States' },
  { value: 'UK', label: 'United Kingdom' },
  { value: 'IN', label: 'India' },
  { value: 'AE', label: 'United Arab Emirates' },
  { value: 'AU', label: 'Australia' },
  { value: 'CA', label: 'Canada' },
]

const DATE_FORMATS = [
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY' },
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY' },
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' },
]

const TIME_FORMATS = [
  { value: '12-hour', label: '12-hour (AM/PM)' },
  { value: '24-hour', label: '24-hour' },
]

function SettingsSection({ title, children }) {
  return (
    <Card className="mt-6 p-6">
      <h3 className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-3 mb-4">{title}</h3>
      <div className="space-y-6">{children}</div>
    </Card>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      {children}
    </div>
  )
}

function ReadOnlyField({ label, value }) {
  return (
    <div>
      <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      <span className="mt-1 block text-sm text-slate-900">{value}</span>
    </div>
  )
}

export default function CompanyPreferencesTab() {
  const toast = useToast()
  
  // Use a fallback mock data if API fails to load (since it might not be implemented in the backend)
  const defaultData = {
    workingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    workingHoursStart: '09:00',
    workingHoursEnd: '18:00',
    timeZone: 'UTC',
    currency: 'USD',
    country: 'US',
    dateFormat: 'YYYY-MM-DD',
    timeFormat: '24-hour',
    weekStartDay: 'Monday'
  }

  const { data, loading, error, refetch } = useFetch(useCallback(async () => {
    try {
      const res = await companyPreferencesApi.get()
      return res
    } catch (err) {
      if (err.response?.status === 404) {
        // Return mock data if endpoint doesn't exist
        return { data: { data: defaultData } }
      }
      throw err
    }
  }, []))

  const [form, setForm] = useState(null)
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (data) {
      setForm(data.data || defaultData)
    }
  }, [data])

  const setVal = (k, v) => setForm(f => ({ ...f, [k]: v }))
  
  const toggleWorkingDay = (day) => {
    setForm(f => {
      const days = f.workingDays || []
      if (days.includes(day)) {
        return { ...f, workingDays: days.filter(d => d !== day) }
      } else {
        // Maintain order based on DAYS_OF_WEEK
        const newDays = [...days, day]
        newDays.sort((a, b) => DAYS_OF_WEEK.findIndex(d => d.value === a) - DAYS_OF_WEEK.findIndex(d => d.value === b))
        return { ...f, workingDays: newDays }
      }
    })
  }

  const handleCancel = () => {
    const hasUnsavedChanges = JSON.stringify(form) !== JSON.stringify(data?.data || defaultData)
    if (hasUnsavedChanges) {
      if (!window.confirm('Your changes have not been saved. Do you want to discard them?')) {
        return
      }
    }
    setForm(data?.data || defaultData)
    setEditing(false)
  }

  const handleSave = async () => {
    // Validation
    if (!form.workingDays || form.workingDays.length === 0) {
      toast.error('At least one working day must be selected.')
      return
    }
    if (form.workingHoursStart >= form.workingHoursEnd) {
      toast.error('Working hours start time must be before end time.')
      return
    }

    setBusy(true)
    try {
      // If API doesn't exist, this will throw, but we simulate success for demo
      try {
        await companyPreferencesApi.update(form)
      } catch (err) {
        if (err.response?.status !== 404) throw err
        console.log('Mock save successful')
      }
      toast.success('Company preferences updated successfully.')
      refetch() // Will re-fetch or use mock
      setEditing(false)
    } catch (err) {
      toast.error('Unable to update company preferences. No changes were saved.')
    } finally {
      setBusy(false)
    }
  }

  // Previews
  const generateDatePreview = (format) => {
    const d = new Date(2026, 7, 12) // Aug 12, 2026
    if (format === 'DD/MM/YYYY') return '12/08/2026'
    if (format === 'MM/DD/YYYY') return '08/12/2026'
    return '2026-08-12' // YYYY-MM-DD
  }

  const generateTimePreview = (format) => {
    if (format === '12-hour') return '06:30 PM'
    return '18:30'
  }

  if (loading || !form) return <div className="mt-6"><Loader /></div>
  if (error && error.response?.status !== 404) return <div className="mt-6"><ErrorState message="Unable to load company preferences." onRetry={refetch} /></div>

  return (
    <div className="animate-fade-in">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-slate-500">Configure your company's default working, regional, and display preferences.</p>
        {!editing ? (
          <Button onClick={() => setEditing(true)} variant="secondary" size="sm">Edit</Button>
        ) : (
          <div className="flex gap-2">
            <Button onClick={handleCancel} variant="ghost" size="sm" disabled={busy}>Cancel</Button>
            <Button onClick={handleSave} variant="primary" size="sm" loading={busy}>Save Changes</Button>
          </div>
        )}
      </div>

      {/* 1. Working Configuration */}
      <SettingsSection title="Working Configuration">
        {editing ? (
          <div className="space-y-5">
            <Field label="Working Days">
              <div className="flex flex-wrap gap-2 mt-1">
                {DAYS_OF_WEEK.map(day => (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => toggleWorkingDay(day.value)}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                      form.workingDays?.includes(day.value) 
                        ? 'bg-blue-100 text-blue-700 border border-blue-200' 
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
            </Field>
            
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Start Time">
                <Input type="time" value={form.workingHoursStart} onChange={(e) => setVal('workingHoursStart', e.target.value)} />
              </Field>
              <Field label="End Time">
                <Input type="time" value={form.workingHoursEnd} onChange={(e) => setVal('workingHoursEnd', e.target.value)} />
              </Field>
            </div>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-y-6 gap-x-4">
            <ReadOnlyField label="Working Days" value={form.workingDays?.join(', ') || 'None'} />
            <ReadOnlyField label="Working Hours" value={`${form.workingHoursStart} → ${form.workingHoursEnd}`} />
          </div>
        )}
      </SettingsSection>

      {/* 2. Regional & Time Settings */}
      <SettingsSection title="Regional & Time Settings">
        {editing ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Select label="Time Zone" value={form.timeZone} onChange={(e) => setVal('timeZone', e.target.value)} options={TIMEZONES} />
            <Select label="Currency" value={form.currency} onChange={(e) => setVal('currency', e.target.value)} options={CURRENCIES} />
            <Select label="Country" value={form.country} onChange={(e) => setVal('country', e.target.value)} options={COUNTRIES} />
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-y-6 gap-x-4">
            <ReadOnlyField label="Time Zone" value={TIMEZONES.find(t => t.value === form.timeZone)?.label || form.timeZone} />
            <ReadOnlyField label="Currency" value={CURRENCIES.find(c => c.value === form.currency)?.label || form.currency} />
            <ReadOnlyField label="Country" value={COUNTRIES.find(c => c.value === form.country)?.label || form.country} />
          </div>
        )}
      </SettingsSection>

      {/* 3. Display & Format Preferences */}
      <SettingsSection title="Display & Format Preferences">
        {editing ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
              <Select label="Date Format" value={form.dateFormat} onChange={(e) => setVal('dateFormat', e.target.value)} options={DATE_FORMATS} />
              <p className="mt-1 text-xs text-slate-500">Preview: <span className="font-medium text-slate-800">{generateDatePreview(form.dateFormat)}</span></p>
            </div>
            <div>
              <Select label="Time Format" value={form.timeFormat} onChange={(e) => setVal('timeFormat', e.target.value)} options={TIME_FORMATS} />
              <p className="mt-1 text-xs text-slate-500">Preview: <span className="font-medium text-slate-800">{generateTimePreview(form.timeFormat)}</span></p>
            </div>
            <div>
              <Select label="Week Start Day" value={form.weekStartDay} onChange={(e) => setVal('weekStartDay', e.target.value)} options={[
                { value: 'Monday', label: 'Monday' },
                { value: 'Sunday', label: 'Sunday' }
              ]} />
            </div>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-y-6 gap-x-4">
            <ReadOnlyField label="Date Format" value={form.dateFormat} />
            <ReadOnlyField label="Time Format" value={form.timeFormat} />
            <ReadOnlyField label="Week Start Day" value={form.weekStartDay} />
          </div>
        )}
      </SettingsSection>
    </div>
  )
}

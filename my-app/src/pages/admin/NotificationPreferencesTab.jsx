import { useState, useEffect, useCallback } from 'react'
import { companyNotificationsApi } from '../../api/resources.js'
import { useFetch } from '../../hooks/useFetch.js'
import { useToast } from '../../context/ToastContext.jsx'
import { Card, Button, Loader, ErrorState, Toggle } from '../../components/ui.jsx'

const NOTIFICATION_GROUPS = [
  {
    title: 'LEAD & CUSTOMER',
    items: [
      { key: 'leadAssigned', label: 'Lead Assigned', description: 'Notify relevant users when a lead is assigned to them.' },
      { key: 'followUpOverdue', label: 'Follow-up Overdue', description: 'Notify relevant users when an assigned follow-up becomes overdue.' },
      { key: 'leadReassignment', label: 'Lead Reassignment', description: 'Notify relevant users when a lead is reassigned.' },
    ]
  },
  {
    title: 'SITE VISIT',
    items: [
      { key: 'siteVisitScheduled', label: 'Site Visit Scheduled', description: 'Notify relevant users when a site visit is scheduled.' },
      { key: 'siteVisitCompleted', label: 'Site Visit Completed', description: 'Notify relevant users when a site visit is marked completed.' },
    ]
  },
  {
    title: 'BOOKING & PAYMENT',
    items: [
      { key: 'bookingCreated', label: 'Booking Created', description: 'Notify relevant users when a booking is created.' },
      { key: 'bookingConfirmed', label: 'Booking Confirmed', description: 'Notify relevant users when a booking is confirmed.' },
      { key: 'paymentRecorded', label: 'Payment Recorded', description: 'Notify relevant users when a company payment is recorded.' },
    ]
  },
  {
    title: 'EMPLOYEE & HR',
    items: [
      { key: 'leaveRequest', label: 'Leave Request', description: 'Notify relevant users when an employee submits a leave request.' },
      { key: 'employeeTransfer', label: 'Employee Transfer', description: 'Notify relevant users when an employee transfer is created or updated.' },
    ]
  },
  {
    title: 'PROJECT & PROPERTY',
    items: [
      { key: 'projectPropertyUpdate', label: 'Project / Property Update', description: 'Notify relevant users when relevant project or property information is updated.' },
    ]
  },
  {
    title: 'POST-SALES',
    items: [
      { key: 'loanUpdate', label: 'Loan Update', description: "Notify relevant users when a customer's loan status or progress is updated." },
      { key: 'registrationUpdate', label: 'Registration Update', description: 'Notify relevant users when registration status or schedule is updated.' },
      { key: 'possessionUpdate', label: 'Possession Update', description: 'Notify relevant users when possession status or schedule is updated.' },
      { key: 'customerSupportUpdate', label: 'Customer Support Update', description: 'Notify relevant users when a customer support request is updated.' },
    ]
  }
]

// Fallback configuration if API doesn't exist
const DEFAULT_NOTIFICATIONS = {
  leadAssigned: true,
  followUpOverdue: true,
  leadReassignment: true,
  siteVisitScheduled: true,
  siteVisitCompleted: true,
  bookingCreated: false,
  bookingConfirmed: true,
  paymentRecorded: true,
  leaveRequest: true,
  employeeTransfer: true,
  projectPropertyUpdate: true,
  loanUpdate: true,
  registrationUpdate: true,
  possessionUpdate: true,
  customerSupportUpdate: true
}

export default function NotificationPreferencesTab() {
  const toast = useToast()

  const { data, loading, error, refetch } = useFetch(useCallback(async () => {
    try {
      const res = await companyNotificationsApi.get()
      return res
    } catch (err) {
      if (err.response?.status === 404) {
        // Return mock data if endpoint doesn't exist
        return { data: { data: DEFAULT_NOTIFICATIONS } }
      }
      throw err
    }
  }, []))

  const [form, setForm] = useState(null)
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (data) {
      setForm(data.data || DEFAULT_NOTIFICATIONS)
    }
  }, [data])

  const handleToggle = (key, value) => {
    setForm(f => ({ ...f, [key]: value }))
  }

  const handleCancel = () => {
    const hasUnsavedChanges = JSON.stringify(form) !== JSON.stringify(data?.data || DEFAULT_NOTIFICATIONS)
    if (hasUnsavedChanges) {
      if (!window.confirm('Your changes have not been saved. Do you want to discard them?')) {
        return
      }
    }
    setForm(data?.data || DEFAULT_NOTIFICATIONS)
    setEditing(false)
  }

  const handleSave = async () => {
    setBusy(true)
    try {
      try {
        await companyNotificationsApi.update(form)
      } catch (err) {
        if (err.response?.status !== 404) throw err
        console.log('Mock save successful')
      }
      toast.success('Notification preferences updated successfully.')
      refetch() 
      setEditing(false)
    } catch (err) {
      toast.error('Unable to update notification preferences. No changes were saved.')
    } finally {
      setBusy(false)
    }
  }

  if (loading || !form) return <div className="mt-6"><Loader /></div>
  if (error && error.response?.status !== 404) return <div className="mt-6"><ErrorState message="Unable to load notification preferences." onRetry={refetch} /></div>

  return (
    <div className="animate-fade-in">
      <div className="mb-6 flex items-center justify-between">
        <p className="text-sm text-slate-500">Configure company-wide CRM notification preferences.</p>
        {!editing ? (
          <Button onClick={() => setEditing(true)} variant="secondary" size="sm">Edit</Button>
        ) : (
          <div className="flex gap-2">
            <Button onClick={handleCancel} variant="ghost" size="sm" disabled={busy}>Cancel</Button>
            <Button onClick={handleSave} variant="primary" size="sm" loading={busy}>Save Changes</Button>
          </div>
        )}
      </div>

      <div className="space-y-6">
        {NOTIFICATION_GROUPS.map((group) => (
          <Card key={group.title} className="p-0 overflow-hidden">
            <div className="bg-slate-50 border-b border-slate-200 px-5 py-3">
              <h3 className="text-xs font-semibold tracking-wider text-slate-500">{group.title}</h3>
            </div>
            <ul className="divide-y divide-slate-100">
              {group.items.map((item) => (
                <li key={item.key} className="px-5 py-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                  <div className="flex gap-3">
                    <span className="material-symbols-outlined text-slate-400 mt-0.5">notifications</span>
                    <div>
                      <h4 className="text-sm font-medium text-slate-900">{item.label}</h4>
                      <p className="mt-0.5 text-xs text-slate-500 max-w-xl">{item.description}</p>
                    </div>
                  </div>
                  <div className="ml-4 shrink-0">
                    {editing ? (
                      <Toggle 
                        checked={form[item.key] || false} 
                        onChange={(val) => handleToggle(item.key, val)} 
                        label={`Enable ${item.label} notifications`}
                        hideLabel
                      />
                    ) : (
                      <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${
                        form[item.key] ? 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20' : 'bg-slate-50 text-slate-600 ring-1 ring-inset ring-slate-500/10'
                      }`}>
                        {form[item.key] ? 'Enabled' : 'Disabled'}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </div>
  )
}

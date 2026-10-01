import { useState, useCallback, useEffect } from 'react'
import { officeSettingsApi } from '../../api/resources.js'
import { useFetch } from '../../hooks/useFetch.js'
import { Card, Loader, ErrorState } from '../../components/ui.jsx'

function Field({ label, value }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm text-slate-900 font-medium">{value || '—'}</dd>
    </div>
  )
}

export default function CompanyProfileTab() {
  const { data: firm, loading, error, refetch } = useFetch(useCallback(() => officeSettingsApi.get(), []))
  const [profile, setProfile] = useState(null)

  useEffect(() => {
    if (firm) {
      setProfile({
        name: firm.name || 'Acme Real Estate',
        companyId: firm.companyId || 'CMP-8932',
        registrationNo: 'REG-1029481',
        primaryContact: '+91 98765 43210',
        email: 'admin@acmerealestate.com',
        address: '123 Business Park, Mumbai, India'
      })
    }
  }, [firm])

  if (loading || !profile) return <div className="mt-6"><Loader /></div>
  if (error) return <div className="mt-6"><ErrorState message="Unable to load company profile." onRetry={refetch} /></div>

  return (
    <div className="animate-fade-in">
      <div className="mb-4">
        <p className="text-sm text-slate-500">View your company's core identity and registration details.</p>
      </div>

      <Card className="mt-6 p-0 overflow-hidden">
        <div className="border-b border-slate-100 bg-slate-50 px-5 py-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Company Identity</h3>
        </div>
        <div className="p-6">
          <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
            <Field label="Company Name" value={profile.name} />
            <Field label="Company ID" value={profile.companyId} />
            <Field label="Registration No." value={profile.registrationNo} />
          </dl>
        </div>
      </Card>

      <Card className="mt-6 p-0 overflow-hidden">
        <div className="border-b border-slate-100 bg-slate-50 px-5 py-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Contact Information</h3>
        </div>
        <div className="p-6">
          <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
            <Field label="Primary Email" value={profile.email} />
            <Field label="Contact Number" value={profile.primaryContact} />
            <Field label="Registered Address" value={profile.address} />
          </dl>
        </div>
      </Card>
      
      <p className="mt-6 rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs text-blue-700">
        To modify your company profile details, please contact SaaS Support.
      </p>
    </div>
  )
}

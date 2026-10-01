import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { firmsApi } from '../../api/resources.js'
import { useToast } from '../../context/ToastContext.jsx'
import { Button, Input, Select, Modal } from '../../components/ui.jsx'

const PLANS = [
  { id: 'standard', name: 'Standard', monthly: 0, yearly: 0, users: 5, storage: 2, features: ['Basic CRM', 'Email Support'] },
  { id: 'professional', name: 'Professional', monthly: 99, yearly: 990, users: 25, storage: 10, features: ['Advanced CRM', 'Priority Support', 'Reporting'] },
  { id: 'enterprise', name: 'Enterprise', monthly: 299, yearly: 2990, users: -1, storage: -1, features: ['Custom Features', '24/7 Support', 'Dedicated AM'] },
]

export default function AddCompanyWizard({ onClose, onDone }) {
  const toast = useToast()
  const navigate = useNavigate()

  const [step, setStep] = useState(1)
  const [busy, setBusy] = useState(false)
  const [createdFirm, setCreatedFirm] = useState(null)

  const [form, setForm] = useState({
    // Step 1: Company Info
    logo: '',
    name: '',
    contactEmail: '',
    contactPhone: '',
    website: '',
    gstNumber: '',
    address: '',
    city: '',
    state: '',
    country: 'India',
    timeZone: 'Asia/Kolkata',
    currency: 'INR',
    // Step 2: Subscription Plan
    plan: '',
    billingCycle: 'monthly',
    enableTrial: false,
    trialDays: 14,
    // Step 3: Admin Info
    adminName: '',
    adminEmail: '',
    adminPhone: '',
    adminPassword: '',
    confirmPassword: '',
    sendWelcomeEmail: true,
    forcePasswordChange: true,
  })

  const setF = (k) => (e) => setForm(prev => ({ ...prev, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  const handleNext = () => setStep(s => Math.min(4, s + 1))
  const handlePrev = () => setStep(s => Math.max(1, s - 1))

  const handleCreate = async () => {
    setBusy(true)
    try {
      const payload = {
        name: form.name,
        contactEmail: form.contactEmail,
        contactPhone: form.contactPhone,
        logo: form.logo,
        website: form.website,
        gstNumber: form.gstNumber,
        address: form.address,
        city: form.city,
        state: form.state,
        country: form.country,
        timeZone: form.timeZone,
        currency: form.currency,
        plan: form.plan,
        billingCycle: form.billingCycle,
        enableTrial: form.enableTrial,
        trialDays: form.enableTrial ? Number(form.trialDays) : 0,
        status: form.enableTrial ? 'trial' : 'active',
        subscriptionStatus: form.enableTrial ? 'trial' : 'active',
        allowedUsers: PLANS.find(p => p.id === form.plan)?.users || 25,
        storageLimit: PLANS.find(p => p.id === form.plan)?.storage || 10,
        admin: {
          name: form.adminName,
          email: form.adminEmail,
          phone: form.adminPhone,
          password: form.adminPassword,
        }
      }
      const res = await firmsApi.create(payload)
      setCreatedFirm(res.data.data.firm)
      setStep(5) // Success step
      toast.success('Company created successfully')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create company')
    } finally {
      setBusy(false)
    }
  }

  // Validations
  const isStep1Valid = form.name.trim() && form.contactEmail.trim() && form.contactPhone.trim()
  const isStep2Valid = form.plan !== '' && (!form.enableTrial || form.trialDays > 0)
  const isStep3Valid = form.adminName.trim() && form.adminEmail.trim() && form.adminPassword.length >= 8 && form.adminPassword === form.confirmPassword

  const renderStepper = () => (
    <div className="flex items-center justify-between mb-8 relative">
      <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-slate-200 -z-10 -translate-y-1/2"></div>
      {['Company Information', 'Subscription Plan', 'Company Admin', 'Review & Create'].map((label, i) => {
        const stepNum = i + 1
        const isActive = step === stepNum
        const isPast = step > stepNum
        return (
          <div key={stepNum} className="flex flex-col items-center gap-2 bg-white px-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-colors ${
              isActive ? 'border-blue-600 bg-blue-600 text-white' :
              isPast ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 bg-white text-slate-400'
            }`}>
              {isPast ? '✓' : stepNum}
            </div>
            <span className={`text-xs font-semibold uppercase tracking-wider ${isActive ? 'text-blue-600' : isPast ? 'text-emerald-600' : 'text-slate-400'}`}>{label}</span>
          </div>
        )
      })}
    </div>
  )

  const renderStep1 = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input label="Company Name *" value={form.name} onChange={setF('name')} placeholder="e.g. Acme Corp" />
        <Input label="Company Logo (URL)" value={form.logo} onChange={setF('logo')} placeholder="https://..." />
        <Input label="Company Email *" type="email" value={form.contactEmail} onChange={setF('contactEmail')} />
        <Input label="Mobile Number *" value={form.contactPhone} onChange={setF('contactPhone')} />
        <Input label="Website" value={form.website} onChange={setF('website')} />
        <Input label="GST Number" value={form.gstNumber} onChange={setF('gstNumber')} />
      </div>
      <div className="border-t border-slate-100 pt-4">
        <h4 className="text-sm font-semibold text-slate-700 mb-3">Address & Region</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="Address" value={form.address} onChange={setF('address')} className="md:col-span-2" />
          <Input label="City" value={form.city} onChange={setF('city')} />
          <Input label="State" value={form.state} onChange={setF('state')} />
          <Select label="Country" value={form.country} onChange={setF('country')}>
            <option value="India">India</option>
            <option value="USA">United States</option>
            <option value="UAE">United Arab Emirates</option>
            <option value="UK">United Kingdom</option>
          </Select>
          <Select label="Currency" value={form.currency} onChange={setF('currency')}>
            <option value="INR">INR (₹)</option>
            <option value="USD">USD ($)</option>
            <option value="AED">AED (د.إ)</option>
            <option value="GBP">GBP (£)</option>
          </Select>
          <Select label="Time Zone" value={form.timeZone} onChange={setF('timeZone')}>
            <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
            <option value="America/New_York">America/New_York (EST)</option>
            <option value="Europe/London">Europe/London (GMT)</option>
            <option value="Asia/Dubai">Asia/Dubai (GST)</option>
          </Select>
        </div>
      </div>
    </div>
  )

  const renderStep2 = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {PLANS.map(p => (
          <div 
            key={p.id} 
            className={`border-2 rounded-xl p-4 cursor-pointer transition-all ${form.plan === p.id ? 'border-blue-600 bg-blue-50/50 shadow-sm' : 'border-slate-200 hover:border-slate-300 bg-white'}`}
            onClick={() => setForm(prev => ({ ...prev, plan: p.id }))}
          >
            <h3 className="font-bold text-slate-800 text-lg mb-1">{p.name}</h3>
            <div className="text-2xl font-black text-slate-900 mb-4">
              ${form.billingCycle === 'monthly' ? p.monthly : p.yearly}
              <span className="text-xs font-medium text-slate-500 uppercase">/{form.billingCycle === 'monthly' ? 'mo' : 'yr'}</span>
            </div>
            <ul className="space-y-2 mb-4">
              <li className="text-sm text-slate-600 flex items-center gap-2"><span>✓</span> {p.users === -1 ? 'Unlimited' : p.users} Users</li>
              <li className="text-sm text-slate-600 flex items-center gap-2"><span>✓</span> {p.storage === -1 ? 'Unlimited' : p.storage} GB Storage</li>
              {p.features.map(f => <li key={f} className="text-sm text-slate-600 flex items-center gap-2"><span>✓</span> {f}</li>)}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-slate-100 pt-4 flex flex-col md:flex-row gap-6">
        <div className="flex-1">
          <Select label="Billing Cycle" value={form.billingCycle} onChange={setF('billingCycle')}>
            <option value="monthly">Monthly Billing</option>
            <option value="yearly">Yearly Billing (Save 20%)</option>
          </Select>
        </div>
        <div className="flex-1 border-l border-slate-100 pl-6">
          <label className="flex items-center gap-3 mb-3 cursor-pointer">
            <input type="checkbox" className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500" checked={form.enableTrial} onChange={setF('enableTrial')} />
            <span className="text-sm font-medium text-slate-800">Enable Free Trial</span>
          </label>
          {form.enableTrial && (
            <Input label="Trial Days" type="number" min="1" value={form.trialDays} onChange={setF('trialDays')} />
          )}
        </div>
      </div>
    </div>
  )

  const renderStep3 = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
      <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-sm text-blue-800 mb-2">
        This user will be created as the primary Platform Admin for the tenant company. They will have full administrative rights over the company's workspace.
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input label="Full Name *" value={form.adminName} onChange={setF('adminName')} />
        <Input label="Admin Email *" type="email" value={form.adminEmail} onChange={setF('adminEmail')} />
        <Input label="Mobile Number" value={form.adminPhone} onChange={setF('adminPhone')} />
        <div className="hidden md:block"></div>
        <Input label="Temporary Password *" type="password" value={form.adminPassword} onChange={setF('adminPassword')} />
        <Input label="Confirm Password *" type="password" value={form.confirmPassword} onChange={setF('confirmPassword')} />
      </div>
      <div className="border-t border-slate-100 pt-4 space-y-3">
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500" checked={form.sendWelcomeEmail} onChange={setF('sendWelcomeEmail')} />
          <span className="text-sm text-slate-700">Send welcome email with login credentials</span>
        </label>
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500" checked={form.forcePasswordChange} onChange={setF('forcePasswordChange')} />
          <span className="text-sm text-slate-700">Force password change on first login</span>
        </label>
      </div>
    </div>
  )

  const renderStep4 = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="border border-slate-200 rounded-lg p-4 bg-slate-50/50">
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Company Information</h4>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-slate-500">Name</dt><dd className="font-medium text-slate-900">{form.name}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Email</dt><dd className="font-medium text-slate-900">{form.contactEmail}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Phone</dt><dd className="font-medium text-slate-900">{form.contactPhone}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Location</dt><dd className="font-medium text-slate-900">{form.city ? `${form.city}, ${form.country}` : form.country}</dd></div>
          </dl>
        </div>
        <div className="border border-slate-200 rounded-lg p-4 bg-slate-50/50">
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Subscription Details</h4>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-slate-500">Plan</dt><dd className="font-medium text-slate-900 capitalize">{form.plan}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Billing Cycle</dt><dd className="font-medium text-slate-900 capitalize">{form.billingCycle}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Status</dt><dd className="font-medium text-emerald-600">{form.enableTrial ? `Trial (${form.trialDays} Days)` : 'Active'}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Users</dt><dd className="font-medium text-slate-900">{PLANS.find(p=>p.id===form.plan)?.users === -1 ? 'Unlimited' : PLANS.find(p=>p.id===form.plan)?.users}</dd></div>
          </dl>
        </div>
        <div className="border border-slate-200 rounded-lg p-4 bg-slate-50/50 md:col-span-2">
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Primary Admin</h4>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div><dt className="text-slate-500 text-xs mb-1">Full Name</dt><dd className="font-medium text-slate-900">{form.adminName}</dd></div>
            <div><dt className="text-slate-500 text-xs mb-1">Email</dt><dd className="font-medium text-slate-900">{form.adminEmail}</dd></div>
          </dl>
        </div>
      </div>
    </div>
  )

  const renderSuccess = () => (
    <div className="flex flex-col items-center justify-center py-10 text-center animate-in zoom-in-95 duration-300">
      <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-3xl mb-4">
        ✓
      </div>
      <h2 className="text-2xl font-bold text-slate-900 mb-2">Company Created Successfully</h2>
      <p className="text-slate-500 mb-8 max-w-sm">
        {form.name} has been successfully onboarded and the welcome email has been sent to {form.adminEmail}.
      </p>
      
      <div className="w-full max-w-sm bg-slate-50 border border-slate-100 rounded-lg p-4 mb-8 text-left">
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between"><dt className="text-slate-500">Company ID</dt><dd className="font-mono font-medium text-slate-900">{createdFirm?.companyId || createdFirm?._id?.substring(createdFirm._id.length-6)}</dd></div>
          <div className="flex justify-between"><dt className="text-slate-500">Assigned Plan</dt><dd className="font-medium text-slate-900 capitalize">{form.plan}</dd></div>
          <div className="flex justify-between"><dt className="text-slate-500">Billing Cycle</dt><dd className="font-medium text-slate-900 capitalize">{form.billingCycle}</dd></div>
        </dl>
      </div>

      <div className="flex flex-col w-full max-w-sm gap-3">
        <Button onClick={() => navigate(`/super-admin/firms/${createdFirm?._id}`)}>View Company Details</Button>
        <Button variant="secondary" onClick={() => { onDone(); setStep(1); setForm({...form, name:'', contactEmail:'', adminEmail:''}) }}>Add Another Company</Button>
        <Button variant="ghost" onClick={onDone}>Back to Company List</Button>
      </div>
    </div>
  )

  if (step === 5) {
    return (
      <Modal open onClose={onDone} wide>
        {renderSuccess()}
      </Modal>
    )
  }

  return (
    <Modal 
      open 
      onClose={onClose} 
      title={step === 1 ? 'Step 1: Company Information' : step === 2 ? 'Step 2: Subscription Plan' : step === 3 ? 'Step 3: Company Admin' : 'Step 4: Review & Create'}
      wide
      footer={
        <div className="w-full flex items-center justify-between">
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <div className="flex gap-2">
            {step > 1 && <Button variant="secondary" onClick={handlePrev} disabled={busy}>Previous</Button>}
            {step < 4 && <Button variant="primary" onClick={handleNext} disabled={(step === 1 && !isStep1Valid) || (step === 2 && !isStep2Valid) || (step === 3 && !isStep3Valid)}>Next</Button>}
            {step === 4 && <Button variant="primary" onClick={handleCreate} disabled={busy}>{busy ? 'Creating...' : 'Create Company'}</Button>}
          </div>
        </div>
      }
    >
      <div className="pb-4">
        {renderStepper()}
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
        {step === 4 && renderStep4()}
      </div>
    </Modal>
  )
}

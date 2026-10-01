import { useState, useEffect } from 'react'
import { PageHeader, Card, Button, Input, Select, Modal } from '../../components/ui.jsx'
import { useToast } from '../../context/ToastContext.jsx'

function Toggle({ label, checked, onChange }) {
  return (
    <label className="flex cursor-pointer items-center justify-between py-2">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <div className="relative">
        <input type="checkbox" className="sr-only" checked={checked} onChange={onChange} />
        <div className={`block h-6 w-10 rounded-full transition-colors ${checked ? 'bg-blue-600' : 'bg-slate-300'}`}></div>
        <div className={`dot absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition-transform ${checked ? 'translate-x-4' : ''}`}></div>
      </div>
    </label>
  )
}

function Checkbox({ label, checked, onChange }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 py-1">
      <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" checked={checked} onChange={onChange} />
      <span className="text-sm text-slate-700">{label}</span>
    </label>
  )
}

const DEFAULT_SETTINGS = {
  // General
  platformName: 'Real Estate SaaS',
  supportEmail: 'support@example.com',
  supportPhone: '+1 (555) 123-4567',
  websiteUrl: 'https://example.com',
  companyAddress: '123 Business Rd, Tech City',
  // Branding
  platformLogo: '',
  favicon: '',
  primaryColor: '#2563eb',
  secondaryColor: '#475569',
  loginPageLogo: '',
  // Security
  sessionTimeout: '30',
  minPasswordLength: '8',
  maxLoginAttempts: '5',
  accountLockDuration: '15',
  requireUppercase: true,
  requireNumber: true,
  requireSpecialChar: true,
  // Notifications
  emailNotifications: true,
  inAppNotifications: true,
  billingAlerts: true,
  securityAlerts: true,
  maintenanceNotifications: false,
  // SMTP
  smtpHost: 'smtp.mailtrap.io',
  smtpPort: '2525',
  smtpUsername: 'user123',
  smtpPassword: 'password123',
  senderName: 'SaaS Platform',
  senderEmail: 'noreply@example.com',
  // Billing
  defaultCurrency: 'USD',
  gstPercentage: '18',
  defaultTrialDuration: '14',
  gracePeriod: '7',
  invoicePrefix: 'INV-',
  autoRenewal: true,
  // Storage
  maxFileUploadSize: '10MB',
  allowedFileTypes: 'jpg, png, pdf, docx',
  defaultStorageLimit: '5GB',
  // Localization
  defaultLanguage: 'en',
  defaultTimeZone: 'UTC',
  dateFormat: 'MM/DD/YYYY',
  timeFormat: '12h',
  // Maintenance
  maintenanceMode: false,
  maintenanceMessage: 'We are currently undergoing scheduled maintenance. Please check back later.',
  allowSuperAdminDuringMaintenance: true,
}

export default function PlatformSettingsPage() {
  const toast = useToast()
  const [form, setForm] = useState({ ...DEFAULT_SETTINGS })
  const [initialForm, setInitialForm] = useState({ ...DEFAULT_SETTINGS })
  const [isSaving, setIsSaving] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  
  const setField = (key, value) => setForm(f => ({ ...f, [key]: value }))
  
  const handleReset = () => {
    setForm({ ...initialForm })
    toast.success('Settings reset to last saved state.')
  }

  const checkCriticalChanges = () => {
    const criticalKeys = [
      'sessionTimeout', 'minPasswordLength', 'maxLoginAttempts', 'accountLockDuration',
      'requireUppercase', 'requireNumber', 'requireSpecialChar',
      'smtpHost', 'smtpPort', 'smtpUsername', 'smtpPassword',
      'defaultCurrency', 'gstPercentage', 'autoRenewal',
      'maintenanceMode'
    ]
    return criticalKeys.some(key => form[key] !== initialForm[key])
  }

  const initiateSave = () => {
    if (checkCriticalChanges()) {
      setShowConfirmModal(true)
    } else {
      performSave()
    }
  }

  const performSave = async () => {
    setShowConfirmModal(false)
    setIsSaving(true)
    // Simulate API call
    setTimeout(() => {
      setInitialForm({ ...form })
      setIsSaving(false)
      toast.success('Platform settings updated successfully.')
    }, 800)
  }

  const Section = ({ title, children }) => (
    <Card className="mb-6 overflow-hidden">
      <div className="border-b border-slate-200 bg-slate-50 px-6 py-4">
        <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
      </div>
      <div className="p-6">{children}</div>
    </Card>
  )

  return (
    <div className="pb-20">
      <PageHeader 
        title="Platform Settings" 
        subtitle="Configure global settings for the SaaS platform." 
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6">
        <div className="space-y-6">
          <Section title="1. General Settings">
            <div className="space-y-4">
              <Input label="Platform Name" value={form.platformName} onChange={e => setField('platformName', e.target.value)} />
              <div className="grid grid-cols-2 gap-4">
                <Input label="Support Email" type="email" value={form.supportEmail} onChange={e => setField('supportEmail', e.target.value)} />
                <Input label="Support Phone" value={form.supportPhone} onChange={e => setField('supportPhone', e.target.value)} />
              </div>
              <Input label="Website URL" value={form.websiteUrl} onChange={e => setField('websiteUrl', e.target.value)} />
              <Input label="Company Address" value={form.companyAddress} onChange={e => setField('companyAddress', e.target.value)} />
            </div>
          </Section>

          <Section title="3. Security">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input label="Session Timeout (Minutes)" type="number" value={form.sessionTimeout} onChange={e => setField('sessionTimeout', e.target.value)} />
                <Input label="Minimum Password Length" type="number" value={form.minPasswordLength} onChange={e => setField('minPasswordLength', e.target.value)} />
                <Input label="Maximum Login Attempts" type="number" value={form.maxLoginAttempts} onChange={e => setField('maxLoginAttempts', e.target.value)} />
                <Input label="Account Lock Duration (Minutes)" type="number" value={form.accountLockDuration} onChange={e => setField('accountLockDuration', e.target.value)} />
              </div>
              <div className="pt-2">
                <h4 className="mb-2 text-sm font-medium text-slate-700">Password Complexity</h4>
                <Checkbox label="Require Uppercase Letter" checked={form.requireUppercase} onChange={e => setField('requireUppercase', e.target.checked)} />
                <Checkbox label="Require Number" checked={form.requireNumber} onChange={e => setField('requireNumber', e.target.checked)} />
                <Checkbox label="Require Special Character" checked={form.requireSpecialChar} onChange={e => setField('requireSpecialChar', e.target.checked)} />
              </div>
            </div>
          </Section>

          <Section title="5. Email (SMTP)">
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <Input label="SMTP Host" value={form.smtpHost} onChange={e => setField('smtpHost', e.target.value)} />
                </div>
                <Input label="SMTP Port" value={form.smtpPort} onChange={e => setField('smtpPort', e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input label="SMTP Username" value={form.smtpUsername} onChange={e => setField('smtpUsername', e.target.value)} />
                <Input label="SMTP Password" type="password" value={form.smtpPassword} onChange={e => setField('smtpPassword', e.target.value)} />
                <Input label="Sender Name" value={form.senderName} onChange={e => setField('senderName', e.target.value)} />
                <Input label="Sender Email" type="email" value={form.senderEmail} onChange={e => setField('senderEmail', e.target.value)} />
              </div>
              <div className="pt-2 border-t border-slate-100 mt-2 flex justify-start">
                <Button variant="secondary" size="sm" onClick={() => toast.success('Test email sent successfully.')}>Send Test Email</Button>
              </div>
            </div>
          </Section>

          <Section title="7. Storage & Upload Limits">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input label="Maximum File Upload Size" value={form.maxFileUploadSize} onChange={e => setField('maxFileUploadSize', e.target.value)} />
                <Input label="Default Storage Limit" value={form.defaultStorageLimit} onChange={e => setField('defaultStorageLimit', e.target.value)} />
              </div>
              <Input label="Allowed File Types" value={form.allowedFileTypes} onChange={e => setField('allowedFileTypes', e.target.value)} />
            </div>
          </Section>
          
          <Section title="9. Maintenance Mode">
            <div className="space-y-4">
              <Toggle label="Enable Maintenance Mode" checked={form.maintenanceMode} onChange={e => setField('maintenanceMode', e.target.checked)} />
              
              {form.maintenanceMode && (
                <div className="space-y-4 rounded-lg bg-amber-50 p-4 border border-amber-200 mt-2">
                  <Input label="Maintenance Message" value={form.maintenanceMessage} onChange={e => setField('maintenanceMessage', e.target.value)} />
                  <Checkbox label="Allow Super Admin Login During Maintenance" checked={form.allowSuperAdminDuringMaintenance} onChange={e => setField('allowSuperAdminDuringMaintenance', e.target.checked)} />
                </div>
              )}
            </div>
          </Section>
        </div>

        <div className="space-y-6">
          <Section title="2. Branding">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input label="Platform Logo URL" placeholder="https://" value={form.platformLogo} onChange={e => setField('platformLogo', e.target.value)} />
                <Input label="Favicon URL" placeholder="https://" value={form.favicon} onChange={e => setField('favicon', e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-slate-700">Primary Color</span>
                  <div className="flex items-center gap-2">
                    <input type="color" className="h-10 w-12 cursor-pointer rounded border border-slate-300 p-1" value={form.primaryColor} onChange={e => setField('primaryColor', e.target.value)} />
                    <Input className="flex-1" value={form.primaryColor} onChange={e => setField('primaryColor', e.target.value)} />
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-slate-700">Secondary Color</span>
                  <div className="flex items-center gap-2">
                    <input type="color" className="h-10 w-12 cursor-pointer rounded border border-slate-300 p-1" value={form.secondaryColor} onChange={e => setField('secondaryColor', e.target.value)} />
                    <Input className="flex-1" value={form.secondaryColor} onChange={e => setField('secondaryColor', e.target.value)} />
                  </div>
                </div>
              </div>
              <Input label="Login Page Logo URL" placeholder="https://" value={form.loginPageLogo} onChange={e => setField('loginPageLogo', e.target.value)} />
            </div>
          </Section>

          <Section title="4. Notifications">
            <div className="space-y-1 divide-y divide-slate-100">
              <Toggle label="Email Notifications" checked={form.emailNotifications} onChange={e => setField('emailNotifications', e.target.checked)} />
              <Toggle label="In-App Notifications" checked={form.inAppNotifications} onChange={e => setField('inAppNotifications', e.target.checked)} />
              <Toggle label="Billing Alerts" checked={form.billingAlerts} onChange={e => setField('billingAlerts', e.target.checked)} />
              <Toggle label="Security Alerts" checked={form.securityAlerts} onChange={e => setField('securityAlerts', e.target.checked)} />
              <Toggle label="Maintenance Notifications" checked={form.maintenanceNotifications} onChange={e => setField('maintenanceNotifications', e.target.checked)} />
            </div>
          </Section>

          <Section title="6. Billing Settings">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Select label="Default Currency" value={form.defaultCurrency} onChange={e => setField('defaultCurrency', e.target.value)}>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="INR">INR (₹)</option>
                </Select>
                <Input label="GST Percentage (%)" type="number" value={form.gstPercentage} onChange={e => setField('gstPercentage', e.target.value)} />
                <Input label="Default Trial Duration (Days)" type="number" value={form.defaultTrialDuration} onChange={e => setField('defaultTrialDuration', e.target.value)} />
                <Input label="Grace Period (Days)" type="number" value={form.gracePeriod} onChange={e => setField('gracePeriod', e.target.value)} />
              </div>
              <Input label="Invoice Prefix" value={form.invoicePrefix} onChange={e => setField('invoicePrefix', e.target.value)} />
              <div className="pt-2 border-t border-slate-100 mt-2">
                <Toggle label="Auto Renewal" checked={form.autoRenewal} onChange={e => setField('autoRenewal', e.target.checked)} />
              </div>
            </div>
          </Section>

          <Section title="8. Localization">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Select label="Default Language" value={form.defaultLanguage} onChange={e => setField('defaultLanguage', e.target.value)}>
                  <option value="en">English</option>
                  <option value="es">Spanish</option>
                  <option value="fr">French</option>
                </Select>
                <Select label="Default Time Zone" value={form.defaultTimeZone} onChange={e => setField('defaultTimeZone', e.target.value)}>
                  <option value="UTC">UTC</option>
                  <option value="EST">EST</option>
                  <option value="PST">PST</option>
                  <option value="IST">IST</option>
                </Select>
                <Select label="Date Format" value={form.dateFormat} onChange={e => setField('dateFormat', e.target.value)}>
                  <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                  <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                  <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                </Select>
                <Select label="Time Format" value={form.timeFormat} onChange={e => setField('timeFormat', e.target.value)}>
                  <option value="12h">12-hour</option>
                  <option value="24h">24-hour</option>
                </Select>
              </div>
            </div>
          </Section>

          <Section title="10. About Platform">
            <div className="grid grid-cols-2 gap-y-4 gap-x-4 text-sm text-slate-600">
              <div><span className="block font-medium text-slate-800">Platform Version</span><span>v2.4.1</span></div>
              <div><span className="block font-medium text-slate-800">Build Number</span><span>#89432</span></div>
              <div><span className="block font-medium text-slate-800">Environment</span><span className="capitalize text-emerald-600 font-medium">Production</span></div>
              <div><span className="block font-medium text-slate-800">Last Updated</span><span>July 9, 2026</span></div>
              <div><a href="#" className="text-blue-600 hover:underline">Terms & Conditions</a></div>
              <div><a href="#" className="text-blue-600 hover:underline">Privacy Policy</a></div>
            </div>
          </Section>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200 bg-white/80 p-4 backdrop-blur-md lg:left-64 flex justify-end gap-3 shadow-[0_-4px_6px_-1px_rgb(0,0,0,0.05)]">
        <Button variant="secondary" onClick={handleReset} disabled={isSaving}>Reset</Button>
        <Button onClick={initiateSave} disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      <Modal open={showConfirmModal} onClose={() => setShowConfirmModal(false)} title="Confirm Critical Changes">
        <div className="space-y-4 py-2">
          <p className="text-sm text-slate-600">
            You are about to modify critical platform settings (such as Security, Billing, SMTP, or Maintenance Mode). These changes will affect the entire platform immediately and will be recorded in the Audit Logs.
          </p>
          <p className="text-sm font-medium text-slate-800">
            Are you sure you want to proceed?
          </p>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setShowConfirmModal(false)}>Cancel</Button>
          <Button onClick={performSave}>Confirm & Save</Button>
        </div>
      </Modal>
    </div>
  )
}

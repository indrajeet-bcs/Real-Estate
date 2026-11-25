import { useState, useEffect } from 'react'
import { companySmtpApi } from '../../api/resources.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import { Card, Button, Input, Loader } from '../../components/ui.jsx'

export default function CompanySmtpSettingsTab() {
  const { can, user } = useAuth()
  const toast = useToast()

  const showToast = (msg, type = 'info') => {
    if (toast?.[type]) toast[type](msg)
    else toast?.info?.(msg)
  }

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [sendingTest, setSendingTest] = useState(false)

  const [showPassword, setShowPassword] = useState(false)
  const [showTestModal, setShowTestModal] = useState(false)
  const [testRecipient, setTestRecipient] = useState('')

  const [formData, setFormData] = useState({
    fromName: '',
    officialEmail: '',
    host: '',
    port: 587,
    secure: false,
    username: '',
    password: '',
  })

  const [statusInfo, setStatusInfo] = useState({
    isConfigured: false,
    isVerified: false,
    lastVerifiedAt: null,
    hasPassword: false,
    lastTestError: null,
  })

  // Permission checks (Super Admin has wildcard, Company Admin has settings permissions)
  const canEdit = can('settings', 'edit') || user?.role === 'super_admin' || user?.role === 'admin'
  const canTest = can('settings', 'test') || user?.role === 'super_admin' || user?.role === 'admin'
  const canSendTest = can('settings', 'send_test') || user?.role === 'super_admin' || user?.role === 'admin'

  const fetchConfig = async () => {
    try {
      setLoading(true)
      const res = await companySmtpApi.get()
      const data = res.data?.data || {}
      const smtp = data.smtpConfig || {}
      setFormData({
        fromName: smtp.fromName || data.firmName || '',
        officialEmail: data.officialEmail || data.contactEmail || '',
        host: smtp.host || '',
        port: smtp.port || 587,
        secure: Boolean(smtp.secure),
        username: smtp.username || '',
        password: '', // Never populate stored password
      })
      setStatusInfo({
        isConfigured: Boolean(smtp.isConfigured),
        isVerified: Boolean(smtp.isVerified),
        lastVerifiedAt: smtp.lastVerifiedAt || null,
        hasPassword: Boolean(smtp.hasPassword),
        lastTestError: null,
      })
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to load SMTP configuration', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchConfig()
  }, [])

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData((prev) => {
      const next = { ...prev, [name]: type === 'checkbox' ? checked : value }
      // Auto-adjust port if user toggles secure mode
      if (name === 'secure') {
        next.port = checked ? 465 : 587
      }
      return next
    })
  }

  const handleSave = async (e) => {
    e?.preventDefault()
    if (!canEdit) return

    if (!formData.host || !formData.port || !formData.username) {
      showToast('Please fill in Host, Port, and Username', 'error')
      return
    }

    if (!statusInfo.hasPassword && !formData.password) {
      showToast('Please provide an SMTP password', 'error')
      return
    }

    try {
      setSaving(true)
      setStatusInfo((prev) => ({ ...prev, lastTestError: null }))
      const payload = {
        fromName: formData.fromName?.trim() || '',
        officialEmail: formData.officialEmail?.trim() || undefined,
        host: formData.host.trim(),
        port: Number(formData.port),
        secure: Boolean(formData.secure),
        username: formData.username.trim(),
      }
      if (formData.password?.trim()) {
        payload.password = formData.password.trim()
      }

      const res = await companySmtpApi.update(payload)
      showToast(res.data?.message || 'SMTP connection verified and settings saved', 'success')

      // Refresh config to reflect updated verified state
      await fetchConfig()
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to verify and save SMTP configuration'
      setStatusInfo((prev) => ({ ...prev, lastTestError: msg }))
      showToast(msg, 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleTestConnection = async () => {
    if (!canTest) return

    try {
      setTesting(true)
      setStatusInfo((prev) => ({ ...prev, lastTestError: null }))

      // Allow testing either currently saved config or unsaved inputs if entered
      const testPayload = {}
      if (formData.host) testPayload.host = formData.host.trim()
      if (formData.port) testPayload.port = Number(formData.port)
      testPayload.secure = Boolean(formData.secure)
      if (formData.username) testPayload.username = formData.username.trim()
      if (formData.password?.trim()) testPayload.password = formData.password.trim()

      const res = await companySmtpApi.testConnection(
        Object.keys(testPayload).length > 1 ? testPayload : {}
      )

      showToast(res.data?.message || 'SMTP Connection Verified Successfully!', 'success')
      await fetchConfig()
    } catch (err) {
      const msg = err.response?.data?.message || 'SMTP Connection test failed'
      setStatusInfo((prev) => ({ ...prev, lastTestError: msg, isVerified: false }))
      showToast(msg, 'error')
    } finally {
      setTesting(false)
    }
  }

  const handleSendTestEmail = async (e) => {
    e?.preventDefault()
    if (!canSendTest) return

    if (!testRecipient?.trim()) {
      showToast('Please enter a recipient email address', 'error')
      return
    }

    try {
      setSendingTest(true)
      const res = await companySmtpApi.sendTestEmail({
        recipientEmail: testRecipient.trim(),
      })
      showToast(res.data?.message || `Test email successfully delivered to ${testRecipient.trim()}`, 'success')
      setShowTestModal(false)
      setTestRecipient('')
      await fetchConfig()
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to send test email', 'error')
    } finally {
      setSendingTest(false)
    }
  }

  if (loading) {
    return (
      <Card className="p-8 flex justify-center items-center min-h-[300px]">
        <Loader />
      </Card>
    )
  }

  // Derive status badge details
  let statusBadge = {
    color: 'bg-slate-100 text-slate-700 border-slate-200',
    icon: 'info',
    text: 'Not Configured',
  }

  if (statusInfo.isConfigured) {
    if (statusInfo.isVerified) {
      statusBadge = {
        color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        icon: 'check_circle',
        text: 'Verified & Active',
      }
    } else if (statusInfo.lastTestError) {
      statusBadge = {
        color: 'bg-red-50 text-red-700 border-red-200',
        icon: 'error',
        text: 'Connection Failed',
      }
    } else {
      statusBadge = {
        color: 'bg-amber-50 text-amber-700 border-amber-200',
        icon: 'hourglass_top',
        text: 'Verification Pending',
      }
    }
  }

  return (
    <div className="space-y-6">
      {/* Overview Card */}
      <Card className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <span className="material-symbols-outlined text-blue-600">mail</span>
              Company SMTP & Outgoing Email
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Configure your company's dedicated SMTP credentials. All invitations, employee onboarding emails, and password links will be sent using these settings.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${statusBadge.color}`}
            >
              <span className="material-symbols-outlined text-[16px]">{statusBadge.icon}</span>
              {statusBadge.text}
            </span>
          </div>
        </div>

        {/* Status Callout */}
        <div className="mt-4 rounded-lg bg-slate-50 p-3.5 border border-slate-200 text-xs text-slate-600 space-y-1">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span>
              <strong>Active Sender:</strong>{' '}
              {(formData.officialEmail || formData.username)
                ? `${formData.fromName ? `"${formData.fromName}" ` : ''}<${formData.officialEmail || formData.username}>`
                : 'Not configured'}
            </span>
            {statusInfo.lastVerifiedAt && (
              <span className="text-slate-400">
                Last Verified: {new Date(statusInfo.lastVerifiedAt).toLocaleString()}
              </span>
            )}
          </div>
          {statusInfo.lastTestError && (
            <div className="mt-2 text-red-600 font-medium">
              Error: {statusInfo.lastTestError}
            </div>
          )}
        </div>
      </Card>

      {/* SMTP Configuration Form */}
      <form onSubmit={handleSave}>
        <Card className="p-6 space-y-6">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-semibold text-slate-900">Email Server Settings</h3>
            <p className="text-xs text-slate-500">
              Enter your SMTP server credentials (e.g. Google Workspace, Office 365, AWS SES, or custom server).
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Sender Display Name */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                Sender Display Name (FROM Name)
              </label>
              <Input
                name="fromName"
                type="text"
                placeholder="e.g. Coastal Estates"
                value={formData.fromName}
                onChange={handleChange}
                disabled={!canEdit}
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Display name shown in recipient inboxes (defaults to company name).
              </span>
            </div>

            {/* Official Sender Email */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                Company Official Email (FROM Address)
              </label>
              <Input
                name="officialEmail"
                type="email"
                placeholder="e.g. notifications@yourcompany.com"
                value={formData.officialEmail}
                onChange={handleChange}
                disabled={!canEdit}
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Sender address on invitations. If omitted, SMTP username is used.
              </span>
            </div>

            {/* SMTP Host */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                SMTP Host <span className="text-red-500">*</span>
              </label>
              <Input
                name="host"
                type="text"
                placeholder="e.g. smtp.gmail.com or smtp.office365.com"
                value={formData.host}
                onChange={handleChange}
                disabled={!canEdit}
                required
              />
            </div>

            {/* SMTP Port */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                SMTP Port <span className="text-red-500">*</span>
              </label>
              <Input
                name="port"
                type="number"
                placeholder="587 or 465"
                value={formData.port}
                onChange={handleChange}
                disabled={!canEdit}
                required
              />
            </div>

            {/* Security Mode */}
            <div className="md:col-span-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="secure"
                  checked={formData.secure}
                  onChange={handleChange}
                  disabled={!canEdit}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                />
                <span className="text-sm font-medium text-slate-700">
                  Use SSL/TLS (Port 465)
                </span>
                <span className="text-xs text-slate-400 ml-1">
                  (Leave unchecked for STARTTLS on Port 587)
                </span>
              </label>
            </div>

            {/* SMTP Username */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                SMTP Username <span className="text-red-500">*</span>
              </label>
              <Input
                name="username"
                type="text"
                placeholder="e.g. user@domain.com or API Key"
                value={formData.username}
                onChange={handleChange}
                disabled={!canEdit}
                required
              />
            </div>

            {/* SMTP Password */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                SMTP Password {!statusInfo.hasPassword && <span className="text-red-500">*</span>}
              </label>
              <div className="relative">
                <Input
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder={statusInfo.hasPassword ? '•••••••••••• (Leave blank to keep existing)' : 'Enter SMTP password'}
                  value={formData.password}
                  onChange={handleChange}
                  disabled={!canEdit}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
              {statusInfo.hasPassword && (
                <span className="text-[11px] text-emerald-600 mt-1 block flex items-center gap-1">
                  <span className="material-symbols-outlined text-[13px]">lock</span>
                  Password securely encrypted with AES-256-GCM. Enter a new password only if changing it.
                </span>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {canTest && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleTestConnection}
                  disabled={testing || saving || (!statusInfo.hasPassword && !formData.password)}
                >
                  {testing ? (
                    <>
                      <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
                      Testing Handshake...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[18px]">check_circle</span>
                      Test Connection
                    </>
                  )}
                </Button>
              )}

              {canSendTest && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setTestRecipient((prev) => prev || user?.email || '')
                    setShowTestModal(true)
                  }}
                  disabled={testing || saving || !statusInfo.isConfigured}
                >
                  <span className="material-symbols-outlined text-[18px]">send</span>
                  Send Test Email
                </Button>
              )}
            </div>

            {canEdit && (
              <Button type="submit" variant="primary" size="sm" disabled={saving || testing}>
                {saving ? (
                  <>
                    <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Verifying &amp; Saving...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">verified</span>
                    Save &amp; Test SMTP
                  </>
                )}
              </Button>
            )}
          </div>
        </Card>
      </form>

      {/* Test Email Modal */}
      {showTestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md bg-white rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-600">forward_to_inbox</span>
                Send SMTP Test Email
              </h3>
              <button
                type="button"
                onClick={() => setShowTestModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleSendTestEmail} className="p-5 space-y-4">
              <p className="text-xs text-slate-500">
                Enter an email address to verify real-world message delivery from your company's SMTP server.
              </p>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                  Recipient Email <span className="text-red-500">*</span>
                </label>
                <Input
                  type="email"
                  placeholder="e.g. your-email@domain.com"
                  value={testRecipient}
                  onChange={(e) => setTestRecipient(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowTestModal(false)}
                  disabled={sendingTest}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={sendingTest || !testRecipient.trim()}
                >
                  {sendingTest ? (
                    <>
                      <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Sending...
                    </>
                  ) : (
                    'Send Test Email'
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

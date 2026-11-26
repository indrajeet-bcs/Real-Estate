import { useState, useEffect } from 'react'
import { companySmtpApi } from '../../api/resources.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import { Card, Button, Input, Loader } from '../../components/ui.jsx'

const PROVIDER_OPTIONS = [
  {
    value: 'smtp',
    label: 'Standard SMTP (Port 587 / 465)',
    shortLabel: 'SMTP',
    description: 'Connect directly to Gmail, Workspace, Office 365, or custom SMTP. Best for local or paid cloud hosts (Render Free Tier blocks SMTP TCP ports).',
  },
  {
    value: 'gmail_webhook',
    label: 'Gmail HTTPS Relay (Apps Script - Render Free Friendly)',
    shortLabel: 'Gmail HTTPS Relay',
    description: 'Sends directly from your Gmail inbox over HTTPS port 443 via Google Apps Script — works reliably on Render Free Tier with zero SMTP port blocks.',
  },
  {
    value: 'brevo_api',
    label: 'Brevo HTTPS API (Port 443)',
    shortLabel: 'Brevo API',
    description: 'Sends over HTTPS port 443 using a Brevo REST API key (300 free emails/day). Works on all cloud hosts.',
  },
  {
    value: 'resend_api',
    label: 'Resend HTTPS API (Port 443)',
    shortLabel: 'Resend API',
    description: 'Sends over HTTPS port 443 via Resend API using a verified sender domain.',
  },
]

const APPS_SCRIPT_SNIPPET = `const SECRET = ''; // Optional: set a passphrase and enter the same value in CRM

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents || '{}');
    if (SECRET && data.secret !== SECRET) {
      return jsonOut({ success: false, error: 'Unauthorized webhook secret' });
    }
    if (data.action === 'ping') {
      return jsonOut({ success: true, message: 'Gmail relay active' });
    }
    if (!data.to || !data.subject) {
      return jsonOut({ success: false, error: 'Missing recipient or subject' });
    }
    GmailApp.sendEmail(data.to, data.subject, data.text || '', {
      htmlBody: data.html || undefined,
      name: data.fromName || undefined,
    });
    return jsonOut({ success: true, messageId: 'gmail-' + Date.now() });
  } catch (err) {
    return jsonOut({ success: false, error: err && err.message ? err.message : String(err) });
  }
}

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}`

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
  const [showRelayGuide, setShowRelayGuide] = useState(false)
  const [showTestModal, setShowTestModal] = useState(false)
  const [testRecipient, setTestRecipient] = useState('')

  const [formData, setFormData] = useState({
    provider: 'smtp',
    fromName: '',
    officialEmail: '',
    host: '',
    port: 587,
    secure: false,
    username: '',
    webhookUrl: '',
    password: '',
  })

  const [statusInfo, setStatusInfo] = useState({
    savedProvider: 'smtp',
    isConfigured: false,
    isVerified: false,
    lastVerifiedAt: null,
    hasPassword: false,
    lastError: '',
    lastErrorAt: null,
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
      const provider = smtp.provider || 'smtp'
      setFormData({
        provider,
        fromName: smtp.fromName || data.firmName || '',
        officialEmail: data.officialEmail || data.contactEmail || '',
        host: smtp.host || '',
        port: smtp.port || 587,
        secure: Boolean(smtp.secure),
        username: smtp.username || '',
        webhookUrl: smtp.webhookUrl || '',
        password: '', // Never populate stored secret/password
      })
      setStatusInfo({
        savedProvider: provider,
        isConfigured: Boolean(smtp.isConfigured),
        isVerified: Boolean(smtp.isVerified),
        lastVerifiedAt: smtp.lastVerifiedAt || null,
        hasPassword: Boolean(smtp.hasPassword),
        lastError: smtp.lastError || '',
        lastErrorAt: smtp.lastErrorAt || null,
        lastTestError: null,
      })
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to load email delivery configuration', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchConfig()
  }, [])

  const hasSavedSecretForProvider = statusInfo.hasPassword && formData.provider === statusInfo.savedProvider
  const currentProviderMeta = PROVIDER_OPTIONS.find((opt) => opt.value === formData.provider) || PROVIDER_OPTIONS[0]

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

  const handleProviderChange = (nextProvider) => {
    setFormData((prev) => ({
      ...prev,
      provider: nextProvider,
      password: '',
    }))
    setStatusInfo((prev) => ({ ...prev, lastTestError: null }))
    setShowRelayGuide(nextProvider === 'gmail_webhook')
  }

  const handleCopyScript = async () => {
    try {
      await navigator.clipboard.writeText(APPS_SCRIPT_SNIPPET)
      showToast('Google Apps Script code copied to clipboard', 'success')
    } catch {
      showToast('Could not copy automatically — please select and copy the script manually', 'warning')
    }
  }

  const handleSave = async (e) => {
    e?.preventDefault()
    if (!canEdit) return

    const provider = formData.provider || 'smtp'
    const officialEmail = formData.officialEmail?.trim() || ''

    if (provider === 'smtp') {
      if (!formData.host?.trim() || !formData.port || !formData.username?.trim()) {
        showToast('Please fill in SMTP Host, Port, and Username', 'error')
        return
      }
      if (!hasSavedSecretForProvider && !formData.password?.trim()) {
        showToast('Please provide an SMTP password', 'error')
        return
      }
    } else if (provider === 'brevo_api' || provider === 'resend_api') {
      if (!officialEmail) {
        showToast('Company Official Email is required for API delivery', 'error')
        return
      }
      if (!hasSavedSecretForProvider && !formData.password?.trim()) {
        showToast(`Please enter your ${provider === 'brevo_api' ? 'Brevo' : 'Resend'} API key`, 'error')
        return
      }
    } else if (provider === 'gmail_webhook') {
      if (!officialEmail) {
        showToast('Company Official Gmail address is required', 'error')
        return
      }
      if (!formData.webhookUrl?.trim().startsWith('https://')) {
        showToast('Please enter a valid HTTPS Google Apps Script Web App URL', 'error')
        return
      }
    }

    try {
      setSaving(true)
      setStatusInfo((prev) => ({ ...prev, lastTestError: null }))
      const payload = {
        provider,
        fromName: formData.fromName?.trim() || '',
        officialEmail: officialEmail || undefined,
      }

      if (provider === 'smtp') {
        payload.host = formData.host.trim()
        payload.port = Number(formData.port)
        payload.secure = Boolean(formData.secure)
        payload.username = formData.username.trim()
      } else if (provider === 'gmail_webhook') {
        payload.webhookUrl = formData.webhookUrl.trim()
      }

      if (formData.password?.trim()) {
        payload.password = formData.password.trim()
      }

      const res = await companySmtpApi.update(payload)
      showToast(res.data?.message || 'Email connection verified and settings saved', 'success')

      // Refresh config to reflect updated verified state
      await fetchConfig()
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to verify and save email configuration'
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

      const provider = formData.provider || 'smtp'
      const usingSavedConfig = provider === statusInfo.savedProvider && !formData.password?.trim() && (
        provider === 'smtp' ? Boolean(hasSavedSecretForProvider) :
        provider === 'gmail_webhook' ? false :
        Boolean(hasSavedSecretForProvider)
      )

      const testPayload = { provider }
      if (provider === 'smtp') {
        if (formData.host?.trim()) testPayload.host = formData.host.trim()
        if (formData.port) testPayload.port = Number(formData.port)
        testPayload.secure = Boolean(formData.secure)
        if (formData.username?.trim()) testPayload.username = formData.username.trim()
      } else if (provider === 'gmail_webhook' && formData.webhookUrl?.trim()) {
        testPayload.webhookUrl = formData.webhookUrl.trim()
      }

      if (formData.password?.trim()) {
        testPayload.password = formData.password.trim()
      }

      const res = await companySmtpApi.testConnection(
        usingSavedConfig && provider === 'smtp' ? {} : testPayload
      )

      showToast(res.data?.message || 'Email Connection Verified Successfully!', 'success')
      await fetchConfig()
    } catch (err) {
      const msg = err.response?.data?.message || 'Connection test failed'
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

  const displayedError = statusInfo.lastTestError || statusInfo.lastError
  const savedProviderMeta = PROVIDER_OPTIONS.find((opt) => opt.value === statusInfo.savedProvider) || PROVIDER_OPTIONS[0]

  // Derive status badge details
  let statusBadge = {
    color: 'bg-slate-100 text-slate-700 border-slate-200',
    icon: 'info',
    text: 'Not Configured',
  }

  if (statusInfo.isConfigured) {
    if (statusInfo.isVerified && !displayedError) {
      statusBadge = {
        color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        icon: 'check_circle',
        text: 'Verified & Active',
      }
    } else if (displayedError) {
      statusBadge = {
        color: 'bg-red-50 text-red-700 border-red-200',
        icon: 'error',
        text: 'Delivery Issue',
      }
    } else {
      statusBadge = {
        color: 'bg-amber-50 text-amber-700 border-amber-200',
        icon: 'hourglass_top',
        text: 'Verification Pending',
      }
    }
  }

  const canRunTest =
    formData.provider === 'gmail_webhook'
      ? Boolean(formData.webhookUrl?.trim().startsWith('https://'))
      : formData.provider === 'brevo_api' || formData.provider === 'resend_api'
      ? Boolean(hasSavedSecretForProvider || formData.password?.trim())
      : Boolean(formData.host?.trim() && formData.username?.trim() && (hasSavedSecretForProvider || formData.password?.trim()))

  return (
    <div className="space-y-6">
      {/* Overview Card */}
      <Card className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <span className="material-symbols-outlined text-blue-600">mail</span>
              Company Outgoing Email &amp; Delivery Provider
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Configure how your company sends employee invitations, onboarding links, and password resets.
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
        <div className="mt-4 rounded-lg bg-slate-50 p-3.5 border border-slate-200 text-xs text-slate-600 space-y-1.5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span>
              <strong>Active Method:</strong> {savedProviderMeta.shortLabel} &nbsp;|&nbsp;{' '}
              <strong>Sender:</strong>{' '}
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
          {displayedError && (
            <div className="mt-2 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-red-700 font-medium flex flex-col gap-0.5">
              <span>Last Delivery / Connection Error: {displayedError}</span>
              {!statusInfo.lastTestError && statusInfo.lastErrorAt && (
                <span className="text-[11px] font-normal text-red-500">
                  Recorded at {new Date(statusInfo.lastErrorAt).toLocaleString()}
                </span>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* Configuration Form */}
      <form onSubmit={handleSave}>
        <Card className="p-6 space-y-6">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-semibold text-slate-900">Delivery Method &amp; Credentials</h3>
            <p className="text-xs text-slate-500">
              Choose Standard SMTP for local/VPS hosting, or an HTTPS Relay / API for Render Free Tier and cloud hosting.
            </p>
          </div>

          {/* Delivery Method Selector */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Delivery Method <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {PROVIDER_OPTIONS.map((opt) => {
                const selected = formData.provider === opt.value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={!canEdit}
                    onClick={() => handleProviderChange(opt.value)}
                    className={`text-left rounded-lg border p-3 transition-all ${
                      selected
                        ? 'border-blue-600 bg-blue-50/70 ring-1 ring-blue-600'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    } ${!canEdit ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <div className="text-xs font-semibold text-slate-900 flex items-center justify-between gap-1">
                      <span>{opt.shortLabel}</span>
                      {opt.value === 'gmail_webhook' && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-medium">
                          Cloud Ready
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500 leading-snug line-clamp-2">
                      {opt.label}
                    </p>
                  </button>
                )
              })}
            </div>
            <p className="text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded-md px-3 py-2">
              {currentProviderMeta.description}
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
                {formData.provider !== 'smtp' && <span className="text-red-500"> *</span>}
              </label>
              <Input
                name="officialEmail"
                type="email"
                placeholder={
                  formData.provider === 'gmail_webhook'
                    ? 'e.g. yourcompany@gmail.com'
                    : 'e.g. notifications@yourcompany.com'
                }
                value={formData.officialEmail}
                onChange={handleChange}
                disabled={!canEdit}
                required={formData.provider !== 'smtp'}
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                {formData.provider === 'smtp'
                  ? 'Sender address on invitations. If omitted, SMTP username is used.'
                  : 'Required real email address shown as sender / reply-to on outgoing mail.'}
              </span>
            </div>

            {formData.provider === 'smtp' && (
              <>
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
                      (Leave unchecked for STARTTLS on Port 587; server auto-retries Port 465 on timeout)
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
                    placeholder="e.g. user@domain.com"
                    value={formData.username}
                    onChange={handleChange}
                    disabled={!canEdit}
                    required
                  />
                </div>

                {/* SMTP Password */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                    SMTP Password / App Password {!hasSavedSecretForProvider && <span className="text-red-500">*</span>}
                  </label>
                  <div className="relative">
                    <Input
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder={hasSavedSecretForProvider ? '•••••••••••• (Leave blank to keep existing)' : 'Enter SMTP password'}
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
                  {hasSavedSecretForProvider && (
                    <span className="text-[11px] text-emerald-600 mt-1 block flex items-center gap-1">
                      <span className="material-symbols-outlined text-[13px]">lock</span>
                      Password securely encrypted with AES-256-GCM. Enter a new password only if changing it.
                    </span>
                  )}
                </div>
              </>
            )}

            {(formData.provider === 'brevo_api' || formData.provider === 'resend_api') && (
              <div className="md:col-span-2 space-y-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                    {formData.provider === 'brevo_api' ? 'Brevo API Key (xkeysib-...)' : 'Resend API Key (re_...)'}{' '}
                    {!hasSavedSecretForProvider && <span className="text-red-500">*</span>}
                  </label>
                  <div className="relative">
                    <Input
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder={
                        hasSavedSecretForProvider
                          ? '•••••••••••• (Leave blank to keep existing API key)'
                          : formData.provider === 'brevo_api'
                          ? 'xkeysib-...'
                          : 're_...'
                      }
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
                  {hasSavedSecretForProvider && (
                    <span className="text-[11px] text-emerald-600 mt-1 block flex items-center gap-1">
                      <span className="material-symbols-outlined text-[13px]">lock</span>
                      API key encrypted with AES-256-GCM. Leave blank to keep existing key.
                    </span>
                  )}
                </div>
                <div className="rounded-lg bg-blue-50/70 border border-blue-200 p-3 text-xs text-blue-900">
                  {formData.provider === 'brevo_api'
                    ? 'Tip: In Brevo, create an API Key under SMTP & API → API Keys and verify your sender email address under Senders, Domains & Dedicated IPs.'
                    : 'Tip: In Resend, verify your sending domain under Domains and generate a Sending-access API key.'}
                </div>
              </div>
            )}

            {formData.provider === 'gmail_webhook' && (
              <>
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                    Google Apps Script Web App URL <span className="text-red-500">*</span>
                  </label>
                  <Input
                    name="webhookUrl"
                    type="url"
                    placeholder="https://script.google.com/macros/s/.../exec"
                    value={formData.webhookUrl}
                    onChange={handleChange}
                    disabled={!canEdit}
                    required
                  />
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    Paste your deployed Apps Script HTTPS Web App URL ending with /exec.
                  </span>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                    Optional Webhook Secret Key
                  </label>
                  <div className="relative">
                    <Input
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder={
                        hasSavedSecretForProvider
                          ? '•••••••••••• (Leave blank to keep saved secret)'
                          : 'Optional: leave blank unless SECRET is set in your Apps Script'
                      }
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
                </div>

                <div className="md:col-span-2 rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-700 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-900">
                      3-Step Gmail HTTPS Relay Setup (Free, Works on Render Free Tier)
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowRelayGuide((prev) => !prev)}
                      className="text-blue-600 hover:text-blue-700 font-medium"
                    >
                      {showRelayGuide ? 'Hide Script' : 'Show Script'}
                    </button>
                  </div>
                  <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-600">
                    <li>Open <strong>script.google.com</strong> logged in with your company Gmail, click <strong>New project</strong>, and paste the script below.</li>
                    <li>Click <strong>Deploy → New deployment → Web app</strong>, set <strong>Execute as: Me</strong> and <strong>Who has access: Anyone</strong>, then authorize Gmail permission.</li>
                    <li>Copy the generated <code>https://script.google.com/macros/s/.../exec</code> URL, paste it above, and click <strong>Save &amp; Test Connection</strong>.</li>
                  </ol>
                  {showRelayGuide && (
                    <div className="space-y-1.5">
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={handleCopyScript}
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:text-blue-800"
                        >
                          <span className="material-symbols-outlined text-[14px]">content_copy</span>
                          Copy Apps Script Code
                        </button>
                      </div>
                      <pre className="rounded-md bg-slate-900 text-slate-100 p-3 text-[11px] overflow-x-auto leading-relaxed">
                        {APPS_SCRIPT_SNIPPET}
                      </pre>
                    </div>
                  )}
                </div>
              </>
            )}
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
                  disabled={testing || saving || !canRunTest}
                >
                  {testing ? (
                    <>
                      <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
                      Testing Connection...
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
                    Save &amp; Test Connection
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

import { useState, useEffect, useCallback } from 'react'
import { Card, PageHeader, Button, Input, Select } from '../../../components/ui.jsx'
import { useToast } from '../../../context/ToastContext.jsx'
import { billingApi } from '../../../api/resources.js'
import { useFetch } from '../../../hooks/useFetch.js'

// ─── Toggle Component ─────────────────────────────────────────────────────────

function Toggle({ label, description, checked, onChange }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-slate-100 last:border-0">
      <div>
        <div className="text-sm font-medium text-slate-800">{label}</div>
        {description && <div className="text-xs text-slate-500 mt-0.5">{description}</div>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`shrink-0 relative inline-flex h-5 w-9 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none mt-0.5 ${checked ? 'bg-blue-600' : 'bg-slate-200'}`}
      >
        <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${checked ? 'translate-x-4' : 'translate-x-0'}`} />
      </button>
    </div>
  )
}

// ─── Settings Section Card ────────────────────────────────────────────────────

function SectionCard({ title, subtitle, children }) {
  return (
    <Card className="p-6">
      <div className="mb-5">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
      </div>
      {children}
    </Card>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function BillingSettingsPage() {
  const toast = useToast()
  const [busy, setBusy] = useState(false)

  const [platform, setPlatform] = useState({
    currency: 'INR',
    gstPercent: 18,
    invoicePrefix: 'INV',
    invoiceFormat: 'INV-YYYY-NNNN',
    trialDuration: 14,
    gracePeriod: 3,
    autoRenewal: true,
    enableGst: true,
    enableEmailInvoice: true,
    enablePaymentReminder: true,
    paymentReminderDays: 7,
  })

  const [gateways, setGateways] = useState({
    razorpay: { enabled: true,  key: 'rzp_live_xxxxxxxxxxxx', secret: '••••••••••••••••' },
    stripe:   { enabled: false, key: 'sk_live_xxxxxxxxxxxx',  secret: '••••••••••••••••' },
    payu:     { enabled: false, key: 'sxBCKE',                 secret: '••••••••••••••••' },
    cashfree: { enabled: false, key: 'cf_live_xxxxxxxxxxxx',   secret: '••••••••••••••••' },
  })

  const setP = k => v => setPlatform(prev => ({ ...prev, [k]: v }))

  // Load persisted settings.
  const { data: settings } = useFetch(useCallback(() => billingApi.settings(), []))
  useEffect(() => {
    if (!settings) return
    setPlatform(prev => ({
      ...prev,
      currency: settings.currency ?? prev.currency,
      gstPercent: settings.gstPercent ?? prev.gstPercent,
      invoicePrefix: settings.invoicePrefix ?? prev.invoicePrefix,
      autoRenewal: settings.autoCharge ?? prev.autoRenewal,
      enablePaymentReminder: settings.sendReminders ?? prev.enablePaymentReminder,
      paymentReminderDays: settings.reminderDaysBefore ?? prev.paymentReminderDays,
    }))
    if (settings.gateways) {
      setGateways(prev => Object.fromEntries(Object.entries(prev).map(([k, cfg]) => [k, { ...cfg, enabled: settings.gateways[k] ?? cfg.enabled }])))
    }
  }, [settings])

  async function saveSettings() {
    setBusy(true)
    try {
      await billingApi.updateSettings({
        currency: platform.currency, gstPercent: Number(platform.gstPercent), invoicePrefix: platform.invoicePrefix,
        autoCharge: platform.autoRenewal, sendReminders: platform.enablePaymentReminder, reminderDaysBefore: Number(platform.paymentReminderDays),
        gateways: Object.fromEntries(Object.entries(gateways).map(([k, cfg]) => [k, cfg.enabled])),
      })
      toast.success('Billing settings saved successfully')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save settings')
    } finally { setBusy(false) }
  }

  const gatewayLabels = {
    razorpay: 'Razorpay',
    stripe:   'Stripe',
    payu:     'PayU',
    cashfree: 'Cashfree',
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Billing Settings"
        subtitle="Configure platform-wide billing, tax, and payment gateway settings"
        actions={
          <Button onClick={saveSettings} disabled={busy}>
            {busy ? 'Saving…' : 'Save Settings'}
          </Button>
        }
      />

      {/* Platform Settings */}
      <SectionCard title="Platform Settings" subtitle="Global billing configuration for all tenants">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Select label="Currency" value={platform.currency} onChange={e => setP('currency')(e.target.value)}>
            <option value="INR">INR — Indian Rupee (₹)</option>
            <option value="USD">USD — US Dollar ($)</option>
            <option value="EUR">EUR — Euro (€)</option>
          </Select>
          <Input label="GST Percentage (%)" type="number" value={platform.gstPercent}
            onChange={e => setP('gstPercent')(Number(e.target.value))} />
          <Input label="Invoice Prefix" value={platform.invoicePrefix}
            onChange={e => setP('invoicePrefix')(e.target.value)} placeholder="INV" />
          <Input label="Invoice Number Format" value={platform.invoiceFormat}
            onChange={e => setP('invoiceFormat')(e.target.value)} placeholder="INV-YYYY-NNNN" />
          <Input label="Default Trial Duration (days)" type="number" value={platform.trialDuration}
            onChange={e => setP('trialDuration')(Number(e.target.value))} />
          <Input label="Grace Period After Expiry (days)" type="number" value={platform.gracePeriod}
            onChange={e => setP('gracePeriod')(Number(e.target.value))} />
        </div>

        <div className="mt-6 border-t border-slate-100 pt-4 space-y-0">
          <Toggle label="Auto Renewal" description="Automatically renew subscriptions before expiry"
            checked={platform.autoRenewal} onChange={setP('autoRenewal')} />
          <Toggle label="Enable GST" description="Apply GST to all invoices"
            checked={platform.enableGst} onChange={setP('enableGst')} />
          <Toggle label="Email Invoice on Payment" description="Automatically email invoice PDF after successful payment"
            checked={platform.enableEmailInvoice} onChange={setP('enableEmailInvoice')} />
          <Toggle label="Payment Reminder Emails" description="Send reminder emails before subscription expiry"
            checked={platform.enablePaymentReminder} onChange={setP('enablePaymentReminder')} />
        </div>

        {platform.enablePaymentReminder && (
          <div className="mt-4 w-48">
            <Input label="Reminder Days Before Expiry" type="number" value={platform.paymentReminderDays}
              onChange={e => setP('paymentReminderDays')(Number(e.target.value))} />
          </div>
        )}
      </SectionCard>

      {/* Payment Gateway Configuration */}
      <SectionCard title="Payment Gateway Configuration" subtitle="Enable and configure payment gateways for tenant billing">
        <div className="space-y-5">
          {Object.entries(gateways).map(([key, cfg]) => (
            <div key={key} className="rounded-xl border border-slate-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-xs text-white ${
                    key === 'razorpay' ? 'bg-blue-600' :
                    key === 'stripe'   ? 'bg-violet-600' :
                    key === 'payu'     ? 'bg-amber-500' : 'bg-emerald-600'
                  }`}>{gatewayLabels[key][0]}</div>
                  <div>
                    <div className="font-semibold text-slate-900">{gatewayLabels[key]}</div>
                    <div className="text-xs text-slate-500">{cfg.enabled ? 'Active gateway' : 'Inactive'}</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setGateways(prev => ({
                    ...prev, [key]: { ...prev[key], enabled: !prev[key].enabled }
                  }))}
                  className={`relative inline-flex h-5 w-9 rounded-full border-2 border-transparent transition-colors ${cfg.enabled ? 'bg-blue-600' : 'bg-slate-200'}`}
                >
                  <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${cfg.enabled ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
              </div>
              {cfg.enabled && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Input label="API Key / Client ID" type="text" value={cfg.key}
                    onChange={e => setGateways(prev => ({ ...prev, [key]: { ...prev[key], key: e.target.value } }))} />
                  <Input label="Secret Key" type="password" value={cfg.secret}
                    onChange={e => setGateways(prev => ({ ...prev, [key]: { ...prev[key], secret: e.target.value } }))} />
                </div>
              )}
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Invoice Preview */}
      <SectionCard title="Invoice Number Preview" subtitle="Preview how invoice numbers will be generated">
        <div className="flex items-center gap-4 rounded-xl bg-slate-50 p-4">
          <div className="text-slate-500 text-sm">Sample invoice number:</div>
          <div className="font-mono text-lg font-bold text-blue-700">
            {platform.invoicePrefix}-{new Date().getFullYear()}-0001
          </div>
        </div>
      </SectionCard>

      {/* Save Button (bottom) */}
      <div className="flex justify-end">
        <Button onClick={saveSettings} disabled={busy}>
          {busy ? 'Saving…' : 'Save All Settings'}
        </Button>
      </div>
    </div>
  )
}

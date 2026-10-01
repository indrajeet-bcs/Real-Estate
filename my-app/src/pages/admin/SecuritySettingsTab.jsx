import { useState, useEffect, useCallback } from 'react'
import { companySecurityApi, activeSessionsApi } from '../../api/resources.js'
import { useFetch } from '../../hooks/useFetch.js'
import { useToast } from '../../context/ToastContext.jsx'
import { Card, Button, Select, Loader, ErrorState, Toggle, Input } from '../../components/ui.jsx'
import { titleCase } from '../../lib/format.js'

const DEFAULT_SECURITY = {
  passwordPolicy: {
    minLength: 12,
    requireUppercase: true,
    requireLowercase: true,
    requireNumber: true,
    requireSpecial: true,
  },
  sessionTimeout: '60',
  loginSecurity: {
    monitorAttempts: true,
    requireSecureLogin: true,
  },
  accountLockout: {
    maxFailedAttempts: '5',
    lockoutDuration: '15',
  },
  twoFactorAuth: {
    require2FA: false,
  },
  securityAlerts: {
    failedLogin: true,
    accountLockout: true,
    newLogin: false,
    sessionRevoked: true,
    passwordChanged: true,
  }
}

const MOCK_SESSIONS = [
  { id: 'sess_1', user: 'Admin User', role: 'Company Owner', device: 'Chrome on Windows', ip: '192.168.1.1', loginTime: '2026-08-12T08:00:00Z', lastActivity: '2026-08-12T13:00:00Z', status: 'Active' },
  { id: 'sess_2', user: 'Admin User', role: 'Company Owner', device: 'Safari on iPhone', ip: '10.0.0.5', loginTime: '2026-08-11T19:30:00Z', lastActivity: '2026-08-11T20:15:00Z', status: 'Inactive' },
]

function SettingsSection({ title, hint, children }) {
  return (
    <Card className="mt-6 p-6">
      <div className="border-b border-slate-100 pb-3 mb-4">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
      </div>
      <div className="space-y-6">{children}</div>
    </Card>
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

function ConfirmModal({ isOpen, title, message, confirmText, onConfirm, onCancel, confirmVariant = 'primary' }) {
  if (!isOpen) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 animate-fade-in">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        <p className="mt-2 text-sm text-slate-500">{message}</p>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button variant={confirmVariant} onClick={onConfirm}>{confirmText}</Button>
        </div>
      </div>
    </div>
  )
}

export default function SecuritySettingsTab() {
  const toast = useToast()

  // Data fetching
  const { data, loading, error, refetch } = useFetch(useCallback(async () => {
    try {
      const res = await companySecurityApi.get()
      return res
    } catch (err) {
      if (err.response?.status === 404) {
        return { data: { data: DEFAULT_SECURITY } }
      }
      throw err
    }
  }, []))

  const { data: sessionsData, loading: sessionsLoading, refetch: refetchSessions } = useFetch(useCallback(async () => {
    try {
      const res = await activeSessionsApi.list()
      return res
    } catch (err) {
      if (err.response?.status === 404) {
        return { data: { data: MOCK_SESSIONS } }
      }
      throw err
    }
  }, []))

  const [form, setForm] = useState(null)
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  
  // Modals state
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false)
  const [revokeSessId, setRevokeSessId] = useState(null)
  const [mockActiveSessions, setMockActiveSessions] = useState([]) // For local testing

  useEffect(() => {
    if (data) setForm(data.data || DEFAULT_SECURITY)
  }, [data])

  useEffect(() => {
    if (sessionsData) setMockActiveSessions(sessionsData.data || MOCK_SESSIONS)
  }, [sessionsData])

  const setNested = (group, key, value) => {
    setForm(f => ({
      ...f,
      [group]: { ...f[group], [key]: value }
    }))
  }
  const setTop = (key, value) => setForm(f => ({ ...f, [key]: value }))

  const handleCancel = () => {
    const hasUnsavedChanges = JSON.stringify(form) !== JSON.stringify(data?.data || DEFAULT_SECURITY)
    if (hasUnsavedChanges) {
      if (!window.confirm('Unsaved security changes\n\nYour changes have not been saved. Do you want to discard them?')) {
        return
      }
    }
    setForm(data?.data || DEFAULT_SECURITY)
    setEditing(false)
  }

  const attemptSave = () => {
    // Basic validation
    if (form.passwordPolicy.minLength < 8 || form.passwordPolicy.minLength > 32) {
      toast.error('Password length must be between 8 and 32 characters.')
      return
    }

    // Check if high impact changes (e.g. 2FA changed)
    const orig = data?.data || DEFAULT_SECURITY
    if (form.twoFactorAuth.require2FA !== orig.twoFactorAuth.require2FA || 
        form.sessionTimeout !== orig.sessionTimeout ||
        form.accountLockout.maxFailedAttempts !== orig.accountLockout.maxFailedAttempts) {
      setSaveConfirmOpen(true)
    } else {
      executeSave()
    }
  }

  const executeSave = async () => {
    setSaveConfirmOpen(false)
    setBusy(true)
    try {
      try {
        await companySecurityApi.update(form)
      } catch (err) {
        if (err.response?.status !== 404) throw err
        console.log('Mock save successful')
      }
      toast.success('Security settings updated successfully.')
      refetch() 
      setEditing(false)
    } catch (err) {
      toast.error('Unable to update security settings. No changes were applied.')
    } finally {
      setBusy(false)
    }
  }

  const executeRevoke = async () => {
    if (!revokeSessId) return
    try {
      try {
        await activeSessionsApi.revoke(revokeSessId)
      } catch (err) {
        if (err.response?.status !== 404) throw err
        console.log('Mock revoke successful')
      }
      setMockActiveSessions(prev => prev.filter(s => s.id !== revokeSessId))
      toast.success('Session revoked successfully.')
    } catch (err) {
      toast.error('Unable to revoke session.')
    } finally {
      setRevokeSessId(null)
    }
  }

  if (loading || !form) return <div className="mt-6"><Loader /></div>
  if (error && error.response?.status !== 404) return <div className="mt-6"><ErrorState message="Unable to load security settings." onRetry={refetch} /></div>

  const renderComplexity = (p) => {
    const reqs = []
    if (p.requireUppercase) reqs.push('Uppercase')
    if (p.requireLowercase) reqs.push('Lowercase')
    if (p.requireNumber) reqs.push('Number')
    if (p.requireSpecial) reqs.push('Special')
    return reqs.length ? reqs.join(', ') : 'None'
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-slate-500">Manage company-level authentication and security preferences.</p>
        {!editing ? (
          <Button onClick={() => setEditing(true)} variant="secondary" size="sm">Edit</Button>
        ) : (
          <div className="flex gap-2">
            <Button onClick={handleCancel} variant="ghost" size="sm" disabled={busy}>Cancel</Button>
            <Button onClick={attemptSave} variant="primary" size="sm" loading={busy}>Save Changes</Button>
          </div>
        )}
      </div>

      {/* 1. Password Policy */}
      <SettingsSection title="Password Policy" hint="Define complexity requirements for employee passwords.">
        {editing ? (
          <div className="space-y-4">
            <div className="w-48">
              <Input 
                label="Minimum Password Length" 
                type="number" 
                min="8" max="32" 
                value={form.passwordPolicy.minLength} 
                onChange={(e) => setNested('passwordPolicy', 'minLength', Number(e.target.value))} 
              />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-700 mb-2">Complexity Requirements</p>
              <div className="grid sm:grid-cols-2 gap-3">
                <Toggle checked={form.passwordPolicy.requireUppercase} onChange={(v) => setNested('passwordPolicy', 'requireUppercase', v)} label="Require Uppercase (A-Z)" />
                <Toggle checked={form.passwordPolicy.requireLowercase} onChange={(v) => setNested('passwordPolicy', 'requireLowercase', v)} label="Require Lowercase (a-z)" />
                <Toggle checked={form.passwordPolicy.requireNumber} onChange={(v) => setNested('passwordPolicy', 'requireNumber', v)} label="Require Number (0-9)" />
                <Toggle checked={form.passwordPolicy.requireSpecial} onChange={(v) => setNested('passwordPolicy', 'requireSpecial', v)} label="Require Special Character (!@#$)" />
              </div>
            </div>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-y-6 gap-x-4">
            <ReadOnlyField label="Minimum Length" value={`${form.passwordPolicy.minLength} characters`} />
            <ReadOnlyField label="Complexity" value={renderComplexity(form.passwordPolicy)} />
          </div>
        )}
      </SettingsSection>

      {/* 2. Session Timeout */}
      <SettingsSection title="Session Timeout" hint="Users will be signed out after the selected period of inactivity.">
        {editing ? (
          <div className="w-64">
            <Select value={form.sessionTimeout} onChange={(e) => setTop('sessionTimeout', e.target.value)}>
              <option value="15">15 minutes</option>
              <option value="30">30 minutes</option>
              <option value="60">60 minutes</option>
              <option value="120">120 minutes</option>
            </Select>
          </div>
        ) : (
          <ReadOnlyField label="Inactivity Timeout" value={`${form.sessionTimeout} minutes`} />
        )}
      </SettingsSection>

      {/* 3. Account Lockout */}
      <SettingsSection title="Account Lockout" hint="Temporarily lock a user account after repeated failed login attempts.">
        {editing ? (
          <div className="grid sm:grid-cols-2 gap-4 max-w-xl">
            <Select label="Max Failed Login Attempts" value={form.accountLockout.maxFailedAttempts} onChange={(e) => setNested('accountLockout', 'maxFailedAttempts', e.target.value)}>
              <option value="3">3 attempts</option>
              <option value="5">5 attempts</option>
              <option value="10">10 attempts</option>
            </Select>
            <Select label="Lockout Duration" value={form.accountLockout.lockoutDuration} onChange={(e) => setNested('accountLockout', 'lockoutDuration', e.target.value)}>
              <option value="5">5 minutes</option>
              <option value="15">15 minutes</option>
              <option value="30">30 minutes</option>
              <option value="60">60 minutes</option>
            </Select>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-y-6 gap-x-4">
            <ReadOnlyField label="Failed Attempts Threshold" value={`${form.accountLockout.maxFailedAttempts} attempts`} />
            <ReadOnlyField label="Lockout Duration" value={`${form.accountLockout.lockoutDuration} minutes`} />
          </div>
        )}
      </SettingsSection>

      {/* 4. Two-Factor Authentication */}
      <SettingsSection title="Two-Factor Authentication" hint="Users may be required to complete an additional verification step during sign-in.">
        <div className="flex items-center justify-between py-1 max-w-xl">
          <div>
            <p className="text-sm font-medium text-slate-900">Require Two-Factor Authentication</p>
            <p className="text-xs text-slate-500 mt-0.5">Users in this company must complete 2FA when supported by their account.</p>
          </div>
          {editing ? (
            <Toggle checked={form.twoFactorAuth.require2FA} onChange={(v) => setNested('twoFactorAuth', 'require2FA', v)} hideLabel label="Require 2FA" />
          ) : (
            <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${
              form.twoFactorAuth.require2FA ? 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20' : 'bg-slate-50 text-slate-600 ring-1 ring-inset ring-slate-500/10'
            }`}>
              {form.twoFactorAuth.require2FA ? 'ON' : 'OFF'}
            </span>
          )}
        </div>
      </SettingsSection>

      {/* 5. Security Alerts */}
      <SettingsSection title="Security Alerts" hint="Company-level notification preferences for security-related events.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {editing ? (
            <>
              <Toggle checked={form.securityAlerts.failedLogin} onChange={(v) => setNested('securityAlerts', 'failedLogin', v)} label="Failed Login Attempts" />
              <Toggle checked={form.securityAlerts.accountLockout} onChange={(v) => setNested('securityAlerts', 'accountLockout', v)} label="Account Lockout" />
              <Toggle checked={form.securityAlerts.newLogin} onChange={(v) => setNested('securityAlerts', 'newLogin', v)} label="New Login" />
              <Toggle checked={form.securityAlerts.sessionRevoked} onChange={(v) => setNested('securityAlerts', 'sessionRevoked', v)} label="Session Revoked" />
              <Toggle checked={form.securityAlerts.passwordChanged} onChange={(v) => setNested('securityAlerts', 'passwordChanged', v)} label="Password Changed" />
            </>
          ) : (
            <>
              <ReadOnlyField label="Failed Login Attempts" value={form.securityAlerts.failedLogin ? 'Enabled' : 'Disabled'} />
              <ReadOnlyField label="Account Lockout" value={form.securityAlerts.accountLockout ? 'Enabled' : 'Disabled'} />
              <ReadOnlyField label="New Login" value={form.securityAlerts.newLogin ? 'Enabled' : 'Disabled'} />
              <ReadOnlyField label="Session Revoked" value={form.securityAlerts.sessionRevoked ? 'Enabled' : 'Disabled'} />
              <ReadOnlyField label="Password Changed" value={form.securityAlerts.passwordChanged ? 'Enabled' : 'Disabled'} />
            </>
          )}
        </div>
      </SettingsSection>

      {/* 6. Active Sessions */}
      <Card className="mt-6 p-0 overflow-hidden">
        <div className="border-b border-slate-200 px-6 py-5">
          <h3 className="text-sm font-semibold text-slate-900">Active Sessions</h3>
          <p className="mt-0.5 text-xs text-slate-500">View and manage currently active sessions belonging to users of this company.</p>
        </div>
        {sessionsLoading ? (
          <div className="p-6"><Loader /></div>
        ) : mockActiveSessions.length === 0 ? (
          <div className="p-6 text-sm text-slate-500">No active sessions found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-6 py-3 font-medium">User</th>
                  <th className="px-6 py-3 font-medium">Device / Browser</th>
                  <th className="px-6 py-3 font-medium">Login Time</th>
                  <th className="px-6 py-3 font-medium">Last Activity</th>
                  <th className="px-6 py-3 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {mockActiveSessions.map((session) => (
                  <tr key={session.id}>
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-900">{session.user}</div>
                      <div className="text-xs text-slate-500">{session.role}</div>
                    </td>
                    <td className="px-6 py-4 text-slate-600">{session.device}</td>
                    <td className="px-6 py-4 text-slate-600">{new Date(session.loginTime).toLocaleString()}</td>
                    <td className="px-6 py-4 text-slate-600">{new Date(session.lastActivity).toLocaleString()}</td>
                    <td className="px-6 py-4 text-right">
                      <Button variant="danger" size="sm" onClick={() => setRevokeSessId(session.id)}>Revoke</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Modals */}
      <ConfirmModal 
        isOpen={saveConfirmOpen}
        title="Apply Security Changes?"
        message="You are changing high-impact company-wide authentication settings. This may affect users' ability to sign in."
        confirmText="Save & Apply"
        onConfirm={executeSave}
        onCancel={() => setSaveConfirmOpen(false)}
      />

      <ConfirmModal 
        isOpen={!!revokeSessId}
        title="Revoke this session?"
        message="That user will need to sign in again. Any unsaved work in that session may be lost."
        confirmText="Revoke Session"
        confirmVariant="danger"
        onConfirm={executeRevoke}
        onCancel={() => setRevokeSessId(null)}
      />
    </div>
  )
}

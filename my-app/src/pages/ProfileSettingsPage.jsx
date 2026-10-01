import { useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { authApi } from '../api/auth.api.js'
import { useToast } from '../context/ToastContext.jsx'
import { formatDate, titleCase } from '../lib/format.js'
import { PageHeader, Card, Button, Input, Loader } from '../components/ui.jsx'

function Field({ label, value, readOnly }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-400">{label}{readOnly && <span className="ml-1 text-[10px] text-slate-300">(read-only)</span>}</dt>
      <dd className="mt-0.5 text-sm text-slate-800">{value || '—'}</dd>
    </div>
  )
}

function Toggle({ label, checked, onChange }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2.5">
      <span className="text-sm text-slate-700">{label}</span>
      <button
        type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition ${checked ? 'bg-blue-600' : 'bg-slate-300'}`}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
      </button>
    </label>
  )
}

function Avatar({ user }) {
  const initial = (user?.name || 'U').charAt(0).toUpperCase()
  if (user?.avatar) return <img src={user.avatar} alt={user.name} className="h-16 w-16 rounded-full object-cover" />
  return <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-2xl font-bold text-blue-600">{initial}</div>
}

export default function ProfileSettingsPage() {
  const { user, updateUser } = useAuth()
  if (!user) return <div><PageHeader title="Profile & Settings" /><Loader /></div>
  return (
    <div className="max-w-3xl">
      <PageHeader title="Profile & Settings" subtitle="Manage your personal information, security and notification preferences." />
      <MyProfile user={user} onSaved={updateUser} />
      <NotificationPreferences user={user} onSaved={updateUser} />
      <ChangePassword />
      <Security user={user} />
    </div>
  )
}

// Section 1 — My Profile
function MyProfile({ user, onSaved }) {
  const toast = useToast()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ name: user.name || '', phone: user.phone || '', avatar: user.avatar || '' })
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function save() {
    setBusy(true)
    try {
      const { data } = await authApi.updateProfile(form)
      onSaved(data.data.user)
      setEditing(false)
      toast.success('Profile updated')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed')
    } finally { setBusy(false) }
  }

  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">My Profile</h3>
        {!editing && <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>Edit Profile</Button>}
      </div>
      <div className="flex items-center gap-4 border-b border-slate-100 pb-5">
        <Avatar user={user} />
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{user.name}</h2>
          <p className="text-sm text-slate-500">{user.designation || titleCase(user.role)}</p>
        </div>
      </div>

      {editing ? (
        <div className="mt-5 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Full Name" value={form.name} onChange={set('name')} />
            <Input label="Mobile Number" value={form.phone} onChange={set('phone')} />
          </div>
          <Input label="Profile Photo URL (optional)" value={form.avatar} onChange={set('avatar')} placeholder="https://…" />
          <div className="flex gap-2">
            <Button onClick={save} disabled={busy || form.name.trim().length < 2}>Save Changes</Button>
            <Button variant="secondary" onClick={() => { setForm({ name: user.name || '', phone: user.phone || '', avatar: user.avatar || '' }); setEditing(false) }}>Cancel</Button>
          </div>
        </div>
      ) : (
        <dl className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Full Name" value={user.name} />
          <Field label="Employee ID" value={user.employeeId} readOnly />
          <Field label="Branch" value={user.branch} readOnly />
          <Field label="Designation" value={user.designation} readOnly />
          <Field label="Email" value={user.email} readOnly />
          <Field label="Mobile Number" value={user.phone} />
          <Field label="Joining Date" value={user.joiningDate ? formatDate(user.joiningDate) : '—'} readOnly />
        </dl>
      )}
    </Card>
  )
}

// Section 3 — Notification Preferences
function NotificationPreferences({ user, onSaved }) {
  const toast = useToast()
  const [prefs, setPrefs] = useState({ inApp: user.notificationPrefs?.inApp ?? true, email: user.notificationPrefs?.email ?? false })
  const [busy, setBusy] = useState(false)

  async function update(next) {
    setPrefs(next)
    setBusy(true)
    try {
      const { data } = await authApi.updateProfile({ notificationPrefs: next })
      onSaved(data.data.user)
      toast.success('Preferences saved')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed')
    } finally { setBusy(false) }
  }

  return (
    <Card className="mt-4 p-6">
      <h3 className="mb-4 text-sm font-semibold text-slate-900">Notification Preferences</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <Toggle label="In-App Notifications" checked={prefs.inApp} onChange={(v) => !busy && update({ ...prefs, inApp: v })} />
        <Toggle label="Email Notifications" checked={prefs.email} onChange={(v) => !busy && update({ ...prefs, email: v })} />
      </div>
    </Card>
  )
}

// Section 2 — Change Password
function ChangePassword() {
  const toast = useToast()
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const mismatch = form.confirmPassword.length > 0 && form.newPassword !== form.confirmPassword
  const canSubmit = form.currentPassword && form.newPassword.length >= 8 && !mismatch

  async function update() {
    setBusy(true)
    try {
      await authApi.changePassword({ currentPassword: form.currentPassword, newPassword: form.newPassword })
      toast.success('Password changed — please log in again')
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to change password')
    } finally { setBusy(false) }
  }

  return (
    <Card className="mt-4 p-6">
      <h3 className="mb-4 text-sm font-semibold text-slate-900">Change Password</h3>
      <div className="grid gap-4 sm:grid-cols-3">
        <Input label="Current Password" type="password" value={form.currentPassword} onChange={set('currentPassword')} />
        <Input label="New Password" type="password" value={form.newPassword} onChange={set('newPassword')} />
        <Input label="Confirm Password" type="password" value={form.confirmPassword} onChange={set('confirmPassword')} error={mismatch ? 'Passwords do not match' : undefined} />
      </div>
      <p className="mt-2 text-xs text-slate-500">New password must be at least 8 characters. Changing it signs you out of all devices.</p>
      <div className="mt-4"><Button onClick={update} disabled={busy || !canSubmit}>Update Password</Button></div>
    </Card>
  )
}

// Section 4 — Security
function Security({ user }) {
  const toast = useToast()
  const { logout } = useAuth()
  const [busy, setBusy] = useState(false)

  async function logoutAll() {
    if (!window.confirm('Sign out of all devices? You will need to log in again.')) return
    setBusy(true)
    try {
      await authApi.logoutAll()
      toast.success('Signed out of all devices')
      await logout()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed')
      setBusy(false)
    }
  }

  return (
    <Card className="mt-4 p-6">
      <h3 className="mb-4 text-sm font-semibold text-slate-900">Security</h3>
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Last Login" value={user.lastLoginAt ? formatDate(user.lastLoginAt, true) : '—'} />
        <Field label="Last Login Device" value={user.lastLoginDevice} />
        <Field label="Last Password Changed" value={user.passwordChangedAt ? formatDate(user.passwordChangedAt, true) : 'Never'} />
        <Field label="Active Session" value="This device (current session)" />
      </dl>
      <div className="mt-5 border-t border-slate-100 pt-4">
        <Button variant="danger" onClick={logoutAll} disabled={busy}>Logout from All Devices</Button>
      </div>
    </Card>
  )
}

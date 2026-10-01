import { useCallback, useState } from 'react'
import { useAuth } from '../../context/AuthContext.jsx'
import { officeSettingsApi } from '../../api/resources.js'
import { authApi } from '../../api/auth.api.js'
import { useFetch } from '../../hooks/useFetch.js'
import { useToast } from '../../context/ToastContext.jsx'
import { formatDate, titleCase } from '../../lib/format.js'
import { PageHeader, Card, Button, Input, Loader } from '../../components/ui.jsx'

function Field({ label, value, readOnly }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-400">{label}{readOnly && <span className="ml-1 text-[10px] text-slate-300">(read-only)</span>}</dt>
      <dd className="mt-0.5 text-sm text-slate-800">{value || '—'}</dd>
    </div>
  )
}

function Avatar({ user, size = 'h-16 w-16 text-2xl' }) {
  const initial = (user?.name || 'A').charAt(0).toUpperCase()
  if (user?.avatar) return <img src={user.avatar} alt={user.name} className={`${size} rounded-full object-cover`} />
  return <div className={`${size} flex items-center justify-center rounded-full bg-blue-50 font-bold text-blue-600`}>{initial}</div>
}

export default function AdminProfilePage() {
  const { user, updateUser } = useAuth()
  const toast = useToast()
  const { data: firm } = useFetch(useCallback(() => officeSettingsApi.get(), []))
  const [editing, setEditing] = useState(false)

  if (!user) return <div><PageHeader title="My Profile" /><Loader /></div>

  return (
    <div className="max-w-3xl">
      <PageHeader title="My Profile" subtitle="Manage your personal information, account details, and security settings." />

      {/* Section 1 — Basic Profile */}
      <Card className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">Basic Profile</h3>
          {!editing && <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>Edit Profile</Button>}
        </div>
        <div className="flex items-center gap-4 border-b border-slate-100 pb-5">
          <Avatar user={user} />
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{user.name}</h2>
            <p className="text-sm text-slate-500">{titleCase(user.role)}</p>
          </div>
        </div>
        <dl className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Full Name" value={user.name} />
          <Field label="Email Address" value={user.email} readOnly />
          <Field label="Company Name" value={firm?.name} />
          <Field label="Role" value={titleCase(user.role)} readOnly />
          <Field label="Company ID" value={firm?.companyId} readOnly />
        </dl>
      </Card>

      {/* Section 2 — Personal Information */}
      <PersonalInfo user={user} editing={editing} onCancel={() => setEditing(false)} onSaved={(u) => { updateUser(u); setEditing(false); toast.success('Profile updated') }} />

      {/* Section 3 — Security */}
      <Security user={user} />
    </div>
  )
}

// Section 2 — Personal Information (editable).
function PersonalInfo({ user, editing, onCancel, onSaved }) {
  const toast = useToast()
  const [form, setForm] = useState({
    name: user.name || '',
    phone: user.phone || '',
    altMobile: user.altMobile || '',
    designation: user.designation || '',
    avatar: user.avatar || '',
  })
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function save() {
    setBusy(true)
    try {
      const { data } = await authApi.updateProfile(form)
      onSaved(data.data.user)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update profile')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="mt-4 p-6">
      <h3 className="mb-4 text-sm font-semibold text-slate-900">Personal Information</h3>
      {editing ? (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Full Name" value={form.name} onChange={set('name')} />
            <Input label="Designation" value={form.designation} onChange={set('designation')} placeholder="e.g. Company Owner" />
            <Input label="Mobile Number" value={form.phone} onChange={set('phone')} />
            <Input label="Alternate Mobile Number (optional)" value={form.altMobile} onChange={set('altMobile')} />
          </div>
          <Input label="Profile Photo URL (optional)" value={form.avatar} onChange={set('avatar')} placeholder="https://…" />
          <div className="flex gap-2">
            <Button onClick={save} disabled={busy || form.name.trim().length < 2}>Save Changes</Button>
            <Button variant="secondary" onClick={onCancel}>Cancel</Button>
          </div>
        </div>
      ) : (
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Mobile Number" value={user.phone} />
          <Field label="Alternate Mobile Number" value={user.altMobile} />
          <Field label="Designation" value={user.designation} />
        </dl>
      )}
    </Card>
  )
}

// Section 3 — Security (change password + login/security info).
function Security({ user }) {
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
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="mt-4 p-6">
      <h3 className="mb-4 text-sm font-semibold text-slate-900">Security</h3>

      <dl className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Last Login" value={user.lastLoginAt ? formatDate(user.lastLoginAt, true) : '—'} />
        <Field label="Last Password Changed" value={user.passwordChangedAt ? formatDate(user.passwordChangedAt, true) : 'Never'} />
      </dl>

      <div className="border-t border-slate-100 pt-5">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Change Password</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <Input label="Current Password" type="password" value={form.currentPassword} onChange={set('currentPassword')} />
          <Input label="New Password" type="password" value={form.newPassword} onChange={set('newPassword')} />
          <Input label="Confirm Password" type="password" value={form.confirmPassword} onChange={set('confirmPassword')} error={mismatch ? 'Passwords do not match' : undefined} />
        </div>
        <p className="mt-2 text-xs text-slate-500">New password must be at least 8 characters. Changing it signs you out of all devices.</p>
        <div className="mt-4">
          <Button onClick={update} disabled={busy || !canSubmit}>Update Password</Button>
        </div>
      </div>
    </Card>
  )
}

import { useState } from 'react'
import { Card, Button, Input } from '../../components/ui.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'

export default function SuperAdminProfilePage() {
  const { user } = useAuth()
  const { addToast } = useToast()
  
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  
  // Section 1: Personal Info
  const [personalInfo, setPersonalInfo] = useState({
    name: user?.name || 'Super Admin',
    mobile: '+1 (555) 123-4567',
    designation: 'Platform Owner',
    bio: 'Responsible for overseeing the entire Real Estate SaaS Platform, managing global configurations, and ensuring system stability.'
  })

  // Section 2: Account Info (Read-only)
  const accountInfo = {
    userId: 'SA-9823-XYZ',
    role: 'Super Admin',
    status: 'Active',
    joinedDate: 'Jan 15, 2026',
    lastLogin: 'Today, 10:45 AM',
    lastPasswordChanged: '3 months ago'
  }

  // Section 3: Security
  const [passwords, setPasswords] = useState({
    current: '',
    newPass: '',
    confirm: ''
  })
  const [is2FAEnabled, setIs2FAEnabled] = useState(true)
  const [isChangingPass, setIsChangingPass] = useState(false)

  // Section 4: Login Activity
  const loginActivity = [
    { id: 1, date: 'Today, 10:45 AM', ip: '192.168.1.42', device: 'MacBook Pro', browser: 'Chrome 120', status: 'Success' },
    { id: 2, date: 'Yesterday, 09:12 AM', ip: '192.168.1.42', device: 'MacBook Pro', browser: 'Chrome 120', status: 'Success' },
    { id: 3, date: 'Oct 15, 2026, 08:30 PM', ip: '172.16.254.1', device: 'iPhone 15 Pro', browser: 'Safari Mobile', status: 'Success' },
    { id: 4, date: 'Oct 14, 2026, 11:20 AM', ip: '203.0.113.45', device: 'Windows PC', browser: 'Edge', status: 'Failed' },
    { id: 5, date: 'Oct 12, 2026, 09:00 AM', ip: '192.168.1.42', device: 'MacBook Pro', browser: 'Chrome 120', status: 'Success' }
  ]

  // Section 5: Preferences
  const [preferences, setPreferences] = useState({
    theme: 'Light',
    language: 'English (US)',
    timeZone: 'UTC-05:00 Eastern Time',
    dateFormat: 'MM/DD/YYYY',
    timeFormat: '12h'
  })

  // Section 6: Active Sessions
  const [sessions, setSessions] = useState([
    { id: 's1', device: 'MacBook Pro 16"', browser: 'Chrome 120', os: 'macOS Sonoma', loginTime: 'Today, 10:45 AM', lastActive: 'Current Session', current: true },
    { id: 's2', device: 'iPhone 15 Pro', browser: 'Safari Mobile', os: 'iOS 17', loginTime: 'Oct 15, 2026', lastActive: '2 hours ago', current: false },
    { id: 's3', device: 'Windows Desktop', browser: 'Firefox 119', os: 'Windows 11', loginTime: 'Oct 10, 2026', lastActive: '5 days ago', current: false }
  ])

  // Handlers
  const handleSaveProfile = () => {
    setIsSaving(true)
    setTimeout(() => {
      setIsSaving(false)
      setIsEditing(false)
      addToast('success', 'Profile settings saved successfully.')
    }, 600)
  }

  const handleChangePassword = (e) => {
    e.preventDefault()
    if (!passwords.current || !passwords.newPass || !passwords.confirm) {
      addToast('error', 'Please fill all password fields.')
      return
    }
    if (passwords.newPass !== passwords.confirm) {
      addToast('error', 'New passwords do not match.')
      return
    }
    
    setIsChangingPass(true)
    setTimeout(() => {
      setIsChangingPass(false)
      setPasswords({ current: '', newPass: '', confirm: '' })
      addToast('success', 'Password updated successfully.')
    }, 600)
  }

  const handleLogoutSession = (id) => {
    setSessions(prev => prev.filter(s => s.id !== id))
    addToast('success', 'Session terminated successfully.')
  }

  const handleLogoutAllOther = () => {
    setSessions(prev => prev.filter(s => s.current))
    addToast('success', 'All other sessions have been terminated.')
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 animate-in fade-in duration-300 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Profile</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage your personal information, account settings, security, preferences, and active sessions.
          </p>
        </div>
        <div className="flex gap-3">
          {isEditing ? (
            <>
              <Button variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button>
              <Button onClick={handleSaveProfile} disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
            </>
          ) : (
            <Button onClick={() => setIsEditing(true)}>Edit Profile</Button>
          )}
        </div>
      </div>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column */}
        <div className="space-y-8 lg:col-span-2">
          
          {/* Section 1: Personal Information */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-6 border-b border-slate-100 pb-2">Personal Information</h2>
            <div className="flex items-start gap-6 mb-8">
              <div className="relative">
                <div className="h-20 w-20 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-2xl font-bold border-4 border-white shadow-sm overflow-hidden">
                  {personalInfo.name.charAt(0)}
                </div>
                {isEditing && (
                  <button className="absolute bottom-0 right-0 h-7 w-7 bg-white rounded-full border border-slate-200 shadow-sm flex items-center justify-center text-slate-500 hover:text-blue-600">
                    <span className="text-xs">📷</span>
                  </button>
                )}
              </div>
              <div className="flex-1 mt-2">
                <h3 className="text-lg font-medium text-slate-900">{personalInfo.name}</h3>
                <p className="text-sm text-slate-500">{user?.email || 'superadmin@example.com'}</p>
                <div className="mt-2 inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                  {personalInfo.designation}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Full Name</label>
                {isEditing ? (
                  <Input value={personalInfo.name} onChange={e => setPersonalInfo({...personalInfo, name: e.target.value})} />
                ) : (
                  <p className="text-sm text-slate-900 py-2">{personalInfo.name}</p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Mobile Number</label>
                {isEditing ? (
                  <Input value={personalInfo.mobile} onChange={e => setPersonalInfo({...personalInfo, mobile: e.target.value})} />
                ) : (
                  <p className="text-sm text-slate-900 py-2">{personalInfo.mobile}</p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Email Address</label>
                <p className="text-sm text-slate-500 py-2">{user?.email || 'superadmin@example.com'} (Read-only)</p>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Designation</label>
                {isEditing ? (
                  <Input value={personalInfo.designation} onChange={e => setPersonalInfo({...personalInfo, designation: e.target.value})} />
                ) : (
                  <p className="text-sm text-slate-900 py-2">{personalInfo.designation}</p>
                )}
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium text-slate-700">Bio (Optional)</label>
                {isEditing ? (
                  <textarea 
                    className="w-full rounded-md border border-slate-300 p-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" 
                    rows="3"
                    value={personalInfo.bio} 
                    onChange={e => setPersonalInfo({...personalInfo, bio: e.target.value})}
                  />
                ) : (
                  <p className="text-sm text-slate-900 py-2">{personalInfo.bio}</p>
                )}
              </div>
            </div>
          </Card>

          {/* Section 4: Login Activity */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-6 border-b border-slate-100 pb-2">Recent Login Activity</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="pb-3 font-medium text-slate-500">Date & Time</th>
                    <th className="pb-3 font-medium text-slate-500">IP Address</th>
                    <th className="pb-3 font-medium text-slate-500">Device</th>
                    <th className="pb-3 font-medium text-slate-500">Browser</th>
                    <th className="pb-3 font-medium text-slate-500">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loginActivity.map(log => (
                    <tr key={log.id}>
                      <td className="py-3 text-slate-900">{log.date}</td>
                      <td className="py-3 text-slate-600 font-mono text-xs">{log.ip}</td>
                      <td className="py-3 text-slate-600">{log.device}</td>
                      <td className="py-3 text-slate-600">{log.browser}</td>
                      <td className="py-3">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                          log.status === 'Success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                        }`}>
                          {log.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          
          {/* Section 6: Active Sessions */}
          <Card className="p-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-6">
              <h2 className="text-lg font-semibold text-slate-800">Active Sessions</h2>
              <Button variant="outline" onClick={handleLogoutAllOther} className="text-xs h-8 py-0">Logout Other Sessions</Button>
            </div>
            <div className="space-y-4">
              {sessions.map(session => (
                <div key={session.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors gap-4">
                  <div className="flex gap-4">
                    <div className={`mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${session.current ? 'bg-blue-100 text-blue-600' : 'bg-slate-200 text-slate-600'}`}>
                      <span className="text-lg">{session.device.includes('iPhone') || session.device.includes('Mobile') ? '📱' : '💻'}</span>
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-slate-900">{session.device} • {session.browser}</p>
                        {session.current && <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-blue-700 tracking-wide">Current</span>}
                      </div>
                      <p className="text-sm text-slate-500 mt-1">{session.os}</p>
                      <p className="text-xs text-slate-400 mt-1">Logged in: {session.loginTime} • Last Active: {session.lastActive}</p>
                    </div>
                  </div>
                  {!session.current && (
                    <button 
                      onClick={() => handleLogoutSession(session.id)}
                      className="text-sm text-red-600 hover:text-red-700 font-medium whitespace-nowrap self-start sm:self-center"
                    >
                      Logout Session
                    </button>
                  )}
                </div>
              ))}
              {sessions.length === 0 && (
                <p className="text-sm text-slate-500 italic text-center py-4">No active sessions found.</p>
              )}
            </div>
          </Card>
        </div>

        {/* Right Column */}
        <div className="space-y-8">
          
          {/* Section 2: Account Information */}
          <Card className="p-6 bg-slate-50/50 border-slate-200 shadow-none">
            <h2 className="text-lg font-semibold text-slate-800 mb-6 border-b border-slate-200 pb-2">Account Information</h2>
            <div className="space-y-5">
              <div>
                <span className="block text-xs font-medium text-slate-500 uppercase tracking-wide">User ID</span>
                <span className="block text-sm font-medium text-slate-900 font-mono mt-0.5">{accountInfo.userId}</span>
              </div>
              <div>
                <span className="block text-xs font-medium text-slate-500 uppercase tracking-wide">Role</span>
                <span className="block text-sm font-medium text-slate-900 mt-0.5">{accountInfo.role}</span>
              </div>
              <div>
                <span className="block text-xs font-medium text-slate-500 uppercase tracking-wide">Status</span>
                <span className="inline-flex mt-1 items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                  {accountInfo.status}
                </span>
              </div>
              <div>
                <span className="block text-xs font-medium text-slate-500 uppercase tracking-wide">Joined Date</span>
                <span className="block text-sm font-medium text-slate-900 mt-0.5">{accountInfo.joinedDate}</span>
              </div>
              <div>
                <span className="block text-xs font-medium text-slate-500 uppercase tracking-wide">Last Login</span>
                <span className="block text-sm font-medium text-slate-900 mt-0.5">{accountInfo.lastLogin}</span>
              </div>
              <div>
                <span className="block text-xs font-medium text-slate-500 uppercase tracking-wide">Last Password Change</span>
                <span className="block text-sm font-medium text-slate-900 mt-0.5">{accountInfo.lastPasswordChanged}</span>
              </div>
            </div>
          </Card>

          {/* Section 5: Preferences */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-6 border-b border-slate-100 pb-2">Preferences</h2>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Theme</label>
                {isEditing ? (
                  <select 
                    className="w-full rounded-md border border-slate-300 p-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    value={preferences.theme}
                    onChange={e => setPreferences({...preferences, theme: e.target.value})}
                  >
                    <option>Light</option>
                    <option>Dark</option>
                    <option>System Default</option>
                  </select>
                ) : (
                  <p className="text-sm text-slate-900 py-1">{preferences.theme}</p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Language</label>
                {isEditing ? (
                  <select 
                    className="w-full rounded-md border border-slate-300 p-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    value={preferences.language}
                    onChange={e => setPreferences({...preferences, language: e.target.value})}
                  >
                    <option>English (US)</option>
                    <option>English (UK)</option>
                    <option>Spanish</option>
                    <option>French</option>
                  </select>
                ) : (
                  <p className="text-sm text-slate-900 py-1">{preferences.language}</p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Time Zone</label>
                {isEditing ? (
                  <select 
                    className="w-full rounded-md border border-slate-300 p-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    value={preferences.timeZone}
                    onChange={e => setPreferences({...preferences, timeZone: e.target.value})}
                  >
                    <option>UTC-05:00 Eastern Time</option>
                    <option>UTC-08:00 Pacific Time</option>
                    <option>UTC+00:00 Greenwich Mean Time</option>
                  </select>
                ) : (
                  <p className="text-sm text-slate-900 py-1">{preferences.timeZone}</p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Date Format</label>
                {isEditing ? (
                  <select 
                    className="w-full rounded-md border border-slate-300 p-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    value={preferences.dateFormat}
                    onChange={e => setPreferences({...preferences, dateFormat: e.target.value})}
                  >
                    <option>MM/DD/YYYY</option>
                    <option>DD/MM/YYYY</option>
                    <option>YYYY-MM-DD</option>
                  </select>
                ) : (
                  <p className="text-sm text-slate-900 py-1">{preferences.dateFormat}</p>
                )}
              </div>
            </div>
          </Card>

          {/* Section 3: Security */}
          <Card className="p-6 border-red-100">
            <h2 className="text-lg font-semibold text-slate-800 mb-6 border-b border-slate-100 pb-2">Security</h2>
            
            <div className="mb-8 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-900">Two-Factor Authentication</p>
                <p className="text-xs text-slate-500">Protect your account with 2FA</p>
              </div>
              <button 
                onClick={() => setIs2FAEnabled(!is2FAEnabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${is2FAEnabled ? 'bg-blue-600' : 'bg-slate-200'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${is2FAEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-4">
              <h3 className="text-sm font-medium text-slate-800 mb-3 border-t border-slate-100 pt-4">Change Password</h3>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">Current Password</label>
                <Input type="password" value={passwords.current} onChange={e => setPasswords({...passwords, current: e.target.value})} placeholder="••••••••" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">New Password</label>
                <Input type="password" value={passwords.newPass} onChange={e => setPasswords({...passwords, newPass: e.target.value})} placeholder="••••••••" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">Confirm New Password</label>
                <Input type="password" value={passwords.confirm} onChange={e => setPasswords({...passwords, confirm: e.target.value})} placeholder="••••••••" />
              </div>
              <Button type="submit" className="w-full mt-2" disabled={isChangingPass}>
                {isChangingPass ? 'Updating...' : 'Update Password'}
              </Button>
            </form>
          </Card>

        </div>
      </div>
    </div>
  )
}

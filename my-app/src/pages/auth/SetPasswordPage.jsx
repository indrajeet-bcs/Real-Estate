import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { authApi } from '../../api/auth.api.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import { ROLE_HOME } from '../../lib/constants.js'

export default function SetPasswordPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { login } = useAuth()

  const urlToken = searchParams.get('token') || ''
  const urlEmail = searchParams.get('email') || ''
  const urlOtp = searchParams.get('otp') || ''

  const [tokenMode, setTokenMode] = useState(Boolean(urlToken))
  const [tokenVerifying, setTokenVerifying] = useState(Boolean(urlToken))
  const [tokenValid, setTokenValid] = useState(false)
  const [tokenUser, setTokenUser] = useState(null)

  const [email, setEmail] = useState(urlEmail)
  const [otp, setOtp] = useState(urlOtp)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  // Verify invitation token if present in URL
  useEffect(() => {
    if (!urlToken) return
    let active = true

    ;(async () => {
      try {
        setTokenVerifying(true)
        setError('')
        const res = await authApi.verifyInvitation(urlToken)
        if (!active) return
        const invitationData = res.data?.data || {}
        setTokenUser(invitationData)
        setEmail(invitationData.email || '')
        setTokenValid(true)
        setTokenMode(true)
      } catch (err) {
        if (!active) return
        setTokenValid(false)
        setError(err.response?.data?.message || 'This invitation link is invalid or has expired.')
      } finally {
        if (active) setTokenVerifying(false)
      }
    })()

    return () => {
      active = false
    }
  }, [urlToken])

  useEffect(() => {
    if (!urlToken) {
      if (urlEmail) setEmail(urlEmail)
      if (urlOtp) setOtp(urlOtp)
    }
  }, [urlToken, urlEmail, urlOtp])

  // Password validation rules
  const hasMinLength = newPassword.length >= 8
  const hasNumber = /\d/.test(newPassword)
  const isMatch = newPassword.length > 0 && newPassword === confirmPassword
  const isOtpValid = tokenMode ? true : otp.trim().length >= 4
  const canSubmit = (tokenMode ? tokenValid : (email.trim() && isOtpValid)) && hasMinLength && isMatch && !busy

  async function handleSubmit(e) {
    e.preventDefault()
    if (!canSubmit) return

    setBusy(true)
    setError('')

    try {
      if (tokenMode && urlToken) {
        // Modern Token-based invitation acceptance
        const res = await authApi.acceptInvitation({
          token: urlToken,
          password: newPassword,
          confirmPassword,
        })

        setSuccess(true)
        toast.success('Account activated and password set successfully!')

        const targetEmail = res.data?.data?.user?.email || email.trim().toLowerCase()
        try {
          const loggedInUser = await login(targetEmail, newPassword)
          const dest = ROLE_HOME[loggedInUser.role] || '/'
          setTimeout(() => navigate(dest, { replace: true }), 1000)
        } catch {
          setTimeout(() => navigate('/login', { state: { email: targetEmail }, replace: true }), 1500)
        }
      } else {
        // Legacy OTP flow
        await authApi.setPassword({
          email: email.trim().toLowerCase(),
          otp: otp.trim(),
          newPassword,
        })

        setSuccess(true)
        toast.success('Password set successfully! Activating your account…')

        try {
          const loggedInUser = await login(email.trim().toLowerCase(), newPassword)
          const dest = ROLE_HOME[loggedInUser.role] || '/'
          setTimeout(() => navigate(dest, { replace: true }), 1000)
        } catch {
          setTimeout(() => navigate('/login', { state: { email }, replace: true }), 1500)
        }
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to set password. Please try again.'
      setError(msg)
      toast.error(msg)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-8 sm:py-12">
      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-xl font-bold text-white shadow-md shadow-blue-500/20">
            RE
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Real Estate CRM</h1>
          <p className="mt-1 text-sm text-slate-600">Account Activation &amp; Password Setup</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xl">
          {tokenVerifying ? (
            <div className="py-12 text-center">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
              <p className="mt-4 text-sm font-medium text-slate-700">Verifying your invitation link...</p>
            </div>
          ) : tokenMode && !tokenValid ? (
            <div className="text-center py-4">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-rose-600">
                <span className="material-symbols-outlined text-[28px]">link_off</span>
              </div>
              <h2 className="text-lg font-semibold text-slate-900">Invitation Link Invalid or Expired</h2>
              <p className="mt-2 text-xs text-slate-500 leading-relaxed">
                {error || 'This invitation link is invalid or has expired. Invitation links are valid for 24 hours.'}
              </p>
              <div className="mt-6 flex flex-col gap-2">
                <Link
                  to="/login"
                  className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-medium text-white shadow hover:bg-blue-700"
                >
                  Return to Sign In
                </Link>
                <p className="text-[11px] text-slate-400 mt-2">
                  Need a new invitation? Ask your Company Admin to resend it from the Employees tab.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-slate-900">
                  {tokenUser?.name ? `Welcome, ${tokenUser.name}!` : 'Set Your Permanent Password'}
                </h2>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                  {tokenMode
                    ? `Set up your password to activate your account for ${tokenUser?.firmName || 'your company'}.`
                    : 'Welcome to the team! Enter the One-Time Password (OTP) sent to your email to verify your identity and choose your permanent password.'}
                </p>
              </div>

              {error && (
                <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-800">
                  <span className="material-symbols-outlined text-[18px] text-rose-600 shrink-0 mt-0.5">error</span>
                  <span>{error}</span>
                </div>
              )}

              {success && (
                <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-800">
                  <span className="material-symbols-outlined text-[18px] text-emerald-600 shrink-0 mt-0.5">check_circle</span>
                  <span>Password set successfully! Redirecting you to your dashboard…</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Email Address */}
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    {tokenMode ? 'Invitation Email' : 'Registered Email Address'}
                  </label>
                  <input
                    type="email"
                    required
                    disabled={tokenMode}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className={`w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-800 outline-none transition ${
                      tokenMode ? 'bg-slate-100 text-slate-600 cursor-not-allowed' : 'bg-slate-50 focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-500/20'
                    }`}
                  />
                  {tokenMode && tokenUser?.role && (
                    <div className="mt-1.5 flex items-center gap-2">
                      <span className="text-[11px] text-slate-400">Assigned Role:</span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200">
                        {tokenUser.role.replace('_', ' ')}
                      </span>
                    </div>
                  )}
                </div>

                {/* Legacy One-Time Password (only if not token-based) */}
                {!tokenMode && (
                  <div>
                    <label className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-700">
                      <span>One-Time Password (OTP)</span>
                      <span className="text-[10px] font-normal text-slate-400">Check your inbox</span>
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={8}
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\s+/g, ''))}
                      placeholder="Enter 6-digit OTP"
                      className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-center font-mono text-lg font-bold tracking-widest text-slate-900 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                )}

                {/* New Password */}
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Choose New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Min. 8 characters"
                      className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 pr-10 text-sm text-slate-800 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        {showNewPassword ? 'visibility_off' : 'visibility'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Confirm Password */}
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter password"
                      className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 pr-10 text-sm text-slate-800 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        {showConfirmPassword ? 'visibility_off' : 'visibility'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Password Validation Checklist */}
                <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 text-[11px] space-y-1 text-slate-600">
                  <div className="flex items-center gap-1.5 font-medium text-slate-700 mb-1">
                    <span className="material-symbols-outlined text-[14px]">lock</span>
                    <span>Password Requirements:</span>
                  </div>
                  <div className={`flex items-center gap-1.5 ${hasMinLength ? 'text-emerald-700 font-medium' : 'text-slate-500'}`}>
                    <span>{hasMinLength ? '✓' : '•'}</span>
                    <span>At least 8 characters long</span>
                  </div>
                  <div className={`flex items-center gap-1.5 ${hasNumber ? 'text-emerald-700 font-medium' : 'text-slate-500'}`}>
                    <span>{hasNumber ? '✓' : '•'}</span>
                    <span>Contains at least 1 number</span>
                  </div>
                  <div className={`flex items-center gap-1.5 ${isMatch ? 'text-emerald-700 font-medium' : 'text-slate-500'}`}>
                    <span>{isMatch ? '✓' : '•'}</span>
                    <span>Both passwords match</span>
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white shadow-md shadow-blue-500/20 transition hover:bg-blue-700 active:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy ? 'Activating Account…' : 'Set Password & Sign In'}
                </button>
              </form>

              {/* Footer Link */}
              <div className="mt-6 text-center text-xs text-slate-500">
                Already have your password set?{' '}
                <Link to="/login" className="font-semibold text-blue-600 hover:underline">
                  Sign In
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

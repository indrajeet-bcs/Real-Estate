import { useState } from 'react'
import { Link } from 'react-router-dom'
import { authApi } from '../../api/auth.api.js'

// Two-step reset: request OTP, then submit OTP + new password (§2 flow).
export default function ForgotPasswordPage() {
  const [step, setStep] = useState('request')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const hasMinLength = newPassword.length >= 8
  const isMatch = newPassword.length > 0 && newPassword === confirmPassword
  const isOtpReady = otp.trim().length === 6
  const canReset = isOtpReady && hasMinLength && isMatch && !busy

  async function requestOtp(e) {
    e?.preventDefault()
    const cleanEmail = email.trim().toLowerCase()
    if (!cleanEmail) return
    setError('')
    setMessage('')
    setBusy(true)
    try {
      const { data } = await authApi.forgotPassword(cleanEmail)
      setEmail(cleanEmail)
      setMessage(
        data.data?.devOtp
          ? `Verification code sent. (Dev OTP: ${data.data.devOtp})`
          : 'If an active account exists for this email, a 6-digit verification code has been sent.'
      )
      setStep('reset')
    } catch (err) {
      setError(err.response?.data?.message || 'Could not send verification code. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function submitReset(e) {
    e.preventDefault()
    if (!canReset) return
    setError('')
    setMessage('')
    setBusy(true)
    try {
      await authApi.resetPassword({
        email: email.trim().toLowerCase(),
        otp: otp.trim(),
        newPassword,
      })
      setMessage('Password reset successful. You can now sign in with your new password.')
      setStep('done')
    } catch (err) {
      setError(err.response?.data?.message || 'Reset failed. Check the OTP code and try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-8 sm:py-12">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xl">
        <div className="mb-5">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-sm font-bold text-white">
            RE
          </div>
          <h1 className="text-xl font-semibold text-slate-900">Reset password</h1>
          <p className="mt-1 text-sm text-slate-600">
            {step === 'request' && 'Enter your registered email address and we will send a 6-digit verification code.'}
            {step === 'reset' && `Enter the 6-digit code sent to ${email} and choose a new password.`}
            {step === 'done' && 'Your password has been updated.'}
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {message && (
          <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {message}
          </div>
        )}

        {step === 'request' && (
          <form onSubmit={requestOtp} className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">Email Address</label>
              <input
                type="email"
                required
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <button
              disabled={busy || !email.trim()}
              className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? 'Sending code…' : 'Send verification code'}
            </button>
          </form>
        )}

        {step === 'reset' && (
          <form onSubmit={submitReset} className="space-y-4">
            <div>
              <div className="mb-1 flex items-center justify-between text-xs">
                <label className="font-semibold text-slate-700">6-digit OTP Code</label>
                <button
                  type="button"
                  onClick={() => {
                    setStep('request')
                    setOtp('')
                    setError('')
                    setMessage('')
                  }}
                  className="text-blue-600 hover:underline"
                >
                  Change email
                </button>
              </div>
              <input
                type="text"
                required
                maxLength={6}
                placeholder="Enter 6-digit code"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D+/g, '').slice(0, 6))}
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-center font-mono text-base font-bold tracking-widest text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">New Password</label>
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  required
                  placeholder="Min. 8 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 pr-10 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword((p) => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {showNewPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">Confirm New Password</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  placeholder="Re-enter new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 pr-10 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((p) => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {showConfirmPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-[11px] space-y-1">
              <div className={hasMinLength ? 'text-emerald-700 font-medium' : 'text-slate-500'}>
                {hasMinLength ? '✓' : '•'} At least 8 characters
              </div>
              <div className={isMatch ? 'text-emerald-700 font-medium' : 'text-slate-500'}>
                {isMatch ? '✓' : '•'} Passwords match
              </div>
            </div>

            <button
              disabled={!canReset}
              className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? 'Resetting…' : 'Reset password'}
            </button>

            <div className="text-center">
              <button
                type="button"
                disabled={busy}
                onClick={() => requestOtp()}
                className="text-xs font-medium text-blue-600 hover:underline disabled:opacity-50"
              >
                Didn&apos;t receive the code? Resend OTP
              </button>
            </div>
          </form>
        )}

        {step === 'done' && (
          <Link
            to="/login"
            className="block w-full rounded-lg bg-blue-600 px-4 py-2.5 text-center text-sm font-medium text-white transition hover:bg-blue-700"
          >
            Continue to Sign in
          </Link>
        )}

        {step !== 'done' && (
          <div className="mt-6 text-center">
            <Link to="/login" className="text-sm text-blue-600 hover:text-blue-700">
              Back to sign in
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import axios from 'axios'
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  LockKeyhole,
  ShieldCheck,
  X,
} from 'lucide-react'
import { authApi } from '../api'

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token') ?? ''

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  const passwordChecks = {
    length: newPassword.length >= 8,
    uppercase: /[A-Z]/.test(newPassword),
    lowercase: /[a-z]/.test(newPassword),
    number: /\d/.test(newPassword),
    special: /[^A-Za-z0-9]/.test(newPassword),
  }

  const passwordStrength = Object.values(passwordChecks).filter(Boolean).length

  const passwordsMatch =
    confirmPassword.length > 0 && newPassword === confirmPassword

  const getStrengthLabel = () => {
    if (!newPassword) return ''
    if (passwordStrength <= 2) return 'Weak'
    if (passwordStrength === 3) return 'Fair'
    if (passwordStrength === 4) return 'Good'
    return 'Strong'
  }

  const getStrengthWidth = () => {
    if (!newPassword) return '0%'
    return `${(passwordStrength / 5) * 100}%`
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!newPassword.trim()) {
      setError('Please enter a new password.')
      return
    }

    if (newPassword.length < 8) {
      setError('Your password must be at least 8 characters long.')
      return
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords don't match.")
      return
    }

    setIsSubmitting(true)

    try {
      await authApi.resetPassword(token, newPassword)

      setSuccess(true)

      timeoutRef.current = setTimeout(() => {
        navigate('/login')
      }, 2500)
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data?.detail) {
        const detail = err.response.data.detail

        const errorMessage =
          typeof detail === 'string'
            ? detail
            : Array.isArray(detail)
              ? detail
                  .map((item: any) => item?.msg)
                  .filter(Boolean)
                  .join(', ')
              : 'Could not reset your password. Please check your inputs.'

        setError(
          errorMessage ||
            'Could not reset your password. Please try again.',
        )
      } else {
        setError('Could not reset your password. Please try again.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handlePasswordChange = (value: string) => {
    setNewPassword(value)

    if (error) {
      setError(null)
    }
  }

  const handleConfirmPasswordChange = (value: string) => {
    setConfirmPassword(value)

    if (error) {
      setError(null)
    }
  }

  const Requirement = ({
    valid,
    children,
  }: {
    valid: boolean
    children: React.ReactNode
  }) => (
    <div
      className={`flex items-center gap-2 text-xs transition-colors ${
        valid
          ? 'text-emerald-600 dark:text-emerald-400'
          : 'text-slate-500 dark:text-slate-400'
      }`}
    >
      <span
        className={`flex h-4 w-4 items-center justify-center rounded-full ${
          valid
            ? 'bg-emerald-500 text-white'
            : 'border border-slate-300 dark:border-slate-700'
        }`}
      >
        {valid && <Check className="h-2.5 w-2.5" />}
      </span>

      <span>{children}</span>
    </div>
  )

  // ---------------------------------------------------------------------------
  // Missing token state
  // ---------------------------------------------------------------------------

  if (!token) {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 font-display font-semibold text-2xl text-primary"
            >
              AI-CS Mentor
            </Link>

            <p className="text-sm text-ink/50 mt-2">
              Ethiopian CS Exit Exam Preparation
            </p>
          </div>

          <div className="card p-7 text-center">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-danger/10 text-danger">
              <LockKeyhole className="h-8 w-8" />
            </div>

            <h1 className="font-display text-xl font-semibold text-ink">
              Invalid reset link
            </h1>

            <p className="mt-2 text-sm leading-relaxed text-ink/60">
              This password reset link is missing its security token or is no
              longer valid.
            </p>

            <Link
              to="/forgot-password"
              className="btn-primary mt-6 w-full inline-flex items-center justify-center"
            >
              Request a new reset link
            </Link>

            <Link
              to="/login"
              className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-accent-dark hover:underline"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to login
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Success state
  // ---------------------------------------------------------------------------

  if (success) {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <Link
              to="/login"
              className="font-display font-semibold text-2xl text-primary"
            >
              AI-CS Mentor
            </Link>

            <p className="text-sm text-ink/50 mt-2">
              Ethiopian CS Exit Exam Preparation
            </p>
          </div>

          <div className="card p-8 text-center">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-9 w-9" />
            </div>

            <h1 className="font-display text-2xl font-semibold text-ink">
              Password reset successfully
            </h1>

            <p className="mt-3 text-sm leading-relaxed text-ink/60">
              Your password has been updated. You can now sign in with your new
              password and continue your Exit Exam preparation.
            </p>

            <div className="mt-6 rounded-xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">
              Redirecting you to the login page…
            </div>

            <Link
              to="/login"
              className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-accent-dark hover:underline"
            >
              Go to login now
              <ArrowLeft className="h-4 w-4 rotate-180" />
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Main reset password page
  // ---------------------------------------------------------------------------

  return (
    <div className="min-h-screen flex">
      {/* ------------------------------------------------------------------- */}
      {/* Desktop branding panel */}
      {/* ------------------------------------------------------------------- */}

      <div className="hidden lg:flex lg:w-1/2 bg-primary text-white flex-col justify-between p-12">
        <div className="font-display font-semibold text-lg">
          AI-CS Mentor
        </div>

        <div className="max-w-md">
          <div className="mb-8 flex h-20 w-20 items-center justify-center rounded-3xl bg-white/10">
            <ShieldCheck className="h-10 w-10 text-white" />
          </div>

          <h1 className="font-display text-3xl font-semibold leading-tight">
            Secure your account.
            <br />
            Keep learning.
          </h1>

          <p className="mt-4 leading-relaxed text-white/70">
            Create a strong new password and get back to preparing for the
            Ethiopian Computer Science Exit Exam.
          </p>

          <div className="mt-8 space-y-3 text-sm text-white/70">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-white/80" />
              Protect your account
            </div>

            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-white/80" />
              Continue your learning progress
            </div>

            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-white/80" />
              Keep your study data secure
            </div>
          </div>
        </div>

        <div className="text-sm text-white/50">
          Built for BSc Computer Science students preparing for the MoE exit
          exam
        </div>
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* Form panel */}
      {/* ------------------------------------------------------------------- */}

      <div className="flex-1 flex items-center justify-center bg-canvas px-4 py-10 sm:px-6">
        <div className="w-full max-w-md">
          {/* Mobile branding */}
          <div className="text-center mb-8 lg:hidden">
            <Link
              to="/login"
              className="font-display font-semibold text-2xl text-primary"
            >
              AI-CS Mentor
            </Link>

            <div className="text-sm text-ink/50 mt-1">
              Ethiopian CS Exit Exam Preparation
            </div>
          </div>

          {/* Heading */}
          <div className="mb-6">
            <h2 className="font-display text-xl sm:text-2xl font-semibold text-ink">
              Create a new password
            </h2>

            <p className="mt-2 text-sm leading-relaxed text-ink/55">
              Choose a strong password you haven't used before.
            </p>
          </div>

          {/* Form card */}
          <form onSubmit={handleSubmit} className="card p-6 sm:p-7 space-y-5">
            {/* Error */}
            {error && (
              <div
                role="alert"
                className="flex items-start gap-3 rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger"
              >
                <X className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* New password */}
            <div>
              <label htmlFor="new-password" className="label">
                New password
              </label>

              <div className="relative">
                <input
                  id="new-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="input pr-11"
                  value={newPassword}
                  onChange={(e) => handlePasswordChange(e.target.value)}
                  placeholder="Enter your new password"
                  disabled={isSubmitting}
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600 dark:hover:text-slate-300"
                  aria-label={
                    showPassword ? 'Hide password' : 'Show password'
                  }
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Password strength */}
            {newPassword && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-ink/60">
                    Password strength
                  </span>

                  <span
                    className={`font-semibold ${
                      passwordStrength <= 2
                        ? 'text-danger'
                        : passwordStrength === 3
                          ? 'text-amber-600'
                          : 'text-emerald-600'
                    }`}
                  >
                    {getStrengthLabel()}
                  </span>
                </div>

                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                  <div
                    className="h-full rounded-full bg-current transition-all duration-300"
                    style={{
                      width: getStrengthWidth(),
                    }}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <Requirement valid={passwordChecks.length}>
                    At least 8 characters
                  </Requirement>

                  <Requirement valid={passwordChecks.uppercase}>
                    One uppercase letter
                  </Requirement>

                  <Requirement valid={passwordChecks.lowercase}>
                    One lowercase letter
                  </Requirement>

                  <Requirement valid={passwordChecks.number}>
                    One number
                  </Requirement>

                  <Requirement valid={passwordChecks.special}>
                    One special character
                  </Requirement>
                </div>
              </div>
            )}

            {/* Confirm password */}
            <div>
              <label htmlFor="confirm-password" className="label">
                Confirm new password
              </label>

              <div className="relative">
                <input
                  id="confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className={`input pr-11 ${
                    confirmPassword &&
                    (passwordsMatch
                      ? 'border-emerald-500 focus:border-emerald-500'
                      : 'border-danger focus:border-danger')
                  }`}
                  value={confirmPassword}
                  onChange={(e) =>
                    handleConfirmPasswordChange(e.target.value)
                  }
                  placeholder="Re-enter your new password"
                  disabled={isSubmitting}
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowConfirmPassword((value) => !value)
                  }
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600 dark:hover:text-slate-300"
                  aria-label={
                    showConfirmPassword
                      ? 'Hide confirmation password'
                      : 'Show confirmation password'
                  }
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>

              {confirmPassword && (
                <div
                  className={`mt-2 flex items-center gap-1.5 text-xs ${
                    passwordsMatch
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-danger'
                  }`}
                >
                  {passwordsMatch ? (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      Passwords match
                    </>
                  ) : (
                    <>
                      <X className="h-3.5 w-3.5" />
                      Passwords do not match
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Security information */}
            <div className="flex items-start gap-3 rounded-xl bg-slate-50 px-4 py-3 dark:bg-slate-900/60">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />

              <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                Use a unique password that you don't use for other accounts.
              </p>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={
                isSubmitting ||
                newPassword.length < 8 ||
                newPassword !== confirmPassword
              }
              className="btn-primary w-full"
            >
              {isSubmitting ? 'Resetting password…' : 'Reset password'}
            </button>

            {/* Back to login */}
            <div className="text-center pt-1">
              <Link
                to="/login"
                className="inline-flex items-center gap-2 text-sm font-medium text-accent-dark hover:underline"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to login
              </Link>
            </div>
          </form>

          {/* Footer */}
          <p className="mt-5 text-center text-xs text-ink/40">
            Your account security matters. Never share your password with
            anyone.
          </p>
        </div>
      </div>
    </div>
  )
}

export default ResetPasswordPage
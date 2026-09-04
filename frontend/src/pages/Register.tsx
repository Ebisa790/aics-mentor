import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Eye,
  EyeOff,
  Check,
  X,
  ShieldCheck,
  UserPlus,
} from 'lucide-react'
import {
  GoogleLogin,
  type CredentialResponse,
} from '@react-oauth/google'
import { useAuth } from '../context/AuthContext'
import { HeroIllustration } from '../components/HeroIllustration'

export function RegisterPage() {
  const { register, loginWithGoogle } = useAuth()
  const navigate = useNavigate()

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [agreedToTerms, setAgreedToTerms] = useState(false)

  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const passwordRequirements = [
    {
      label: 'At least 8 characters',
      valid: password.length >= 8,
    },
    {
      label: 'One uppercase letter',
      valid: /[A-Z]/.test(password),
    },
    {
      label: 'One lowercase letter',
      valid: /[a-z]/.test(password),
    },
    {
      label: 'One number',
      valid: /\d/.test(password),
    },
  ]

  const isPasswordValid = passwordRequirements.every(
    (requirement) => requirement.valid,
  )

  const isFormValid =
    fullName.trim().length >= 2 &&
    email.trim().length > 0 &&
    isPasswordValid &&
    agreedToTerms

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    if (isSubmitting) return

    setError(null)

    const trimmedName = fullName.trim()
    const trimmedEmail = email.trim()

    if (trimmedName.length < 2) {
      setError('Please enter your full name.')
      return
    }

    if (!trimmedEmail) {
      setError('Please enter your email address.')
      return
    }

    if (!isPasswordValid) {
      setError('Please meet all password requirements.')
      return
    }

    if (!agreedToTerms) {
      setError('Please read and accept the Terms of Service and Privacy Policy.')
      return
    }

    setIsSubmitting(true)

    try {
      await register(trimmedEmail, password, trimmedName)
      navigate('/dashboard')
    } catch (err: any) {
      const detail = err?.response?.data?.detail
      if (typeof detail === 'string') {
        setError(detail)
      } else if (Array.isArray(detail)) {
        const messages = detail
          .map((item: any) => item?.msg || item)
          .filter(Boolean)
          .join(', ')
        setError(messages)
      } else if (err instanceof Error && err.message) {
        setError(err.message)
      } else {
        setError('Registration failed. Please check your details and try again.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleGoogleSuccess = async (
    credentialResponse: CredentialResponse,
  ) => {
    if (isSubmitting) return

    setError(null)
    setIsSubmitting(true)

    try {
      if (!credentialResponse.credential) {
        throw new Error('Google credential token is missing.')
      }

      await loginWithGoogle(credentialResponse.credential)
      navigate('/dashboard')
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : 'Failed to authenticate with Google. Please try again.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950">
      {/* ============================================================
          LEFT BRANDING PANEL
          ============================================================ */}
      <div className="hidden lg:flex lg:w-1/2 bg-indigo-600 text-white flex-col justify-between p-12">
        <div className="font-bold text-lg">
          ExitAI Ethiopia
        </div>

        <div className="max-w-md">
          <HeroIllustration className="w-64 h-64 mb-8" />

          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/10 px-3 py-1.5 text-xs font-medium text-white/80 mb-5">
            <ShieldCheck className="w-3.5 h-3.5" />
            Built for Ethiopian CS students
          </div>

          <h1 className="text-3xl font-bold leading-tight">
            Study smarter.
            <br />
            Pass your CS Exit Exam.
          </h1>

          <p className="text-white/70 mt-4 leading-relaxed">
            Practice with structured courses, exam-focused questions,
            tutoring, and progress tracking designed for Computer
            Science students preparing for the Ethiopian Ministry of
            Education exit exam.
          </p>

          <div className="mt-7 space-y-3 text-sm text-white/75">
            <div className="flex items-center gap-3">
              <span className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center">
                <Check className="w-3 h-3" />
              </span>
              16 Computer Science exit-exam courses
            </div>

            <div className="flex items-center gap-3">
              <span className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center">
                <Check className="w-3 h-3" />
              </span>
              Exam-focused practice and mock exams
            </div>

            <div className="flex items-center gap-3">
              <span className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center">
                <Check className="w-3 h-3" />
              </span>
              Study Assistant and personalized learning
            </div>
          </div>
        </div>

        <div className="text-sm text-white/50">
          Aligned with the MoE Computer Science Exit Exam competency framework
        </div>
      </div>

      {/* ============================================================
          RIGHT FORM PANEL
          ============================================================ */}
      <div className="flex-1 flex items-center justify-center px-4 py-10 sm:px-6 lg:px-10">
        <div className="w-full max-w-md">
          {/* Mobile branding */}
          <div className="text-center mb-8 lg:hidden">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-indigo-600 text-white mb-3 shadow-sm">
              <UserPlus className="w-6 h-6" />
            </div>

            <div className="font-bold text-2xl text-indigo-600">
              ExitAI Ethiopia
            </div>

            <div className="text-sm text-slate-500 mt-1">
              CS Exit Exam Preparation
            </div>
          </div>

          {/* Heading */}
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
              Create your account
            </h2>

            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5">
              Start studying today.
            </p>
          </div>

          {/* Main card */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-7 shadow-sm">
            {/* Error */}
            {error && (
              <div
                role="alert"
                className="mb-5 flex items-start gap-3 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl px-3.5 py-3"
              >
                <X className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Google Sign Up */}
            <div className="w-full flex justify-center">
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() =>
                  setError('Google sign-up was unsuccessful or cancelled.')
                }
                useOneTap={false}
                theme="outline"
                shape="rectangular"
                width="320"
                text="signup_with"
                size="large"
              />
            </div>

            {/* Divider */}
            <div className="relative flex items-center justify-center my-6">
              <div className="border-t border-slate-200 dark:border-slate-800 w-full" />

              <span className="absolute bg-white dark:bg-slate-900 px-3 text-xs text-slate-400 font-medium uppercase tracking-wider">
                or
              </span>
            </div>

            {/* Registration form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Full name */}
              <div>
                <label htmlFor="full-name" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Full name
                </label>

                <input
                  id="full-name"
                  type="text"
                  required
                  autoComplete="name"
                  className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                  value={fullName}
                  onChange={(e) => {
                    setFullName(e.target.value)
                    if (error) setError(null)
                  }}
                  placeholder="Your full name"
                  disabled={isSubmitting}
                />
              </div>

              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Email address
                </label>

                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    if (error) setError(null)
                  }}
                  placeholder="you@example.com"
                  disabled={isSubmitting}
                />
              </div>

              {/* Password */}
              <div>
                <label htmlFor="password" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Password
                </label>

                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="new-password"
                    className="w-full h-11 px-3 pr-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value)
                      if (error) setError(null)
                    }}
                    placeholder="Create a strong password"
                    disabled={isSubmitting}
                  />

                  <button
                    type="button"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    onClick={() => setShowPassword((current) => !current)}
                    disabled={isSubmitting}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors active:scale-95 disabled:opacity-50"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>

                {/* Password requirements */}
                {password.length > 0 && (
                  <div className="mt-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 p-3">
                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">
                      Password requirements
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {passwordRequirements.map((requirement) => (
                        <div
                          key={requirement.label}
                          className={`flex items-center gap-2 text-xs ${
                            requirement.valid
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-slate-500 dark:text-slate-500'
                          }`}
                        >
                          <span
                            className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${
                              requirement.valid
                                ? 'bg-emerald-500/10'
                                : 'bg-slate-200 dark:bg-slate-800'
                            }`}
                          >
                            {requirement.valid ? (
                              <Check className="w-2.5 h-2.5" />
                            ) : (
                              <span className="w-1 h-1 rounded-full bg-current" />
                            )}
                          </span>

                          {requirement.label}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Terms of Service Checkbox */}
              <div className="flex items-start gap-2.5 pt-1">
                <input
                  type="checkbox"
                  id="agree-terms"
                  checked={agreedToTerms}
                  onChange={(e) => {
                    setAgreedToTerms(e.target.checked)
                    if (error) setError(null)
                  }}
                  disabled={isSubmitting}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />

                <label htmlFor="agree-terms" className="text-xs leading-relaxed text-slate-500 dark:text-slate-400 cursor-pointer">
                  I agree to the{' '}
                  <Link
                    to="/terms"
                    target="_blank"
                    className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
                  >
                    Terms of Service
                  </Link>{' '}
                  and{' '}
                  <Link
                    to="/privacy"
                    target="_blank"
                    className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
                  >
                    Privacy Policy
                  </Link>
                </label>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isSubmitting || !isFormValid}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl transition active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20"
              >
                {isSubmitting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Creating account...
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    Create account
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Login link */}
          <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-5">
            Already have an account?{' '}
            <Link
              to="/login"
              className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
            >
              Sign in
            </Link>
          </p>

          {/* Footer */}
          <p className="text-center text-xs text-slate-400 dark:text-slate-500 mt-6">
            Your learning progress will be saved to your account.
          </p>
        </div>
      </div>
    </div>
  )
}

export default RegisterPage
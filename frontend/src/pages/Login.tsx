import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { HeroIllustration } from '../components/HeroIllustration'
import {
  Eye,
  EyeOff,
  ShieldCheck,
  Mail,
  Smartphone,
  ArrowLeft,
  ArrowRight,
  LockKeyhole,
  CheckCircle2,
  Loader2,
  BookOpen,
  Brain,
  Target,
} from 'lucide-react'
import {
  GoogleLogin,
  type CredentialResponse,
} from '@react-oauth/google'

const API_BASE_URL = import.meta.env.VITE_API_URL || ''

export function LoginPage() {
  const { login, loginWithGoogle } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [requires2FA, setRequires2FA] = useState(false)
  const [twoFACode, setTwoFACode] = useState('')
  const [trustDevice, setTrustDevice] = useState(true)
  const [twoFAMethod, setTwoFAMethod] = useState<'app' | 'email'>('app')
  const [emailCodeSent, setEmailCodeSent] = useState(false)

  const handleTwoFACodeChange = (value: string) => {
    setTwoFACode(value.replace(/[^0-9]/g, '').slice(0, 6))
  }

  const handle2FAVerify = async () => {
    if (twoFACode.length !== 6) {
      setError('Please enter a valid 6-digit code.')
      return
    }

    setError(null)
    setIsSubmitting(true)

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/2fa/login-verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
          code: twoFACode,
          trust_device: trustDevice,
        }),
      })

      const data = await response.json()

      if (response.ok && data.access_token) {
        const { setTokens } = await import('../api/client')
        setTokens(data.access_token, data.refresh_token)
        navigate('/dashboard')
      } else {
        setError(data.detail || 'Invalid 2FA code.')
      }
    } catch {
      setError('Failed to verify 2FA. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEmail2FASend = async () => {
    setError(null)
    setIsSubmitting(true)

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/2fa/email/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setEmailCodeSent(true)
      } else {
        setError(data.detail || 'Failed to send verification code.')
      }
    } catch {
      setError('Failed to send 2FA code. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEmail2FAVerify = async () => {
    if (twoFACode.length !== 6) {
      setError('Please enter a valid 6-digit code.')
      return
    }

    setError(null)
    setIsSubmitting(true)

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/2fa/email/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          code: twoFACode,
          trust_device: trustDevice,
        }),
      })

      const data = await response.json()

      if (response.ok && data.access_token) {
        const { setTokens } = await import('../api/client')
        setTokens(data.access_token, data.refresh_token)
        navigate('/dashboard')
      } else {
        setError(data.detail || 'Invalid verification code.')
      }
    } catch {
      setError('Failed to verify code. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleGoogleSuccess = async (credentialResponse: CredentialResponse) => {
    setError(null)
    setIsSubmitting(true)

    try {
      if (!credentialResponse.credential) {
        throw new Error('Google credential token missing')
      }

      await loginWithGoogle(credentialResponse.credential)
      navigate('/dashboard')
    } catch {
      setError('Google sign-in didn\'t work. Please try again or use email login.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handle2FABack = () => {
    setRequires2FA(false)
    setTwoFACode('')
    setError(null)
    setEmailCodeSent(false)
    setTwoFAMethod('app')
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      const result = await login(email, password)
      const resultData = (result as any)?.data || result

      if (resultData && resultData.requires_2fa === true) {
        setRequires2FA(true)
      } else {
        navigate('/dashboard')
      }
    } catch (err: any) {
      if (err?.response?.data?.detail) {
        setError(err.response.data.detail)
      } else if (err?.response?.status === 403) {
        setError('Your account has been deactivated. Please contact support to reactivate your account.')
      } else if (err?.message) {
        setError(err.message === 'Network Error' ? 'Connection issue. Check your internet and try again.' : err.message)
      } else {
        setError('Incorrect email or password.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex">
      {/* =========================================================
          DESKTOP BRAND PANEL
      ========================================================== */}
      <aside className="hidden lg:flex lg:w-[46%] xl:w-1/2 relative overflow-hidden bg-gradient-to-br from-slate-950 via-indigo-950 to-indigo-900 text-white">
        {/* Background decoration */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-indigo-500/20 blur-3xl" />
          <div className="absolute -bottom-40 -right-20 w-[32rem] h-[32rem] rounded-full bg-purple-500/20 blur-3xl" />
          <div className="absolute top-24 right-20 w-2 h-2 rounded-full bg-white/40" />
          <div className="absolute top-44 right-36 w-1.5 h-1.5 rounded-full bg-indigo-300/60" />
          <div className="absolute bottom-32 left-24 w-2 h-2 rounded-full bg-purple-300/40" />
          <div className="absolute inset-0 opacity-[0.04]">
            <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="login-grid" width="42" height="42" patternUnits="userSpaceOnUse">
                  <path d="M 42 0 L 0 0 0 42" fill="none" stroke="white" strokeWidth="1" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#login-grid)" />
            </svg>
          </div>
        </div>

        <div className="relative z-10 w-full flex flex-col justify-between p-10 xl:p-14">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/15 backdrop-blur-xl flex items-center justify-center shadow-lg">
              <Brain className="w-5 h-5 text-indigo-200" />
            </div>
            <div>
              <div className="font-bold text-lg tracking-tight">ExitAI Ethiopia</div>
              <div className="text-[10px] text-white/45 uppercase tracking-[0.18em] font-semibold">CS Exit Exam Platform</div>
            </div>
          </div>

          {/* Main hero */}
          <div className="max-w-xl py-10">
            <HeroIllustration className="w-60 h-60 xl:w-72 xl:h-72 mb-5" />

            <h1 className="text-4xl xl:text-5xl font-bold tracking-tight leading-[1.08]">
              Study smarter
              <br />
              for your CS Exit Exam.
            </h1>

            <p className="mt-5 max-w-lg text-sm xl:text-base text-white/65 leading-7">
              Study with structured notes, tutoring, practice questions,
              flashcards, and exam-focused learning built around the
              Ethiopian Computer Science Exit Exam.
            </p>

            {/* Feature highlights */}
            <div className="mt-8 grid grid-cols-3 gap-3 max-w-lg">
              <div className="rounded-2xl border border-white/10 bg-white/[0.06] backdrop-blur-sm p-3.5">
                <BookOpen className="w-4 h-4 text-indigo-300 mb-2" />
                <p className="text-xs font-bold text-white">Structured Notes</p>
                <p className="text-[10px] text-white/45 mt-1">Exam-focused</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.06] backdrop-blur-sm p-3.5">
                <Brain className="w-4 h-4 text-purple-300 mb-2" />
                <p className="text-xs font-bold text-white">Study Assistant</p>
                <p className="text-[10px] text-white/45 mt-1">Learn interactively</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.06] backdrop-blur-sm p-3.5">
                <Target className="w-4 h-4 text-emerald-300 mb-2" />
                <p className="text-xs font-bold text-white">Track Progress</p>
                <p className="text-[10px] text-white/45 mt-1">Know your readiness</p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-6 text-[11px] text-white/35">
            <span>Aligned with the Ministry of Education CS competency framework</span>
            <span className="hidden xl:inline-flex items-center gap-1.5 whitespace-nowrap">
              <ShieldCheck className="w-3.5 h-3.5" />
              Secure authentication
            </span>
          </div>
        </div>
      </aside>

      {/* =========================================================
          AUTH AREA
      ========================================================== */}
      <main className="flex-1 min-h-screen flex items-center justify-center px-4 py-8 sm:px-6 lg:px-10">
        <div className="w-full max-w-md">
          {/* Mobile brand */}
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-600/20">
                <Brain className="w-5 h-5" />
              </div>
              <div className="text-left">
                <div className="font-bold text-xl text-slate-900 dark:text-white tracking-tight">ExitAI Ethiopia</div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">CS Exit Exam Preparation</div>
              </div>
            </div>
          </div>

          {/* =====================================================
              LOGIN / 2FA CARD
          ====================================================== */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-xl shadow-slate-200/40 dark:shadow-black/20 overflow-hidden">
            {/* Card header */}
            <div className="px-6 pt-7 pb-5 sm:px-8 sm:pt-8">
              {requires2FA ? (
                <>
                  <button
                    type="button"
                    onClick={handle2FABack}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors mb-6"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Back to sign in
                  </button>

                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 shrink-0 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-100 dark:border-emerald-900/50">
                      <ShieldCheck className="w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Verify your identity</h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">Two-factor authentication is enabled for your account.</p>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-indigo-600 dark:text-indigo-400">Welcome back</p>
                      <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight mt-1">Sign in to study</h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">Continue your Exit Exam preparation.</p>
                    </div>
                    <div className="hidden sm:flex w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 items-center justify-center">
                      <LockKeyhole className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="mx-6 sm:mx-8 mb-4">
                <div
                  role="alert"
                  className="flex items-start gap-2.5 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 px-3.5 py-3 text-xs text-red-700 dark:text-red-300"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 shrink-0" />
                  <span className="leading-relaxed">
                    {error}
                    {error?.includes('deactivated') && (
                      <span className="block mt-1">
                        <Link
                          to="/support"
                          className="font-semibold text-red-700 dark:text-red-300 underline hover:text-red-900 dark:hover:text-red-100"
                        >
                          Contact Support
                        </Link>
                        {' '}to request reactivation.
                      </span>
                    )}
                  </span>
                </div>
              </div>
            )}

            <div className="px-6 pb-6 sm:px-8 sm:pb-8">
              {requires2FA ? (
                <div className="space-y-5">
                  {/* 2FA method selector */}
                  <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800">
                    <button
                      type="button"
                      onClick={() => {
                        setTwoFAMethod('app')
                        setEmailCodeSent(false)
                        setTwoFACode('')
                        setError(null)
                      }}
                      className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold transition-all ${
                        twoFAMethod === 'app'
                          ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      <Smartphone className="w-3.5 h-3.5" />
                      Authenticator
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTwoFAMethod('email')
                        setTwoFACode('')
                        setError(null)
                      }}
                      className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold transition-all ${
                        twoFAMethod === 'email'
                          ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      <Mail className="w-3.5 h-3.5" />
                      Email
                    </button>
                  </div>

                  {twoFAMethod === 'app' ? (
                    <>
                      <div className="text-center">
                        <p className="text-xs text-slate-500 dark:text-slate-400">Enter the 6-digit code from your authenticator app.</p>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2 text-center">Authentication code</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          maxLength={6}
                          placeholder="000000"
                          value={twoFACode}
                          onChange={(e) => handleTwoFACodeChange(e.target.value)}
                          autoFocus
                          className="w-full h-14 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-slate-900 dark:text-white text-center text-2xl tracking-[0.45em] font-mono font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600"
                        />
                      </div>

                      <label className="flex items-start gap-3 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={trustDevice}
                          onChange={(e) => setTrustDevice(e.target.checked)}
                          className="mt-0.5 h-4 w-4 rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span>
                          <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Trust this device</span>
                          <span className="block text-[10px] text-slate-400 mt-0.5">Don't ask for a verification code for 30 days.</span>
                        </span>
                      </label>

                      <button
                        type="button"
                        onClick={handle2FAVerify}
                        disabled={isSubmitting || twoFACode.length !== 6}
                        className="w-full h-12 inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold shadow-lg shadow-indigo-600/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Verifying...
                          </>
                        ) : (
                          <>
                            Verify & Sign In
                            <ArrowRight className="w-4 h-4" />
                          </>
                        )}
                      </button>
                    </>
                  ) : (
                    <>
                      {!emailCodeSent ? (
                        <>
                          <div className="rounded-2xl border border-indigo-100 dark:border-indigo-900/50 bg-indigo-50/70 dark:bg-indigo-950/20 p-4">
                            <div className="flex items-start gap-3">
                              <div className="w-9 h-9 rounded-xl bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                                <Mail className="w-4 h-4" />
                              </div>
                              <div>
                                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Verify by email</p>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                                  We'll send a 6-digit verification code to
                                  <span className="font-semibold text-slate-700 dark:text-slate-300"> {email}</span>.
                                </p>
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={handleEmail2FASend}
                            disabled={isSubmitting}
                            className="w-full h-12 inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold shadow-lg shadow-indigo-600/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isSubmitting ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Sending code...
                              </>
                            ) : (
                              <>
                                Send verification code
                                <ArrowRight className="w-4 h-4" />
                              </>
                            )}
                          </button>
                        </>
                      ) : (
                        <>
                          <div className="text-center">
                            <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-3">
                              <Mail className="w-5 h-5" />
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Code sent to</p>
                            <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-1 break-all">{email}</p>
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2 text-center">Verification code</label>
                            <input
                              type="text"
                              inputMode="numeric"
                              autoComplete="one-time-code"
                              maxLength={6}
                              placeholder="000000"
                              value={twoFACode}
                              onChange={(e) => handleTwoFACodeChange(e.target.value)}
                              autoFocus
                              className="w-full h-14 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-slate-900 dark:text-white text-center text-2xl tracking-[0.45em] font-mono font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600"
                            />
                          </div>

                          <label className="flex items-start gap-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={trustDevice}
                              onChange={(e) => setTrustDevice(e.target.checked)}
                              className="mt-0.5 h-4 w-4 rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500"
                            />
                            <span>
                              <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Trust this device</span>
                              <span className="block text-[10px] text-slate-400 mt-0.5">For 30 days</span>
                            </span>
                          </label>

                          <button
                            type="button"
                            onClick={handleEmail2FAVerify}
                            disabled={isSubmitting || twoFACode.length !== 6}
                            className="w-full h-12 inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold shadow-lg shadow-indigo-600/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isSubmitting ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Verifying...
                              </>
                            ) : (
                              <>
                                Verify & Sign In
                                <ArrowRight className="w-4 h-4" />
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={handleEmail2FASend}
                            disabled={isSubmitting}
                            className="w-full text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                          >
                            Resend verification code
                          </button>
                        </>
                      )}
                    </>
                  )}

                  <div className="flex items-center justify-center gap-2 pt-1 text-[10px] text-slate-400">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Your account is protected with two-factor authentication.
                  </div>
                </div>
              ) : (
                <>
                  {/* =================================================
                      LOGIN FORM
                  ================================================== */}
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label htmlFor="email" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Email address</label>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                        <input
                          id="email"
                          type="email"
                          required
                          autoComplete="email"
                          className="w-full h-11 pl-10 pr-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/60 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                          placeholder="you@example.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label htmlFor="password" className="block text-xs font-bold text-slate-700 dark:text-slate-300">Password</label>
                        <Link to="/forgot-password" className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors">
                          Forgot password?
                        </Link>
                      </div>
                      <div className="relative">
                        <LockKeyhole className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                        <input
                          id="password"
                          type={showPassword ? 'text' : 'password'}
                          required
                          autoComplete="current-password"
                          className="w-full h-11 pl-10 pr-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/60 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                          placeholder="Enter your password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                          className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full h-12 inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold shadow-lg shadow-indigo-600/20 hover:shadow-indigo-600/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Signing in...
                        </>
                      ) : (
                        <>
                          Sign In
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>

                    {/* Register prompt */}
                    <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 pt-1">
                      <span>Don't have an account?</span>
                      <Link to="/register" className="font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors">
                        Create account
                      </Link>
                    </div>
                  </form>

                  {/* Divider */}
                  <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-slate-200 dark:border-slate-800" />
                    </div>
                    <div className="relative flex justify-center">
                      <span className="px-3 bg-white dark:bg-slate-900 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Or continue with</span>
                    </div>
                  </div>

                  {/* Google */}
                  <div className="flex justify-center min-h-[40px]">
                    <GoogleLogin
                      onSuccess={handleGoogleSuccess}
                      onError={() => setError('Google sign-in failed.')}
                      width="100%"
                    />
                  </div>

                  {/* Security note */}
                  <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-center gap-2 text-[10px] text-slate-400 dark:text-slate-500">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Your account information is securely protected.</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Terms and Privacy Links */}
          <p className="text-center text-xs text-slate-400 dark:text-slate-500 mt-5">
            By signing in, you agree to our{' '}
            <Link to="/terms" className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline">
              Terms of Service
            </Link>
            {' '}and{' '}
            <Link to="/privacy" className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline">
              Privacy Policy
            </Link>
          </p>

          {/* Bottom mobile trust */}
          <div className="lg:hidden mt-4 flex items-center justify-center gap-2 text-[10px] text-slate-400 dark:text-slate-500">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            Built for Ethiopian Computer Science students
          </div>
        </div>
      </main>
    </div>
  )
}

export default LoginPage
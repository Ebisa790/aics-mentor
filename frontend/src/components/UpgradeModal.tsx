import { useCallback, useEffect, useState } from 'react'
import axios from 'axios'
import {
  Check,
  Crown,
  Lock,
  ShieldCheck,
  Sparkles,
  X,
  Zap,
} from 'lucide-react'
import { paymentApi, type PricingPlan } from '../api'

interface UpgradeModalProps {
  isOpen: boolean
  onClose: () => void
  customMessage?: string | null
}

export function UpgradeModal({
  isOpen,
  onClose,
  customMessage,
}: UpgradeModalProps) {
  const [pricing, setPricing] = useState<PricingPlan | null>(null)
  const [loading, setLoading] = useState(false)
  const [initializing, setInitializing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /*
   * Fetch live pricing whenever the modal opens.
   */
  useEffect(() => {
    if (!isOpen) return

    let isMounted = true

    setLoading(true)
    setError(null)

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    paymentApi
      .getPricing()
      .then((data) => {
        if (!isMounted) return

        const primaryPlan = Array.isArray(data) ? data[0] : data

        setPricing(primaryPlan ?? null)
      })
      .catch((err) => {
        if (!isMounted) return

        console.error('Failed to fetch pricing:', err)

        setPricing(null)
        setError(
          'We could not load the latest pricing. Please try again.'
        )
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false)
        }
      })

    return () => {
      isMounted = false
      document.body.style.overflow = previousOverflow
    }
  }, [isOpen])

  /*
   * ESC closes the modal unless payment initialization is in progress.
   */
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen && !initializing) {
        onClose()
      }
    },
    [isOpen, initializing, onClose]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleKeyDown])

  /*
   * Prevent background interaction while the modal is open.
   */
  useEffect(() => {
    if (!isOpen) return

    const handleTabKey = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return

      const modal = document.getElementById('upgrade-modal')

      if (!modal) return

      const focusableElements = modal.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])'
      )

      if (!focusableElements.length) return

      const firstElement = focusableElements[0]
      const lastElement = focusableElements[focusableElements.length - 1]

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault()
        lastElement.focus()
      } else if (
        !event.shiftKey &&
        document.activeElement === lastElement
      ) {
        event.preventDefault()
        firstElement.focus()
      }
    }

    document.addEventListener('keydown', handleTabKey)

    return () => {
      document.removeEventListener('keydown', handleTabKey)
    }
  }, [isOpen])

  if (!isOpen) {
    return null
  }

  /*
   * Initialize Chapa checkout.
   */
  const handleCheckout = async () => {
    if (!pricing?.id) {
      setError(
        'No active pricing plan is available. Please try again later.'
      )
      return
    }

    setInitializing(true)
    setError(null)

    try {
      const response = await paymentApi.initializePayment({
        plan_id: pricing.id,
      })

      if (!response?.checkout_url) {
        throw new Error(
          'Checkout URL was not returned by the server.'
        )
      }

      /*
       * Redirect to Chapa's hosted checkout page.
       */
      window.location.href = response.checkout_url
    } catch (err: unknown) {
      console.error('Payment initialization failed:', err)

      setInitializing(false)

      if (axios.isAxiosError(err)) {
        const detail = err.response?.data?.detail

        if (typeof detail === 'string') {
          setError(detail)
        } else if (
          Array.isArray(detail) &&
          detail.length > 0 &&
          detail[0]?.msg
        ) {
          setError(detail[0].msg)
        } else {
          setError(
            'Unable to start the payment. Please check your connection and try again.'
          )
        }

        return
      }

      if (err instanceof Error) {
        setError(err.message)
        return
      }

      setError(
        'Something went wrong while starting your payment. Please try again.'
      )
    }
  }

  const defaultFeatures = [
    'Unlimited quizzes with no 3-hour cooldown',
    '100-question Exit Exam Simulator',
    'Full access to all 16 CS course notes',
    'AI Tutor with personalized explanations',
    'Advanced analytics and readiness score',
    'Previous exam practice and targeted review',
  ]

  const featuresToDisplay =
    pricing?.features && pricing.features.length > 0
      ? pricing.features
      : defaultFeatures

  const planName = pricing?.name || 'Lifetime Premium'

  const amount = pricing?.amount || 500

  const currency = pricing?.currency || 'ETB'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="upgrade-modal-title"
      aria-describedby="upgrade-modal-description"
      onMouseDown={(event) => {
        if (
          event.target === event.currentTarget &&
          !initializing
        ) {
          onClose()
        }
      }}
    >
      <div
        id="upgrade-modal"
        className="relative w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl"
      >
        {/* Header */}
        <div className="relative overflow-hidden px-6 pt-6 pb-5 sm:px-7 sm:pt-7">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-amber-400" />

          <button
            type="button"
            onClick={onClose}
            disabled={initializing}
            aria-label="Close upgrade dialog"
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:pointer-events-none disabled:opacity-40 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="flex items-start gap-4 pr-8">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 via-purple-500 to-indigo-600 shadow-lg shadow-purple-500/20">
              <Crown className="h-6 w-6 fill-white text-white" />
            </div>

            <div>
              <div className="mb-1 flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
                  <Sparkles className="h-3 w-3" />
                  Premium
                </span>
              </div>

              <h2
                id="upgrade-modal-title"
                className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white"
              >
                Upgrade your preparation
              </h2>

              <p
                id="upgrade-modal-description"
                className="mt-1.5 text-sm leading-relaxed text-slate-500 dark:text-slate-400"
              >
                {customMessage ||
                  'Unlock the complete Exit Exam preparation experience and study without limits.'}
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 pb-6 sm:px-7 sm:pb-7">
          {loading ? (
            <div className="space-y-5">
              {/* Pricing skeleton */}
              <div className="animate-pulse rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950">
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-2">
                    <div className="h-3 w-24 rounded bg-slate-200 dark:bg-slate-800" />
                    <div className="h-3 w-40 rounded bg-slate-200 dark:bg-slate-800" />
                  </div>

                  <div className="h-8 w-24 rounded bg-slate-200 dark:bg-slate-800" />
                </div>
              </div>

              {/* Feature skeleton */}
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((item) => (
                  <div
                    key={item}
                    className="flex items-center gap-3 animate-pulse"
                  >
                    <div className="h-5 w-5 rounded-full bg-slate-200 dark:bg-slate-800" />
                    <div
                      className={`h-3 rounded bg-slate-200 dark:bg-slate-800 ${
                        item % 2 === 0 ? 'w-3/4' : 'w-5/6'
                      }`}
                    />
                  </div>
                ))}
              </div>

              <div className="py-2 text-center">
                <p className="text-xs font-medium text-slate-400">
                  Loading current pricing...
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Pricing card */}
              <div className="relative overflow-hidden rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-5 dark:border-indigo-500/20 dark:from-indigo-950/40 dark:via-slate-900 dark:to-purple-950/30">
                <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-purple-500/10 blur-2xl" />

                <div className="relative flex items-center justify-between gap-4">
                  <div>
                    <div className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                      <Zap className="h-3.5 w-3.5 fill-amber-400 text-amber-500" />
                      {planName}
                    </div>

                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      One-time payment
                    </p>

                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Lifetime access
                    </p>
                  </div>

                  <div className="text-right">
                    <div className="text-2xl font-black tracking-tight text-indigo-600 dark:text-indigo-400">
                      {amount} {currency}
                    </div>

                    <div className="text-[10px] font-medium text-slate-400">
                      Pay once
                    </div>
                  </div>
                </div>
              </div>

              {/* Features */}
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Everything included
                  </h3>

                  <span className="text-[11px] font-medium text-slate-400">
                    Lifetime access
                  </span>
                </div>

                <ul className="grid gap-2.5 sm:grid-cols-2">
                  {featuresToDisplay.map((feature, index) => (
                    <li
                      key={`${feature}-${index}`}
                      className="flex items-start gap-2.5 rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-950/50"
                    >
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
                        <Check className="h-3 w-3" strokeWidth={3} />
                      </span>

                      <span className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Error */}
              {error && (
                <div
                  role="alert"
                  className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-xs leading-relaxed text-red-600 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-400"
                >
                  {error}
                </div>
              )}

              {/* Security information */}
              <div className="flex items-center justify-center gap-2 text-center text-[11px] text-slate-400 dark:text-slate-500">
                <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-500" />

                <span>
                  Secure payment powered by Chapa
                </span>
              </div>

              {/* Checkout */}
              <button
                type="button"
                onClick={handleCheckout}
                disabled={initializing || !pricing?.id}
                className="group flex w-full items-center justify-center gap-2.5 rounded-xl bg-indigo-600 px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-indigo-500/20 transition hover:bg-indigo-700 hover:shadow-indigo-500/30 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:focus:ring-offset-slate-900"
              >
                {initializing ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    <span>Redirecting to secure checkout...</span>
                  </>
                ) : (
                  <>
                    <Lock className="h-4 w-4 transition-transform group-hover:scale-110" />

                    <span>
                      Pay {amount} {currency} with Chapa
                    </span>
                  </>
                )}
              </button>

              {/* Bottom reassurance */}
              <p className="text-center text-[10px] leading-relaxed text-slate-400 dark:text-slate-500">
                You will be redirected to Chapa's secure hosted payment
                page to complete your purchase.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default UpgradeModal
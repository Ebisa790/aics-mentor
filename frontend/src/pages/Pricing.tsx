import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import axios from 'axios'
import { 
  Crown, 
  Check, 
  ShieldCheck, 
  Loader2,
  ArrowLeft
} from 'lucide-react'
import { paymentApi, type PricingPlan } from '../api'
import { useAuth } from '../context/AuthContext'

export function PricingPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { isPremium, refreshUser } = useAuth()
  const [pricing, setPricing] = useState<PricingPlan | null>(null)
  const [loading, setLoading] = useState(true)
  const [initializing, setInitializing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reason = searchParams.get('reason')

  useEffect(() => {
    fetchPricing()
  }, [])

  const fetchPricing = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await paymentApi.getPricing()
      const primaryPlan = Array.isArray(data) ? data[0] : data
      setPricing(primaryPlan ?? null)
    } catch (err: unknown) {
      console.error('Failed to fetch pricing:', err)
      setError('Could not load pricing information. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleCheckout = async () => {
    if (!pricing?.id) {
      setError('No active pricing plan found. Please contact support.')
      return
    }

    setInitializing(true)
    setError(null)

    try {
      // Refresh user data to ensure valid token
      await refreshUser()
      
      const res = await paymentApi.initializePayment({ plan_id: pricing.id })

      if (res?.checkout_url) {
        // Redirect to Chapa checkout
        window.location.href = res.checkout_url
      } else {
        throw new Error('Checkout URL was not returned. Please try again.')
      }
    } catch (err: unknown) {
      setInitializing(false)
      
      if (axios.isAxiosError(err)) {
        const status = err.response?.status
        const detail = err.response?.data?.detail
        
        if (status === 401) {
          setError('Your session has expired. Please log in again.')
          // Redirect to login after 2 seconds
          setTimeout(() => navigate('/login'), 2000)
        } else if (typeof detail === 'string') {
          setError(detail)
        } else if (typeof detail === 'object' && detail !== null) {
          // Handle object detail (like cooldown errors)
          const detailObj = detail as any
          setError(detailObj.message || 'Failed to initialize payment.')
        } else {
          setError('Failed to initialize payment. Please try again.')
        }
      } else if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('An unexpected error occurred.')
      }
    }
  }

  const defaultFeatures = [
    'Unlimited quizzes (no cooldown)',
    '100-question Exit Exam Simulator',
    'Full access to all 16 CS course notes',
    'Study Assistant for explanations',
    'Advanced analytics and readiness score',
    'Previous exam practice and review',
  ]

  const featuresToDisplay: string[] = pricing?.features?.length ? pricing.features : defaultFeatures

  if (isPremium) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 sm:px-6 bg-gradient-to-b from-indigo-50 to-white">
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl max-w-md w-full p-8 text-center border border-indigo-100">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Crown className="w-8 h-8 text-amber-500 fill-amber-500" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">You have Premium</h1>
          <p className="text-gray-600 mt-2 text-sm">
            You already have full access to all premium features.
          </p>
          <button
            onClick={() => navigate('/dashboard')}
            className="mt-6 w-full bg-indigo-600 text-white font-semibold py-3 rounded-xl hover:bg-indigo-700 transition"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 bg-gradient-to-b from-indigo-50 to-white">
      <div className="max-w-2xl mx-auto">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center text-sm text-slate-600 dark:text-slate-400 hover:text-indigo-600 mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back
        </button>

        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 text-xs font-bold text-indigo-600 bg-indigo-100 px-3 py-1 rounded-full uppercase tracking-wider mb-4">
            <Crown className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
            Premium
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
            Get Full Access
          </h1>
          <p className="text-gray-600 mt-3 text-sm md:text-base">
            One-time payment. Lifetime access.
          </p>
        </div>

        {reason && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-4 mb-6 text-sm">
            {reason === 'mock_exam_upgrade' && 'Upgrade to access the Mock Exam Simulator.'}
            {reason === 'quiz_limit' && 'Upgrade for unlimited quizzes with no cooldown.'}
            {reason === 'notes_limit' && 'Upgrade for full course notes.'}
            {reason === 'ai_limit' && 'Upgrade for unlimited Study Assistant access.'}
          </div>
        )}

        {loading ? (
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl p-12 text-center">
            <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mx-auto" />
            <p className="text-gray-500 mt-4 text-sm">Loading pricing...</p>
          </div>
        ) : error && !pricing ? (
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl p-8 text-center">
            <p className="text-red-600 text-sm">{error}</p>
            <button
              onClick={fetchPricing}
              className="mt-4 px-4 py-2 bg-indigo-600 text-white text-sm rounded-xl hover:bg-indigo-700"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl overflow-hidden border border-indigo-100">
            {/* Plan Header - Uses dynamic pricing from database */}
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-8 text-center text-white">
              <h2 className="text-xl font-bold mb-2">{pricing?.name || 'Premium'}</h2>
              
              {/* Show actual amount from database - NO hardcoded fallback */}
              {pricing ? (
                <div className="text-4xl font-black">
                  {pricing.amount} <span className="text-lg">{pricing.currency}</span>
                </div>
              ) : (
                <div className="text-4xl font-black">
                  <Loader2 className="w-8 h-8 animate-spin inline" />
                </div>
              )}
              
              <p className="text-indigo-200 text-sm mt-2">One-time payment · Lifetime access</p>
            </div>

            <div className="p-8">
              {/* Features */}
              <ul className="space-y-3">
                {featuresToDisplay.map((feature: string, idx: number) => (
                  <li key={idx} className="flex items-start gap-3 text-sm text-gray-700">
                    <Check className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <div className="flex items-center justify-center gap-4 mt-6 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  Secure Payment
                </span>
              </div>

              {error && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl">
                  {error}
                </div>
              )}

              <button
                onClick={handleCheckout}
                disabled={initializing || !pricing}
                className="w-full mt-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl transition shadow-lg shadow-indigo-500/20 disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {initializing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Redirecting...</span>
                  </>
                ) : (
                  <>
                    <Crown className="w-5 h-5 fill-amber-400 text-amber-400" />
                    <span>
                      Pay {pricing?.amount} {pricing?.currency} with Chapa
                    </span>
                  </>
                )}
              </button>

              <p className="text-center text-xs text-slate-400 mt-4">
                Pay securely via Chapa (Telebirr, CBE, Awash, etc.)
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
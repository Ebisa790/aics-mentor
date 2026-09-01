import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import axios from 'axios'
import { 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  ArrowRight, 
  RotateCcw, 
  LayoutDashboard,
  Crown
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { paymentApi } from '../api'

export function PaymentCallbackPage() {
  const [searchParams] = useSearchParams()
  const txRef = searchParams.get('tx_ref')
  const navigate = useNavigate()
  const { refreshUser } = useAuth()

  const [status, setStatus] = useState<'loading' | 'success' | 'failed'>('loading')
  const [message, setMessage] = useState('Verifying your payment...')
  const [countdown, setCountdown] = useState(5)
  const [retryCount, setRetryCount] = useState(0)
  const mountedRef = useRef(true)

  const verifyPaymentOnce = useCallback(async () => {
    if (!txRef) {
      setStatus('failed')
      setMessage('Invalid or missing transaction reference.')
      return
    }

    try {
      // Refresh user token first to ensure valid session
      await refreshUser().catch(() => {})
      
      const res = await paymentApi.verifyPayment(txRef)
      
      if (!mountedRef.current) return

      const statusValue = String(res?.status || '').toLowerCase()
      const isSuccessful = statusValue === 'success' || statusValue === 'completed'

      if (isSuccessful) {
        setStatus('success')
        setMessage('Payment verified. Your account now has Premium access.')
        
        // IMPORTANT: Refresh user data and wait for it to complete
        try {
          await refreshUser()
        } catch (refreshError) {
          console.error('Failed to refresh user after payment:', refreshError)
        }
        
        // Do NOT navigate immediately - wait for countdown
        // The countdown effect will handle navigation
      } else {
        setStatus('failed')
        setMessage(res.message || 'Payment was not completed. You can try again.')
      }
    } catch (err: unknown) {
      if (!mountedRef.current) return
      
      // If 401, try again with refreshed token
      if (axios.isAxiosError(err) && err.response?.status === 401 && retryCount < 2) {
        setRetryCount(prev => prev + 1)
        setMessage('Session expired. Refreshing and retrying...')
        setTimeout(() => {
          verifyPaymentOnce()
        }, 1000)
        return
      }
      
      setStatus('failed')

      if (axios.isAxiosError(err)) {
        const detail = err.response?.data?.detail
        if (typeof detail === 'string') {
          setMessage(detail)
        } else {
          setMessage('Could not verify your payment. Please try again.')
        }
      } else {
        setMessage('An unexpected error occurred during payment verification.')
      }
    }
  }, [txRef, refreshUser, retryCount])

  useEffect(() => {
    mountedRef.current = true
    verifyPaymentOnce()
    return () => {
      mountedRef.current = false
    }
  }, [verifyPaymentOnce])

  useEffect(() => {
    if (status !== 'success') return

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          // Navigate to dashboard directly
          navigate('/dashboard', { replace: true })
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [status, navigate])

  const handleManualRedirect = () => {
    // Use replace to prevent back button issues
    navigate('/dashboard', { replace: true })
  }

  const handleTryAgain = () => {
    setStatus('loading')
    setRetryCount(0)
    navigate('/pricing')
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[75vh] px-4 text-center">
      <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-xl max-w-md w-full border border-gray-100 dark:border-gray-700 transition-all">
        
        {status === 'loading' && (
          <div className="space-y-4 py-4">
            <Loader2 className="w-12 h-12 text-indigo-600 dark:text-indigo-400 animate-spin mx-auto" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Verifying Payment</h2>
            <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">{message}</p>
            {retryCount > 0 && (
              <p className="text-xs text-amber-600">Retry attempt {retryCount}/2</p>
            )}
          </div>
        )}

        {status === 'success' && (
          <div className="space-y-4 py-2">
            <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10 shrink-0" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Payment Successful</h2>
            <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">{message}</p>

            <div className="inline-flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 px-3 py-1.5 rounded-full text-xs font-bold">
              <Crown className="w-3.5 h-3.5 fill-amber-500" />
              Premium Active
            </div>

            <button
              onClick={handleManualRedirect}
              className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 px-4 rounded-xl transition cursor-pointer shadow-md hover:shadow-lg flex items-center justify-center gap-2"
            >
              <span>Go to Dashboard</span>
              <span className="text-xs opacity-80">({countdown}s)</span>
              <ArrowRight className="w-4 h-4 shrink-0" />
            </button>
          </div>
        )}

        {status === 'failed' && (
          <div className="space-y-4 py-2">
            <div className="w-16 h-16 bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded-full flex items-center justify-center mx-auto">
              <XCircle className="w-10 h-10 shrink-0" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Payment Not Completed</h2>
            <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">{message}</p>
            
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => navigate('/dashboard')}
                className="flex-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-semibold py-2.5 px-4 rounded-xl transition cursor-pointer flex items-center justify-center gap-2 text-sm"
              >
                <LayoutDashboard className="w-4 h-4 shrink-0" />
                <span>Dashboard</span>
              </button>
              <button
                onClick={handleTryAgain}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 px-4 rounded-xl transition cursor-pointer shadow-md hover:shadow-lg flex items-center justify-center gap-2 text-sm"
              >
                <RotateCcw className="w-4 h-4 shrink-0" />
                <span>Try Again</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
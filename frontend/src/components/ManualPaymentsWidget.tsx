import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, ArrowRight } from 'lucide-react'
import { manualPaymentApi } from '../api'

export function ManualPaymentsWidget() {
  const [count, setCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    try {
      const res = await manualPaymentApi.adminStats()
      setCount(res.pending_count)
    } catch (err) {
      // Silent — widget is decorative, never blocks the admin dashboard.
      console.warn('Failed to load manual payment stats:', err)
      setCount(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // Refresh every 60s while the dashboard is open.
    const interval = window.setInterval(load, 60_000)
    return () => window.clearInterval(interval)
  }, [])

  // Hide entirely while loading the first time.
  if (loading) return null

  // Hide when nothing is pending (or when the request failed).
  if (count === null || count === 0) return null

  const isUrgent = count >= 4

  const style = isUrgent
    ? {
        wrapper:
          'border-rose-300 bg-rose-50 dark:border-rose-500/40 dark:bg-rose-500/10',
        icon: 'text-rose-600 dark:text-rose-400',
        title: 'text-rose-900 dark:text-rose-200',
        sub: 'text-rose-800/80 dark:text-rose-200/80',
        button:
          'bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-600/20',
      }
    : {
        wrapper:
          'border-amber-300 bg-amber-50 dark:border-amber-500/40 dark:bg-amber-500/10',
        icon: 'text-amber-600 dark:text-amber-400',
        title: 'text-amber-900 dark:text-amber-200',
        sub: 'text-amber-800/80 dark:text-amber-200/80',
        button:
          'bg-amber-600 hover:bg-amber-700 text-white shadow-lg shadow-amber-600/20',
      }

  return (
    <div
      className={`rounded-2xl border-2 p-5 flex flex-col sm:flex-row sm:items-center gap-4 ${style.wrapper}`}
    >
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <div className={`shrink-0 mt-0.5 ${style.icon}`}>
          <AlertCircle className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <p className={`font-bold text-base ${style.title}`}>
            {count} manual {count === 1 ? 'payment' : 'payments'} awaiting verification
          </p>
          <p className={`text-sm mt-0.5 ${style.sub}`}>
            Approve to activate Premium for the {count === 1 ? 'student' : 'students'}.
          </p>
        </div>
      </div>

      <Link
        to="/admin/manual-payments"
        className={`shrink-0 inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold transition active:scale-95 ${style.button}`}
      >
        Review Now
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  )
}

export default ManualPaymentsWidget
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  Clock,
  Loader2,
  AlertCircle,
  Smartphone,
  Trash2,
  XCircle,
  X,
  type LucideIcon,
} from 'lucide-react'
import { manualPaymentApi, type ManualPaymentStatusItem, type ManualBank } from '../api'
import { formatMoney } from '../utils/format'

const bankDisplay: Record<ManualBank, string> = {
  cbe: 'CBE',
  telebirr: 'Telebirr',
  awash: 'Awash Bank',
}

const bankIcon: Record<ManualBank, LucideIcon> = {
  cbe: Building2,
  telebirr: Smartphone,
  awash: Building2,
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

// Per-status presentation (label, icon, tone)
type StatusTone = 'amber' | 'emerald' | 'rose' | 'slate'

function getStatusPresentation(status: string): {
  label: string
  Icon: LucideIcon
  tone: StatusTone
} {
  switch (status) {
    case 'pending':
      return { label: 'Pending review', Icon: Clock, tone: 'amber' }
    case 'success':
      return { label: 'Approved', Icon: CheckCircle2, tone: 'emerald' }
    case 'failed':
      return { label: 'Not verified', Icon: XCircle, tone: 'rose' }
    case 'cancelled':
      return { label: 'Cancelled', Icon: XCircle, tone: 'slate' }
    case 'expired':
      return { label: 'Expired', Icon: Clock, tone: 'slate' }
    default:
      return { label: status, Icon: AlertCircle, tone: 'slate' }
  }
}

const toneClasses: Record<
  StatusTone,
  { light: string; dark: string }
> = {
  amber: {
    light: 'bg-amber-100 text-amber-800',
    dark: 'dark:bg-amber-500/10 dark:text-amber-400',
  },
  emerald: {
    light: 'bg-emerald-100 text-emerald-800',
    dark: 'dark:bg-emerald-500/10 dark:text-emerald-400',
  },
  rose: {
    light: 'bg-rose-100 text-rose-800',
    dark: 'dark:bg-rose-500/10 dark:text-rose-400',
  },
  slate: {
    light: 'bg-slate-100 text-slate-700',
    dark: 'dark:bg-slate-800 dark:text-slate-300',
  },
}

export function ManualPaymentStatusPage() {
  const [items, setItems] = useState<ManualPaymentStatusItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const [actionMessage, setActionMessage] = useState<string | null>(null)

  const loadPayments = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await manualPaymentApi.myPayments()
      setItems(data)
    } catch (err) {
      console.error('Failed to load manual payments:', err)
      setError('Could not load your payments. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPayments()
  }, [])

  const handleCancel = async (paymentId: string) => {
    setCancelling(true)
    setActionMessage(null)
    try {
      await manualPaymentApi.cancel(paymentId)
      setConfirmCancelId(null)
      setActionMessage('Payment cancelled. You can make a new one anytime.')
      await loadPayments()
    } catch (err: any) {
      console.error('Cancel failed:', err)
      setActionMessage(
        err?.response?.data?.detail ||
          'Could not cancel. Please try again or contact support.'
      )
    } finally {
      setCancelling(false)
    }
  }

  // FIX 8 — hide "make another payment" when a pending exists
  const hasPendingPayment = items.some((i) => i.status === 'pending')

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 bg-gradient-to-b from-indigo-50 to-white dark:from-slate-950 dark:to-slate-950">
      <div className="max-w-3xl mx-auto">
        <Link
          to="/dashboard"
          className="inline-flex items-center text-sm text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Dashboard
        </Link>

        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">
            My Bank Payments
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-2 text-sm">
            Track the status of your manual bank transfers.
          </p>
        </div>

        {actionMessage && (
          <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs leading-relaxed text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
            <div className="flex-1">{actionMessage}</div>
            <button
              type="button"
              onClick={() => setActionMessage(null)}
              className="shrink-0 rounded-md p-0.5 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-900 dark:text-emerald-300 dark:hover:bg-emerald-500/20 dark:hover:text-emerald-100 transition-colors"
              aria-label="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {loading ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm p-12 text-center border border-slate-200 dark:border-slate-800">
            <Loader2 className="w-8 h-8 text-indigo-600 dark:text-indigo-400 animate-spin mx-auto" />
            <p className="text-slate-500 dark:text-slate-400 mt-4 text-sm">
              Loading your payments...
            </p>
          </div>
        ) : error ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm p-8 text-center border border-slate-200 dark:border-slate-800">
            <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
            <p className="text-rose-600 dark:text-rose-400 text-sm mb-4">{error}</p>
            <button
              onClick={loadPayments}
              className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-xl hover:bg-indigo-700 transition-colors"
            >
              Retry
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm p-12 text-center border border-slate-200 dark:border-slate-800">
            <Building2 className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-slate-800 dark:text-white mb-1">
              No payments yet
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">
              Your bank payment history will appear here once you submit one.
            </p>
            <Link
              to="/pricing"
              className="inline-flex items-center justify-center px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors"
            >
              View Pricing
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => {
              const Icon = bankIcon[item.bank] || Building2
              const isPending = item.status === 'pending'
              const status = getStatusPresentation(item.status)
              const StatusIcon = status.Icon
              const tone = toneClasses[status.tone]

              return (
                <div
                  key={item.payment_id}
                  className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5"
                >
                  {/* Header row: bank + amount */}
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 dark:text-white text-sm">
                          {bankDisplay[item.bank]}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 font-mono truncate">
                          {item.bank_reference}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-lg font-black text-slate-900 dark:text-white">
                        {formatMoney(item.amount, item.currency)}
                      </div>
                    </div>
                  </div>

                  {/* FIX 7 — meta row stacks on mobile */}
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4 text-xs">
                    <div className="text-slate-500 dark:text-slate-400">
                      Submitted {formatDate(item.created_at)}
                    </div>

                    <span
                      className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 font-bold ${tone.light} ${tone.dark}`}
                    >
                      <StatusIcon className="h-3 w-3" />
                      {status.label}
                    </span>
                  </div>

                  {item.admin_note && (
                    <div className="mt-3 rounded-lg bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 px-3 py-2 text-xs text-slate-600 dark:text-slate-400">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        Admin note:
                      </span>{' '}
                      {item.admin_note}
                    </div>
                  )}

                  {item.sender_name && (
                    <div className="mt-2 text-[11px] text-slate-400 dark:text-slate-500">
                      Sender: {item.sender_name}
                    </div>
                  )}

                  {isPending && (
                    <>
                      <div className="mt-3 text-[11px] text-slate-500 dark:text-slate-400">
                        We verify manual payments within 24 hours. You'll receive
                        an email once it's approved.
                      </div>

                      {confirmCancelId === item.payment_id ? (
                        <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 dark:border-rose-500/30 dark:bg-rose-500/10">
                          <p className="text-xs font-semibold text-rose-800 dark:text-rose-300">
                            Cancel this payment?
                          </p>
                          <p className="mt-1 text-[11px] leading-relaxed text-rose-700 dark:text-rose-400">
                            This frees your bank reference so you can submit a
                            new one. You can make a fresh payment anytime.
                          </p>
                          <div className="mt-3 flex gap-2">
                            <button
                              type="button"
                              onClick={() => setConfirmCancelId(null)}
                              disabled={cancelling}
                              className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                              Keep it
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCancel(item.payment_id)}
                              disabled={cancelling}
                              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-rose-600 px-3 py-2 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-50 transition-colors"
                            >
                              {cancelling ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Trash2 className="h-3 w-3" />
                              )}
                              Yes, cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmCancelId(item.payment_id)}
                          className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-semibold text-rose-600 hover:text-rose-800 dark:text-rose-400 dark:hover:text-rose-300 transition-colors"
                        >
                          <Trash2 className="h-3 w-3" />
                          Cancel this payment
                        </button>
                      )}
                    </>
                  )}
                </div>
              )
            })}

            {/* FIX 8 — hide "Make another payment" when pending exists */}
            {!hasPendingPayment && (
              <div className="pt-4 text-center">
                <Link
                  to="/pricing"
                  className="inline-flex items-center justify-center px-5 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-sm font-semibold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  Make another payment
                </Link>
              </div>
            )}

            {hasPendingPayment && (
              <p className="pt-4 text-center text-[11px] text-slate-500 dark:text-slate-400">
                You have a pending payment. You'll be able to start a new one
                after it's reviewed or cancelled.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default ManualPaymentStatusPage
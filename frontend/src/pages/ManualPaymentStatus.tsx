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
} from 'lucide-react'
import { manualPaymentApi, type ManualPaymentStatusItem, type ManualBank } from '../api'

const bankDisplay: Record<ManualBank, string> = {
  cbe: 'CBE',
  telebirr: 'Telebirr',
  awash: 'Awash Bank',
}

const bankIcon: Record<ManualBank, any> = {
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

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 bg-gradient-to-b from-indigo-50 to-white">
      <div className="max-w-3xl mx-auto">
        <Link
          to="/dashboard"
          className="inline-flex items-center text-sm text-slate-600 dark:text-slate-400 hover:text-indigo-600 mb-8 transition-colors"
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
              className="shrink-0 text-emerald-700 hover:text-emerald-900 dark:text-emerald-300 dark:hover:text-emerald-100"
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        )}

        {loading ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm p-12 text-center border border-slate-200 dark:border-slate-800">
            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
            <p className="text-slate-500 mt-4 text-sm">Loading your payments...</p>
          </div>
        ) : error ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm p-8 text-center border border-slate-200 dark:border-slate-800">
            <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
            <p className="text-rose-600 text-sm mb-4">{error}</p>
            <button
              onClick={loadPayments}
              className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-xl hover:bg-indigo-700"
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
              You haven't made any manual bank payments yet.
            </p>
            <Link
              to="/pricing"
              className="inline-flex items-center justify-center px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition"
            >
              View Pricing
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => {
              const Icon = bankIcon[item.bank] || Building2
              const isPending = item.status === 'pending'
              const isApproved = item.status === 'success'
              const isFailed = item.status === 'failed' || item.status === 'cancelled' || item.status === 'expired'

              return (
                <div
                  key={item.payment_id}
                  className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5"
                >
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white text-sm">
                          {bankDisplay[item.bank]}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                          {item.bank_reference}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-lg font-black text-slate-900 dark:text-white">
                        {item.amount} {item.currency}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-4 text-xs">
                    <div className="text-slate-500 dark:text-slate-400">
                      Submitted {formatDate(item.created_at)}
                    </div>

                    {isPending && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 font-bold text-amber-800 dark:bg-amber-500/10 dark:text-amber-400">
                        <Clock className="h-3 w-3" />
                        Pending review
                      </span>
                    )}
                    {isApproved && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 font-bold text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-400">
                        <CheckCircle2 className="h-3 w-3" />
                        Approved
                      </span>
                    )}
                    {isFailed && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-2.5 py-1 font-bold text-rose-800 dark:bg-rose-500/10 dark:text-rose-400">
                        <XCircle className="h-3 w-3" />
                        Not verified
                      </span>
                    )}
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
                        We verify manual payments within 24 hours. You'll receive an email once it's approved.
                      </div>

                      {confirmCancelId === item.payment_id ? (
                        <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 dark:border-rose-500/30 dark:bg-rose-500/10">
                          <p className="text-xs font-semibold text-rose-800 dark:text-rose-300">
                            Cancel this payment?
                          </p>
                          <p className="mt-1 text-[11px] leading-relaxed text-rose-700 dark:text-rose-400">
                            This frees your bank reference so you can submit
                            a new payment. This can't be undone.
                          </p>
                          <div className="mt-3 flex gap-2">
                            <button
                              type="button"
                              onClick={() => setConfirmCancelId(null)}
                              disabled={cancelling}
                              className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                            >
                              Keep it
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCancel(item.payment_id)}
                              disabled={cancelling}
                              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-rose-600 px-3 py-2 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-50"
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
                          className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-semibold text-rose-600 hover:text-rose-800 dark:text-rose-400 dark:hover:text-rose-300"
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

            <div className="pt-4 text-center">
              <Link
                to="/pricing"
                className="inline-flex items-center justify-center px-5 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-sm font-semibold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition"
              >
                Make another payment
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default ManualPaymentStatusPage
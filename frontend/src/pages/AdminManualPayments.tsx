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
  X,
  Inbox,
  BookOpen,
} from 'lucide-react'
import {
  manualPaymentApi,
  type ManualPaymentAdminItem,
  type ManualBank,
} from '../api'
import { formatMoney } from '../utils/format'

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

interface RejectionReason {
  code: string
  label: string
  message: string
  next_step: string | null
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

export function AdminManualPaymentsPage() {
  const [items, setItems] = useState<ManualPaymentAdminItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  // Reject modal state
  const [rejectTarget, setRejectTarget] = useState<ManualPaymentAdminItem | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectionReasons, setRejectionReasons] = useState<RejectionReason[]>([])
  const [selectedReasonCode, setSelectedReasonCode] = useState<string | null>(null)

  const loadPending = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await manualPaymentApi.adminListPending()
      setItems(res.items)
    } catch (err) {
      console.error('Failed to load pending manual payments:', err)
      setError('Could not load pending payments. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPending()
    // Load the preset rejection reasons once.
    manualPaymentApi
      .adminRejectionReasons()
      .then((res) => setRejectionReasons(res.reasons))
      .catch((err) => console.warn('Failed to load rejection reasons:', err))
  }, [])

  const handleApprove = async (item: ManualPaymentAdminItem) => {
    if (busyId) return
    setBusyId(item.payment_id)
    setError(null)
    try {
      await manualPaymentApi.adminApprove(item.payment_id)
      setItems((prev) => prev.filter((p) => p.payment_id !== item.payment_id))
    } catch (err: any) {
      console.error('Approve failed:', err)
      setError(
        err?.response?.data?.detail ||
          'Could not approve this payment. Please try again.'
      )
    } finally {
      setBusyId(null)
    }
  }

  const openReject = (item: ManualPaymentAdminItem) => {
    setRejectTarget(item)
    setRejectReason('')
    setSelectedReasonCode(null)
  }

  const selectReason = (code: string) => {
    setSelectedReasonCode(code)
    // Clear custom text when switching away from 'other'
    if (code !== 'other') {
      setRejectReason('')
    }
  }

  const confirmReject = async () => {
    if (!rejectTarget) return
    if (!selectedReasonCode) return
    // If "other", custom text is required
    if (selectedReasonCode === 'other' && !rejectReason.trim()) return

    const target = rejectTarget
    setBusyId(target.payment_id)
    setError(null)
    try {
      await manualPaymentApi.adminReject(
        target.payment_id,
        selectedReasonCode === 'other' ? rejectReason.trim() : '',
        selectedReasonCode,
      )
      setItems((prev) => prev.filter((p) => p.payment_id !== target.payment_id))
      setRejectTarget(null)
      setRejectReason('')
      setSelectedReasonCode(null)
    } catch (err: any) {
      console.error('Reject failed:', err)
      setError(
        err?.response?.data?.detail ||
          'Could not reject this payment. Please try again.'
      )
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900">
      <div className="max-w-4xl mx-auto">
        <Link
          to="/admin"
          className="inline-flex items-center text-sm text-slate-600 dark:text-slate-400 hover:text-indigo-600 mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Admin
        </Link>

        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">
              Manual Payments
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mt-2 text-sm">
              Verify bank transfers and activate Premium for students.
            </p>
          </div>

          <button
            onClick={loadPending}
            disabled={loading}
            className="shrink-0 inline-flex items-center gap-2 px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-sm font-semibold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              'Refresh'
            )}
          </button>

          <Link
            to="/admin/manual-payments/help"
            className="shrink-0 inline-flex items-center gap-2 px-4 py-2 border border-indigo-200 dark:border-indigo-500/40 text-indigo-700 dark:text-indigo-400 text-sm font-semibold rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition"
            title="How to verify manual payments"
          >
            <BookOpen className="w-4 h-4" />
            Help
          </Link>
        </div>

        {error && (
          <div className="mb-6 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-400">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm p-12 text-center border border-slate-200 dark:border-slate-800">
            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
            <p className="text-slate-500 mt-4 text-sm">Loading pending payments...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm p-12 text-center border border-slate-200 dark:border-slate-800">
            <Inbox className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-slate-800 dark:text-white mb-1">
              No pending payments
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm">
              There are no manual bank payments awaiting verification.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((item) => {
              const Icon = bankIcon[item.bank] || Building2
              const isBusy = busyId === item.payment_id

              return (
                <div
                  key={item.payment_id}
                  className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 sm:p-6"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400 shrink-0">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white text-sm">
                          {item.user_full_name || 'Student'}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {item.user_email}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-xl font-black text-slate-900 dark:text-white">
                        {formatMoney(item.amount, item.currency)}
                      </div>
                      <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                        {item.plan_name}
                      </div>
                    </div>
                  </div>

                  {/* Details grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs mb-4">
                    <div className="rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 px-3 py-2">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Bank
                      </div>
                      <div className="text-slate-800 dark:text-slate-200 font-semibold">
                        {bankDisplay[item.bank]}
                      </div>
                    </div>

                    <div className="rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 px-3 py-2">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Reference
                      </div>
                      <div className="text-slate-800 dark:text-slate-200 font-mono font-bold">
                        {item.bank_reference}
                      </div>
                    </div>

                    {item.sender_name && (
                      <div className="rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 px-3 py-2">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Sender name
                        </div>
                        <div className="text-slate-800 dark:text-slate-200">
                          {item.sender_name}
                        </div>
                      </div>
                    )}

                    {item.sender_phone && (
                      <div className="rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 px-3 py-2">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Sender phone
                        </div>
                        <div className="text-slate-800 dark:text-slate-200 font-mono">
                          {item.sender_phone}
                        </div>
                      </div>
                    )}
                  </div>

                  {item.student_note && (
                    <div className="mb-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 px-3 py-2 text-xs text-slate-600 dark:text-slate-400">
                      <span className="font-bold text-slate-700 dark:text-slate-300">
                        Student note:
                      </span>{' '}
                      {item.student_note}
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-3 mb-4 text-[11px] text-slate-400">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDate(item.created_at)}
                    </span>
                    <span className="font-mono text-[10px]">{item.tx_ref}</span>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2.5">
                    <button
                      onClick={() => handleApprove(item)}
                      disabled={isBusy}
                      className="flex-1 min-w-[140px] inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl transition disabled:opacity-50"
                    >
                      {isBusy ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4" />
                      )}
                      Approve & Activate
                    </button>

                    <button
                      onClick={() => openReject(item)}
                      disabled={isBusy}
                      className="flex-1 min-w-[140px] inline-flex items-center justify-center gap-2 px-4 py-2.5 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-sm font-bold rounded-xl transition disabled:opacity-50"
                    >
                      <X className="w-4 h-4" />
                      Reject
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Reject modal */}
      {rejectTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !busyId) {
              setRejectTarget(null)
            }
          }}
        >
          <div className="w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 my-auto">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
              Reject this payment?
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Student: <strong>{rejectTarget.user_full_name || rejectTarget.user_email}</strong>
              <br />
              Reference: <span className="font-mono">{rejectTarget.bank_reference}</span>
            </p>

            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
              Pick a reason <span className="text-rose-500">*</span>
            </label>

            <div className="max-h-72 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-200 dark:divide-slate-700">
              {rejectionReasons.length === 0 ? (
                <div className="p-3 text-xs text-slate-500 dark:text-slate-400 text-center">
                  Loading reasons…
                </div>
              ) : (
                rejectionReasons.map((r) => {
                  const isSelected = selectedReasonCode === r.code
                  return (
                    <button
                      key={r.code}
                      type="button"
                      onClick={() => selectReason(r.code)}
                      disabled={!!busyId}
                      className={`w-full text-left px-3.5 py-2.5 text-xs font-medium transition flex items-start gap-2.5 ${
                        isSelected
                          ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-900 dark:text-rose-200'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <span
                        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition ${
                          isSelected
                            ? 'border-rose-600 bg-rose-600'
                            : 'border-slate-300 dark:border-slate-600'
                        }`}
                      >
                        {isSelected && (
                          <span className="h-1.5 w-1.5 rounded-full bg-white" />
                        )}
                      </span>
                      <span>{r.label}</span>
                    </button>
                  )
                })
              )}
            </div>

            {selectedReasonCode === 'other' && (
              <div className="mt-3">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Custom reason <span className="text-rose-500">*</span>
                </label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={3}
                  placeholder="Explain the reason in a few words…"
                  disabled={!!busyId}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
              </div>
            )}

            {selectedReasonCode && selectedReasonCode !== 'other' && (
              <div className="mt-3 rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 px-3 py-2.5 text-[11px] leading-relaxed text-rose-800 dark:text-rose-300">
                The student will see:
                <br />
                <strong>
                  {rejectionReasons.find((r) => r.code === selectedReasonCode)?.message}
                </strong>
                {(() => {
                  const r = rejectionReasons.find((x) => x.code === selectedReasonCode)
                  return r?.next_step ? <><br />{r.next_step}</> : null
                })()}
              </div>
            )}

            <div className="mt-5 flex gap-3">
              <button
                onClick={() => setRejectTarget(null)}
                disabled={!!busyId}
                className="flex-1 px-4 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-sm font-semibold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmReject}
                disabled={
                  !!busyId ||
                  !selectedReasonCode ||
                  (selectedReasonCode === 'other' && !rejectReason.trim())
                }
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold rounded-xl transition disabled:opacity-50"
              >
                {busyId ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <X className="w-4 h-4" />
                )}
                Reject payment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminManualPaymentsPage
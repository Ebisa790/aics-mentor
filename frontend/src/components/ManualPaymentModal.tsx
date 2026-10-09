import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import {
  AlertCircle,
  Building2,
  Check,
  Copy,
  Phone,
  Send,
  ShieldCheck,
  Smartphone,
  X,
  QrCode,
  Keyboard,
  type LucideIcon,
} from 'lucide-react'
import { formatMoney } from '../utils/format'
import {
  manualPaymentApi,
  type ManualPaymentOptions,
  type ManualBank,
} from '../api'

interface ManualPaymentModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

const bankMeta: Record<
  ManualBank,
  { label: string; icon: LucideIcon; hint: string }
> = {
  cbe: {
    label: 'CBE',
    icon: Building2,
    hint: 'Commercial Bank of Ethiopia',
  },
  telebirr: {
    label: 'Telebirr',
    icon: Smartphone,
    hint: 'Mobile money',
  },
  awash: {
    label: 'Awash',
    icon: Building2,
    hint: 'Awash Bank',
  },
}

// Client-side format hints matching backend validation.
const bankPatterns: Record<ManualBank, RegExp> = {
  cbe: /^(FT[A-Z0-9]{8,16}|[A-Za-z0-9]{15,25})$/,
  telebirr: /^[A-Z0-9]{10,14}$/,
  awash: /^\d{14,16}$/,
}

const bankFormatHint: Record<ManualBank, string> = {
  cbe: 'From your CBE SMS: tap the receipt link, then find the FT reference (starts with FT, e.g. FT0000000000). Or paste the SMS link code directly.',
  telebirr:
    'The Transaction Number from your Telebirr SMS or app (10 characters, e.g. ABC1234567)',
  awash:
    'The Transaction ID from your Awash SMS or receipt (14-16 digits, e.g. 100000000000000)',
}

const bankUssd: Record<ManualBank, string> = {
  cbe: '*889#',
  telebirr: '*127#',
  awash: '*901#',
}

const bankUssdHint: Record<ManualBank, string> = {
  cbe: 'Dial from the phone registered with CBE Birr',
  telebirr: 'Dial from the phone registered with Telebirr',
  awash: 'Dial from the phone registered with Awash',
}

const DRAFT_KEY = 'manual_payment_draft_v1'
const DRAFT_TTL_MS = 24 * 60 * 60 * 1000

function StepIndicator({
  step1Done,
  step2Done,
  step3Done,
  currentStep,
}: {
  step1Done: boolean
  step2Done: boolean
  step3Done: boolean
  currentStep: 1 | 2 | 3
}) {
  const steps = [
    { n: 1, label: 'Choose bank', done: step1Done },
    { n: 2, label: 'Send money', done: step2Done },
    { n: 3, label: 'Submit reference', done: step3Done },
  ]

  return (
    <div className="mb-5 flex items-start justify-between gap-1">
      {steps.map((step, idx) => {
        const isActive = step.n === currentStep && !step.done
        const isDone = step.done
        return (
          <div key={step.n} className="flex flex-1 items-start gap-1">
            <div className="flex flex-1 flex-col items-center">
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold transition-colors ${
                  isDone
                    ? 'bg-emerald-500 text-white'
                    : isActive
                      ? 'bg-indigo-600 text-white ring-4 ring-indigo-100 dark:ring-indigo-500/20'
                      : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'
                }`}
              >
                {isDone ? (
                  <Check className="h-3.5 w-3.5" strokeWidth={3} />
                ) : (
                  step.n
                )}
              </div>
              <span
                className={`mt-1.5 text-center text-[10px] font-semibold leading-tight ${
                  isDone
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : isActive
                      ? 'text-indigo-600 dark:text-indigo-400'
                      : 'text-slate-400 dark:text-slate-500'
                }`}
              >
                {step.label}
              </span>
            </div>

            {idx < steps.length - 1 && (
              <div
                className={`mt-3 h-0.5 flex-1 rounded-full transition-colors ${
                  steps[idx + 1].done
                    ? 'bg-emerald-500'
                    : steps[idx].done
                      ? 'bg-indigo-300 dark:bg-indigo-500/40'
                      : 'bg-slate-200 dark:bg-slate-700'
                }`}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

export function ManualPaymentModal({
  isOpen,
  onClose,
  onSuccess,
}: ManualPaymentModalProps) {
  const [options, setOptions] = useState<ManualPaymentOptions | null>(null)
  const [selectedBank, setSelectedBank] = useState<ManualBank | null>(null)

  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const [reference, setReference] = useState('')
  const [senderName, setSenderName] = useState('')
  const [senderPhone, setSenderPhone] = useState('')
  const [note, setNote] = useState('')
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [copiedAll, setCopiedAll] = useState(false)
  const [payMethod, setPayMethod] = useState<'qr' | 'manual'>('qr')
  const [referenceError, setReferenceError] = useState<string | null>(null)

  // Confirmation gates
  const [confirmSent, setConfirmSent] = useState(false)
  const [confirmUnderstood, setConfirmUnderstood] = useState(false)
  const [confirmAmount, setConfirmAmount] = useState('')

  // ── Draft persistence helpers ──────────────────────────────
  const clearDraft = () => {
    try {
      localStorage.removeItem(DRAFT_KEY)
    } catch {
      /* ignore */
    }
  }

  const saveDraft = (
    bank: ManualBank | null,
    ref: string,
    name: string,
    phone: string,
    noteText: string,
  ) => {
    try {
      localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({
          selectedBank: bank,
          reference: ref,
          senderName: name,
          senderPhone: phone,
          note: noteText,
          savedAt: Date.now(),
        }),
      )
    } catch {
      /* ignore */
    }
  }

  const loadDraft = () => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY)
      if (!raw) return null
      const parsed = JSON.parse(raw)
      if (!parsed || typeof parsed !== 'object') return null
      if (Date.now() - (parsed.savedAt || 0) > DRAFT_TTL_MS) {
        localStorage.removeItem(DRAFT_KEY)
        return null
      }
      return parsed
    } catch {
      return null
    }
  }

  useEffect(() => {
    if (!isOpen) return
    const draft = loadDraft()
    if (!draft) return

    if (draft.selectedBank) setSelectedBank(draft.selectedBank)
    if (draft.reference) setReference(draft.reference)
    if (draft.senderName) setSenderName(draft.senderName)
    if (draft.senderPhone) setSenderPhone(draft.senderPhone)
    if (draft.note) setNote(draft.note)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    if (success) return
    if (loading) return
    saveDraft(selectedBank, reference, senderName, senderPhone, note)
  }, [
    isOpen,
    selectedBank,
    reference,
    senderName,
    senderPhone,
    note,
    success,
    loading,
  ])

  useEffect(() => {
    if (!isOpen) return

    let isMounted = true

    setLoading(true)
    setError(null)
    setSelectedBank(null)
    setSuccess(false)
    setReference('')
    setSenderName('')
    setSenderPhone('')
    setNote('')
    setConfirmSent(false)
    setConfirmUnderstood(false)
    setConfirmAmount('')

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    manualPaymentApi
      .getOptions()
      .then((data) => {
        if (!isMounted) return
        setOptions(data)
        if (data.banks.length > 0) {
          setSelectedBank(data.banks[0].bank)
        }
      })
      .catch((err) => {
        if (!isMounted) return
        console.error('Failed to load manual payment options:', err)
        setError(
          'We could not load the manual payment options. Please try again.',
        )
      })
      .finally(() => {
        if (isMounted) setLoading(false)
      })

    return () => {
      isMounted = false
      document.body.style.overflow = previousOverflow
    }
  }, [isOpen])

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen && !submitting) {
        onClose()
      }
    },
    [isOpen, submitting, onClose],
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  if (!isOpen) return null

  const selectedBankInfo =
    options?.banks.find((b) => b.bank === selectedBank) ?? null

  const referenceIsValid = selectedBank
    ? bankPatterns[selectedBank].test(reference)
    : false

  const step1Done = selectedBank !== null
  const step2Done = step1Done && options !== null
  const step3Done = referenceIsValid
  const currentStep: 1 | 2 | 3 = !step1Done ? 1 : !step3Done ? 2 : 3

  const typedAmountNum = parseFloat(confirmAmount.replace(/,/g, '').trim())
  const amountMatches =
    !!options &&
    !isNaN(typedAmountNum) &&
    Math.abs(typedAmountNum - Number(options.amount)) < 0.01

    // Client-side phone validation — mirrors the backend rule.
  // Phone is optional, but if typed, it must start with 0 or +251.
  const phoneIsValid = (() => {
    const cleaned = senderPhone.replace(/[\s-]/g, '').trim()
    if (!cleaned) return true
    if (!cleaned.startsWith('0') && !cleaned.startsWith('+251')) return false
    if (cleaned.length < 9 || cleaned.length > 15) return false
    return true
  })()

  const gatesPassed = confirmSent && confirmUnderstood && amountMatches



  const handleCopy = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(field)
      window.setTimeout(() => setCopiedField(null), 1500)
    } catch {
      /* ignore */
    }
  }

  const handleCopyAll = async () => {
    if (!options || !selectedBankInfo) return
    const label =
      selectedBankInfo.bank === 'telebirr' ? 'Phone' : 'Account'
    const text = [
      `${bankMeta[selectedBankInfo.bank].label} Payment`,
      `${label}: ${selectedBankInfo.account_number}`,
      `Name: ${selectedBankInfo.account_name}`,
      `Amount: ${options.amount} ${options.currency}`,
      `Plan: ${options.plan_name}`,
    ].join('\n')
    try {
      await navigator.clipboard.writeText(text)
      setCopiedAll(true)
      window.setTimeout(() => setCopiedAll(false), 2000)
    } catch {
      /* ignore */
    }
  }

  const handleSubmit = async () => {
    if (!options || !selectedBank || !reference.trim()) {
      setError('Please fill in the reference number from your bank receipt.')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const initiated = await manualPaymentApi.initiate({
        plan_id: options.plan_id,
        bank: selectedBank,
      })

      await manualPaymentApi.submit({
        tx_ref: initiated.tx_ref,
        bank_reference: reference.trim(),
        sender_name: senderName.trim() || undefined,
        sender_phone: senderPhone.trim() || undefined,
        student_note: note.trim() || undefined,
        accepted_terms: confirmSent && confirmUnderstood,
        confirmed_amount: confirmAmount.trim(),
      })

      setSuccess(true)
      clearDraft()
      onSuccess?.()
    } catch (err: unknown) {
      console.error('Manual payment submit failed:', err)

      if (axios.isAxiosError(err)) {
        const status = err.response?.status
        const data = err.response?.data
        const rawDetail = data?.detail
        const rawError = data?.error

        let message: string | null = null
        if (typeof rawDetail === 'string') {
          message = rawDetail
        } else if (typeof rawError === 'string') {
          message = rawError
        } else if (Array.isArray(rawDetail) && rawDetail[0]?.msg) {
          message = rawDetail[0].msg
        }

        if (status === 429) {
          message = 'Too many attempts. Please wait a few minutes and try again.'
        } else if (status === 401) {
          message = 'Your session expired. Please log in again.'
        } else if (status === 403) {
          message = message || 'You are not allowed to do that right now.'
        } else if (status && status >= 500) {
          message = message || 'Server error. Please try again in a moment.'
        }

        if (!message) {
          message =
            'We could not submit your payment. Please check your connection and try again.'
        }

        const lower = message.toLowerCase()
        if (
          lower.includes('reference is already in use') ||
          lower.includes('already submitted this reference') ||
          lower.includes('already approved') ||
          lower.includes('already been submitted')
        ) {
          setReferenceError(message)
        } else {
          setError(message)
        }
      } else if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('Something went wrong. Please try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  // Hint shown when submit is disabled
  const submitDisabledReason = (() => {
    if (submitting) return null
    if (!referenceIsValid) return 'Enter a valid reference number to continue.'
    if (!confirmSent)
      return 'Check the confirmation box to enable submit.'
    if (!amountMatches)
      return 'Type the exact amount you sent to enable submit.'
    if (!confirmUnderstood)
      return 'Accept the reference verification note to enable submit.'
    if (!phoneIsValid)
      return 'Phone must start with 0 or +251 (e.g. 0912 345 678).'
    return null
  })()

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-3 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="manual-payment-modal-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !submitting) {
          onClose()
        }
      }}
    >
      <div
        id="manual-payment-modal"
        className="relative w-full max-w-lg sm:max-w-2xl lg:max-w-3xl max-h-[92vh] sm:max-h-[88vh] overflow-y-auto rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl"
      >
        {/* Header */}
        <div className="relative overflow-hidden px-6 pt-6 pb-4 sm:px-8 sm:pt-7">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-indigo-500" />

          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="Close manual payment dialog"
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:pointer-events-none disabled:opacity-40 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="flex items-start gap-4 pr-8">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/20">
              <Send className="h-6 w-6 text-white" />
            </div>

            <div>
              <h2
                id="manual-payment-modal-title"
                className="font-display text-xl font-bold tracking-tight text-slate-900 dark:text-white"
              >
                Pay via Bank Transfer
              </h2>

              <p className="mt-1.5 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                Send the payment from your bank app, then submit the
                reference number. We verify and activate Premium within
                24 hours.
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 pb-6 sm:px-8 sm:pb-8">
          {loading ? (
            <div className="space-y-4 py-6 animate-pulse">
              <div className="h-16 rounded-2xl bg-slate-100 dark:bg-slate-800" />
              <div className="h-40 rounded-2xl bg-slate-100 dark:bg-slate-800" />
            </div>
          ) : success ? (
            /* ============ SUCCESS STATE ============ */
            <div className="space-y-4 py-4 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
                <Check className="h-8 w-8" strokeWidth={3} />
              </div>

              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Reference submitted
              </h3>

              <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                We received your bank reference. Our team will verify the
                deposit and activate Premium shortly.
              </p>

              {/* Post-submit timeline */}
              <div className="mt-5 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-left dark:border-slate-800 dark:bg-slate-950/50">
                <div className="flex items-start gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
                    <Check className="h-3.5 w-3.5" strokeWidth={3} />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-bold text-slate-900 dark:text-white">
                      Reference submitted
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Just now
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
                    <span className="text-[10px] font-bold">2</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-bold text-slate-900 dark:text-white">
                      Under review
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Usually within a few hours
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                    <span className="text-[10px] font-bold">3</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-bold text-slate-900 dark:text-white">
                      Email confirmation
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      You'll be notified when approved
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400">
                    <span className="text-[10px] font-bold">4</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-bold text-slate-900 dark:text-white">
                      Premium unlocked
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Full access to all content
                    </p>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="mt-2 w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-700"
              >
                Close
              </button>
            </div>
          ) : !options || options.banks.length === 0 ? (
            /* ============ NO BANKS ============ */
            <div className="space-y-4 py-6 text-center">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Manual payment is not available right now. Please try again
                later or contact support.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Close
              </button>
            </div>
          ) : (
            /* ============ MAIN FORM ============ */
            <div className="space-y-5">
              {/* Progress indicator */}
              <StepIndicator
                step1Done={step1Done}
                step2Done={step2Done}
                step3Done={step3Done}
                currentStep={currentStep}
              />

              {/* Amount card */}
              <div className="rounded-2xl border-2 border-emerald-300 bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-5 dark:border-emerald-500/40 dark:from-emerald-950/40 dark:via-slate-900 dark:to-teal-950/30">
                <div className="text-center">
                  <div className="text-[11px] font-bold uppercase tracking-widest text-emerald-700 dark:text-emerald-400">
                    Send exactly this amount
                  </div>

                  <button
                    type="button"
                    onClick={() => handleCopy(String(options.amount), 'amount')}
                    className="group mt-3 inline-flex items-center gap-3 rounded-2xl bg-white px-5 py-3 shadow-sm ring-1 ring-emerald-200 transition hover:bg-emerald-50 dark:bg-slate-950 dark:ring-emerald-500/30 dark:hover:bg-slate-900"
                    title="Tap to copy the exact amount"
                  >
                    <span className="text-4xl font-black tracking-tight text-emerald-700 dark:text-emerald-400">
                      {formatMoney(options.amount, null, false)}
                    </span>
                    <span className="text-lg font-bold text-emerald-600 dark:text-emerald-500 self-end pb-1.5">
                      {options.currency}
                    </span>
                    {copiedField === 'amount' ? (
                      <Check className="h-5 w-5 text-emerald-500" />
                    ) : (
                      <Copy className="h-5 w-5 text-emerald-500/70 group-hover:text-emerald-600" />
                    )}
                  </button>

                  <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                    For:{' '}
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {options.plan_name}
                    </span>
                  </div>
                </div>
              </div>

              {/* USSD shortcut */}
              {selectedBank && (
                <div className="rounded-2xl border border-indigo-200 bg-indigo-50/60 p-4 dark:border-indigo-500/30 dark:bg-indigo-500/10">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white">
                      <Smartphone className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-indigo-900 dark:text-indigo-300">
                        Fastest way to pay
                      </p>
                      <p className="mt-0.5 text-xs leading-relaxed text-indigo-800/80 dark:text-indigo-300/80">
                        {bankUssdHint[selectedBank]}
                      </p>

                      <button
                        type="button"
                        onClick={() => handleCopy(bankUssd[selectedBank], 'ussd')}
                        className="mt-3 inline-flex items-center gap-2.5 rounded-xl bg-white px-4 py-2.5 shadow-sm ring-1 ring-indigo-200 transition hover:bg-indigo-50 dark:bg-slate-950 dark:ring-indigo-500/30 dark:hover:bg-slate-900"
                        title="Tap to copy USSD code"
                      >
                        <span className="font-mono text-2xl font-black tracking-wider text-indigo-700 dark:text-indigo-300">
                          {bankUssd[selectedBank]}
                        </span>
                        {copiedField === 'ussd' ? (
                          <Check className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <Copy className="h-4 w-4 text-indigo-500/70" />
                        )}
                      </button>

                      <p className="mt-2 text-[11px] text-indigo-700/70 dark:text-indigo-300/60">
                        Follow the menu, then come back and submit your
                        reference below.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Bank selection */}
              <div>
                <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Step 1 — Choose your bank
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {options.banks.map((bank) => {
                    const meta = bankMeta[bank.bank]
                    const Icon = meta.icon
                    const isSelected = selectedBank === bank.bank

                    return (
                      <button
                        key={bank.bank}
                        type="button"
                        onClick={() => setSelectedBank(bank.bank)}
                        className={`relative flex items-center sm:flex-col gap-3 sm:gap-1 rounded-2xl border-2 px-4 sm:px-2 py-3 transition ${
                          isSelected
                            ? 'border-emerald-500 bg-emerald-50 dark:border-emerald-500 dark:bg-emerald-500/10'
                            : 'border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600'
                        }`}
                      >
                        <Icon
                          className={`h-5 w-5 shrink-0 ${
                            isSelected
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-slate-500 dark:text-slate-400'
                          }`}
                        />
                        <span
                          className={`text-sm sm:text-xs font-bold ${
                            isSelected
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : 'text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {meta.label}
                        </span>
                        {isSelected && (
                          <span className="absolute right-3 sm:right-1 top-1/2 sm:top-1 -translate-y-1/2 sm:translate-y-0 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500">
                            <Check
                              className="h-2.5 w-2.5 text-white"
                              strokeWidth={4}
                            />
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Bank details */}
              {selectedBankInfo && (
                <div className="space-y-2.5 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/50 sm:p-5">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Step 2 — Send the exact amount to
                  </div>

                  {/* Tab switcher — Telebirr only, desktop only */}
                  {selectedBankInfo.bank === 'telebirr' && (
                    <div className="hidden sm:inline-flex rounded-xl bg-slate-200 p-0.5 dark:bg-slate-800">
                      <button
                        type="button"
                        onClick={() => setPayMethod('qr')}
                        className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                          payMethod === 'qr'
                            ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white'
                            : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                        }`}
                      >
                        <QrCode className="h-3.5 w-3.5" />
                        Scan QR
                      </button>
                      <button
                        type="button"
                        onClick={() => setPayMethod('manual')}
                        className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                          payMethod === 'manual'
                            ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white'
                            : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                        }`}
                      >
                        <Keyboard className="h-3.5 w-3.5" />
                        Copy details
                      </button>
                    </div>
                  )}

                  {/* QR view — Telebirr, desktop only, active tab */}
                  {selectedBankInfo.bank === 'telebirr' &&
                    payMethod === 'qr' && (
                      <div className="hidden sm:grid grid-cols-[auto_1fr] gap-5 items-center rounded-xl border border-emerald-200 bg-white p-5 dark:border-emerald-500/30 dark:bg-slate-900">
                        <div className="rounded-lg bg-white p-2 ring-1 ring-slate-200 dark:ring-slate-700">
                          <img
                            src="/telebirr-qr.png"
                            alt="Telebirr payment QR code"
                            className="h-40 w-40 rounded-lg"
                          />
                        </div>

                        <div className="text-left">
                          <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                            Scan with your Telebirr app
                          </div>

                          <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                            Open the Telebirr app, tap the scan icon, and point
                            at this QR. Your phone will show our phone number —
                            tap it, then enter{' '}
                            <strong className="text-slate-700 dark:text-slate-200">
                              {options.amount} {options.currency}
                            </strong>{' '}
                            and send.
                          </p>
                        </div>
                      </div>
                    )}

                  {/* Copy details view */}
                  <div
                    className={`space-y-2.5 ${
                      selectedBankInfo.bank === 'telebirr' && payMethod === 'qr'
                        ? 'block sm:hidden'
                        : 'block'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        handleCopy(selectedBankInfo.account_number, 'acct')
                      }
                      className="flex w-full items-center justify-between gap-3 rounded-xl bg-white px-3 py-2.5 text-left transition hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800"
                    >
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          {selectedBankInfo.bank === 'telebirr'
                            ? 'Phone number'
                            : 'Account number'}
                        </div>
                        <div className="font-mono text-sm font-bold text-slate-900 dark:text-white">
                          {selectedBankInfo.account_number}
                        </div>
                      </div>
                      {copiedField === 'acct' ? (
                        <Check className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <Copy className="h-4 w-4 text-slate-400" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        handleCopy(selectedBankInfo.account_name, 'name')
                      }
                      className="flex w-full items-center justify-between gap-3 rounded-xl bg-white px-3 py-2.5 text-left transition hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800"
                    >
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Account name
                        </div>
                        <div className="text-sm font-semibold text-slate-900 dark:text-white">
                          {selectedBankInfo.account_name}
                        </div>
                      </div>
                      {copiedField === 'name' ? (
                        <Check className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <Copy className="h-4 w-4 text-slate-400" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={handleCopyAll}
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      {copiedAll ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-500" />
                          <span className="text-emerald-600 dark:text-emerald-400">
                            Copied all details!
                          </span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          <span>Copy all details</span>
                        </>
                      )}
                    </button>
                  </div>

                  <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                    {options.instructions}
                  </p>
                </div>
              )}

              {/* Reference form */}
              <div className="space-y-3">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Step 3 — Submit your reference
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Bank reference number{' '}
                    <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={reference}
                    onChange={(e) => {
                      const cleaned = e.target.value
                        .toUpperCase()
                        .replace(/\s+/g, '')
                      setReference(cleaned)
                      if (referenceError) setReferenceError(null)
                    }}
                    placeholder={
                      selectedBank === 'cbe'
                        ? 'e.g. FT0000000000'
                        : selectedBank === 'telebirr'
                          ? 'e.g. ABC1234567'
                          : 'e.g. 100000000000000'
                    }
                    disabled={submitting}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    className={`w-full rounded-xl border bg-white px-3 py-2.5 font-mono text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 disabled:opacity-50 dark:bg-slate-950 dark:text-white ${
                      reference.length === 0
                        ? 'border-slate-200 focus:border-indigo-500 focus:ring-indigo-500 dark:border-slate-700'
                        : referenceIsValid
                          ? 'border-emerald-400 focus:border-emerald-500 focus:ring-emerald-500 dark:border-emerald-500/60'
                          : 'border-amber-400 focus:border-amber-500 focus:ring-amber-500 dark:border-amber-500/60'
                    }`}
                  />

                  {reference.length > 0 && (
                    <p
                      className={`mt-1.5 flex items-center gap-1.5 text-[11px] font-medium ${
                        referenceIsValid
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      {referenceIsValid ? (
                        <>
                          <Check className="h-3 w-3" strokeWidth={3} />
                          Looks good
                        </>
                      ) : (
                        <>
                          <AlertCircle className="h-3 w-3" />
                          {selectedBank
                            ? bankFormatHint[selectedBank]
                            : 'Check the reference format'}
                        </>
                      )}
                    </p>
                  )}

                  {reference.length === 0 && selectedBank && (
                    <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                      {bankFormatHint[selectedBank]}
                    </p>
                  )}

                  {referenceError && (
                    <p className="mt-1.5 flex items-start gap-1.5 text-[11px] font-medium text-rose-600 dark:text-rose-400">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      <span>{referenceError}</span>
                    </p>
                  )}

                  {/* Confirmation gates */}
                  <div className="mt-4 space-y-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/50 p-3.5">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                      Before you submit
                    </p>

                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={confirmSent}
                        onChange={(e) => {
                          const checked = e.target.checked
                          setConfirmSent(checked)
                          if (!checked) {
                            setConfirmAmount('')
                          }
                        }}
                        disabled={submitting}
                        className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 dark:border-slate-600"
                      />
                      <span className="text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                        I have sent{' '}
                        <strong className="text-slate-900 dark:text-white">
                          {options ? `${options.amount} ${options.currency}` : ''}
                        </strong>{' '}
                        to the account shown above, from my own bank account.
                      </span>
                    </label>

                    {confirmSent && (
                      <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                        <label className="mb-1 block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                          Type the amount you sent to confirm{' '}
                          <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={confirmAmount}
                          onChange={(e) => setConfirmAmount(e.target.value)}
                          placeholder={options ? String(options.amount) : '500'}
                          disabled={submitting}
                          className={`w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 disabled:opacity-50 dark:bg-slate-950 dark:text-white ${
                            confirmAmount.length === 0
                              ? 'border-slate-200 focus:border-indigo-500 focus:ring-indigo-500 dark:border-slate-700'
                              : amountMatches
                                ? 'border-emerald-400 focus:border-emerald-500 focus:ring-emerald-500 dark:border-emerald-500/60'
                                : 'border-amber-400 focus:border-amber-500 focus:ring-amber-500 dark:border-amber-500/60'
                          }`}
                        />
                        {confirmAmount.length > 0 && !amountMatches && (
                          <p className="mt-1 flex items-center gap-1.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                            <AlertCircle className="h-3 w-3" />
                            Amount doesn't match. Please type exactly{' '}
                            {options ? `${options.amount}` : ''}.
                          </p>
                        )}
                      </div>
                    )}

                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={confirmUnderstood}
                        onChange={(e) =>
                          setConfirmUnderstood(e.target.checked)
                        }
                        disabled={submitting}
                        className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 dark:border-slate-600"
                      />
                      <span className="text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                        I understand that submitting a{' '}
                        <strong>fake or reused reference</strong> will result
                        in a permanent ban.
                      </span>
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Sender name
                    </label>
                    <input
                      type="text"
                      value={senderName}
                      onChange={(e) => setSenderName(e.target.value)}
                      placeholder="Name on the sender's account"
                      disabled={submitting}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                      <Phone className="h-3 w-3" />
                      Phone (optional)
                    </label>
                                     <input
                      type="tel"
                      value={senderPhone}
                      onChange={(e) => setSenderPhone(e.target.value)}
                      placeholder="0912 345 678"
                      disabled={submitting}
                      className={`w-full rounded-xl border bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 disabled:opacity-50 dark:bg-slate-950 dark:text-white ${
                        senderPhone.length === 0 || phoneIsValid
                          ? 'border-slate-200 focus:border-indigo-500 focus:ring-indigo-500 dark:border-slate-700'
                          : 'border-amber-400 focus:border-amber-500 focus:ring-amber-500 dark:border-amber-500/60'
                      }`}
                    />
                    {senderPhone.length > 0 && !phoneIsValid && (
                      <p className="mt-1 flex items-center gap-1.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                        <AlertCircle className="h-3 w-3" />
                        Start with 0 or +251 (e.g. 0912 345 678).
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Note (optional)
                  </label>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={2}
                    placeholder="Anything the admin should know"
                    disabled={submitting}
                    className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  />
                </div>
              </div>

                        {/* Error */}
              {error && (
                <div
                  role="alert"
                  className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-xs leading-relaxed text-red-600 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-400 space-y-2"
                >
                  <div>{error}</div>
                  {(error.toLowerCase().includes('already have a pending') ||
                    error.toLowerCase().includes('pending manual payment')) && (
                    <Link
                      to="/payment/manual/status"
                      onClick={onClose}
                      className="inline-flex items-center gap-1 font-bold underline hover:no-underline"
                    >
                      View my pending payments →
                    </Link>
                  )}
                </div>
              )}

              {/* Warning above submit */}
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 dark:border-amber-500/30 dark:bg-amber-500/10">
                <div className="flex items-start gap-2.5">
                  <ShieldCheck className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                  <div>
                    <p className="text-[11px] font-bold text-amber-900 dark:text-amber-300">
                      Every submission is verified
                    </p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-amber-800/80 dark:text-amber-400/80">
                      We match each reference against our bank statement before
                      approving. Falsified or reused references result in
                      permanent account suspension.
                    </p>
                  </div>
                </div>
              </div>

              {/* Submit hint */}
              {submitDisabledReason && (
                <p className="text-center text-[11px] text-slate-500 dark:text-slate-400">
                  {submitDisabledReason}
                </p>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={submitting}
                  className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>

                            <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting || !referenceIsValid || !gatesPassed || !phoneIsValid}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-500/20 transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      <span>Submit Reference</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ManualPaymentModal
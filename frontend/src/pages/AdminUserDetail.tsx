import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Crown,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Target,
  Bot,
  CreditCard,
  UserPlus,
  Mail,
  ShieldCheck,
  Loader2,
} from 'lucide-react'
import { apiClient } from '../api/client'



interface TimelineEvent {
  type: string
  label: string
  at: string
  meta: Record<string, unknown> | null
}

interface PaymentRecord {
  id: string
  amount: number
  currency: string
  status: string
  payment_method: string | null
  tx_ref: string
  chapa_transaction_id: string | null
  created_at: string | null
  verified_at: string | null
}

interface UserDetail {
  user: {
    id: string
    email: string
    full_name: string
    university: string | null
    year_of_study: number | null
    role: string
    subscription_tier: string
    subscription_expires_at: string | null
    is_active: boolean
    email_verified: boolean
    email_verified_at: string | null
    exam_date: string | null
    is_2fa_enabled: boolean
    created_at: string | null
    last_active: string | null
    ai_usage_count: number
    days_since_signup: number | null
    days_since_active: number | null
  }


  stats: {
    quiz_attempts: number
    quiz_avg_score: number | null
    quiz_best_score: number | null
    mock_exams: number
    mock_avg_score: number | null
    mock_best_score: number | null
    tutor_sessions: number
    tutor_messages: number
    payments_count: number
    payments_total: number
  }
  subscription: {
    status: string | null
    started_at: string | null
    expires_at: string | null
    plan_name: string | null
  } | null
  payments: PaymentRecord[] 
  timeline: TimelineEvent[]
}

function formatDateTime(iso: string | null): string {
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

function relativeDays(days: number | null): string {
  if (days === null) return '—'
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`
  return `${Math.floor(days / 30)} months ago`
}

function formatPaymentMethod(m: string | null): string {
  if (!m || m === 'chapa') return 'Chapa'
  if (m === 'manual_cbe') return 'CBE (manual)'
  if (m === 'manual_telebirr') return 'Telebirr (manual)'
  if (m === 'manual_awash') return 'Awash (manual)'
  return m
}

function statusBadgeClass(status: string): string {
  switch (status.toLowerCase()) {
    case 'success':
      return 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 ring-emerald-500/20'
    case 'pending':
      return 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 ring-amber-500/20'
    case 'failed':
      return 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 ring-rose-500/20'
    case 'cancelled':
    case 'expired':
    default:
      return 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 ring-slate-500/20'
  }
}

const EVENT_ICON: Record<string, typeof Clock> = {
  register: UserPlus,
  verify: Mail,
  quiz: Target,
  mock_exam: Target,
  tutor: Bot,
  payment: CreditCard,
}

const EVENT_COLOR: Record<string, string> = {
  register: 'text-blue-500 bg-blue-50 dark:bg-blue-500/10',
  verify: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10',
  quiz: 'text-indigo-500 bg-indigo-50 dark:bg-indigo-500/10',
  mock_exam: 'text-purple-500 bg-purple-50 dark:bg-purple-500/10',
  tutor: 'text-amber-500 bg-amber-50 dark:bg-amber-500/10',
  payment: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10',
}

export function AdminUserDetailPage() {
  const { userId } = useParams<{ userId: string }>()
  const navigate = useNavigate()
  const [data, setData] = useState<UserDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    setLoading(true)
    apiClient
      .get<UserDetail>(`/api/admin/users/${userId}/detail`)
      .then((res) => {
        if (!cancelled) setData(res.data)
      })
      .catch((err) => {
        if (!cancelled) {
          const detail = err?.response?.data?.detail
          setError(typeof detail === 'string' ? detail : 'Could not load user.')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [userId])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="max-w-3xl mx-auto py-12 px-6">
        <button
          onClick={() => navigate('/admin/users')}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Users
        </button>
        <div className="rounded-2xl border border-rose-200 bg-rose-50 dark:border-rose-900/40 dark:bg-rose-950/20 p-6 text-sm text-rose-700 dark:text-rose-400">
          {error || 'User not found.'}
        </div>
      </div>
    )
  }

  const { user, stats, subscription, timeline } = data
  const isPremium = user.subscription_tier.toLowerCase() === 'premium'

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6 space-y-6">
      {/* Back */}
      <Link
        to="/admin/users"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Users
      </Link>

      {/* Header */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-start gap-4 min-w-0">
            <div className="w-14 h-14 shrink-0 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white flex items-center justify-center text-xl font-bold">
              {(user.full_name || 'U').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-slate-900 dark:text-white truncate">
                {user.full_name || 'Unnamed user'}
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
                {user.email}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {isPremium && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ring-1 ring-amber-500/20">
                    <Crown className="w-3 h-3 fill-amber-500" />
                    Premium
                  </span>
                )}
                {user.role === 'admin' && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ring-1 ring-blue-500/20">
                    <ShieldCheck className="w-3 h-3" />
                    Admin
                  </span>
                )}
                {user.email_verified ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ring-1 ring-emerald-500/20">
                    <CheckCircle2 className="w-3 h-3" />
                    Verified
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ring-1 ring-amber-500/20">
                    <AlertTriangle className="w-3 h-3" />
                    Unverified
                  </span>
                )}
                {!user.is_active && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ring-1 ring-rose-500/20">
                    Deactivated
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="shrink-0 text-right">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Joined
            </div>
            <div className="text-sm font-semibold text-slate-900 dark:text-white">
              {relativeDays(user.days_since_signup)}
            </div>
            <div className="mt-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Last active
            </div>
            <div className="text-sm font-semibold text-slate-900 dark:text-white">
              {relativeDays(user.days_since_active)}
            </div>
          </div>
        </div>

        {/* Detail row */}
        <div className="mt-5 pt-5 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              University
            </div>
            <div className="mt-0.5 text-slate-700 dark:text-slate-300">
              {user.university || '—'}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Year of study
            </div>
            <div className="mt-0.5 text-slate-700 dark:text-slate-300">
              {user.year_of_study ?? '—'}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Exam date
            </div>
            <div className="mt-0.5 text-slate-700 dark:text-slate-300">
              {user.exam_date
                ? new Date(user.exam_date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })
                : 'Not set'}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              2FA
            </div>
            <div className="mt-0.5 text-slate-700 dark:text-slate-300">
              {user.is_2fa_enabled ? 'Enabled' : 'Off'}
            </div>
          </div>
        </div>
      </section>

      {/* Stats grid */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          {
            label: 'Practice quizzes',
            value: stats.quiz_attempts,
            sub:
              stats.quiz_avg_score !== null
                ? `${stats.quiz_avg_score}% avg`
                : 'No attempts',
          },
          {
            label: 'Mock exams',
            value: stats.mock_exams,
            sub:
              stats.mock_avg_score !== null
                ? `${stats.mock_avg_score}% avg`
                : 'No attempts',
          },
          {
            label: 'Tutor sessions',
            value: stats.tutor_sessions,
            sub:
              stats.tutor_messages > 0
                ? `${stats.tutor_messages} messages`
                : 'No usage',
          },
          {
            label: 'Payments',
            value: stats.payments_count,
            sub:
              stats.payments_total > 0
                ? `${stats.payments_total} ETB total`
                : 'No payments',
          },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4"
          >
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {s.label}
            </div>
            <div className="mt-1 text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
              {s.value}
            </div>
            <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              {s.sub}
            </div>
          </div>
        ))}
      </section>

      {/* Subscription */}
      {subscription && (
        <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex items-center justify-between gap-4">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Subscription
            </div>
            <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
              {subscription.plan_name || 'Premium'}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Status: {subscription.status || 'active'}
              {subscription.expires_at
                ? ` · Expires ${formatDateTime(subscription.expires_at)}`
                : ' · Lifetime'}
            </div>
          </div>
        </section>
      )}
            {/* Payments */}
      {data.payments.length > 0 && (
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Payment history
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-left">
                  <th className="px-5 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Date
                  </th>
                  <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Amount
                  </th>
                  <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Method
                  </th>
                  <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Status
                  </th>
                  <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Reference
                  </th>
                  <th className="px-5 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Verified
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.payments.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-slate-50 dark:border-slate-800/60 last:border-0"
                  >
                    <td className="px-5 py-3 text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {formatDateTime(p.created_at)}
                    </td>
                    <td className="px-3 py-3 text-xs font-bold tabular-nums text-slate-900 dark:text-white whitespace-nowrap">
                      {p.amount.toFixed(0)} {p.currency}
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {formatPaymentMethod(p.payment_method)}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${statusBadgeClass(
                          p.status
                        )}`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-[11px] font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {p.chapa_transaction_id ||
                        (p.tx_ref.length > 24
                          ? p.tx_ref.slice(0, 24) + '…'
                          : p.tx_ref)}
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {p.verified_at ? formatDateTime(p.verified_at) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Timeline */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-4">
          Activity timeline
        </h2>

        {timeline.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400 py-6 text-center">
            No activity recorded yet.
          </p>
        ) : (
          <ol className="space-y-3">
            {timeline.map((event, idx) => {
              const Icon = EVENT_ICON[event.type] || Clock
              const colors =
                EVENT_COLOR[event.type] ||
                'text-slate-500 bg-slate-50 dark:bg-slate-800'
              return (
                <li
                  key={idx}
                  className="flex items-start gap-3 text-sm"
                >
                  <div
                    className={`w-8 h-8 shrink-0 rounded-lg flex items-center justify-center ${colors}`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0 pt-1">
                    <div className="text-slate-900 dark:text-white truncate">
                      {event.label}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      {formatDateTime(event.at)}
                      {event.meta &&
                        typeof event.meta.score === 'number' &&
                        ` · Score: ${event.meta.score}%`}
                    </div>
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </section>
    </div>
  )
}

export default AdminUserDetailPage
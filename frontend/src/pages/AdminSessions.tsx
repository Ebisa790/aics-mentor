import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Loader2,
  Monitor,
  Smartphone,
  Tablet,
  HelpCircle,
  ShieldCheck,
  LogOut,
  RefreshCw,
  AlertTriangle,
  X,
} from 'lucide-react'
import { apiClient } from '../api/client'

type RoleFilter = 'all' | 'admin' | 'student'

interface SessionUser {
  id: string
  full_name: string
  email: string
  role: string
}

interface SessionRow {
  id: string
  session_jti: string
  user: SessionUser
  device_name: string
  device_type: string
  browser: string
  ip_address: string
  last_active: string | null
  is_trusted: boolean
  is_current: boolean
}

function relativeTime(iso: string | null): string {
  if (!iso) return '—'
  try {
    const t = new Date(iso).getTime()
    if (isNaN(t)) return '—'
    const diff = Math.max(0, Math.floor((Date.now() - t) / 1000))
    if (diff < 60) return 'Just now'
    if (diff < 3600) return `${Math.floor(diff / 60)} min ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`
    return `${Math.floor(diff / 86400)} days ago`
  } catch {
    return '—'
  }
}

function isActiveRecent(iso: string | null): boolean {
  if (!iso) return false
  try {
    const t = new Date(iso).getTime()
    if (isNaN(t)) return false
    return Date.now() - t < 5 * 60 * 1000 // 5 minutes
  } catch {
    return false
  }
}

function DeviceIcon({ type }: { type: string }) {
  if (type === 'mobile') return <Smartphone className="w-4 h-4" />
  if (type === 'tablet') return <Tablet className="w-4 h-4" />
  if (type === 'desktop') return <Monitor className="w-4 h-4" />
  return <HelpCircle className="w-4 h-4" />
}

export function AdminSessionsPage() {
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<RoleFilter>('all')
  const [confirmRevoke, setConfirmRevoke] = useState<SessionRow | null>(null)
  const [revoking, setRevoking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const params: Record<string, string> = {}
      if (filter !== 'all') params.role = filter
      const res = await apiClient.get<SessionRow[]>('/api/admin/sessions', { params })
      setSessions(res.data)
    } catch (err) {
      console.error('Failed to load sessions', err)
      setError('Could not load active sessions. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter])

  const handleRevoke = async () => {
    if (!confirmRevoke) return
    setRevoking(true)
    setError(null)
    try {
      await apiClient.delete(`/api/admin/sessions/${confirmRevoke.id}`)
      setConfirmRevoke(null)
      await load()
    } catch (err: any) {
      const detail = err?.response?.data?.detail
      setError(typeof detail === 'string' ? detail : 'Could not revoke session.')
      setConfirmRevoke(null)
    } finally {
      setRevoking(false)
    }
  }

  const tabs: Array<{ id: RoleFilter; label: string }> = [
    { id: 'all', label: 'All' },
    { id: 'admin', label: 'Admins' },
    { id: 'student', label: 'Students' },
  ]

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <Link
          to="/admin"
          className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
        >
          ← Admin
        </Link>
        <h1 className="font-display text-2xl font-semibold mt-2 text-slate-900 dark:text-slate-100">
          Active Sessions
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
          Every device currently logged into the platform. Revoke any
          session to force a logout.
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          {tabs.map((tab) => {
            const active = filter === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition ${
                  active
                    ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-900 dark:border-slate-100'
                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                }`}
              >
                {tab.label}
              </button>
            )
          })}
        </div>

        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-400 flex items-start justify-between gap-3">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="shrink-0 rounded-md p-0.5 hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-colors"
            aria-label="Dismiss error"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Sessions list */}
      {loading && sessions.length === 0 ? (
        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 py-6">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading sessions…
        </div>
      ) : sessions.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No active sessions found.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {sessions.map((s) => {
            const recent = isActiveRecent(s.last_active)
            const isAdmin = s.user.role === 'admin'

            return (
              <div
                key={s.id}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex items-start justify-between gap-4 shadow-sm"
              >
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  {/* Status dot */}
                  <div className="shrink-0 pt-1.5">
                    <span
                      className={`block w-2 h-2 rounded-full ${
                        recent ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
                      }`}
                      title={recent ? 'Active now' : 'Idle'}
                    />
                  </div>

                  {/* Device icon */}
                  <div className="shrink-0 w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 flex items-center justify-center">
                    <DeviceIcon type={s.device_type} />
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-sm text-slate-900 dark:text-slate-100 truncate">
                        {s.user.full_name}
                      </span>
                      {isAdmin && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 px-2 py-0.5 rounded-full">
                          <ShieldCheck className="w-3 h-3" />
                          Admin
                        </span>
                      )}
                      {s.is_current && (
                        <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 px-2 py-0.5 rounded-full">
                          This device
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {s.user.email}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                      {s.browser || 'Unknown browser'} · {s.device_name || s.device_type} ·{' '}
                      <span className="font-mono">{s.ip_address}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                      Last active {relativeTime(s.last_active)}
                    </div>
                  </div>
                </div>

                {/* Action */}
                {!s.is_current && (
                  <button
                    type="button"
                    onClick={() => setConfirmRevoke(s)}
                    className="shrink-0 inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/20 transition"
                    title="Force this device to log out"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Revoke
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Confirmation modal */}
      {confirmRevoke && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/70 dark:bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => !revoking && setConfirmRevoke(null)}
        >
          <div
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Revoke this session?
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                  <strong className="text-slate-800 dark:text-slate-200">
                    {confirmRevoke.user.full_name}
                  </strong>{' '}
                  will be logged out immediately on{' '}
                  <strong>{confirmRevoke.device_name || confirmRevoke.device_type}</strong>.
                  They can log back in at any time.
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 p-3 text-xs space-y-1.5">
              <div className="flex justify-between gap-3">
                <span className="text-slate-500 dark:text-slate-400">Browser</span>
                <span className="text-slate-800 dark:text-slate-200 font-medium text-right truncate">
                  {confirmRevoke.browser || '—'}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-slate-500 dark:text-slate-400">IP address</span>
                <span className="text-slate-800 dark:text-slate-200 font-mono">
                  {confirmRevoke.ip_address}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-slate-500 dark:text-slate-400">Last active</span>
                <span className="text-slate-800 dark:text-slate-200">
                  {relativeTime(confirmRevoke.last_active)}
                </span>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmRevoke(null)}
                disabled={revoking}
                className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRevoke}
                disabled={revoking}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white px-4 py-2.5 text-sm font-bold transition-colors active:scale-95 disabled:opacity-50"
              >
                {revoking ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <LogOut className="w-4 h-4" />
                )}
                {revoking ? 'Revoking…' : 'Revoke session'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminSessionsPage
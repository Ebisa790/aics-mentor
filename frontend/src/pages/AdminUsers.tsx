import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, Trash2, AlertTriangle, X, Loader2 } from 'lucide-react'
import { adminUserApi } from '../api'
import type { AdminUser } from '../api/types'
import { useAuth } from '../context/AuthContext'

type VerifiedFilter = 'all' | 'verified' | 'unverified'

export function AdminUsersPage() {
  const { user: me } = useAuth()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [search, setSearch] = useState('')
  const [filterVerified, setFilterVerified] = useState<VerifiedFilter>('all')
  const [isLoading, setIsLoading] = useState(true)
  const [confirmDelete, setConfirmDelete] = useState<AdminUser | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // FIX 2 — typed params instead of `any`
  const load = async (q?: string) => {
    setIsLoading(true)   // FIX 3 — set loading on every search/refresh
    try {
      const params: Record<string, string> = {}
      if (q) params.search = q

      const res = await adminUserApi.list(params)
      const userData = Array.isArray(res) ? res : (res as any).data || []
      setUsers(userData)
    } catch (err) {
      console.error('Failed to load users', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSearch = (value: string) => {
    setSearch(value)
    load(value)
  }

  const clearSearch = () => {
    setSearch('')
    load('')
  }

  const patch = async (
    id: string,
    data: Partial<Pick<AdminUser, 'role' | 'subscription_tier' | 'is_active'>>,
  ) => {
    await adminUserApi.update(id, data)
    await load(search)
  }

  const handleDelete = async () => {
    if (!confirmDelete) return
    setIsDeleting(true)
    setError(null)
    try {
      await adminUserApi.delete(confirmDelete.id)
      setConfirmDelete(null)
      await load(search)
    } catch (err: any) {
      setError(
        err?.response?.data?.detail ||
          err?.response?.data?.error ||
          'Could not delete user. Please try again.',
      )
    } finally {
      setIsDeleting(false)
    }
  }

  const verifiedCount = users.filter((u) => u.email_verified).length
  const unverifiedCount = users.length - verifiedCount

  const visibleUsers = users.filter((u) => {
    if (filterVerified === 'verified') return u.email_verified
    if (filterVerified === 'unverified') return !u.email_verified
    return true
  })

  const tabs: Array<{ id: VerifiedFilter; label: string; count: number }> = [
    { id: 'all', label: 'All', count: users.length },
    { id: 'verified', label: 'Verified', count: verifiedCount },
    { id: 'unverified', label: 'Unverified', count: unverifiedCount },
  ]

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div>
        <Link
          to="/admin"
          className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
        >
          ← Admin
        </Link>
        <h1 className="font-display text-2xl font-semibold mt-2 text-slate-900 dark:text-slate-100">
          Users
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
          Search students, grant/revoke Premium, change roles, deactivate or
          delete accounts.
        </p>
      </div>

      {/* Search — FIX 5: clear button */}
      <div className="relative max-w-sm">
        <input
          className="w-full h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 pr-9 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
        />
        {search.length > 0 && (
          <button
            type="button"
            onClick={clearSearch}
            className="absolute right-2 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
            aria-label="Clear search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {tabs.map((tab) => {
          const active = filterVerified === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterVerified(tab.id)}
              className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border transition ${
                active
                  ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-900 dark:border-slate-100'
                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`inline-flex items-center justify-center min-w-[20px] h-[18px] px-1.5 rounded text-[10px] font-black tabular-nums ${
                  active
                    ? 'bg-white/20 text-white dark:bg-slate-900/20 dark:text-slate-900'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                {tab.count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-400 flex items-start justify-between gap-3">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="shrink-0 rounded-md p-0.5 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-colors"
            aria-label="Dismiss error"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 py-6">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading…
        </div>
      ) : visibleUsers.length === 0 ? (
        <div className="text-slate-500 dark:text-slate-400 text-sm py-8 text-center">
          No users match this filter.
        </div>
      ) : (
        <div className="space-y-2">
          {visibleUsers.map((u) => (
            <div
              key={u.id}
              className={`rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex items-center justify-between gap-4 shadow-sm transition-colors ${
                !u.is_active ? 'opacity-60' : ''
              }`}
            >
              {/* User info */}
              <div className="min-w-0">
                <div className="font-medium text-sm truncate flex items-center gap-2 flex-wrap text-slate-900 dark:text-slate-100">
                  <span>{u.full_name}</span>
                  {u.id === me?.id && (
                    <span className="text-xs text-slate-400 dark:text-slate-500">
                      (you)
                    </span>
                  )}
                  {u.email_verified ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 px-2 py-0.5 rounded-full">
                      <CheckCircle2 className="h-3 w-3" />
                      Verified
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 px-2 py-0.5 rounded-full">
                      <AlertTriangle className="h-3 w-3" />
                      Unverified
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  {u.email}
                </div>
                {!u.is_active && (
                  <div className="text-xs text-rose-600 dark:text-rose-400 mt-0.5">
                    Deactivated
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0">
                <select
                  className="h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-0 text-xs text-slate-700 dark:text-slate-200 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
                  value={u.role}
                  onChange={(e) =>
                    patch(u.id, { role: e.target.value as AdminUser['role'] })
                  }
                  disabled={u.id === me?.id}
                >
                  <option value="student">Student</option>
                  <option value="admin">Admin</option>
                </select>

                <select
                  className="h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-0 text-xs text-slate-700 dark:text-slate-200 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  value={u.subscription_tier}
                  onChange={(e) =>
                    patch(u.id, {
                      subscription_tier: e.target
                        .value as AdminUser['subscription_tier'],
                    })
                  }
                >
                  <option value="free">Free</option>
                  <option value="premium">Premium</option>
                </select>

                <button
                  type="button"
                  onClick={() => patch(u.id, { is_active: !u.is_active })}
                  disabled={u.id === me?.id}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-colors disabled:opacity-40 ${
                    u.is_active
                      ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-500/20'
                      : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20'
                  }`}
                >
                  {u.is_active ? 'Deactivate' : 'Reactivate'}
                </button>

                {/* FIX 4 — larger hit target on Delete button */}
                {!u.email_verified && u.id !== me?.id && (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(u)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-colors"
                    title="Permanently delete this unverified account"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/70 dark:bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => !isDeleting && setConfirmDelete(null)}
        >
          <div
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Delete this account?
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                  <strong className="text-slate-800 dark:text-slate-200">
                    {confirmDelete.full_name}
                  </strong>{' '}
                  ({confirmDelete.email}) will be permanently removed along
                  with any attempts and history. This cannot be undone.
                </p>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                disabled={isDeleting}
                className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white px-4 py-2.5 text-sm font-bold transition-colors active:scale-95 disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Deleting…</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    <span>Delete account</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, Trash2, AlertTriangle } from 'lucide-react'
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

  const load = async (q?: string) => {
    try {
      const params: any = {}
      if (q) params.search = q

      const res = await adminUserApi.list(params)
      const userData = Array.isArray(res) ? res : (res as any).data || []
      setUsers(userData)
    } catch (err) {
      console.error('Failed to load users', err)
    }
  }

  useEffect(() => {
    load().finally(() => setIsLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSearch = (value: string) => {
    setSearch(value)
    load(value)
  }

  const patch = async (
    id: string,
    data: Partial<Pick<AdminUser, 'role' | 'subscription_tier' | 'is_active'>>
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
          'Could not delete user. Please try again.'
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
      <div>
        <Link to="/admin" className="text-sm text-ink/50 hover:text-ink">
          ← Admin
        </Link>
        <h1 className="font-display text-2xl font-semibold mt-2">Users</h1>
        <p className="text-ink/60 mt-1">
          Search students, grant/revoke Premium, change roles, deactivate or
          delete accounts.
        </p>
      </div>

      <input
        className="input max-w-sm"
        placeholder="Search by name or email…"
        value={search}
        onChange={(e) => handleSearch(e.target.value)}
      />

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
                  ? 'bg-ink text-white border-ink'
                  : 'bg-white text-ink/70 border-ink/10 hover:border-ink/25'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`inline-flex items-center justify-center min-w-[20px] h-[18px] px-1.5 rounded text-[10px] font-black tabular-nums ${
                  active ? 'bg-white/20 text-white' : 'bg-ink/5 text-ink/60'
                }`}
              >
                {tab.count}
              </span>
            </button>
          )
        })}
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="text-ink/50 text-sm">Loading…</div>
      ) : visibleUsers.length === 0 ? (
        <div className="text-ink/50 text-sm py-8 text-center">
          No users match this filter.
        </div>
      ) : (
        <div className="space-y-2">
          {visibleUsers.map((u) => (
            <div
              key={u.id}
              className={`card p-4 flex items-center justify-between gap-4 ${
                !u.is_active ? 'opacity-50' : ''
              }`}
            >
              <div className="min-w-0">
                <div className="font-medium text-sm truncate flex items-center gap-2 flex-wrap">
                  <span>{u.full_name}</span>
                  {u.id === me?.id && (
                    <span className="text-xs text-ink/40">(you)</span>
                  )}
                  {u.email_verified ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                      <CheckCircle2 className="h-3 w-3" />
                      Verified
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                      <AlertTriangle className="h-3 w-3" />
                      Unverified
                    </span>
                  )}
                </div>
                <div className="text-xs text-ink/50 truncate">{u.email}</div>
                {!u.is_active && (
                  <div className="text-xs text-danger mt-0.5">Deactivated</div>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <select
                  className="input py-1 text-xs w-auto"
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
                  className="input py-1 text-xs w-auto"
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
                  className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                    u.is_active
                      ? 'bg-danger/10 text-danger'
                      : 'bg-accent-light text-accent-dark'
                  } disabled:opacity-40`}
                >
                  {u.is_active ? 'Deactivate' : 'Reactivate'}
                </button>

                {!u.email_verified && u.id !== me?.id && (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(u)}
                    className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 hover:bg-rose-100 transition"
                    title="Permanently delete this unverified account"
                  >
                    <Trash2 className="h-3 w-3" />
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
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => !isDeleting && setConfirmDelete(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold">Delete this account?</h3>
                <p className="text-sm text-ink/70 mt-1 leading-relaxed">
                  <strong>{confirmDelete.full_name}</strong> (
                  {confirmDelete.email}) will be permanently removed along with
                  any attempts and history. This cannot be undone.
                </p>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                disabled={isDeleting}
                className="flex-1 rounded-xl border border-ink/10 px-4 py-2.5 text-sm font-semibold hover:bg-ink/5 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex-1 rounded-xl bg-rose-600 hover:bg-rose-700 text-white px-4 py-2.5 text-sm font-bold disabled:opacity-50"
              >
                {isDeleting ? 'Deleting…' : 'Delete account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
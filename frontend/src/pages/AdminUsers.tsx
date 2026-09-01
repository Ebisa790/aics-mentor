import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { adminUserApi } from '../api'
import type { AdminUser } from '../api/types'
import { useAuth } from '../context/AuthContext'

export function AdminUsersPage() {
  const { user: me } = useAuth()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [search, setSearch] = useState('')
  const [filterActive] = useState<'all' | 'active' | 'inactive'>('all')
  const [filterTier] = useState<'all' | 'free' | 'premium'>('all')
  const [filterRole] = useState<'all' | 'student' | 'admin'>('all')
  const [isLoading, setIsLoading] = useState(true)

  const load = async (q?: string, active?: string, tier?: string, role?: string) => {
    try {
      const params: any = {}
      if (q) params.search = q
      if (active && active !== 'all') params.is_active = active === 'active'
      if (tier && tier !== 'all') params.subscription_tier = tier
      if (role && role !== 'all') params.role = role
      
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
    load(value, filterActive, filterTier, filterRole)
  }

  const patch = async (id: string, data: Partial<Pick<AdminUser, 'role' | 'subscription_tier' | 'is_active'>>) => {
    await adminUserApi.update(id, data)
    await load(search, filterActive, filterTier, filterRole)
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <Link to="/admin" className="text-sm text-ink/50 hover:text-ink">
          ← Admin
        </Link>
        <h1 className="font-display text-2xl font-semibold mt-2">Users</h1>
        <p className="text-ink/60 mt-1">Search students, grant/revoke Premium, change roles, deactivate accounts.</p>
      </div>

      <input
        className="input max-w-sm"
        placeholder="Search by name or email…"
        value={search}
        onChange={(e) => handleSearch(e.target.value)}
      />

      {isLoading ? (
        <div className="text-ink/50 text-sm">Loading…</div>
      ) : (
        <div className="space-y-2">
          {users.map((u) => (
            <div key={u.id} className={`card p-4 flex items-center justify-between gap-4 ${!u.is_active ? 'opacity-50' : ''}`}>
              <div className="min-w-0">
                <div className="font-medium text-sm truncate">
                  {u.full_name} {u.id === me?.id && <span className="text-xs text-ink/40">(you)</span>}
                </div>
                <div className="text-xs text-ink/50 truncate">{u.email}</div>
                {!u.is_active && <div className="text-xs text-danger mt-0.5">Deactivated</div>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <select
                  className="input py-1 text-xs w-auto"
                  value={u.role}
                  onChange={(e) => patch(u.id, { role: e.target.value as AdminUser['role'] })}
                  disabled={u.id === me?.id}
                >
                  <option value="student">Student</option>
                  <option value="admin">Admin</option>
                </select>
                <select
                  className="input py-1 text-xs w-auto"
                  value={u.subscription_tier}
                  onChange={(e) => patch(u.id, { subscription_tier: e.target.value as AdminUser['subscription_tier'] })}
                >
                  <option value="free">Free</option>
                  <option value="premium">Premium</option>
                </select>
                <button
                  type="button"
                  onClick={() => patch(u.id, { is_active: !u.is_active })}
                  disabled={u.id === me?.id}
                  className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                    u.is_active ? 'bg-danger/10 text-danger' : 'bg-accent-light text-accent-dark'
                  } disabled:opacity-40`}
                >
                  {u.is_active ? 'Deactivate' : 'Reactivate'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
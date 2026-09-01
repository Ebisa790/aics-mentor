import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function AdminRoute() {
  const { user, isLoading } = useAuth()

  // Don't redirect while the /me call is still in flight — otherwise `user` is
  // momentarily null on every page load and this fires a false redirect.
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-ink/50">
        Loading&hellip;
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  // Compare against the backend's actual enum value ("admin", lowercase) — not
  // 'ADMIN' or 'Admin'. This is the single most common cause of "admin gets
  // redirected away" bugs: the backend enum and the frontend check drift apart.
  if (user.role !== 'admin') {
    return <Navigate to="/dashboard" replace />
  }

  return <Outlet />
}
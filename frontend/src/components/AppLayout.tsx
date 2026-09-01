import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { LifeBuoy, FileText, LayoutDashboard, BookOpen, FileQuestion, MessageCircle, ShieldCheck } from 'lucide-react'

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/courses', label: 'Courses', icon: BookOpen },
  { to: '/notes', label: 'Notes', icon: FileText },
  { to: '/mock-exams', label: 'Mock Exams', icon: FileQuestion },
  { to: '/tutor', label: 'Study Assistant', icon: MessageCircle },
  { to: '/support', label: 'Support', icon: LifeBuoy },
]

export function AppLayout() {
  const { user, logout } = useAuth()

  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(false)

  const toggleSidebar = () => setIsSidebarOpen((prev) => !prev)
  const closeSidebar = () => setIsSidebarOpen(false)

  // Keep dark mode consistent with the user's system preference
  // while still allowing manual toggling.
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme')

    if (savedTheme === 'dark') {
      setIsDarkMode(true)
      document.documentElement.classList.add('dark')
      return
    }

    if (savedTheme === 'light') {
      setIsDarkMode(false)
      document.documentElement.classList.remove('dark')
      return
    }

    const prefersDark = window.matchMedia(
      '(prefers-color-scheme: dark)'
    ).matches

    setIsDarkMode(prefersDark)

    if (prefersDark) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [])

  const toggleDarkMode = () => {
    setIsDarkMode((prev) => {
      const next = !prev

      if (next) {
        document.documentElement.classList.add('dark')
        localStorage.setItem('theme', 'dark')
      } else {
        document.documentElement.classList.remove('dark')
        localStorage.setItem('theme', 'light')
      }

      return next
    })
  }

  // Compute initials for fallback avatar
  const userInitials = user?.full_name
    ? user.full_name
        .split(' ')
        .filter(Boolean)
        .map((name) => name[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'US'

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200">

      {/* =========================================================
          TOP HEADER
      ========================================================= */}
      <header className="sticky top-0 z-30 h-14 shrink-0 border-b border-white/10 bg-primary px-3 shadow-md sm:px-4">
        <div className="mx-auto flex h-full max-w-7xl items-center justify-between">

          {/* Left side */}
          <div className="flex items-center gap-2.5">

            {/* Hamburger */}
            <button
              onClick={toggleSidebar}
              className="rounded-lg p-2 text-white/80 transition-all hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
              aria-label="Toggle navigation menu"
              aria-expanded={isSidebarOpen}
              title="Menu"
            >
              <svg
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>

            {/* Logo */}
            <Link
              to="/dashboard"
              className="font-display text-base font-semibold leading-tight text-white sm:text-lg"
            >
              ExitAI Ethiopia
            </Link>
          </div>

          {/* Center badge */}
          <div className="hidden items-center rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-400 sm:flex sm:text-xs">
            Ethiopian CS Prep
          </div>

          {/* Right side */}
          <div className="flex items-center gap-1">

            {/* Support link for quick access */}
            <Link
              to="/support"
              className="hidden sm:flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white"
              title="Get Help"
            >
              <LifeBuoy className="w-4 h-4" />
              <span>Support</span>
            </Link>

            {/* Dark mode */}
            <button
              onClick={toggleDarkMode}
              className="rounded-lg p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
              title={
                isDarkMode
                  ? 'Switch to Light Mode'
                  : 'Switch to Dark Mode'
              }
              aria-label={
                isDarkMode
                  ? 'Switch to Light Mode'
                  : 'Switch to Dark Mode'
              }
            >
              {isDarkMode ? (
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                  />
                </svg>
              ) : (
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* =========================================================
          MAIN AREA
      ========================================================= */}
      <div className="relative flex flex-1 overflow-hidden">

        {/* =======================================================
            SIDEBAR BACKDROP
        ======================================================= */}
        {isSidebarOpen && (
          <div
            onClick={closeSidebar}
            className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-[2px]"
            aria-hidden="true"
          />
        )}

        {/* =======================================================
            SLIDE-OUT SIDEBAR
        ======================================================= */}
        <aside
          className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-primary text-white shadow-2xl transition-transform duration-300 ease-in-out ${
            isSidebarOpen
              ? 'translate-x-0'
              : '-translate-x-full'
          }`}
        >

          {/* Sidebar header */}
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-5">
            <Link
              to="/dashboard"
              onClick={closeSidebar}
              className="min-w-0"
            >
              <div className="font-display text-lg font-semibold leading-tight">
                ExitAI Ethiopia
              </div>

              <div className="mt-0.5 text-xs text-white/50">
                Exit Exam Preparation
              </div>
            </Link>

            {/* Close */}
            <button
              onClick={closeSidebar}
              className="rounded-lg p-1.5 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
              aria-label="Close sidebar"
              title="Close"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* =====================================================
              NAVIGATION
          ===================================================== */}
          <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={closeSidebar}
                  className={({ isActive }) =>
                    `group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-white/10 text-white shadow-sm'
                        : 'text-white/70 hover:bg-white/5 hover:text-white'
                    }`
                  }
                >
                  <Icon className="w-4 h-4 text-white/50 group-hover:text-white" />
                  <span>{item.label}</span>
                </NavLink>
              )
            })}

            {/* Admin */}
            {user?.role === 'admin' && (
              <NavLink
                to="/admin"
                onClick={closeSidebar}
                className={({ isActive }) =>
                  `group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-white/10 text-white shadow-sm'
                      : 'text-white/70 hover:bg-white/5 hover:text-white'
                  }`
                }
              >
                <ShieldCheck className="w-4 h-4 text-white/50 group-hover:text-white" />
                <span>Admin</span>
              </NavLink>
            )}
          </nav>

          {/* =====================================================
              USER FOOTER
          ===================================================== */}
          <div className="space-y-3 border-t border-white/10 bg-slate-950/20 p-4">

            {/* Profile */}
            <Link
              to="/profile"
              onClick={closeSidebar}
              className="group -m-1.5 flex items-center gap-3 rounded-xl p-1.5 transition-all hover:bg-white/5"
              title="View Profile"
            >
              <div className="relative shrink-0">

                {user?.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt={user.full_name || 'User Profile'}
                    className="h-10 w-10 rounded-full object-cover shadow-sm ring-2 ring-emerald-400/80 transition-all group-hover:ring-emerald-300"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/20 text-xs font-bold text-emerald-400 shadow-sm transition-all group-hover:border-emerald-400">
                    {userInitials}
                  </div>
                )}

                {/* Online indicator */}
                <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-primary" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold leading-tight text-white transition-colors group-hover:text-emerald-300">
                  {user?.full_name || 'User'}
                </div>

                <div className="mt-0.5 truncate text-xs text-white/50">
                  {user?.email}
                </div>
              </div>
            </Link>

            {/* Sign out */}
            <button
              onClick={() => {
                closeSidebar()
                logout()
              }}
              className="group flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-white/70 transition-all hover:border-red-500/20 hover:bg-red-500/10 hover:text-red-300 active:scale-[0.98]"
            >
              <svg
                className="h-3.5 w-3.5 text-white/50 transition-colors group-hover:text-red-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>

              <span>Sign out</span>
            </button>
          </div>
        </aside>

        {/* =======================================================
            MAIN CONTENT
        ======================================================= */}
        <main className="w-full flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="mx-auto w-full max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
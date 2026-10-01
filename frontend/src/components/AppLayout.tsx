import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  LifeBuoy,
  FileText,
  LayoutDashboard,
  BookOpen,
  FileQuestion,
  MessageCircle,
  ShieldCheck,
  Menu,
  X,
  Sun,
  Moon,
  LogOut,
  PanelLeftClose,
  PanelLeft,
  Crown,
} from 'lucide-react'

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/courses', label: 'Courses', icon: BookOpen },
  { to: '/notes', label: 'Notes', icon: FileText },
  { to: '/mock-exams', label: 'Mock Exams', icon: FileQuestion },
  { to: '/tutor', label: 'Study Assistant', icon: MessageCircle },
  { to: '/support', label: 'Support', icon: LifeBuoy },
]

// Map route prefix → header title
const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/courses': 'Courses',
  '/notes': 'Notes',
  '/mock-exams': 'Mock Exams',
  '/tutor': 'Study Assistant',
  '/support': 'Support',
  '/profile': 'Profile',
  '/admin': 'Admin',
}

function getPageTitle(pathname: string): string | null {
  // Exact match first
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname]
  // Then longest prefix match
  const match = Object.keys(PAGE_TITLES)
    .filter((p) => pathname.startsWith(p + '/'))
    .sort((a, b) => b.length - a.length)[0]
  if (match) return PAGE_TITLES[match]
  // Dashboard is the default — don't show a title on the dashboard itself
  if (pathname === '/dashboard') return null
  return null
}

export function AppLayout() {
  const { user, isPremium, logout } = useAuth()
  const location = useLocation()

  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(false)

  const closeSidebar = () => setIsSidebarOpen(false)

  useEffect(() => {
    setIsSidebarOpen(false)
  }, [location.pathname])

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
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    setIsDarkMode(prefersDark)
    document.documentElement.classList.toggle('dark', prefersDark)
  }, [])

  const toggleDarkMode = () => {
    setIsDarkMode((prev) => {
      const next = !prev
      document.documentElement.classList.toggle('dark', next)
      localStorage.setItem('theme', next ? 'dark' : 'light')
      return next
    })
  }

  const userInitials = user?.full_name
    ? user.full_name
        .split(' ')
        .filter(Boolean)
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'US'

  const isAdmin = user?.role === 'admin'
  const pageTitle = getPageTitle(location.pathname)

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 transition-colors duration-200 dark:bg-slate-950 dark:text-slate-100">
      {/* Mobile backdrop */}
      {isSidebarOpen && (
        <div
          onClick={closeSidebar}
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-[2px] lg:hidden"
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 flex flex-col
          bg-[#1E2A5E] text-white shadow-xl dark:bg-[#141C42]
          transition-all duration-300 ease-in-out
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:static lg:translate-x-0
          ${isCollapsed ? 'lg:w-[68px]' : 'lg:w-64'}
          w-64
        `}
      >
        {/* Header */}
        <div className="flex h-14 items-center justify-between border-b border-white/10 px-4">
          <Link
            to="/dashboard"
            onClick={closeSidebar}
            className="flex min-w-0 items-center gap-2"
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-emerald-500/20 text-xs font-bold text-emerald-400">
              AI
            </div>
            {!isCollapsed && (
              <span className="truncate font-display text-sm font-semibold leading-tight">
                ExitAI Ethiopia
              </span>
            )}
          </Link>

          <button
            onClick={closeSidebar}
            className="rounded-md p-1.5 text-white/60 hover:bg-white/10 hover:text-white lg:hidden"
            aria-label="Close sidebar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={closeSidebar}
                title={isCollapsed ? item.label : undefined}
                className={({ isActive }) =>
                  `group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-white/10 text-white'
                      : 'text-white/70 hover:bg-white/5 hover:text-white'
                  } ${isCollapsed ? 'lg:justify-center lg:px-2' : ''}`
                }
              >
                <Icon className="h-4 w-4 shrink-0 text-white/60 group-hover:text-white" />
                {!isCollapsed && <span>{item.label}</span>}
              </NavLink>
            )
          })}

          {isAdmin && (
            <>
              <div className="my-2 border-t border-white/10" />
              {!isCollapsed && (
                <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-white/40">
                  Admin
                </div>
              )}
              <NavLink
                to="/admin"
                onClick={closeSidebar}
                title={isCollapsed ? 'Admin' : undefined}
                className={({ isActive }) =>
                  `group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-white/10 text-white'
                      : 'text-white/70 hover:bg-white/5 hover:text-white'
                  } ${isCollapsed ? 'lg:justify-center lg:px-2' : ''}`
                }
              >
                <ShieldCheck className="h-4 w-4 shrink-0 text-white/60 group-hover:text-white" />
                {!isCollapsed && <span>Admin Panel</span>}
              </NavLink>
            </>
          )}
        </nav>

        {/* User footer */}
        <div className="border-t border-white/10 p-3">
          <Link
            to="/profile"
            onClick={closeSidebar}
            title={isCollapsed ? 'View profile' : undefined}
            className={`flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-white/5 ${
              isCollapsed ? 'lg:justify-center' : ''
            }`}
          >
            <div className="relative shrink-0">
              {user?.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={user.full_name || 'User'}
                  className="h-8 w-8 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/20 text-[11px] font-bold text-emerald-400">
                  {userInitials}
                </div>
              )}
              {isPremium && (
                <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-500 ring-2 ring-[#1E2A5E] dark:ring-[#141C42]">
                  <Crown className="h-2 w-2 fill-white text-white" />
                </span>
              )}
            </div>

            {!isCollapsed && (
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-semibold text-white">
                  {user?.full_name || 'User'}
                </div>
                <div className="truncate text-[11px] text-white/50">
                  {user?.email}
                </div>
              </div>
            )}
          </Link>

          <button
            onClick={() => {
              closeSidebar()
              logout()
            }}
            title={isCollapsed ? 'Sign out' : undefined}
            className={`mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium text-white/60 transition-colors hover:bg-red-500/10 hover:text-red-300 ${
              isCollapsed ? 'lg:justify-center lg:px-2' : ''
            }`}
          >
            <LogOut className="h-3.5 w-3.5" />
            {!isCollapsed && <span>Sign out</span>}
          </button>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-slate-200 bg-white/80 px-3 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/80 sm:px-4">
          {/* Mobile hamburger */}
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="rounded-md p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 lg:hidden"
            aria-label="Open navigation menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Desktop collapse toggle */}
          <button
            onClick={() => setIsCollapsed((v) => !v)}
            className="hidden rounded-md p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 lg:inline-flex"
            aria-label="Toggle sidebar"
          >
            {isCollapsed ? (
              <PanelLeft className="h-5 w-5" />
            ) : (
              <PanelLeftClose className="h-5 w-5" />
            )}
          </button>

          {/* Dynamic page title */}
          <div className="hidden min-w-0 flex-1 sm:block">
            {pageTitle && (
              <h1 className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                {pageTitle}
              </h1>
            )}
          </div>

          {/* Right side */}
          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={toggleDarkMode}
              className="rounded-md p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="mx-auto w-full max-w-6xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
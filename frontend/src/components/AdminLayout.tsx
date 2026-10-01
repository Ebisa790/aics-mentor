import { useState, useEffect } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  FileText,
  CreditCard,
  Users,
  DollarSign,
  BookOpen,
  MessageSquare,
  ClipboardCheck,
  Menu,
  LogOut,
  ChevronRight,
  TrendingUp,
  Moon,
  Sun,
  Activity,
  LifeBuoy,
  Wallet,
  ArrowLeft,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const ADMIN_NAV = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/analytics', label: 'Analytics', icon: Activity },
  { to: '/admin/drills', label: 'Code Trace Drills', icon: FileText },
  { to: '/admin/question-coverage', label: 'Question Coverage', icon: TrendingUp },
  { to: '/admin/users', label: 'User Management', icon: Users },
  { to: '/admin/pricing', label: 'Pricing Control', icon: DollarSign },
  { to: '/admin/courses', label: 'Content Management', icon: BookOpen },
  { to: '/admin/announcements', label: 'Announcements', icon: MessageSquare },
  { to: '/admin/review', label: 'Review Queue', icon: ClipboardCheck },
  { to: '/admin/support', label: 'Support Tickets', icon: LifeBuoy },
  { to: '/admin/transactions', label: 'Transactions', icon: CreditCard },
  { to: '/admin/manual-payments', label: 'Manual Payments', icon: Wallet },
]

export function AdminLayout() {
  const { user, logout } = useAuth()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(false)

  const location = useLocation()
  const navigate = useNavigate()

  // ── Dark mode: same contract as AppLayout so the two stay in sync ──
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

  // ── Close mobile drawer on route change ──
  useEffect(() => {
    setIsSidebarOpen(false)
  }, [location.pathname])

  const currentPage = ADMIN_NAV.find((item) =>
    item.end
      ? location.pathname === item.to
      : location.pathname.startsWith(item.to)
  )

  return (
    <div className="min-h-screen flex bg-slate-100 dark:bg-slate-950">
      {/* Mobile overlay */}
      {isSidebarOpen && (
        <div
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-slate-950/50 backdrop-blur-[2px] lg:hidden"
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-40 w-64 flex flex-col
          bg-slate-900 text-white shadow-xl dark:bg-[#0a0a1a]
          transition-transform duration-300 ease-in-out
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          ${isSidebarCollapsed ? 'lg:-translate-x-full' : 'lg:translate-x-0'}
        `}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-white/10 shrink-0">
          <Link to="/admin" className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-600/30 shrink-0">
              <LayoutDashboard className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <span className="font-bold text-sm block truncate">ExitAI Admin</span>
              <span className="text-[10px] text-slate-400">Control Panel</span>
            </div>
          </Link>

          {/* Close / collapse */}
          <button
            type="button"
            onClick={() => {
              setIsSidebarOpen(false)
              setIsSidebarCollapsed(true)
            }}
            className="text-slate-400 hover:text-white hover:bg-white/10 p-1.5 rounded-lg transition-colors shrink-0"
            title="Hide sidebar"
            aria-label="Hide sidebar"
          >
            <Menu className="w-4 h-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="py-3 px-2.5 space-y-0.5 flex-1 overflow-y-auto">
          {ADMIN_NAV.map((item) => {
            const isActive = item.end
              ? location.pathname === item.to
              : location.pathname.startsWith(item.to)
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    isActive ? 'text-white' : 'text-slate-500'
                  }`}
                />
                <span className="truncate">{item.label}</span>
                {isActive && (
                  <ChevronRight className="w-3.5 h-3.5 ml-auto shrink-0" />
                )}
              </NavLink>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-white/10 shrink-0 space-y-2">
          {/* Back to student view */}
          <Link
            to="/dashboard"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to student view</span>
          </Link>

          {/* User card */}
          <div className="flex items-center gap-3 px-2 py-1.5">
            <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-xs font-bold shadow-lg shrink-0">
              {user?.full_name?.charAt(0) || 'A'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate text-white">
                {user?.full_name || 'Admin'}
              </p>
              <p className="text-[11px] text-slate-400">Administrator</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              logout()
              navigate('/login')
            }}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      {/* Main column */}
      <div
        className={`flex-1 min-w-0 transition-[margin] duration-300 ease-in-out ${
          isSidebarCollapsed ? 'lg:ml-0' : 'lg:ml-64'
        }`}
      >
        {/* Header */}
        <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 sm:px-6 sticky top-0 z-20">
          <div className="flex items-center gap-3 min-w-0">
            {/* Menu (mobile) / expand (desktop) */}
            <button
              type="button"
              onClick={() => {
                setIsSidebarOpen(true)
                setIsSidebarCollapsed(false)
              }}
              className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Open navigation"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Breadcrumb */}
            <div className="hidden sm:flex items-center gap-2 text-sm min-w-0">
              <span className="text-slate-400 dark:text-slate-500">Admin</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 dark:text-slate-600 shrink-0" />
              <span className="font-semibold text-slate-900 dark:text-white truncate">
                {currentPage?.label || 'Dashboard'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* Dark mode */}
            <button
              type="button"
              onClick={toggleDarkMode}
              className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>

            {/* Support quick link */}
            <Link
              to="/admin/support"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-600/20"
            >
              <LifeBuoy className="w-3.5 h-3.5" />
              Support
            </Link>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
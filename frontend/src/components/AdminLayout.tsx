import { useState, useEffect } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { 
  LayoutDashboard,
  FileText, 
  Users, 
  DollarSign, 
  BookOpen, 
  MessageSquare, 
  ClipboardCheck,
  Menu,
  X,
  LogOut,
  ChevronRight,
  TrendingUp,
  Moon,
  Sun,
  Bell,
  Activity,
  LifeBuoy
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
]

export function AdminLayout() {
  const { user, logout } = useAuth()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    setIsDarkMode(prefersDark)
    if (prefersDark) {
      document.documentElement.classList.add('dark')
    }
  }, [])

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode)
    if (!isDarkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }

  const currentPage = ADMIN_NAV.find(item => 
    item.end ? location.pathname === item.to : location.pathname.startsWith(item.to)
  )

  return (
    <div className="min-h-screen flex bg-slate-100 dark:bg-slate-950">
      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 bg-slate-950/50 z-30 lg:hidden"
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-slate-900 text-white transition-transform duration-300 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} ${isSidebarCollapsed ? 'lg:-translate-x-full' : 'lg:translate-x-0'} flex flex-col`}>
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-slate-800 shrink-0">
          <Link to="/admin" className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-600/30">
              <LayoutDashboard className="w-4 h-4 text-white" />
            </div>
            <div>
              <span className="font-bold text-sm block">ExitAI Admin</span>
              <span className="text-[10px] text-slate-400">Control Panel</span>
            </div>
          </Link>
          <button 
            onClick={() => {
              setIsSidebarOpen(false)
              setIsSidebarCollapsed(true)
            }}
            className="text-slate-400 hover:text-white hover:bg-slate-800 p-1.5 rounded-lg transition-colors"
            title="Hide Sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="py-4 px-3 space-y-1 flex-1 overflow-y-auto">
          {ADMIN_NAV.map((item) => {
            const isActive = item.end 
              ? location.pathname === item.to 
              : location.pathname.startsWith(item.to)
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <item.icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                <span>{item.label}</span>
                {isActive && <ChevronRight className="w-3.5 h-3.5 ml-auto" />}
              </NavLink>
            )
          })}
        </nav>

        {/* User Info */}
        <div className="p-4 border-t border-slate-800 shrink-0">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-xs font-bold shadow-lg">
              {user?.full_name?.charAt(0) || 'A'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate text-white">{user?.full_name || 'Admin'}</p>
              <p className="text-xs text-slate-400">Administrator</p>
            </div>
          </div>
          <button
            onClick={() => {
              logout()
              navigate('/login')
            }}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className={`flex-1 transition-all ${isSidebarOpen ? 'lg:ml-64' : 'ml-0'} ${isSidebarCollapsed ? 'lg:ml-0' : ''}`}>
        {/* Top Bar */}
        <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-6 sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setIsSidebarOpen(true)
                setIsSidebarCollapsed(false)
              }}
              className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
            {/* Breadcrumb */}
            <div className="hidden sm:flex items-center gap-2 text-sm">
              <span className="text-slate-400 dark:text-slate-500">Admin</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 dark:text-slate-600" />
              <span className="font-semibold text-slate-800 dark:text-white">
                {currentPage?.label || 'Dashboard'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Dark Mode Toggle */}
            <button
              onClick={toggleDarkMode}
              className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>

            {/* Notifications */}
            <button className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
            </button>

            {/* Quick Action */}
            <Link
              to="/admin/support"
              className="hidden sm:block px-3 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-600/20"
            >
              Support Tickets
            </Link>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
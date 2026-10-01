import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  Crown,
  Lock,
  Terminal,
  Target,
} from 'lucide-react'

import { announcementApi } from '../api'
import { apiClient } from '../api/client'
import type { Announcement } from '../api/types'
import { useAuth } from '../context/AuthContext'
import UpgradeModal from '../components/UpgradeModal'
import { CodeTraceDebuggerModal } from '../components/CodeTraceDebuggerModal'

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface ActivityItem {
  id: string
  type: string
  label: string
  course_id: string | null
  score: number
  submitted_at: string | null
  relative_when: string
}

interface WeakSubject {
  course_id: string
  course_name: string
  average_score: number
  attempts: number
}

interface DashboardData {
  last_activity: ActivityItem | null
  recent_activity: ActivityItem[]
  weakest_subjects: WeakSubject[]
  streak_days: number
}

// ─────────────────────────────────────────────────────────────
// Announcement display maps
// ─────────────────────────────────────────────────────────────

const ANNOUNCEMENT_LABEL: Record<Announcement['announcement_type'], string> = {
  moe_update: 'MoE Update',
  exam_notice: 'Exam Notice',
  platform_news: 'Platform News',
}

const ANNOUNCEMENT_BADGE: Record<Announcement['announcement_type'], string> = {
  moe_update:
    'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20',
  exam_notice:
    'bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/20',
  platform_news:
    'bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20',
}

// ─────────────────────────────────────────────────────────────
// Small helpers (in-file, to keep the layout readable)
// ─────────────────────────────────────────────────────────────

function Stat({
  label,
  value,
  sub,
  accent = 'default',
}: {
  label: string
  value: string | number
  sub?: string
  accent?: 'default' | 'warn' | 'success'
}) {
  const valueClass =
    accent === 'warn'
      ? 'text-amber-600 dark:text-amber-400'
      : accent === 'success'
        ? 'text-emerald-600 dark:text-emerald-400'
        : 'text-slate-900 dark:text-slate-100'

  return (
    <div className="min-w-0">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {label}
      </div>
      <div className={`mt-1 font-display text-2xl font-bold tabular-nums ${valueClass}`}>
        {value}
      </div>
      {sub && (
        <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-500 truncate">
          {sub}
        </div>
      )}
    </div>
  )
}

function ToolButton({
  icon: Icon,
  label,
  hint,
  onClick,
  locked = false,
}: {
  icon: typeof Target
  label: string
  hint: string
  onClick: () => void
  locked?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700 dark:hover:bg-slate-800/40"
    >
      <div className="flex min-w-0 items-center gap-3">
        <Icon className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 truncate text-sm font-medium text-slate-900 dark:text-slate-100">
            <span className="truncate">{label}</span>
            {locked && <Lock className="h-3 w-3 shrink-0 text-amber-500" />}
          </div>
          <div className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-slate-400">
            {hint}
          </div>
        </div>
      </div>
      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5" />
    </button>
  )
}

// ─────────────────────────────────────────────────────────────
// Dashboard
// ─────────────────────────────────────────────────────────────

export function DashboardPage() {
  const { user, isPremium, isAdmin } = useAuth()
  const navigate = useNavigate()

  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [loadingDashboard, setLoadingDashboard] = useState(true)
  const [isCodeTraceOpen, setIsCodeTraceOpen] = useState(false)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [upgradeMessage, setUpgradeMessage] = useState<string | null>(null)

  const hasPremiumAccess = isPremium || isAdmin

  // ── Announcements
  useEffect(() => {
    let isMounted = true
    announcementApi
      .list()
      .then((res: any) => {
        if (!isMounted) return
        const data = res?.data !== undefined ? res.data : res
        setAnnouncements(Array.isArray(data) ? data : [])
      })
      .catch((err) => console.error("Couldn't load announcements:", err))
    return () => {
      isMounted = false
    }
  }, [])

  // ── Dashboard snapshot
  useEffect(() => {
    let isMounted = true
    apiClient
      .get<DashboardData>('/api/dashboard/me')
      .then((res: { data: DashboardData }) => {
        if (isMounted) setDashboard(res.data)
      })
      .catch((err: unknown) => {
        console.warn('Dashboard data failed to load:', err)
      })
      .finally(() => {
        if (isMounted) setLoadingDashboard(false)
      })
    return () => {
      isMounted = false
    }
  }, [])

  const greeting = (() => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 18) return 'Good afternoon'
    return 'Good evening'
  })()

  const firstName = user?.full_name?.split(' ')[0] ?? 'Student'
  const streak = dashboard?.streak_days ?? 0
  const lastActivity = dashboard?.last_activity
  const weakest = (dashboard?.weakest_subjects ?? []).slice(0, 3)

  // Days to exam (nullable)
  const daysToExam = (() => {
    if (!user?.exam_date) return null
    const target = new Date(user.exam_date)
    if (isNaN(target.getTime())) return null
    target.setHours(0, 0, 0, 0)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const diff = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    return Math.max(0, diff)
  })()

  // Recent average — from recent_activity scores (safe math only)
  const recentAvg = (() => {
    if (!dashboard?.recent_activity?.length) return null
    const scores = dashboard.recent_activity
      .map((a) => a.score)
      .filter((s) => typeof s === 'number' && !isNaN(s))
    if (!scores.length) return null
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
  })()

  const recentAttempts = dashboard?.recent_activity?.length ?? 0

  const openUpgradeModal = (message?: string) => {
    setUpgradeMessage(message ?? null)
    setShowUpgradeModal(true)
  }

  const handleMockExamClick = () => {
    if (!hasPremiumAccess) {
      openUpgradeModal(
        'Unlock the CBT Mock Exam Simulator and practice under realistic Ethiopian CS Exit Exam conditions.'
      )
      return
    }
    navigate('/mock-exams')
  }

  const handleTutorClick = () => {
    if (!hasPremiumAccess) {
      openUpgradeModal(
        'Get the Study Assistant for personalized explanations and guided problem solving.'
      )
      return
    }
    navigate('/tutor')
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      {/* =========================================================
          HEADER — greeting + primary actions, no card
      ========================================================= */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
            {greeting}, {firstName}.
          </h1>
          {streak > 0 && (
            <span className="text-sm font-medium text-amber-600 dark:text-amber-400">
              {streak} {streak === 1 ? 'day' : 'days'} in a row.
            </span>
          )}
        </div>

        {lastActivity ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Last up:{' '}
            <span className="font-medium text-slate-700 dark:text-slate-200">
              {lastActivity.label}
            </span>
            {' · '}
            {lastActivity.relative_when}
            {typeof lastActivity.score === 'number' && (
              <>
                {' · '}
                <span
                  className={
                    lastActivity.score >= 50
                      ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                      : 'text-rose-600 dark:text-rose-400 font-medium'
                  }
                >
                  {Math.round(lastActivity.score)}%
                </span>
              </>
            )}
          </p>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Start your first quiz when you're ready.
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2.5">
          {lastActivity?.course_id ? (
            <button
              type="button"
              onClick={() => navigate(`/courses/${lastActivity.course_id}`)}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 active:scale-[0.98] dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
            >
              Continue {lastActivity.label}
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => navigate('/courses')}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 active:scale-[0.98] dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
            >
              Browse courses
              <ArrowRight className="h-4 w-4" />
            </button>
          )}

          <button
            type="button"
            onClick={handleMockExamClick}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 active:scale-[0.98] dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            {!hasPremiumAccess && <Lock className="h-3.5 w-3.5 text-amber-500" />}
            Start a Mock Exam
          </button>

          {isPremium && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-700 ring-1 ring-amber-500/20 dark:text-amber-400">
              <Crown className="h-3 w-3 fill-current" />
              Premium
            </span>
          )}
          {isAdmin && (
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-blue-700 ring-1 ring-blue-500/20 dark:text-blue-400">
              <CheckCircle2 className="h-3 w-3" />
              Admin
            </span>
          )}
        </div>
      </section>

      {/* =========================================================
          STATS STRIP — 4 numbers, no card
      ========================================================= */}
      <section className="grid grid-cols-2 gap-x-6 gap-y-5 border-y border-slate-200 py-5 dark:border-slate-800 sm:grid-cols-4">
        <Stat
          label="Days to exam"
          value={daysToExam !== null ? daysToExam : '—'}
          sub={daysToExam === null ? 'Set in profile' : undefined}
          accent={daysToExam !== null && daysToExam <= 30 ? 'warn' : 'default'}
        />
        <Stat
          label="Recent average"
          value={recentAvg !== null ? `${recentAvg}%` : '—'}
          sub={
            recentAvg === null && !loadingDashboard
              ? 'Take a quiz'
              : undefined
          }
        />
        <Stat
          label="Recent attempts"
          value={recentAttempts > 0 ? recentAttempts : '—'}
          sub={recentAttempts === 0 && !loadingDashboard ? 'No history yet' : undefined}
        />
        <Stat
          label="Streak"
          value={streak > 0 ? `${streak}d` : '—'}
          accent={streak > 0 ? 'success' : 'default'}
        />
      </section>

      {/* =========================================================
          WHERE TO FOCUS — plain list, no card
      ========================================================= */}
      {loadingDashboard ? (
        <section className="space-y-3">
          <div className="h-3 w-32 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
          <div className="h-10 animate-pulse rounded bg-slate-100 dark:bg-slate-900" />
          <div className="h-10 animate-pulse rounded bg-slate-100 dark:bg-slate-900" />
        </section>
      ) : weakest.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Where to focus
          </h2>
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {weakest.map((s) => (
              <div
                key={s.course_id}
                className="flex items-center justify-between gap-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                    {s.course_name}
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    {s.attempts} attempt{s.attempts === 1 ? '' : 's'} ·{' '}
                    {Math.round(s.average_score)}% average
                  </div>
                </div>
                <Link
                  to={`/courses/${s.course_id}`}
                  className="shrink-0 text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                >
                  Practice →
                </Link>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <section className="space-y-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Where to focus
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Take a few quizzes and we'll show which subjects need attention.
          </p>
          <Link
            to="/courses"
            className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
          >
            Browse courses
            <ArrowRight className="h-3 w-3" />
          </Link>
        </section>
      )}

      {/* =========================================================
          TOOLS — compact row
      ========================================================= */}
      <section className="space-y-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Tools
        </h2>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          <ToolButton
            icon={Target}
            label="Mock Exam"
            hint="20 / 50 / 100 questions"
            onClick={handleMockExamClick}
            locked={!hasPremiumAccess}
          />
          <ToolButton
            icon={Terminal}
            label="Code Trace"
            hint="C++ · DSA · OS"
            onClick={() => setIsCodeTraceOpen(true)}
          />
          <ToolButton
            icon={Bot}
            label="Study Assistant"
            hint="Ask any concept"
            onClick={handleTutorClick}
            locked={!hasPremiumAccess}
          />
        </div>
      </section>

      {/* =========================================================
          FREE TIER — compact strip
      ========================================================= */}
      {!hasPremiumAccess && (
        <section className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-800 dark:bg-slate-900/50">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                You're on the free plan
              </p>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                1 quiz every 3 hours · 20% of notes · 3 code traces per day
              </p>
            </div>
            <button
              type="button"
              onClick={() => openUpgradeModal()}
              className="shrink-0 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
            >
              See Premium
            </button>
          </div>
        </section>
      )}

      {/* =========================================================
          ANNOUNCEMENTS — only when there are any
      ========================================================= */}
      {announcements.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Announcements
            </h2>
            {announcements.length > 3 && (
              <span className="text-[11px] text-slate-400 dark:text-slate-500">
                Showing 3 of {announcements.length}
              </span>
            )}
          </div>

          <div className="space-y-2">
            {announcements.slice(0, 3).map((announcement) => (
              <article
                key={announcement.id}
                className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 text-sm font-medium text-slate-900 dark:text-slate-100">
                    {announcement.title}
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      ANNOUNCEMENT_BADGE[announcement.announcement_type] ||
                      'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                    }`}
                  >
                    {ANNOUNCEMENT_LABEL[announcement.announcement_type] ||
                      'Notice'}
                  </span>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  {announcement.content}
                </p>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* =========================================================
          MODALS (unchanged)
      ========================================================= */}
      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => {
          setShowUpgradeModal(false)
          setUpgradeMessage(null)
        }}
        customMessage={upgradeMessage}
      />

      <CodeTraceDebuggerModal
        isOpen={isCodeTraceOpen}
        onClose={() => setIsCodeTraceOpen(false)}
      />
    </div>
  )
}
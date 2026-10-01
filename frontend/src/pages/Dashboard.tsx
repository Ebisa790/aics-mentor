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
import { ExamCountdown } from '../components/ExamCountdown'
import { HeroIllustration } from '../components/HeroIllustration'
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

const ANNOUNCEMENT_LABEL: Record<Announcement['announcement_type'], string> = {
  moe_update: 'MoE Update',
  exam_notice: 'Exam Notice',
  platform_news: 'Platform News',
}

const ANNOUNCEMENT_BADGE: Record<Announcement['announcement_type'], string> = {
  moe_update:
    'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20',
  exam_notice:
    'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20',
  platform_news:
    'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20',
}

// ─────────────────────────────────────────────────────────────
// Subcomponents
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
      <div
        className={`mt-1 font-display text-2xl font-bold tabular-nums ${valueClass}`}
      >
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

  // Recent average + attempts count from recent_activity (already in the payload)
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
    <div className="mx-auto max-w-6xl space-y-8">
      {/* =========================================================
          HERO — restored gradient + illustration + badges
      ========================================================= */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 px-6 py-8 sm:px-8 sm:py-10">
        <div className="relative z-10 flex items-start justify-between gap-6">
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-2xl font-bold leading-tight tracking-tight text-white sm:text-3xl">
              {greeting}, {firstName}.
            </h1>

            <p className="mt-2 text-sm leading-relaxed text-slate-300 sm:text-base">
              {streak > 0 && (
                <>
                  <span className="font-semibold text-amber-300">
                    {streak} {streak === 1 ? 'day' : 'days'} in a row.
                  </span>{' '}
                </>
              )}
              {lastActivity ? (
                <>
                  Last up:{' '}
                  <span className="text-slate-100">{lastActivity.label}</span>
                  {' — '}
                  {lastActivity.relative_when}.
                </>
              ) : (
                <>Ready to start your first session?</>
              )}
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              {isPremium && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-300 ring-1 ring-amber-500/20">
                  <Crown className="h-3 w-3 fill-amber-400" />
                  Premium
                </span>
              )}
              {isAdmin && (
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-blue-300 ring-1 ring-blue-500/20">
                  <CheckCircle2 className="h-3 w-3" />
                  Admin
                </span>
              )}
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
              {lastActivity && lastActivity.course_id ? (
                <button
                  type="button"
                  onClick={() =>
                    navigate(`/courses/${lastActivity.course_id}`)
                  }
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-100 active:scale-[0.98]"
                >
                  Continue {lastActivity.label}
                  <ArrowRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => navigate('/courses')}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-100 active:scale-[0.98]"
                >
                  Browse courses
                  <ArrowRight className="h-4 w-4" />
                </button>
              )}

              <button
                type="button"
                onClick={handleMockExamClick}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-white/10 px-5 py-2.5 text-sm font-semibold text-white ring-1 ring-white/10 transition hover:bg-white/15 active:scale-[0.98]"
              >
                {!hasPremiumAccess && <Lock className="h-3.5 w-3.5" />}
                Start a Mock Exam
              </button>
            </div>
          </div>

          <HeroIllustration className="hidden h-32 w-32 shrink-0 opacity-80 lg:block" />
        </div>
      </section>

      {/* =========================================================
          STATS + FOCUS — 2-column row, exam countdown inlined
      ========================================================= */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Left: 4 compact stats, no big card */}
        <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
            <Stat
              label="Days to exam"
              value={
                user?.exam_date
                  ? (() => {
                      const target = new Date(user.exam_date)
                      if (isNaN(target.getTime())) return '—'
                      target.setHours(0, 0, 0, 0)
                      const today = new Date()
                      today.setHours(0, 0, 0, 0)
                      const diff = Math.ceil(
                        (target.getTime() - today.getTime()) /
                          (1000 * 60 * 60 * 24)
                      )
                      return Math.max(0, diff)
                    })()
                  : '—'
              }
              sub={!user?.exam_date ? 'Set in profile' : undefined}
            />
            <Stat
              label="Recent avg"
              value={recentAvg !== null ? `${recentAvg}%` : '—'}
              sub={!recentAvg && !loadingDashboard ? 'Take a quiz' : undefined}
            />
            <Stat
              label="Attempts"
              value={recentAttempts > 0 ? recentAttempts : '—'}
              sub={
                recentAttempts === 0 && !loadingDashboard ? 'None yet' : undefined
              }
            />
            <Stat
              label="Streak"
              value={streak > 0 ? `${streak}d` : '—'}
              accent={streak > 0 ? 'success' : 'default'}
            />
          </div>

          {/* Inline exam-date note — no card */}
          <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800">
            <ExamCountdown examDate={user?.exam_date ?? null} />
          </div>
        </div>

        {/* Right: Where to focus */}
        {loadingDashboard ? (
          <div className="animate-pulse rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="h-3 w-24 rounded bg-slate-200 dark:bg-slate-800" />
            <div className="mt-3 h-3 w-40 rounded bg-slate-200 dark:bg-slate-800" />
          </div>
        ) : weakest.length > 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Where to focus
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Your weakest subjects from recent quizzes:
            </p>

            <div className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
              {weakest.map((s) => (
                <div
                  key={s.course_id}
                  className="flex items-center justify-between gap-3 py-2.5"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                      {s.course_name}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      {s.attempts} attempts · {Math.round(s.average_score)}% avg
                    </div>
                  </div>
                  <Link
                    to={`/courses/${s.course_id}`}
                    className="shrink-0 rounded-lg bg-slate-900 px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
                  >
                    Practice
                  </Link>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Where to focus
            </div>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Take a couple more quizzes and we'll show which subjects need
              your attention.
            </p>
            <Link
              to="/courses"
              className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
            >
              Browse courses
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        )}
      </section>

      {/* =========================================================
          TOOLS — Mock Exam hero + 2 supporting
      ========================================================= */}
      <section className="space-y-4">
        <div>
          <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100">
            Tools
          </h2>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            Pick what fits your time.
          </p>
        </div>

        {/* Mock Exam — full width */}
        <button
          type="button"
          onClick={handleMockExamClick}
          className="group relative flex w-full items-center justify-between gap-6 overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 text-left transition hover:border-slate-300 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
        >
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-blue-500" />
              <span className="text-base font-semibold text-slate-900 dark:text-white">
                Mock Exam
              </span>
              {!hasPremiumAccess && (
                <Lock className="h-3.5 w-3.5 text-amber-500" />
              )}
            </div>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-500 dark:text-slate-400">
              Practice with 20, 50, or 100 questions under exam-style timing.
              Best way to check if you're ready.
            </p>
            <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400">
              {hasPremiumAccess ? 'Begin exam' : 'Upgrade to unlock'}
              <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
            </span>
          </div>
          <div className="hidden sm:flex h-14 w-14 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-500/10">
            <Target className="h-6 w-6 text-blue-500" />
          </div>
        </button>

        {/* Two smaller tools */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setIsCodeTraceOpen(true)}
            className="group flex flex-col rounded-xl border border-slate-200 bg-white p-5 text-left transition hover:border-slate-300 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
          >
            <div className="flex items-center gap-2 text-slate-900 dark:text-white">
              <Terminal className="h-4 w-4 text-emerald-500" />
              <span className="text-sm font-semibold">Code Trace</span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              Step through C++, DSA, and OS execution line by line.
            </p>
            <span className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              Open
              <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
            </span>
          </button>

          <button
            type="button"
            onClick={handleTutorClick}
            className="group flex flex-col rounded-xl border border-slate-200 bg-white p-5 text-left transition hover:border-slate-300 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
          >
            <div className="flex items-center gap-2 text-slate-900 dark:text-white">
              <Bot className="h-4 w-4 text-purple-500" />
              <span className="text-sm font-semibold">Study Assistant</span>
              {!hasPremiumAccess && (
                <Lock className="h-3 w-3 text-amber-500" />
              )}
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              Ask about any concept and get clear explanations.
            </p>
            <span className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-purple-600 dark:text-purple-400">
              {hasPremiumAccess ? 'Ask a question' : 'Upgrade to unlock'}
              <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
            </span>
          </button>
        </div>
      </section>

      {/* =========================================================
          FREE TIER TEASE
      ========================================================= */}
      {!hasPremiumAccess && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                You're on the free plan
              </h3>

              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                    What you have
                  </p>
                  <ul className="mt-2 space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-500">·</span>
                      1 quiz every 3 hours
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-500">·</span>
                      20% of course notes
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-500">·</span>
                      3 code traces per day
                    </li>
                  </ul>
                </div>

                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    What's locked
                  </p>
                  <ul className="mt-2 space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                    <li className="flex items-start gap-2">
                      <Lock className="mt-0.5 h-3 w-3 shrink-0 text-amber-500" />
                      Unlimited quizzes
                    </li>
                    <li className="flex items-start gap-2">
                      <Lock className="mt-0.5 h-3 w-3 shrink-0 text-amber-500" />
                      Full course notes
                    </li>
                    <li className="flex items-start gap-2">
                      <Lock className="mt-0.5 h-3 w-3 shrink-0 text-amber-500" />
                      Mock Exam Simulator
                    </li>
                    <li className="flex items-start gap-2">
                      <Lock className="mt-0.5 h-3 w-3 shrink-0 text-amber-500" />
                      Study Assistant
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => openUpgradeModal()}
              className="shrink-0 self-start rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
            >
              See Premium
            </button>
          </div>
        </section>
      )}

      {/* =========================================================
          ANNOUNCEMENTS
      ========================================================= */}
      {announcements.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100">
              Announcements
            </h2>
            {announcements.length > 3 && (
              <span className="text-xs text-slate-400 dark:text-slate-500">
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
                  <div className="min-w-0 text-sm font-medium text-slate-900 dark:text-white">
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
          MODALS
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
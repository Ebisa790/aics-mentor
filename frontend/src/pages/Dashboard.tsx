import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  Crown,
  Lock,
  Pin,
  Terminal,
  TrendingUp,
  AlertTriangle,
  BookOpen,
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

// ─────────────────────────────────────────────────────────────
// Announcement display maps (unchanged)
// ─────────────────────────────────────────────────────────────

const ANNOUNCEMENT_LABEL: Record<Announcement['announcement_type'], string> = {
  moe_update: 'MoE Update',
  exam_notice: 'Exam Notice',
  platform_news: 'Platform News',
}

const ANNOUNCEMENT_BADGE: Record<Announcement['announcement_type'], string> = {
  moe_update: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20',
  exam_notice: 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20',
  platform_news: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20',
}

// ─────────────────────────────────────────────────────────────
// Component
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

  // ── Load announcements (unchanged behavior) ────────────────
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

  // ── Load dashboard snapshot ────────────────────────────────
  useEffect(() => {
    let isMounted = true

    apiClient
      .get<DashboardData>('/api/dashboard/me')
      .then((res: { data: DashboardData }) => {
        if (isMounted) setDashboard(res.data)
      })
      .catch((err: unknown) => {
        console.warn('Dashboard data failed to load:', err)
        // Silently degrade — dashboard still renders without stats
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
    navigate('/mock-exam')
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

  const openCount = dashboard?.recent_activity.length ?? 0
  const streak = dashboard?.streak_days ?? 0
  const lastActivity = dashboard?.last_activity
  const weakest = dashboard?.weakest_subjects ?? []

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      {/* =========================================================
          HERO — personal, motivating, honest
      ========================================================= */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 px-6 py-8 sm:px-8 sm:py-10">
        <div className="relative z-10 flex items-start justify-between gap-6">
          <div className="flex-1 min-w-0">
            {/* Greeting */}
            <h1 className="font-display text-2xl font-bold leading-tight tracking-tight text-white sm:text-3xl">
              {greeting}, {firstName}.
            </h1>

            {/* Personal line — the real hook */}
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

            {/* Badges — minimal */}
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

            {/* Actions — Continue first, then Start Mock */}
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
              {lastActivity && lastActivity.course_id ? (
                <button
                  type="button"
                  onClick={() => navigate(`/courses/${lastActivity.course_id}`)}
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
          EXAM METRICS — countdown + Focus Area
      ========================================================= */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ExamCountdown examDate={user?.exam_date ?? null} />

        {/* Focus Area — replaces "Exam Target" */}
        {loadingDashboard ? (
          <div className="animate-pulse rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="h-3 w-24 rounded bg-slate-200 dark:bg-slate-800" />
            <div className="mt-3 h-3 w-40 rounded bg-slate-200 dark:bg-slate-800" />
          </div>
        ) : weakest.length > 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
              Where to focus
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Based on your last few quizzes:
            </p>

            <div className="mt-3 space-y-2">
              {weakest.map((s) => (
                <div
                  key={s.course_id}
                  className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-950/50"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                      {s.course_name}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      {s.attempts} attempts · {s.average_score}% average
                    </div>
                  </div>
                  <Link
                    to={`/courses/${s.course_id}`}
                    className="shrink-0 rounded-lg bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700 dark:hover:bg-slate-700"
                  >
                    Practice
                  </Link>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <Target className="h-3.5 w-3.5 text-emerald-500" />
              Where to focus
            </div>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Take a couple more quizzes and we'll show you which subjects
              need your attention.
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
          RECENT ACTIVITY (compact, only if exists)
      ========================================================= */}
      {!loadingDashboard && openCount > 0 && (
        <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <TrendingUp className="h-3.5 w-3.5 text-blue-500" />
            Recent activity
          </div>

          <ul className="mt-3 space-y-2">
            {dashboard?.recent_activity.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 text-sm">
                <div className="min-w-0 flex items-center gap-2">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300 dark:bg-slate-600" />
                  <span className="truncate text-slate-700 dark:text-slate-300">
                    {a.type}: <span className="font-medium text-slate-900 dark:text-white">{a.label}</span>
                  </span>
                </div>
                <div className="shrink-0 text-right">
                  <span
                    className={`text-xs font-semibold ${
                      a.score >= 70
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : a.score >= 50
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {a.score}%
                  </span>
                  <span className="ml-2 text-[11px] text-slate-400">
                    {a.relative_when}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* =========================================================
          TOOLS — Mock Exam hero, others supporting
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

        {/* Mock Exam — full width hero */}
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
              {!hasPremiumAccess && <Lock className="h-3.5 w-3.5 text-amber-500" />}
            </div>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-500 dark:text-slate-400">
              Full 100-question simulation under real exam conditions. Strict timing, no
              hints. Best way to check if you're ready.
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
              {!hasPremiumAccess && <Lock className="h-3 w-3 text-amber-500" />}
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
          FREE TIER TEASE (only for free users)
      ========================================================= */}
      {!hasPremiumAccess && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-slate-500" />
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  You're on the free plan
                </h3>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                    What you have
                  </p>
                  <ul className="mt-2 space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
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
                  <ul className="mt-2 space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
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
          ANNOUNCEMENTS (unchanged)
      ========================================================= */}
      {announcements.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100">
              Announcements
            </h2>
            <span className="text-xs text-slate-400 dark:text-slate-500">
              {Math.min(announcements.length, 3)} of {announcements.length}
            </span>
          </div>

          <div className="space-y-2">
            {announcements.slice(0, 3).map((announcement) => (
              <article
                key={announcement.id}
                className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    {announcement.is_pinned && (
                      <Pin className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                    )}
                    <span className="truncate text-sm font-medium text-slate-900 dark:text-white">
                      {announcement.title}
                    </span>
                  </div>

                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      ANNOUNCEMENT_BADGE[announcement.announcement_type] ||
                      'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                    }`}
                  >
                    {ANNOUNCEMENT_LABEL[announcement.announcement_type] || 'Notice'}
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
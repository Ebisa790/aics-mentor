import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  Crown,
  Lock,
  Pin,
  Target,
  Terminal,
} from 'lucide-react'

import { announcementApi } from '../api'
import type { Announcement } from '../api/types'
import { useAuth } from '../context/AuthContext'
import UpgradeModal from '../components/UpgradeModal'
import { ExamCountdown } from '../components/ExamCountdown'
import { HeroIllustration } from '../components/HeroIllustration'
import { CodeTraceDebuggerModal } from '../components/CodeTraceDebuggerModal'

const ANNOUNCEMENT_LABEL: Record<
  Announcement['announcement_type'],
  string
> = {
  moe_update: 'MoE Update',
  exam_notice: 'Exam Notice',
  platform_news: 'Platform News',
}

const ANNOUNCEMENT_BADGE: Record<
  Announcement['announcement_type'],
  string
> = {
  moe_update:
    'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20',
  exam_notice:
    'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20',
  platform_news:
    'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20',
}

export function DashboardPage() {
  const { user, isPremium, isAdmin } = useAuth()
  const navigate = useNavigate()

  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [isCodeTraceOpen, setIsCodeTraceOpen] = useState(false)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [upgradeMessage, setUpgradeMessage] = useState<string | null>(null)

  const hasPremiumAccess = isPremium || isAdmin

  useEffect(() => {
    let isMounted = true

    announcementApi
      .list()
      .then((announcementRes: any) => {
        if (!isMounted) return

        const announcementData =
          announcementRes?.data !== undefined
            ? announcementRes.data
            : announcementRes

        setAnnouncements(
          Array.isArray(announcementData) ? announcementData : []
        )
      })
      .catch((err) => {
        console.error("Couldn't load announcements:", err)
      })

    return () => {
      isMounted = false
    }
  }, [])

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 18) return 'Good afternoon'
    return 'Good evening'
  }

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

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      {/* =========================================================
          HERO
      ========================================================= */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 px-6 py-8 sm:px-8 sm:py-10">
        <div className="relative z-10 flex items-start justify-between gap-6">
          <div className="flex-1 min-w-0">
            {/* Status pills */}
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-300 ring-1 ring-white/10">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Exit Exam Prep
              </span>

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

            <h1 className="font-display text-2xl font-bold leading-tight tracking-tight text-white sm:text-3xl">
              {getGreeting()},{' '}
              {user?.full_name?.split(' ')[0] ?? 'Student'}
            </h1>

            <p className="mt-3 max-w-lg text-sm leading-relaxed text-slate-400">
              Keep your momentum. Practice a simulation, review your notes,
              or trace through code — whatever moves you forward today.
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={handleMockExamClick}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-100 active:scale-[0.98]"
              >
                {!hasPremiumAccess && <Lock className="h-3.5 w-3.5" />}
                Start Mock Exam
                {hasPremiumAccess && <ArrowRight className="h-4 w-4" />}
              </button>

              <button
                type="button"
                onClick={() => setIsCodeTraceOpen(true)}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-white/10 px-5 py-2.5 text-sm font-semibold text-white ring-1 ring-white/10 transition hover:bg-white/15 active:scale-[0.98]"
              >
                <Terminal className="h-4 w-4" />
                Code Trace
              </button>
            </div>
          </div>

          <HeroIllustration className="hidden h-32 w-32 shrink-0 opacity-80 lg:block" />
        </div>
      </section>

      {/* =========================================================
          EXAM METRICS
      ========================================================= */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <ExamCountdown examDate={user?.exam_date ?? null} />

        <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
            <Target className="h-5 w-5" />
          </div>

          <div className="min-w-0">
            <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Exam Target
            </div>
            <div className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-white">
              CS Exit Exam
            </div>
            <Link
              to="/courses"
              className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
            >
              Browse courses
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </section>

      {/* =========================================================
          TOOLS
      ========================================================= */}
      <section className="space-y-4">
        <div>
          <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100">
            Your Tools
          </h2>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            Pick up where you left off.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Code Trace */}
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
              Launch
              <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
            </span>
          </button>

          {/* Mock Exam */}
          <button
            type="button"
            onClick={handleMockExamClick}
            className="group flex flex-col rounded-xl border border-slate-200 bg-white p-5 text-left transition hover:border-slate-300 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
          >
            <div className="flex items-center gap-2 text-slate-900 dark:text-white">
              <Target className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-semibold">Mock Exam</span>
              {!hasPremiumAccess && (
                <Lock className="h-3 w-3 text-amber-500" />
              )}
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              Simulate official MoE exam conditions with a strict timer.
            </p>
            <span className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400">
              {hasPremiumAccess ? 'Start' : 'Upgrade to unlock'}
              <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
            </span>
          </button>

          {/* Study Assistant */}
          <button
            type="button"
            onClick={handleTutorClick}
            className="group flex flex-col rounded-xl border border-slate-200 bg-white p-5 text-left transition hover:border-slate-300 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700 sm:col-span-2 lg:col-span-1"
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
          ANNOUNCEMENTS
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
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
          Array.isArray(announcementData)
            ? announcementData
            : []
        )
      })
      .catch((err) => {
        console.error('Couldn\'t load announcements:', err)
      })

    return () => {
      isMounted = false
    }
  }, [])

  const getGreeting = () => {
    const hour = new Date().getHours()

    if (hour < 12) return 'Morning'
    if (hour < 18) return 'Afternoon'

    return 'Evening'
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
        'Get the Study Assistant for personalized explanations, guided problem solving, and better exam preparation.'
      )
      return
    }

    navigate('/tutor')
  }

  return (
    <div className="min-h-full bg-transparent px-1 sm:px-0">
      <div className="mx-auto max-w-7xl space-y-7 sm:space-y-9">

        {/* =========================================================
            HERO
        ========================================================= */}
        <section className="relative overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-900 shadow-xl">

          {/* Background decoration */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />
            <div className="absolute -bottom-32 -left-24 h-72 w-72 rounded-full bg-indigo-500/10 blur-3xl" />
            <div className="absolute right-1/3 top-1/2 h-40 w-40 rounded-full bg-purple-500/5 blur-3xl" />
          </div>

          <div className="relative z-10 flex items-center justify-between gap-8 p-6 sm:p-8 lg:p-10">

            <div className="w-full lg:max-w-2xl">

              {/* Platform label */}
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Ethiopian CS Exit Exam Prep
              </div>

              {/* Greeting */}
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="font-display text-2xl font-bold leading-tight tracking-tight text-white sm:text-3xl lg:text-4xl">
                  {getGreeting()},{' '}
                  {user?.full_name?.split(' ')[0] ?? 'Student'}
                </h1>

                {isPremium && (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-bold text-amber-300">
                    <Crown className="h-3.5 w-3.5 fill-amber-400" />
                    Premium
                  </span>
                )}

                {isAdmin && (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-blue-500/30 bg-blue-500/10 px-2.5 py-1 text-xs font-bold text-blue-300">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Admin
                  </span>
                )}
              </div>

              <p className="mt-3 max-w-xl text-xs leading-relaxed text-slate-300 sm:text-sm">
                Prepare smarter for the Ethiopian Computer Science Exit Exam.
                Practice, review your course notes, trace code, and measure
                your readiness before exam day.
              </p>

              {/* Hero actions */}
              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">

                <button
                  type="button"
                  onClick={handleMockExamClick}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-xs font-bold text-slate-900 shadow-sm transition active:scale-95 hover:bg-slate-100 active:scale-[0.98] sm:w-auto sm:py-2.5 sm:text-sm"
                >
                  {!hasPremiumAccess && (
                    <Lock className="h-3.5 w-3.5" />
                  )}

                  Start Exit Exam Simulation

                  {!hasPremiumAccess && (
                    <span className="rounded bg-amber-400 px-1.5 py-0.5 text-[9px] font-black text-slate-950">
                      PREMIUM
                    </span>
                  )}

                  {hasPremiumAccess && (
                    <ArrowRight className="h-4 w-4" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setIsCodeTraceOpen(true)}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-xs font-bold text-slate-950 shadow-sm transition active:scale-95 hover:bg-emerald-400 active:scale-[0.98] sm:w-auto sm:py-2.5 sm:text-sm"
                >
                  <Terminal className="h-4 w-4" />
                  Code Trace Debugger
                </button>
              </div>

            </div>

            <HeroIllustration
              className="relative z-10 hidden h-40 w-40 shrink-0 opacity-90 transition-transform duration-300 hover:scale-105 lg:block"
            />
          </div>
        </section>

        {/* =========================================================
            ANNOUNCEMENTS
        ========================================================= */}
        {announcements.length > 0 && (
          <section className="space-y-3">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100 sm:text-lg">
                  Platform Announcements
                </h2>

                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  Important updates for your exam preparation
                </p>
              </div>

              <span className="text-xs text-slate-500 dark:text-slate-400">
                Showing top {Math.min(announcements.length, 3)} updates
              </span>
            </div>

            <div className="space-y-2.5">
              {announcements.slice(0, 3).map((announcement) => (
                <article
                  key={announcement.id}
                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition active:scale-95 hover:border-slate-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700 sm:p-5"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">

                    <div className="flex min-w-0 items-center gap-2">
                      {announcement.is_pinned && (
                        <span
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500"
                          title="Pinned Announcement"
                        >
                          <Pin className="h-3.5 w-3.5" />
                        </span>
                      )}

                      <span className="truncate text-xs font-semibold text-slate-900 dark:text-white sm:text-sm">
                        {announcement.title}
                      </span>
                    </div>

                    <span
                      className={`w-fit shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                        ANNOUNCEMENT_BADGE[
                          announcement.announcement_type
                        ] ||
                        'border border-slate-200 bg-slate-100 text-slate-600'
                      }`}
                    >
                      {ANNOUNCEMENT_LABEL[
                        announcement.announcement_type
                      ] || 'Notice'}
                    </span>
                  </div>

                  <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400 sm:text-sm">
                    {announcement.content}
                  </p>
                </article>
              ))}
            </div>
          </section>
        )}

        {/* =========================================================
            EXAM METRICS
        ========================================================= */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">

          {/* Countdown */}
          <ExamCountdown examDate={user?.exam_date ?? null} />

          {/* Exam target */}
          <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition active:scale-95 hover:border-slate-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700">

            <div className="flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-500 sm:h-14 sm:w-14">
              <Target className="h-6 w-6 sm:h-7 sm:w-7" />
            </div>

            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Exam Target
              </div>

              <div className="mt-0.5 text-sm font-bold text-slate-900 dark:text-white sm:text-base">
                CS Exit Exam Practice
              </div>

              <Link
                to="/courses"
                className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 transition-colors active:scale-95 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
              >
                Browse All Courses & Topics
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </section>

        {/* =========================================================
            PRACTICE TOOLS
        ========================================================= */}
        <section className="space-y-3">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100 sm:text-lg">
              Practice Tools & Simulators
            </h2>

            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Use focused tools to strengthen your exam readiness.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">

            {/* =====================================================
                CODE TRACE
            ===================================================== */}
            <button
              type="button"
              onClick={() => setIsCodeTraceOpen(true)}
              className="group flex flex-col justify-between rounded-xl border border-l-4 border-slate-200 border-l-emerald-500 bg-white p-5 text-left shadow-sm transition-all active:scale-95 duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md dark:border-slate-800 dark:border-l-emerald-500 dark:bg-slate-900 dark:hover:border-slate-700"
            >
              <div>
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white sm:text-base">
                    <Terminal className="h-4 w-4 text-emerald-500" />
                    Live Code Trace
                  </span>

                  <ArrowRight className="h-4 w-4 font-bold text-emerald-500 transition-transform group-hover:translate-x-1" />
                </div>

                <p className="mt-2.5 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                  Step through C++, DSA, and OS execution line-by-line with
                  dynamic variable state inspection.
                </p>
              </div>

              <div className="mt-5 text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 sm:text-[11px]">
                Launch Debugger
              </div>
            </button>

            {/* =====================================================
                MOCK EXAM
            ===================================================== */}
            <button
              type="button"
              onClick={handleMockExamClick}
              className="group flex flex-col justify-between rounded-xl border border-l-4 border-slate-200 border-l-blue-500 bg-white p-5 text-left shadow-sm transition-all active:scale-95 duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md dark:border-slate-800 dark:border-l-blue-500 dark:bg-slate-900 dark:hover:border-slate-700"
            >
              <div>
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-900 dark:text-white sm:text-base">
                    CBT Mock Simulator

                    {!hasPremiumAccess && (
                      <Lock className="h-3.5 w-3.5 text-amber-500" />
                    )}
                  </span>

                  <ArrowRight className="h-4 w-4 font-bold text-blue-500 transition-transform group-hover:translate-x-1" />
                </div>

                <p className="mt-2.5 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                  Simulate official MoE exam conditions with strict timer
                  constraints and domain coverage.
                </p>

                {!hasPremiumAccess && (
                  <span className="mt-2 inline-block rounded bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                    PREMIUM FEATURE
                  </span>
                )}
              </div>

              <div className="mt-5 text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 sm:text-[11px]">
                {hasPremiumAccess
                  ? 'Start Mock Test'
                  : 'Upgrade to Access'}
              </div>
            </button>

            {/* =====================================================
                STUDY ASSISTANT
            ===================================================== */}
            <button
              type="button"
              onClick={handleTutorClick}
              className="group flex flex-col justify-between rounded-xl border border-l-4 border-slate-200 border-l-purple-500 bg-white p-5 text-left shadow-sm transition-all active:scale-95 duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md dark:border-slate-800 dark:border-l-purple-500 dark:bg-slate-900 dark:hover:border-slate-700 sm:col-span-2 md:col-span-1"
            >
              <div>
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-900 dark:text-white sm:text-base">
                    <Bot className="h-4 w-4 text-purple-500" />

                    Ask Study Assistant

                    {!hasPremiumAccess && (
                      <Lock className="h-3.5 w-3.5 text-amber-500" />
                    )}
                  </span>

                  <ArrowRight className="h-4 w-4 font-bold text-purple-500 transition-transform group-hover:translate-x-1" />
                </div>

                <p className="mt-2.5 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                  Stuck on a tricky algorithm, database query, or network rule?
                  Get instant, structured explanations from your study assistant
                  tutor.
                </p>

                {!hasPremiumAccess && (
                  <span className="mt-2 inline-block rounded bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                    PREMIUM FEATURE
                  </span>
                )}
              </div>

              <div className="mt-5 text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 sm:text-[11px]">
                {hasPremiumAccess
                  ? 'Ask Question'
                  : 'Upgrade to Access'}
              </div>
            </button>
          </div>
        </section>

        {/* =========================================================
            QUICK STUDY LINKS
        ========================================================= */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

            <div>
              <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white sm:text-lg">
                Continue Your Preparation
              </h2>

              <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400 sm:text-sm">
                Review your courses and keep building your exit exam
                readiness.
              </p>
            </div>

            <Link
              to="/courses"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-bold text-slate-700 transition active:scale-95 hover:border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 sm:w-auto"
            >
              Explore Courses
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </section>
      </div>

      {/* =========================================================
          SHARED UPGRADE MODAL
      ========================================================= */}
      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => {
          setShowUpgradeModal(false)
          setUpgradeMessage(null)
        }}
        customMessage={upgradeMessage}
      />

      {/* =========================================================
          CODE TRACE MODAL
      ========================================================= */}
      <CodeTraceDebuggerModal
        isOpen={isCodeTraceOpen}
        onClose={() => setIsCodeTraceOpen(false)}
      />
    </div>
  )
}
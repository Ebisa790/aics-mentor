import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import axios from 'axios'
import UpgradeModal from '../components/UpgradeModal'
import {
  ArrowLeft,
  BookOpen,
  FileText,
  ArrowRight,
  Loader2,
  AlertCircle,
  RefreshCw,
  Lock,
  Crown,
} from 'lucide-react'

import { courseApi, examApi } from '../api'
import type { CourseDetail } from '../api/types'

import { useAuth } from '../context/AuthContext'


export function CourseDetailPage() {
  const { courseId } = useParams<{ courseId: string }>()
  const navigate = useNavigate()
  const { isPremium, isAdmin, isLoading: isAuthLoading } = useAuth()

  // ============================================================
  // COURSE STATE
  // ============================================================

  const [course, setCourse] = useState<CourseDetail | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  // ============================================================
  // QUIZ STATE
  // ============================================================

  const [generating, setGenerating] = useState<boolean>(false)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [cooldownMessage, setCooldownMessage] = useState<string | null>(null)

  // Premium upgrade modal
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [upgradeMessage, setUpgradeMessage] = useState<string | null>(null)

  // ============================================================
  // FETCH COURSE
  // ============================================================

  const fetchCourse = useCallback(async () => {
    if (!courseId) {
      setCourse(null)
      setFetchError('Course ID is missing.')
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setFetchError(null)

    try {
      const courseData = await courseApi.get(courseId)
      setCourse(courseData)
    } catch (err) {
      console.error('Failed to fetch course:', err)

      if (axios.isAxiosError(err)) {
        const status = err.response?.status

        if (status === 404) {
          setFetchError('The requested course could not be found.')
        } else if (status === 401) {
          setFetchError('Your session has expired. Please log in again.')
        } else {
          setFetchError(
            typeof err.response?.data?.detail === 'string'
              ? err.response.data.detail
              : 'Failed to load course details. Please try again.'
          )
        }
      } else {
        setFetchError('Failed to load course details. Please try again.')
      }

      setCourse(null)
    } finally {
      setIsLoading(false)
    }
  }, [courseId])

  useEffect(() => {
    let mounted = true

    const loadCourse = async () => {
      if (!mounted) return
      await fetchCourse()
    }

    loadCourse()

    return () => {
      mounted = false
    }
  }, [fetchCourse])

  // ============================================================
  // HANDLE COURSE QUIZ
  // ============================================================

  const handleTakeQuiz = async () => {
    if (!courseId || generating || isAuthLoading) {
      return
    }

    setGenerating(true)
    setGenerateError(null)
    setCooldownMessage(null)
    setUpgradeMessage(null)

    try {
      const quiz = await examApi.generate({
        course_id: courseId,
        mode: 'practice',
        num_questions: 10,
      })

      if (!quiz?.quiz_id) {
        throw new Error('Quiz ID was not returned by the server.')
      }

      navigate(`/quizzes/${quiz.quiz_id}`)
    } catch (err) {
      console.error('Quiz generation error:', err)

      if (axios.isAxiosError(err)) {
        const status = err.response?.status
        const detail = err.response?.data?.detail

        // ========================================================
        // PREMIUM REQUIRED
        // ========================================================

        if (status === 403) {
          setUpgradeMessage(
            typeof detail === 'string'
              ? detail
              : 'This feature requires Premium access. Upgrade your plan to continue.'
          )

          setShowUpgradeModal(true)
          return
        }

        // ========================================================
        // FREE USER COOLDOWN
        // ========================================================

        if (status === 429) {
          if (typeof detail === 'object' && detail !== null) {
            const cooldownDetail = detail as {
              message?: string
              retry_after_seconds?: number
            }

            const message =
              cooldownDetail.message ||
              'You need to wait before taking another quiz.'

            setCooldownMessage(message)

            if (
              typeof cooldownDetail.retry_after_seconds === 'number' &&
              cooldownDetail.retry_after_seconds > 0
            ) {
              const untilTime =
                Date.now() +
                cooldownDetail.retry_after_seconds * 1000

              localStorage.setItem(
                'quiz_cooldown_until',
                untilTime.toString()
              )
            }
          } else {
            setCooldownMessage(
              typeof detail === 'string'
                ? detail
                : 'Free-tier cooldown is active. Please wait or upgrade for unlimited quizzes.'
            )
          }

          return
        }

        // ========================================================
        // NOT ENOUGH QUESTIONS
        // ========================================================

        if (status === 422) {
          setGenerateError(
            typeof detail === 'string'
              ? detail
              : 'Not enough questions are available in this course yet.'
          )
          return
        }

        // ========================================================
        // UNAUTHORIZED
        // ========================================================

        if (status === 401) {
          setGenerateError(
            'Your session has expired. Please log in again.'
          )
          return
        }

        // ========================================================
        // SERVER ERROR
        // ========================================================

        if (status && status >= 500) {
          setGenerateError(
            'The quiz service is temporarily unavailable. Please try again shortly.'
          )
          return
        }

        // ========================================================
        // OTHER API ERROR
        // ========================================================

        setGenerateError(
          typeof detail === 'string'
            ? detail
            : 'Could not generate the course quiz right now. Please try again.'
        )
      } else if (err instanceof Error) {
        setGenerateError(err.message)
      } else {
        setGenerateError(
          'Could not generate the course quiz right now. Please try again.'
        )
      }
    } finally {
      setGenerating(false)
    }
  }

  // ============================================================
  // CLEAR QUIZ MESSAGES
  // ============================================================

  const clearMessages = () => {
    setGenerateError(null)
    setUpgradeMessage(null)
    setCooldownMessage(null)
  }

  // ============================================================
  // OPEN UPGRADE
  // ============================================================

  const openUpgrade = (message?: string) => {
    setUpgradeMessage(message || null)
    setShowUpgradeModal(true)
  }

  // ============================================================
  // LOADING STATE
  // ============================================================

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-8 py-6 px-4 animate-pulse">
        <div className="h-4 w-28 bg-slate-200 dark:bg-slate-800 rounded-md" />

        <div className="space-y-3">
          <div className="h-8 w-2/3 bg-slate-200 dark:bg-slate-800 rounded-lg" />
          <div className="h-4 w-full bg-slate-200 dark:bg-slate-800 rounded-md" />
          <div className="h-4 w-4/5 bg-slate-200 dark:bg-slate-800 rounded-md" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
          <div className="h-56 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
          <div className="h-56 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
        </div>
      </div>
    )
  }

  // ============================================================
  // COURSE ERROR / NOT FOUND
  // ============================================================

  if (fetchError || !course) {
    return (
      <div className="max-w-4xl mx-auto py-16 px-4 text-center">
        <div className="inline-flex p-3 bg-red-50 dark:bg-red-950/50 rounded-full text-red-500 mb-4">
          <AlertCircle className="w-6 h-6" />
        </div>

        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
          {fetchError ? 'Failed to Load Course' : 'Course Not Found'}
        </h2>

        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-md mx-auto mb-6">
          {fetchError ||
            'The requested course could not be located or may no longer be available.'}
        </p>

        <div className="flex items-center justify-center gap-3 flex-wrap">
          <Link
            to="/courses"
            className="px-4 py-2.5 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            ← Back to All Courses
          </Link>

          {fetchError && (
            <button
              type="button"
              onClick={fetchCourse}
              className="px-4 py-2.5 text-xs font-semibold rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-colors inline-flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Try Again
            </button>
          )}
        </div>
      </div>
    )
  }

  // ============================================================
  // MAIN COURSE PAGE
  // ============================================================

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-6 px-4">
      {/* ========================================================
          HEADER & BREADCRUMB
      ======================================================== */}

      <div>
        <div className="flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400 mb-4">
          <Link
            to="/dashboard"
            className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
          >
            Dashboard
          </Link>

          <span>/</span>

          <Link
            to="/courses"
            className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors inline-flex items-center"
          >
            <ArrowLeft className="w-3.5 h-3.5 mr-1" />
            Courses
          </Link>

          <span>/</span>

          <span className="text-slate-700 dark:text-slate-300 truncate max-w-[180px]">
            {course.name}
          </span>
        </div>

        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-display text-3xl md:text-4xl font-bold text-slate-900 dark:text-slate-100">
              {course.name}
            </h1>

            {course.description && (
              <p className="text-slate-600 dark:text-slate-300 mt-3 text-base leading-relaxed max-w-3xl">
                {course.description}
              </p>
            )}
          </div>

          {/* Premium Badge */}
          {isPremium && (
            <span className="px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-bold rounded-xl flex items-center gap-1.5 shrink-0">
              <Crown className="w-3.5 h-3.5 fill-amber-500" />
              Premium
            </span>
          )}
        </div>
      </div>

      {/* ========================================================
          GENERATION ERROR
      ======================================================== */}

      {generateError && (
        <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 rounded-xl px-4 py-3 flex items-start justify-between gap-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
            <span>{generateError}</span>
          </div>

          <button
            type="button"
            onClick={() => setGenerateError(null)}
            className="text-xs font-bold text-red-500 hover:underline ml-2 shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ========================================================
          COOLDOWN CALLOUT
      ======================================================== */}

      {cooldownMessage && (
        <div className="text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 rounded-xl px-4 py-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="text-lg leading-none">⏳</span>

              <div>
                <p className="font-semibold">
                  Quiz cooldown active
                </p>

                <p className="text-xs mt-1 text-amber-700/80 dark:text-amber-400/80">
                  {cooldownMessage}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setCooldownMessage(null)}
              className="text-xs font-bold text-amber-500 hover:underline shrink-0"
            >
              Dismiss
            </button>
          </div>

          {!isPremium && !isAdmin && (
            <div className="mt-3 pt-3 border-t border-amber-200 dark:border-amber-900/50">
              <button
                type="button"
                onClick={() =>
                  openUpgrade(
                    'Upgrade to Premium for unlimited quizzes with no cooldown.'
                  )
                }
                className="text-xs font-bold text-amber-700 dark:text-amber-400 hover:underline inline-flex items-center gap-1"
              >
                <Crown className="w-3.5 h-3.5" />
                Upgrade for Unlimited Quizzes
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* ========================================================
          COURSE ACTION CARDS
      ======================================================== */}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
        {/* ======================================================
            OPTION 1 — COURSE NOTES
        ====================================================== */}

        <Link
          to={`/courses/${courseId}/notes`}
          className="card p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl hover:border-indigo-600 dark:hover:border-indigo-500 hover:shadow-lg hover:shadow-indigo-500/5 transition-all flex flex-col justify-between group"
        >
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors">
              <BookOpen className="w-6 h-6" />
            </div>

            <h3 className="font-display font-bold text-xl text-slate-900 dark:text-slate-100">
              Read Course Notes
            </h3>

            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Complete study notes prepared from
              course materials and structured according to Ethiopian
              National Exit Exam competency standards.
            </p>

            {!isPremium && !isAdmin && (
              <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1">
                <Lock className="w-3 h-3" />
                Free preview available
              </p>
            )}

            {(isPremium || isAdmin) && (
              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                <Crown className="w-3 h-3 fill-emerald-500" />
                Full Premium study notes
              </p>
            )}
          </div>

          <div className="text-xs font-bold text-indigo-600 dark:text-indigo-400 mt-6 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
            <span>
              {isPremium || isAdmin
                ? 'Open Full Study Notes'
                : 'Open Preview'}
            </span>

            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </Link>

        {/* ======================================================
            OPTION 2 — COURSE QUIZ
        ====================================================== */}

        <button
          type="button"
          onClick={handleTakeQuiz}
          disabled={generating || isAuthLoading}
          aria-busy={generating}
          className="card p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl hover:border-emerald-600 dark:hover:border-emerald-500 hover:shadow-lg hover:shadow-emerald-500/5 transition-all text-left flex flex-col justify-between group disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors">
              {generating ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <FileText className="w-6 h-6" />
              )}
            </div>

            <h3 className="font-display font-bold text-xl text-slate-900 dark:text-slate-100">
              Take Course Quiz
            </h3>

            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Test your mastery with a focused 10-question practice
              assessment drawn exclusively from this course module with
              instant feedback.
            </p>

            {!isPremium && !isAdmin && (
              <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1">
                <Lock className="w-3 h-3" />
                Free tier: 3-hour cooldown
              </p>
            )}

            {(isPremium || isAdmin) && (
              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                <Crown className="w-3 h-3 fill-emerald-500" />
                Unlimited Premium quizzes
              </p>
            )}
          </div>

          <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-6 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
            {generating ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Generating Quiz...</span>
              </>
            ) : (
              <>
                <span>
                  {isPremium || isAdmin
                    ? 'Start Unlimited Quiz'
                    : 'Start 10-Question Quiz'}
                </span>

                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </div>
        </button>
      </div>

      {/* ========================================================
          QUICK INFORMATION
      ======================================================== */}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 p-4">
          <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
            Study
          </p>

          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-1">
            Course Notes
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 p-4">
          <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
            Practice
          </p>

          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-1">
            10 Questions
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 p-4">
          <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
            Access
          </p>

          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-1">
            {isPremium || isAdmin ? 'Unlimited' : 'Free + Cooldown'}
          </p>
        </div>
      </div>

      {/* ========================================================
          MOBILE/USER FEEDBACK AREA
      ======================================================== */}

      {(generateError || cooldownMessage || upgradeMessage) && (
        <div className="flex justify-center pt-1">
          <button
            type="button"
            onClick={clearMessages}
            className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          >
            Clear notifications
          </button>
        </div>
      )}

      {/* ========================================================
          UPGRADE MODAL
      ======================================================== */}

      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => {
          setShowUpgradeModal(false)
          setUpgradeMessage(null)
        }}
        customMessage={
          upgradeMessage ||
          'Upgrade to Premium for unlimited quizzes, full course notes, mock exams, and study tools.'
        }
      />
    </div>
  )
}
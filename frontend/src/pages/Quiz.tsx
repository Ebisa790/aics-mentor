import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Crown } from 'lucide-react'

import { quizApi } from '../api'
import { useAuth } from '../context/AuthContext'
import type {
  AttemptResult,
  Question,
  QuizAnswerItem,
  QuizDetail,
} from '../api/types'
import { FormattedQuestionText } from '../components/FormattedQuestionText'

const THREE_HOURS_IN_SECONDS = 3 * 60 * 60
const COOLDOWN_KEY = 'quiz_cooldown_until'

function formatCountdown(totalSeconds: number): string {
  const clamped = Math.max(0, totalSeconds)
  const hours = Math.floor(clamped / 3600)
  const minutes = Math.floor((clamped % 3600) / 60)
  const seconds = clamped % 60

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds.toString().padStart(2, '0')}s`
  }

  return `${minutes}:${seconds.toString().padStart(2, '0')}s`
}

function cleanChoiceText(text: string): string {
  if (!text) return ''
  return text.replace(/^[a-zA-Z][.)]\s*/, '')
}

function getRemainingCooldownSeconds(): number | null {
  const storedUntil = localStorage.getItem(COOLDOWN_KEY)

  if (!storedUntil) return null

  const untilTime = parseInt(storedUntil, 10)
  const remainingSeconds = Math.ceil((untilTime - Date.now()) / 1000)

  return remainingSeconds > 0 ? remainingSeconds : null
}

function setCooldownTimestamp(
  seconds: number = THREE_HOURS_IN_SECONDS,
) {
  const untilTime = Date.now() + seconds * 1000
  localStorage.setItem(COOLDOWN_KEY, untilTime.toString())
}

function clearCooldownTimestamp() {
  localStorage.removeItem(COOLDOWN_KEY)
}

export function Quiz() {
  const { quizId } = useParams<{ quizId: string }>()
  const navigate = useNavigate()
  const { isPremium, isAdmin } = useAuth()

  const [quiz, setQuiz] = useState<QuizDetail | null>(null)
  const [attemptId, setAttemptId] = useState<string | null>(null)
  const [deadline, setDeadline] = useState<number | null>(null)
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [flagged, setFlagged] = useState<Record<string, boolean>>({})
  const [activeQuestionIdx, setActiveQuestionIdx] = useState<number>(0)
  const [warningsCount, setWarningsCount] = useState<number>(0)
  const [result, setResult] = useState<AttemptResult | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isRestarting, setIsRestarting] = useState(false)
  const [isGeneratingNew, setIsGeneratingNew] = useState(false)
  const [autoSubmitted, setAutoSubmitted] = useState(false)
  const [cooldownError, setCooldownError] = useState<string | null>(null)

  const [cooldownSeconds, setCooldownSeconds] = useState<number | null>(
    () => (isPremium || isAdmin ? null : getRemainingCooldownSeconds()),
  )

  const answersRef = useRef(answers)
  answersRef.current = answers

  const quizRef = useRef<QuizDetail | null>(quiz)
  quizRef.current = quiz

  const submittedRef = useRef(false)

  const handleApiError = useCallback((err: any) => {
    const status = err?.response?.status
    const errorDetail = err?.response?.data?.detail

    if (status === 429) {
      let retrySeconds = THREE_HOURS_IN_SECONDS

      if (typeof errorDetail === 'object' && errorDetail !== null) {
        setCooldownError(
          errorDetail.message ||
            'Free tier 3-hour cooldown active. Please wait or upgrade.',
        )

        if (typeof errorDetail.retry_after_seconds === 'number') {
          retrySeconds = errorDetail.retry_after_seconds
        }
      } else if (typeof errorDetail === 'string') {
        setCooldownError(errorDetail)
      } else {
        setCooldownError(
          'Free tier 3-hour cooldown active. Please try again later.',
        )
      }

      setCooldownSeconds(retrySeconds)
      setCooldownTimestamp(retrySeconds)
    } else {
      const fallback =
        typeof errorDetail === 'string'
          ? errorDetail
          : 'Could not process the quiz request right now. Please try again.'

      setCooldownError(fallback)
    }
  }, [])

  const checkCooldownActive = useCallback(() => {
    if (isPremium || isAdmin) return false

    const remaining = getRemainingCooldownSeconds()

    if (remaining !== null && remaining > 0) {
      setCooldownSeconds(remaining)
      setCooldownError(
        'A 3-hour cooldown is currently active between quiz attempts.',
      )
      return true
    }

    return false
  }, [isPremium, isAdmin])

  const doSubmit = useCallback(
    async (isAutoSubmit: boolean) => {
      const currentQuizId = quizRef.current?.id || quizId

      if (submittedRef.current || !currentQuizId) return

      submittedRef.current = true
      setIsSubmitting(true)

      try {
        const payload: QuizAnswerItem[] = Object.entries(
          answersRef.current,
        ).map(([question_id, selected_answer]) => ({
          question_id,
          answer: selected_answer,
        }))

        const data = await quizApi.submit(currentQuizId, payload)

        setResult(data)

        if (isAutoSubmit) {
          setAutoSubmitted(true)
        }

        localStorage.removeItem(`quiz_draft_${currentQuizId}`)

        if (!isPremium && !isAdmin) {
          setCooldownTimestamp(THREE_HOURS_IN_SECONDS)
          setCooldownSeconds(THREE_HOURS_IN_SECONDS)
        }
      } catch (err) {
        console.error('Failed to submit quiz:', err)
        submittedRef.current = false
        handleApiError(err)
      } finally {
        setIsSubmitting(false)
      }
    },
    [quizId, handleApiError, isPremium, isAdmin],
  )

  const doSubmitRef = useRef(doSubmit)
  doSubmitRef.current = doSubmit

  const initAttempt = useCallback(
    async (id: string, isCancelled: () => boolean) => {
      setIsLoading(true)
      setResult(null)
      setFlagged({})
      setActiveQuestionIdx(0)
      setWarningsCount(0)
      setAutoSubmitted(false)
      setDeadline(null)
      setSecondsLeft(null)
      submittedRef.current = false

      if (!isPremium && !isAdmin) {
        const remainingCooldown = getRemainingCooldownSeconds()

        if (remainingCooldown !== null && remainingCooldown > 0) {
          setCooldownSeconds(remainingCooldown)
          setCooldownError(
            'A 3-hour cooldown is currently active before taking your next quiz.',
          )
          setIsLoading(false)
          setIsRestarting(false)
          return
        }
      }

      setCooldownError(null)
      setCooldownSeconds(null)

      let initialDraft: Record<string, string> = {}

      try {
        const saved = localStorage.getItem(`quiz_draft_${id}`)

        if (saved) {
          initialDraft = JSON.parse(saved)
        }
      } catch {
        // Fallback on JSON parsing error.
      }

      setAnswers(initialDraft)

      try {
        const [quizRes, attemptRes] = await Promise.all([
          quizApi.get(id),
          quizApi.start(id),
        ])

        if (isCancelled()) return

        setQuiz(quizRes)
        setAttemptId(attemptRes?.attempt_id ?? null)

        const timeLimit = quizRes?.time_limit_minutes
        const startedAt = attemptRes?.started_at

        if (timeLimit && startedAt) {
          const startedAtMs = new Date(startedAt).getTime()

          if (!isNaN(startedAtMs)) {
            setDeadline(startedAtMs + timeLimit * 60 * 1000)
          }
        }
      } catch (err) {
        if (!isCancelled()) {
          console.error('Failed to initialize quiz attempt:', err)
          handleApiError(err)
        }
      } finally {
        if (!isCancelled()) {
          setIsLoading(false)
          setIsRestarting(false)
        }
      }
    },
    [handleApiError, isPremium, isAdmin],
  )

  useEffect(() => {
    let cancelled = false

    if (quizId) {
      initAttempt(quizId, () => cancelled)
    }

    return () => {
      cancelled = true
    }
  }, [quizId, initAttempt])

  useEffect(() => {
    if (quizId && !result && !isLoading) {
      if (Object.keys(answers).length > 0) {
        localStorage.setItem(
          `quiz_draft_${quizId}`,
          JSON.stringify(answers),
        )
      } else {
        localStorage.removeItem(`quiz_draft_${quizId}`)
      }
    }
  }, [quizId, answers, result, isLoading])

  useEffect(() => {
    if (cooldownSeconds === null || cooldownSeconds <= 0) return

    const interval = setInterval(() => {
      setCooldownSeconds((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval)
          clearCooldownTimestamp()
          setCooldownError(null)
          return null
        }

        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [cooldownSeconds])

  useEffect(() => {
    if (warningsCount >= 3 && !submittedRef.current) {
      doSubmitRef.current(true)
    }
  }, [warningsCount])

  useEffect(() => {
    if (result || isLoading) return

    const handleVisibilityChange = () => {
      if (document.hidden && !submittedRef.current) {
        setWarningsCount((prev) => prev + 1)
      }
    }

    document.addEventListener(
      'visibilitychange',
      handleVisibilityChange,
    )

    return () => {
      document.removeEventListener(
        'visibilitychange',
        handleVisibilityChange,
      )
    }
  }, [result, isLoading])

  useEffect(() => {
    if (!deadline || result) return

    const tick = () => {
      const remaining = Math.round((deadline - Date.now()) / 1000)

      setSecondsLeft(remaining)

      if (remaining <= 0 && !submittedRef.current) {
        doSubmitRef.current(true)
      }
    }

    tick()

    const interval = setInterval(tick, 1000)

    return () => clearInterval(interval)
  }, [deadline, result])

  const handleRetakeQuiz = async () => {
    if (!quizId || isRestarting) return
    if (checkCooldownActive()) return

    setIsRestarting(true)

    localStorage.removeItem(`quiz_draft_${quizId}`)
    setAnswers({})

    initAttempt(quizId, () => false)
  }

  const handleGenerateNewQuiz = async () => {
    const courseId = quiz?.course_id

    if (!courseId || isGeneratingNew) return
    if (checkCooldownActive()) return

    setIsGeneratingNew(true)
    setCooldownError(null)
    setCooldownSeconds(null)

    try {
      const newQuiz = await quizApi.generate(courseId)

      if (quizId) {
        localStorage.removeItem(`quiz_draft_${quizId}`)
      }

      setResult(null)
      navigate(`/quizzes/${newQuiz.id}`)
    } catch (err: any) {
      console.error('Failed to generate course quiz:', err)

      if (err?.response?.status === 429) {
        setQuiz(null)
      }

      handleApiError(err)
    } finally {
      setIsGeneratingNew(false)
    }
  }

  const handleManualSubmit = () => {
    if (
      window.confirm(
        'Are you sure you want to submit your quiz?',
      )
    ) {
      doSubmit(false)
    }
  }

  if (isLoading || isRestarting || isGeneratingNew) {
    return (
      <div className="min-h-[85vh] flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto mb-7 flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-600 dark:border-slate-700 dark:border-t-indigo-400" />
          </div>

          <div className="space-y-2">
            <h3 className="text-xl font-black tracking-tight text-slate-900 dark:text-slate-100">
              {isGeneratingNew
                ? 'Generating Adaptive Questions'
                : isRestarting
                  ? 'Resetting Session'
                  : 'Preparing Exam Environment'}
            </h3>

            <p className="mx-auto max-w-sm text-sm leading-relaxed text-slate-500 dark:text-slate-400">
              {isGeneratingNew
                ? 'Creating a new question set for your course.'
                : isRestarting
                  ? 'Preparing a fresh assessment session.'
                  : 'Loading your assessment and preparing the exam environment.'}
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (cooldownError && !quiz) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 md:py-24">
        <div className="rounded-3xl border border-amber-200 bg-white p-7 text-center shadow-sm dark:border-amber-900/40 dark:bg-slate-900 md:p-10">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-200 bg-amber-50 text-2xl dark:border-amber-900/40 dark:bg-amber-950/30">
            ⏳
          </div>

          <div className="mt-6 space-y-2">
            <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-400">
              3-Hour Cooldown
            </span>

            <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100">
              Quiz Access Temporarily Locked
            </h2>

            <p className="mx-auto max-w-md text-sm leading-relaxed text-slate-500 dark:text-slate-400">
              {cooldownError}
            </p>
          </div>

          {cooldownSeconds !== null && cooldownSeconds > 0 && (
            <div className="mx-auto mt-7 max-w-xs rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-800 dark:bg-slate-950">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Next Assessment Available In
              </span>

              <div className="mt-1 font-mono text-3xl font-black tabular-nums text-amber-500">
                {formatCountdown(cooldownSeconds)}
              </div>
            </div>
          )}

          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <button
              onClick={() => navigate('/pricing')}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-6 py-3 text-xs font-bold text-white transition-all hover:bg-amber-600 active:scale-[0.98] sm:w-auto"
            >
              <Crown className="h-3.5 w-3.5 fill-white" />
              Unlock Unlimited Quizzes
            </button>

            <button
              onClick={() => navigate('/courses')}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3 text-xs font-bold text-slate-700 transition-all hover:bg-slate-50 active:scale-[0.98] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 sm:w-auto"
            >
              <span>←</span>
              Back to Courses
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!quiz) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center md:py-28">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-2xl dark:border-slate-800 dark:bg-slate-900">
          
        </div>

        <h3 className="mt-5 text-lg font-black tracking-tight text-slate-900 dark:text-slate-100">
          Assessment Not Located
        </h3>

        <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
          This quiz session has expired or does not exist.
        </p>

        <button
          onClick={() => navigate('/courses')}
          className="mt-6 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white transition-all hover:bg-indigo-500 active:scale-[0.98]"
        >
          Return to Courses
        </button>
      </div>
    )
  }

  const questions: Question[] = quiz.questions ?? []

  if (result) {
    const weakTopics = result.weak_topics ?? []
    const gradedAnswers = result.graded_answers ?? []
    const isPassed = result.score_percent >= 70

    const isCooldownActive =
      !isPremium &&
      !isAdmin &&
      cooldownSeconds !== null &&
      cooldownSeconds > 0

    return (
      <div className="mx-auto max-w-5xl space-y-7 px-4 py-8 md:py-10">
        {isPremium && (
          <div className="flex items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-bold text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-400">
            <Crown className="h-4 w-4 fill-amber-500" />
            Premium — Unlimited Quiz Access
          </div>
        )}

        {cooldownError && (
          <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3.5 text-xs font-bold text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300 sm:flex-row sm:items-center sm:justify-between">
            <span className="flex items-center gap-2">
              <span>️</span>
              <span>{cooldownError}</span>
            </span>

            {cooldownSeconds !== null && cooldownSeconds > 0 && (
              <span className="w-fit rounded-lg bg-amber-100 px-2.5 py-1 font-mono text-xs font-extrabold tabular-nums dark:bg-amber-900/30">
                {formatCountdown(cooldownSeconds)}
              </span>
            )}
          </div>
        )}

        {autoSubmitted && (
          <div className="flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3.5 text-xs font-bold text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-400">
            <span></span>
            <span>
              Assessment automatically submitted due to the time limit or
              anti-cheating tab switches.
            </span>
          </div>
        )}

        <section className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-950 text-white">
          <div className="p-6 md:p-8">
            <div className="flex flex-col gap-7 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0 space-y-3 text-center md:text-left">
                <span
                  className={`inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest ${
                    isPassed
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                      : 'border-amber-500/30 bg-amber-500/10 text-amber-400'
                  }`}
                >
                  {isPassed
                    ? ' Assessment Passed'
                    : ' Diagnostic Summary'}
                </span>

                <h1 className="break-words text-2xl font-black tracking-tight md:text-3xl">
                  {quiz.title}
                </h1>

                {attemptId && (
                  <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-slate-400 md:justify-start">
                    <span>Session ID:</span>
                    <span className="rounded-md border border-slate-700 bg-slate-900 px-2 py-0.5 font-mono text-[11px] text-slate-300">
                      {attemptId}
                    </span>
                  </div>
                )}
              </div>

              <div className="shrink-0 text-center">
                <div
                  className={`mx-auto flex h-32 w-32 items-center justify-center rounded-full border-4 ${
                    isPassed
                      ? 'border-emerald-500/30 bg-emerald-500/5'
                      : 'border-amber-500/30 bg-amber-500/5'
                  }`}
                >
                  <div>
                    <div className="font-mono text-4xl font-black tracking-tight">
                      {result.score_percent}%
                    </div>

                    <span className="mt-1 block text-[9px] font-black uppercase tracking-widest text-slate-400">
                      Accuracy
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {weakTopics.length > 0 && (
              <div className="mt-7 border-t border-slate-800 pt-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                  <span className="flex shrink-0 items-center gap-1.5 text-xs font-black uppercase tracking-wider text-amber-400">
                     Focus Areas
                  </span>

                  <div className="flex flex-wrap gap-2">
                    {weakTopics.map((topic, i) => (
                      <span
                        key={i}
                        className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-300"
                      >
                        {topic}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="mt-7 flex flex-col gap-3 border-t border-slate-800 pt-6 sm:flex-row sm:justify-end">
              <button
                onClick={handleRetakeQuiz}
                disabled={isRestarting || isCooldownActive}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-5 py-2.5 text-xs font-bold text-slate-200 transition-all hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                 Retake Same Quiz

                {isCooldownActive && cooldownSeconds !== null && (
                  <span className="text-[10px] text-amber-400">
                    ({formatCountdown(cooldownSeconds)})
                  </span>
                )}
              </button>

              {quiz.course_id && (
                <button
                  onClick={handleGenerateNewQuiz}
                  disabled={isGeneratingNew || isCooldownActive}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white transition-all hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                   Generate Adaptive Set

                  {isCooldownActive &&
                    cooldownSeconds !== null && (
                      <span className="text-[10px] text-indigo-200">
                        ({formatCountdown(cooldownSeconds)})
                      </span>
                    )}
                </button>
              )}

              <button
                onClick={() =>
                  navigate(
                    quiz.course_id
                      ? `/courses/${quiz.course_id}`
                      : '/courses',
                  )
                }
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-transparent px-5 py-2.5 text-xs font-bold text-slate-300 transition-all hover:bg-slate-900"
              >
                 Course Directory
              </button>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex flex-col gap-1 px-1 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-black tracking-tight text-slate-900 dark:text-slate-100">
              Question Diagnostics & Explanations
            </h2>

            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
              {gradedAnswers.length} Questions Reviewed
            </span>
          </div>

          <div className="space-y-4">
            {gradedAnswers.map((ga, idx) => {
              const isCorrect = ga.is_correct

              return (
                <article
                  key={
                    ga.question?.id || `graded-ans-${idx}`
                  }
                  className={`rounded-2xl border p-5 md:p-6 ${
                    isCorrect
                      ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/40 dark:bg-emerald-950/10'
                      : 'border-rose-200 bg-rose-50/50 dark:border-rose-900/40 dark:bg-rose-950/10'
                  }`}
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 space-y-2">
                      <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Question #{idx + 1}
                      </div>

                      <FormattedQuestionText
                        text={ga.question?.prompt || ''}
                      />
                    </div>

                    <span
                      className={`w-fit shrink-0 rounded-full border px-3 py-1 text-xs font-black ${
                        isCorrect
                          ? 'border-emerald-300 bg-emerald-100 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400'
                          : 'border-rose-300 bg-rose-100 text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-400'
                      }`}
                    >
                      {isCorrect
                        ? ' Correct'
                        : ' Incorrect'}
                    </span>
                  </div>

                  <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900">
                      <span className="mb-1 block text-[11px] font-bold text-slate-500 dark:text-slate-400">
                        Your Selected Answer
                      </span>

                      <span
                        className={`font-mono text-xs font-black ${
                          isCorrect
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {ga.student_answer
                          ? ga.student_answer.toUpperCase()
                          : '(Unanswered)'}
                      </span>
                    </div>

                    {!isCorrect &&
                      ga.question?.correct_answer && (
                        <div className="rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900">
                          <span className="mb-1 block text-[11px] font-bold text-slate-500 dark:text-slate-400">
                            Correct Choice
                          </span>

                          <span className="font-mono text-xs font-black text-emerald-600 dark:text-emerald-400">
                            {ga.question.correct_answer.toUpperCase()}
                          </span>
                        </div>
                      )}
                  </div>

                  {ga.ai_feedback ? (
                    <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950 p-4">
                      <div className="flex items-center gap-1.5 text-xs font-extrabold text-indigo-400">
                        <span></span>
                        <span>AI Tutor Analysis</span>
                      </div>

                      <p className="mt-2 text-xs leading-relaxed text-slate-300">
                        {ga.ai_feedback}
                      </p>
                    </div>
                  ) : (
                    ga.question?.explanation && (
                      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                        <span className="block text-[11px] font-black text-slate-500 dark:text-slate-400">
                          Explanation
                        </span>

                        <p className="mt-1.5 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                          {ga.question.explanation}
                        </p>
                      </div>
                    )
                  )}
                </article>
              )
            })}
          </div>
        </section>
      </div>
    )
  }

  const isTimeCritical =
    secondsLeft !== null && secondsLeft <= 300

  const currentQuestion = questions[activeQuestionIdx]

  const progressPercent =
    questions.length > 0
      ? Math.round(
          ((activeQuestionIdx + 1) / questions.length) * 100,
        )
      : 0

  const totalAnswered = Object.keys(answers).length

  const answeredPercent =
    questions.length > 0
      ? Math.round((totalAnswered / questions.length) * 100)
      : 0

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-5 md:py-7">
      {/* Exam Header */}
      <header className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-indigo-700 dark:border-indigo-900/50 dark:bg-indigo-950/30 dark:text-indigo-400">
                Active Assessment
              </span>

              {attemptId && (
                <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-[10px] text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
                  ID: {attemptId.slice(0, 8)}
                </span>
              )}

              {isPremium && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
                  <Crown className="h-3 w-3 fill-amber-500" />
                  Premium
                </span>
              )}
            </div>

            <h1 className="mt-2 truncate text-lg font-black tracking-tight text-slate-900 dark:text-slate-100 md:text-xl">
              {quiz.title}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2 md:justify-end">
            {warningsCount > 0 && (
              <div className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-black text-rose-600 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-400">
                <span>️</span>
                <span>
                  Warnings {warningsCount}/3
                </span>
              </div>
            )}

            {secondsLeft !== null && (
              <div
                className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 font-mono text-sm font-black tabular-nums ${
                  isTimeCritical
                    ? 'border-rose-300 bg-rose-50 text-rose-600 dark:border-rose-900/50 dark:bg-rose-950/20 dark:text-rose-400'
                    : 'border-slate-200 bg-slate-50 text-slate-800 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200'
                }`}
              >
                <span>⏱</span>
                <span>{formatCountdown(secondsLeft)}</span>
              </div>
            )}
          </div>
        </div>

        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-slate-400">
            <span>Question Progress</span>

            <span>
              {activeQuestionIdx + 1} / {questions.length}
            </span>
          </div>

          <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className="h-full rounded-full bg-indigo-600 transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </header>

      {/* Main Exam Area */}
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-4">
        {/* Question */}
        <main className="lg:col-span-3">
          {currentQuestion && (
            <section className="rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="p-5 md:p-7">
                <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 dark:border-slate-800 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
                      Question {activeQuestionIdx + 1}
                    </span>

                    <div className="mt-2">
                      <FormattedQuestionText
                        text={currentQuestion.prompt}
                      />
                    </div>
                  </div>

                  <button
                    onClick={() =>
                      setFlagged((prev) => ({
                        ...prev,
                        [currentQuestion.id]:
                          !prev[currentQuestion.id],
                      }))
                    }
                    className={`inline-flex w-fit shrink-0 items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition-all ${
                      flagged[currentQuestion.id]
                        ? 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-400'
                        : 'border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span>
                      {flagged[currentQuestion.id]
                        ? ''
                        : ''}
                    </span>

                    <span>
                      {flagged[currentQuestion.id]
                        ? 'Flagged'
                        : 'Flag Question'}
                    </span>
                  </button>
                </div>

                {currentQuestion.choices && (
                  <div className="mt-6 space-y-3">
                    {Object.entries(
                      currentQuestion.choices,
                    ).map(([key, val]) => {
                      const isSelected =
                        answers[currentQuestion.id] === key

                      return (
                        <button
                          key={key}
                          onClick={() => {
                            setAnswers((prev) => {
                              const updated = {
                                ...prev,
                                [currentQuestion.id]: key,
                              }

                              answersRef.current = updated

                              return updated
                            })
                          }}
                          className={`group flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left transition-all md:p-4 ${
                            isSelected
                              ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30'
                              : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700 dark:hover:bg-slate-800'
                          }`}
                        >
                          <span
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-mono text-xs font-black transition-all ${
                              isSelected
                                ? 'bg-indigo-600 text-white'
                                : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:group-hover:bg-slate-700'
                            }`}
                          >
                            {key.toUpperCase()}
                          </span>

                          <span
                            className={`text-sm leading-relaxed ${
                              isSelected
                                ? 'font-semibold text-indigo-950 dark:text-indigo-100'
                                : 'font-medium text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            {cleanChoiceText(val)}
                          </span>

                          {isSelected && (
                            <span className="ml-auto flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-black text-white">
                              
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )}

                <div className="mt-7 flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    onClick={() =>
                      setActiveQuestionIdx((prev) =>
                        Math.max(0, prev - 1),
                      )
                    }
                    disabled={activeQuestionIdx === 0}
                    className="rounded-xl border border-slate-200 px-5 py-2.5 text-xs font-bold text-slate-700 transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    ← Previous
                  </button>

                  <div className="flex w-full gap-2 sm:w-auto">
                    {activeQuestionIdx <
                    questions.length - 1 ? (
                      <button
                        onClick={() =>
                          setActiveQuestionIdx((prev) =>
                            Math.min(
                              questions.length - 1,
                              prev + 1,
                            ),
                          )
                        }
                        className="w-full rounded-xl bg-indigo-600 px-6 py-2.5 text-xs font-bold text-white transition-all hover:bg-indigo-500 active:scale-[0.98] sm:w-auto"
                      >
                        Next Question →
                      </button>
                    ) : (
                      <button
                        onClick={handleManualSubmit}
                        disabled={isSubmitting}
                        className="w-full rounded-xl bg-emerald-600 px-6 py-2.5 text-xs font-bold text-white transition-all hover:bg-emerald-500 active:scale-[0.98] disabled:opacity-50 sm:w-auto"
                      >
                        {isSubmitting
                          ? 'Submitting...'
                          : 'Submit Assessment '}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </section>
          )}
        </main>

        {/* Navigator */}
        <aside className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:sticky lg:top-5">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">
                Question Navigator
              </h3>

              <span className="text-[10px] font-bold text-slate-400">
                {answeredPercent}%
              </span>
            </div>

            <p className="mt-1 text-[11px] text-slate-400">
              {totalAnswered} of {questions.length} answered
            </p>
          </div>

          <div className="mt-5 grid grid-cols-5 gap-2">
            {questions.map((q, idx) => {
              const isAnswered = Boolean(answers[q.id])
              const isCurrent = idx === activeQuestionIdx
              const isFlagged = flagged[q.id]

              return (
                <button
                  key={q.id || idx}
                  onClick={() => setActiveQuestionIdx(idx)}
                  aria-label={`Go to question ${idx + 1}`}
                  className={`relative h-10 rounded-xl border font-mono text-xs font-black transition-all ${
                    isCurrent
                      ? 'z-10 border-indigo-600 bg-indigo-600 text-white'
                      : isAnswered
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-400'
                        : 'border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400 dark:hover:bg-slate-800'
                  }`}
                >
                  {idx + 1}

                  {isFlagged && (
                    <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-amber-500 dark:border-slate-900" />
                  )}
                </button>
              )
            })}
          </div>

          <div className="mt-5 space-y-2.5 border-t border-slate-100 pt-4 text-[11px] text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                Answered
              </span>

              <span className="font-mono font-bold">
                {totalAnswered}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                Flagged
              </span>

              <span className="font-mono font-bold">
                {Object.values(flagged).filter(Boolean).length}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-indigo-500" />
                Current
              </span>

              <span className="font-mono font-bold">
                {activeQuestionIdx + 1}
              </span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
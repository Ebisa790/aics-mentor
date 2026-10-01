import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  Layers,
  Brain,
  AlertTriangle,
  FileText,
  Printer,
} from 'lucide-react'
import { examBlueprintApi } from '../api'

interface BlueprintItem {
  id: string
  theme: string
  course_name: string
  credit_hours: number
  test_items: number
  cognitive_remember: number
  cognitive_understand: number
  cognitive_apply: number
  cognitive_analyze: number
  cognitive_evaluate: number
  cognitive_create: number
  course_id: string | null
  general_objective: string | null
  learning_outcomes: string[] | null
}

interface BlueprintSummary {
  total_items: number
  total_courses: number
  total_themes: number
  cognitive_totals: Record<string, number>
}

interface BlueprintData {
  summary: BlueprintSummary
  items: BlueprintItem[]
  // Optional — backend may add this later. Frontend falls back to a default.
  last_updated?: string | null
}

// Human-friendly labels for Bloom's taxonomy levels
const COGNITIVE_LABELS: Record<string, { label: string; short: string }> = {
  remember: { label: 'Remembering', short: 'Recall facts' },
  understand: { label: 'Understanding', short: 'Explain ideas' },
  apply: { label: 'Applying', short: 'Use in new situations' },
  analyze: { label: 'Analyzing', short: 'Draw connections' },
  evaluate: { label: 'Evaluating', short: 'Justify a decision' },
  create: { label: 'Creating', short: 'Produce new work' },
}

const COGNITIVE_ORDER = [
  'remember',
  'understand',
  'apply',
  'analyze',
  'evaluate',
  'create',
]

const THEME_EXPANDED_KEY = 'blueprint_expanded_theme'
const COURSE_EXPANDED_KEY = 'blueprint_expanded_course'
const SEEN_KEY = 'blueprint_seen'

function formatRefreshDate(iso: string | null | undefined): string {
  if (!iso) return 'September 2026'
  try {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return 'September 2026'
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  } catch {
    return 'September 2026'
  }
}

// -- Course detail panel (MoE objective + learning outcomes + cognitive mini-chart)
function CourseDetailPanel({ item }: { item: BlueprintItem }) {
  const levels = [
    { key: 'cognitive_remember', label: 'Remember' },
    { key: 'cognitive_understand', label: 'Understand' },
    { key: 'cognitive_apply', label: 'Apply' },
    { key: 'cognitive_analyze', label: 'Analyze' },
    { key: 'cognitive_evaluate', label: 'Evaluate' },
    { key: 'cognitive_create', label: 'Create' },
  ] as const

  const max = Math.max(...levels.map((l) => (item as any)[l.key] as number), 1)

  const hasObjective = !!item.general_objective
  const hasOutcomes =
    Array.isArray(item.learning_outcomes) && item.learning_outcomes.length > 0

  return (
    <div className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 px-4 py-4 space-y-4">
      {hasObjective && (
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
            Course objective
          </div>
          <p className="text-xs italic text-slate-600 dark:text-slate-300 leading-relaxed">
            {item.general_objective}
          </p>
        </div>
      )}

      {hasOutcomes && (
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
            What you must be able to do
          </div>
          <ul className="space-y-1.5">
            {item.learning_outcomes!.map((outcome, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-300 leading-relaxed"
              >
                <span className="mt-1 shrink-0 h-1.5 w-1.5 rounded-full bg-indigo-500" />
                <span>{outcome}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
          Cognitive focus (per MoE blueprint)
        </div>
        <div className="space-y-1.5">
          {levels.map(({ key, label }) => {
            const count = (item as any)[key] as number
            if (count === 0) return null
            const pct = (count / max) * 100
            const color =
              key === 'cognitive_remember' || key === 'cognitive_understand'
                ? 'bg-slate-400'
                : key === 'cognitive_apply' || key === 'cognitive_analyze'
                  ? 'bg-indigo-500'
                  : 'bg-purple-500'
            return (
              <div key={key} className="flex items-center gap-3">
                <div className="w-24 shrink-0 text-[11px] font-medium text-slate-600 dark:text-slate-400">
                  {label}
                </div>
                <div className="flex-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${color}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="w-6 text-right text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  {count}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export function ExamBlueprintPage() {
  const [data, setData] = useState<BlueprintData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // FIX 5 — persist expanded theme/course across visits
  const [expandedTheme, setExpandedThemeState] = useState<string | null>(() => {
    try {
      return localStorage.getItem(THEME_EXPANDED_KEY)
    } catch {
      return null
    }
  })

  const [expandedCourse, setExpandedCourseState] = useState<string | null>(
    () => {
      try {
        return localStorage.getItem(COURSE_EXPANDED_KEY)
      } catch {
        return null
      }
    },
  )

  const setExpandedTheme = (val: string | null) => {
    setExpandedThemeState(val)
    try {
      if (val) localStorage.setItem(THEME_EXPANDED_KEY, val)
      else localStorage.removeItem(THEME_EXPANDED_KEY)
    } catch {
      /* ignore */
    }
  }

  const setExpandedCourse = (val: string | null) => {
    setExpandedCourseState(val)
    try {
      if (val) localStorage.setItem(COURSE_EXPANDED_KEY, val)
      else localStorage.removeItem(COURSE_EXPANDED_KEY)
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    let isMounted = true

    examBlueprintApi
      .get()
      .then((res) => {
        if (isMounted) setData(res)
      })
      .catch((err) => {
        if (isMounted) {
          console.error('Failed to load exam blueprint:', err)
          setError('Could not load the exam blueprint. Please try again.')
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [])

  // Group items by theme
  const themes = useMemo(() => {
    if (!data) return []
    const grouped: Record<string, BlueprintItem[]> = {}
    for (const item of data.items) {
      if (!grouped[item.theme]) grouped[item.theme] = []
      grouped[item.theme].push(item)
    }
    return Object.entries(grouped)
      .map(([theme, items]) => ({
        theme,
        items,
        totalItems: items.reduce((s, i) => s + i.test_items, 0),
        totalCredits: items.reduce((s, i) => s + i.credit_hours, 0),
      }))
      .sort((a, b) => b.totalItems - a.totalItems)
  }, [data])

  // FIX 6 — auto-expand the biggest theme on the first-ever visit
  useEffect(() => {
    if (!data) return
    if (expandedTheme) return // user already has something open
    try {
      if (localStorage.getItem(SEEN_KEY)) return // seen before — don't override
    } catch {
      /* ignore */
    }
    if (themes.length > 0) {
      setExpandedThemeState(themes[0].theme)
      try {
        localStorage.setItem(SEEN_KEY, 'true')
      } catch {
        /* ignore */
      }
    }
  }, [data, themes, expandedTheme])

  const cognitiveMax = data
    ? Math.max(...Object.values(data.summary.cognitive_totals), 1)
    : 1

  // FIX 1 — compute the top-2 theme shares for the study advice
  const top2Share = useMemo(() => {
    if (!data || themes.length < 2) return { pct1: 0, pct2: 0, combined: 0 }
    const t1 = themes[0]
    const t2 = themes[1]
    const total = data.summary.total_items || 1
    const pct1 = Math.round((t1.totalItems / total) * 100)
    const pct2 = Math.round((t2.totalItems / total) * 100)
    const combined = Math.round(
      ((t1.totalItems + t2.totalItems) / total) * 100,
    )
    return { pct1, pct2, combined }
  }, [data, themes])

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-8 px-4 sm:px-6 print:bg-white print:py-0 print:px-0">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Back */}
        <Link
          to="/dashboard"
          className="inline-flex items-center text-sm text-slate-600 dark:text-slate-400 hover:text-indigo-600 transition-colors print:hidden"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Dashboard
        </Link>

        {/* Hero */}
        <header className="relative rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-700 p-6 sm:p-8 text-white shadow-xl print:bg-indigo-600 print:shadow-none">
          {/* FIX 4 — Print / Save as PDF */}
          <button
            type="button"
            onClick={() => window.print()}
            className="absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold px-3 py-1.5 ring-1 ring-white/20 transition print:hidden"
            title="Print or save this page as PDF"
          >
            <Printer className="h-3.5 w-3.5" />
            Print / Save
          </button>

          <div className="flex items-start gap-4">
            <div className="shrink-0 rounded-2xl bg-white/10 p-3 ring-1 ring-white/20">
              <FileText className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1 pr-16 sm:pr-24">
              <div className="text-[10px] font-bold uppercase tracking-widest text-indigo-200">
                Official Ministry of Education Document
              </div>
              <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight">
                The Real Exit Exam Blueprint
              </h1>
              <p className="mt-2 text-sm sm:text-base leading-relaxed text-indigo-100 max-w-2xl">
                This is the actual MoE Test Blueprint for the BSc Computer
                Science Exit Exam. It tells you exactly what's on the exam, how
                many questions come from each course, and what level of
                thinking is required.
              </p>
              {data && (
                <div className="mt-5 flex flex-wrap gap-4 text-sm">
                  <div>
                    <div className="text-2xl font-black">
                      {data.summary.total_items}
                    </div>
                    <div className="text-indigo-200 text-xs uppercase tracking-wide">
                      Questions
                    </div>
                  </div>
                  <div className="w-px bg-white/20" />
                  <div>
                    <div className="text-2xl font-black">
                      {data.summary.total_courses}
                    </div>
                    <div className="text-indigo-200 text-xs uppercase tracking-wide">
                      Courses
                    </div>
                  </div>
                  <div className="w-px bg-white/20" />
                  <div>
                    <div className="text-2xl font-black">
                      {data.summary.total_themes}
                    </div>
                    <div className="text-indigo-200 text-xs uppercase tracking-wide">
                      Themes
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900">
            <div className="h-6 w-6 rounded-full border-2 border-slate-200 border-t-indigo-600 animate-spin mx-auto" />
            <p className="mt-3 text-sm text-slate-500">
              Loading the blueprint...
            </p>
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center dark:border-rose-900/60 dark:bg-rose-950/30">
            <AlertTriangle className="h-8 w-8 text-rose-500 mx-auto mb-2" />
            <p className="text-sm text-rose-700 dark:text-rose-400">{error}</p>
          </div>
        ) : data ? (
          <>
            {/* Cognitive Distribution */}
            <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 print:border-slate-300">
              <div className="flex items-center gap-2 mb-1">
                <Brain className="h-4 w-4 text-purple-500" />
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  What the exam actually tests
                </h2>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">
                The MoE blueprint breaks down all{' '}
                <strong>{data.summary.total_items}</strong> questions by
                thinking level (Bloom's Taxonomy). This tells you how to study
                — memorization won't carry you, you need to apply and analyze.
              </p>

              <div className="space-y-3">
                {COGNITIVE_ORDER.map((key) => {
                  const count = data.summary.cognitive_totals[key] || 0
                  const pct = (count / cognitiveMax) * 100
                  const meta = COGNITIVE_LABELS[key]

                  const color =
                    key === 'remember' || key === 'understand'
                      ? 'bg-slate-400'
                      : key === 'apply' || key === 'analyze'
                        ? 'bg-indigo-500'
                        : 'bg-purple-500'

                  return (
                    <div key={key} className="flex items-center gap-3">
                      <div className="w-28 sm:w-36 shrink-0">
                        <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                          {meta.label}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {meta.short}
                        </div>
                      </div>
                      <div className="flex-1 h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${color}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="w-12 text-right text-sm font-bold text-slate-700 dark:text-slate-300">
                        {count}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* FIX 7 — color legend for the difficulty tiers */}
              <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] text-slate-500 dark:text-slate-400">
                <span className="font-bold uppercase tracking-wider text-slate-400">
                  Legend
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-sm bg-slate-400" />
                  Recall &amp; explain
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-sm bg-indigo-500" />
                  Apply &amp; analyze
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-sm bg-purple-500" />
                  Evaluate &amp; create
                </span>
              </div>

              <p className="mt-5 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                <strong className="text-slate-700 dark:text-slate-300">
                  What this means:
                </strong>{' '}
                Applying ({data.summary.cognitive_totals.apply || 0}) and
                Analyzing ({data.summary.cognitive_totals.analyze || 0}) make
                up{' '}
                {Math.round(
                  (((data.summary.cognitive_totals.apply || 0) +
                    (data.summary.cognitive_totals.analyze || 0)) /
                    data.summary.total_items) *
                    100,
                )}
                % of the exam. Focus on solving problems, not memorizing facts.
              </p>
            </section>

            {/* Theme breakdown */}
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-indigo-500" />
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Themes and courses
                </h2>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Click any theme to see the individual courses and how many
                questions come from each.
              </p>

              {themes.map((theme) => {
                const isExpanded = expandedTheme === theme.theme
                const share = Math.round(
                  (theme.totalItems / data.summary.total_items) * 100,
                )

                return (
                  <div
                    key={theme.theme}
                    className="rounded-2xl border border-slate-200 bg-white overflow-hidden dark:border-slate-800 dark:bg-slate-900 print:border-slate-300"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedTheme(isExpanded ? null : theme.theme)
                      }
                      aria-expanded={isExpanded}
                      aria-controls={`theme-panel-${theme.theme}`}
                      className="w-full text-left px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                            {theme.theme}
                          </h3>
                          <div className="mt-1 flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
                            <span>
                              {theme.items.length}{' '}
                              {theme.items.length === 1 ? 'course' : 'courses'}
                            </span>
                            <span>·</span>
                            <span>{theme.totalItems} questions</span>
                            <span>·</span>
                            <span>{share}% of exam</span>
                          </div>
                        </div>
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-slate-400 shrink-0" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
                        )}
                      </div>
                    </button>

                    {isExpanded && (
                      <div
                        id={`theme-panel-${theme.theme}`}
                        className="border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 px-5 py-4"
                      >
                        <ul className="space-y-3">
                          {theme.items.map((item) => {
                            const isCourseOpen = expandedCourse === item.id
                            return (
                              <li
                                key={item.id}
                                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden"
                              >
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedCourse(
                                      isCourseOpen ? null : item.id,
                                    )
                                  }
                                  aria-expanded={isCourseOpen}
                                  aria-controls={`course-panel-${item.id}`}
                                  className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                                >
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                      <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                                        {item.course_name}
                                      </div>
                                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                        {item.test_items} questions ·{' '}
                                        {item.credit_hours} credit hours
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                      {item.course_id && (
                                        <Link
                                          to={`/courses/${item.course_id}`}
                                          onClick={(e) => e.stopPropagation()}
                                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 print:hidden"
                                        >
                                          Practice
                                          <ArrowRight className="h-3 w-3" />
                                        </Link>
                                      )}
                                      {isCourseOpen ? (
                                        <ChevronUp className="h-4 w-4 text-slate-400" />
                                      ) : (
                                        <ChevronDown className="h-4 w-4 text-slate-400" />
                                      )}
                                    </div>
                                  </div>
                                </button>
                                {isCourseOpen && (
                                  <div id={`course-panel-${item.id}`}>
                                    <CourseDetailPanel item={item} />
                                  </div>
                                )}
                              </li>
                            )
                          })}
                        </ul>
                      </div>
                    )}
                  </div>
                )
              })}
            </section>

            {/* Study advice */}
            <section className="rounded-2xl border border-indigo-200 bg-indigo-50 p-6 dark:border-indigo-500/30 dark:bg-indigo-500/10">
              <div className="flex items-start gap-3">
                <TrendingUp className="h-5 w-5 shrink-0 text-indigo-600 dark:text-indigo-400 mt-0.5" />
                <div>
                  <h3 className="text-sm font-bold text-indigo-900 dark:text-indigo-200">
                    How to use this blueprint
                  </h3>
                  <ul className="mt-2 space-y-1.5 text-xs text-indigo-800 dark:text-indigo-300 leading-relaxed">
                    <li>
                      <strong>Study in proportion.</strong>{' '}
                      {themes[0] && (
                        <>
                          <strong>{themes[0].theme}</strong> ({top2Share.pct1}%)
                        </>
                      )}
                      {themes[1] && (
                        <>
                          {' '}
                          and <strong>{themes[1].theme}</strong> (
                          {top2Share.pct2}%)
                        </>
                      )}
                      {themes.length >= 2 && (
                        <>
                          {' '}
                          together are <strong>{top2Share.combined}% of the
                          exam</strong>. Start there.
                        </>
                      )}
                    </li>
                    <li>
                      <strong>Practice applying, not memorizing.</strong> The
                      blueprint is heavy on Applying and Analyzing — do mock
                      exams and problem sets, not just flashcards.
                    </li>
                    <li>
                      <strong>Check yourself per course.</strong> After studying
                      a topic, take a short quiz on that specific course. Aim
                      for 70%+ before moving on.
                    </li>
                  </ul>
                </div>
              </div>
            </section>

            {/* Source */}
            <p className="text-center text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed">
              Source: Ministry of Education, Test Blueprint for National Exit
              Examination — BSc in Computer Science (2015 E.C. / 2023).<br />
              Data refreshed: {formatRefreshDate(data.last_updated)}.
            </p>
          </>
        ) : null}
      </div>
    </div>
  )
}

export default ExamBlueprintPage
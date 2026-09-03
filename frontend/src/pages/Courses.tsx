import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react'
import { courseApi } from '../api'
import type { Course } from '../api/types'

export function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL')
  const [showFilters, setShowFilters] = useState(false)

  const fetchCourses = async (isMounted = true) => {
    setIsLoading(true)
    setError(null)

    try {
      const res = await courseApi.list()

      if (isMounted) {
        setCourses(Array.isArray(res) ? res : [])
      }
    } catch (err: unknown) {
      if (isMounted) {
        const errorObj = err as {
          response?: {
            data?: {
              detail?: string
            }
          }
        }

        setError(
          errorObj?.response?.data?.detail ||
            'Couldn\'t load courses. Check your internet and try again.'
        )
      }
    } finally {
      if (isMounted) {
        setIsLoading(false)
      }
    }
  }

  useEffect(() => {
    let isMounted = true

    fetchCourses(isMounted)

    return () => {
      isMounted = false
    }
  }, [])

  const categories = useMemo(() => {
    const categorySet = new Set(
      courses.map((course) => course.category || 'General')
    )

    return ['ALL', ...Array.from(categorySet)]
  }, [courses])

  const filteredCourses = useMemo(() => {
    const query = searchQuery.toLowerCase().trim()

    return courses.filter((course) => {
      const category = course.category || 'General'

      const matchesCategory =
        selectedCategory === 'ALL' || category === selectedCategory

      const matchesSearch =
        !query ||
        course.name.toLowerCase().includes(query) ||
        course.code?.toLowerCase().includes(query) ||
        course.description?.toLowerCase().includes(query) ||
        category.toLowerCase().includes(query)

      return matchesCategory && matchesSearch
    })
  }, [courses, selectedCategory, searchQuery])

  const groupedCourses = useMemo(() => {
    return filteredCourses.reduce<Record<string, Course[]>>(
      (accumulator, course) => {
        const category = course.category || 'General'

        if (!accumulator[category]) {
          accumulator[category] = []
        }

        accumulator[category].push(course)

        return accumulator
      },
      {}
    )
  }, [filteredCourses])

  const hasActiveFilters =
    searchQuery.trim().length > 0 || selectedCategory !== 'ALL'

  const clearFilters = () => {
    setSearchQuery('')
    setSelectedCategory('ALL')
  }

  return (
    <div className="min-h-full bg-transparent pb-16">
      <div className="mx-auto max-w-7xl space-y-8 px-4 py-6 sm:px-6 lg:px-8">

        {/* =========================================================
            PAGE HEADER
        ========================================================= */}
        <section className="relative overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm">
          <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-indigo-600 dark:bg-indigo-500/10 blur-3xl" />
          <div className="absolute -bottom-24 -left-20 h-48 w-48 rounded-full bg-indigo-600 dark:bg-indigo-500/5 blur-3xl" />

          <div className="relative p-6 sm:p-8 lg:p-10">

            {/* Breadcrumb */}
            <div className="mb-7">
              <Link
                to="/dashboard"
                className="group inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 transition-colors hover:bg-slate-100 dark:bg-slate-800/5 hover:text-indigo-600 dark:text-indigo-400"
              >
                <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
                Back to Dashboard
              </Link>
            </div>

            {/* Main heading */}
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-indigo-200 dark:border-indigo-800 bg-indigo-600 dark:bg-indigo-500/10 px-3 py-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400">
                  <BookOpen className="h-3.5 w-3.5" />
                  <span>EXIT EXAM PREPARATION</span>
                </div>

                <h1 className="font-bold text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-4xl lg:text-5xl">
                  Curriculum Courses
                </h1>

                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-400 sm:text-base">
                  Explore your Computer Science courses, study modules, and
                  practice quizzes designed to help you prepare confidently
                  for the national exit examination.
                </p>
              </div>

              {!isLoading && courses.length > 0 && (
                <div className="flex shrink-0 items-center gap-3">
                  <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/[0.025] px-4 py-3 text-center">
                    <div className="font-bold text-2xl font-bold text-slate-900 dark:text-slate-100">
                      {courses.length}
                    </div>
                    <div className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Courses
                    </div>
                  </div>

                  {categories.length > 1 && (
                    <div className="hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/[0.025] px-4 py-3 text-center sm:block">
                      <div className="font-bold text-2xl font-bold text-slate-900 dark:text-slate-100">
                        {categories.length - 1}
                      </div>
                      <div className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Categories
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* =========================================================
            SEARCH & FILTER BAR
        ========================================================= */}
        {!isLoading && !error && courses.length > 0 && (
          <section className="space-y-4">

            {/* Search */}
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />

                <input
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search courses by code, title, or topic..."
                  aria-label="Search courses"
                  className="h-12 w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white pl-11 pr-11 text-sm text-slate-900 dark:text-slate-100 shadow-sm outline-none transition-all placeholder:text-slate-400 dark:text-slate-500 focus:border-accent/50 focus:ring-4 focus:ring-accent/10 dark:bg-slate-900"
                />

                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    aria-label="Clear search"
                    className="absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 transition-colors hover:bg-slate-100 dark:bg-slate-800/5 hover:text-slate-900 dark:text-slate-100"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setShowFilters((value) => !value)}
                className={`inline-flex h-12 items-center justify-center gap-2 rounded-2xl border px-5 text-sm font-semibold transition-all lg:hidden ${
                  showFilters || selectedCategory !== 'ALL'
                    ? 'border-indigo-300 dark:border-indigo-700 bg-indigo-600 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                    : 'border-slate-200 dark:border-slate-700 bg-white text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:bg-slate-800/[0.03] dark:bg-slate-900'
                }`}
              >
                <SlidersHorizontal className="h-4 w-4" />
                Filters
                {selectedCategory !== 'ALL' && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-indigo-600 dark:bg-indigo-500 px-1.5 text-[10px] text-white">
                    1
                  </span>
                )}
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${
                    showFilters ? 'rotate-180' : ''
                  }`}
                />
              </button>

              <div className="hidden items-center gap-2 lg:flex">
                <span className="mr-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Filter:
                </span>

                <div className="flex max-w-full gap-1.5 overflow-x-auto scrollbar-none">
                  {categories.map((category) => {
                    const active = selectedCategory === category

                    return (
                      <button
                        key={category}
                        type="button"
                        onClick={() => setSelectedCategory(category)}
                        className={`whitespace-nowrap rounded-xl px-3.5 py-2 text-xs font-semibold transition-all ${
                          active
                            ? 'bg-slate-100 dark:bg-slate-800 text-white shadow-sm'
                            : 'bg-slate-100 dark:bg-slate-800/5 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:bg-slate-800/10 hover:text-slate-900 dark:text-slate-100'
                        }`}
                      >
                        {category === 'ALL' ? 'All Courses' : category}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Mobile filters */}
            {showFilters && (
              <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white p-4 shadow-sm dark:bg-slate-900 lg:hidden">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Course Categories
                  </span>

                  {selectedCategory !== 'ALL' && (
                    <button
                      type="button"
                      onClick={() => setSelectedCategory('ALL')}
                      className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      Reset
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  {categories.map((category) => {
                    const active = selectedCategory === category

                    return (
                      <button
                        key={category}
                        type="button"
                        onClick={() => setSelectedCategory(category)}
                        className={`rounded-xl px-3 py-2 text-xs font-semibold transition-all ${
                          active
                            ? 'bg-slate-100 dark:bg-slate-800 text-white'
                            : 'bg-slate-100 dark:bg-slate-800/5 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:bg-slate-800/10 hover:text-slate-900 dark:text-slate-100'
                        }`}
                      >
                        {category === 'ALL' ? 'All Courses' : category}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Result information */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-1">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {hasActiveFilters ? (
                  <>
                    Showing{' '}
                    <span className="font-bold text-slate-700 dark:text-slate-300">
                      {filteredCourses.length}
                    </span>{' '}
                    of{' '}
                    <span className="font-bold text-slate-700 dark:text-slate-300">
                      {courses.length}
                    </span>{' '}
                    courses
                  </>
                ) : (
                  <>
                    Showing all{' '}
                    <span className="font-bold text-slate-700 dark:text-slate-300">
                      {courses.length}
                    </span>{' '}
                    courses
                  </>
                )}
              </div>

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  <X className="h-3.5 w-3.5" />
                  Clear filters
                </button>
              )}
            </div>
          </section>
        )}

        {/* =========================================================
            LOADING STATE
        ========================================================= */}
        {isLoading && (
          <div
            className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3"
            aria-label="Loading courses"
          >
            {[1, 2, 3, 4, 5, 6].map((item) => (
              <div
                key={item}
                className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-white p-5 shadow-sm dark:bg-slate-900"
              >
                <div className="animate-pulse space-y-5">
                  <div className="flex items-center justify-between">
                    <div className="h-6 w-20 rounded-lg bg-slate-100 dark:bg-slate-800/10" />
                    <div className="h-6 w-16 rounded-full bg-slate-100 dark:bg-slate-800/5" />
                  </div>

                  <div className="space-y-2">
                    <div className="h-5 w-3/4 rounded-lg bg-slate-100 dark:bg-slate-800/10" />
                    <div className="h-3 w-full rounded bg-slate-100 dark:bg-slate-800/5" />
                    <div className="h-3 w-5/6 rounded bg-slate-100 dark:bg-slate-800/5" />
                  </div>

                  <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
                    <div className="h-3 w-32 rounded bg-slate-100 dark:bg-slate-800/5" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* =========================================================
            ERROR STATE
        ========================================================= */}
        {!isLoading && error && (
          <div className="mx-auto max-w-lg">
            <div className="rounded-3xl border border-red-500/15 bg-red-500/[0.035] p-8 text-center shadow-sm">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10 text-red-500">
                <BookOpen className="h-6 w-6" />
              </div>

              <h2 className="mt-5 font-bold text-xl font-bold text-slate-900 dark:text-slate-100">
                Unable to load courses
              </h2>

              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-600 dark:text-slate-400">
                {error}
              </p>

              <button
                type="button"
                onClick={() => fetchCourses()}
                className="mt-6 inline-flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 px-5 py-2.5 text-xs font-bold text-white transition-all hover:-translate-y-0.5 hover:bg-slate-100 dark:bg-slate-800/90 hover:shadow-lg"
              >
                Try Again
              </button>
            </div>
          </div>
        )}

        {/* =========================================================
            EMPTY CURRICULUM
        ========================================================= */}
        {!isLoading && !error && courses.length === 0 && (
          <div className="mx-auto max-w-lg">
            <div className="rounded-3xl border border-slate-200 dark:border-slate-700 bg-white p-10 text-center shadow-sm dark:bg-slate-900 sm:p-12">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-600 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                <BookOpen className="h-7 w-7" />
              </div>

              <h2 className="mt-6 font-bold text-xl font-bold text-slate-900 dark:text-slate-100">
                No courses available yet
              </h2>

              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-600 dark:text-slate-400">
                The curriculum has not been configured yet. Once courses are
                added, they will appear here for your exam preparation.
              </p>

              <Link
                to="/dashboard"
                className="mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-100 dark:bg-slate-800 px-5 py-2.5 text-xs font-bold text-white transition-all hover:-translate-y-0.5 hover:bg-slate-100 dark:bg-slate-800/90"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Return to Dashboard
              </Link>
            </div>
          </div>
        )}

        {/* =========================================================
            NO SEARCH RESULTS
        ========================================================= */}
        {!isLoading &&
          !error &&
          courses.length > 0 &&
          filteredCourses.length === 0 && (
            <div className="mx-auto max-w-lg">
              <div className="rounded-3xl border border-slate-200 dark:border-slate-700 bg-white p-10 text-center shadow-sm dark:bg-slate-900">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800/5 text-slate-500 dark:text-slate-400">
                  <Search className="h-6 w-6" />
                </div>

                <h2 className="mt-5 font-bold text-lg font-bold text-slate-900 dark:text-slate-100">
                  No matching courses
                </h2>

                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
                  We couldn't find any courses matching{' '}
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    "{searchQuery || selectedCategory}"
                  </span>
                  .
                </p>

                <button
                  type="button"
                  onClick={clearFilters}
                  className="mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-100 dark:bg-slate-800 px-5 py-2.5 text-xs font-bold text-white transition-all hover:-translate-y-0.5 hover:bg-slate-100 dark:bg-slate-800/90"
                >
                  <X className="h-3.5 w-3.5" />
                  Clear Filters
                </button>
              </div>
            </div>
          )}

        {/* =========================================================
            GROUPED COURSE LIST
        ========================================================= */}
        {!isLoading &&
          !error &&
          filteredCourses.length > 0 && (
            <div className="space-y-10">
              {Object.entries(groupedCourses).map(
                ([category, categoryCourses]) => (
                  <section key={category} className="space-y-4">

                    {/* Category heading */}
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                        <BookOpen className="h-4 w-4" />
                      </div>

                      <div className="min-w-0">
                        <h2 className="font-bold text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100">
                          {category}
                        </h2>
                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                          {categoryCourses.length}{' '}
                          {categoryCourses.length === 1
                            ? 'course'
                            : 'courses'}
                        </p>
                      </div>

                      <div className="h-px flex-1 bg-slate-100 dark:bg-slate-800/10" />
                    </div>

                    {/* Course cards */}
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                      {categoryCourses.map((course) => (
                        <Link
                          key={course.id}
                          to={`/courses/${course.id}`}
                          className="group relative flex min-h-[245px] flex-col overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-indigo-300 dark:border-indigo-700 hover:shadow-xl hover:shadow-indigo-500/10 dark:bg-slate-900"
                        >
                          {/* Accent line */}
                          <div className="absolute left-0 right-0 top-0 h-0.5 origin-left scale-x-0 bg-indigo-600 dark:bg-indigo-500 transition-transform duration-300 group-hover:scale-x-100" />

                          <div className="flex flex-1 flex-col">

                            {/* Card top */}
                            <div className="flex items-start justify-between gap-3">
                              {course.code ? (
                                <span className="inline-flex items-center rounded-lg bg-slate-100 dark:bg-slate-800/5 px-2.5 py-1 font-mono text-[11px] font-bold text-slate-600 dark:text-slate-400 transition-colors group-hover:bg-indigo-600 dark:bg-indigo-500/10 group-hover:text-indigo-600 dark:text-indigo-400">
                                  {course.code}
                                </span>
                              ) : (
                                <span className="inline-flex items-center rounded-lg bg-slate-100 dark:bg-slate-800/5 px-2.5 py-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                                  COURSE
                                </span>
                              )}

                              {course.ects_credits ? (
                                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-slate-100 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/[0.025] px-2.5 py-1 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                                  <span className="h-1.5 w-1.5 rounded-full bg-indigo-600 dark:bg-indigo-500/60" />
                                  {course.ects_credits} ECTS
                                </span>
                              ) : null}
                            </div>

                            {/* Course title */}
                            <div className="mt-5">
                              <h3 className="font-bold text-lg font-bold leading-snug text-slate-900 dark:text-slate-100 transition-colors group-hover:text-indigo-600 dark:text-indigo-400">
                                {course.name}
                              </h3>

                              {course.description ? (
                                <p className="mt-2.5 line-clamp-3 text-sm leading-6 text-slate-600 dark:text-slate-400">
                                  {course.description}
                                </p>
                              ) : (
                                <p className="mt-2.5 text-xs italic text-slate-400 dark:text-slate-500">
                                  Explore course modules and practice
                                  materials.
                                </p>
                              )}
                            </div>

                            {/* Features */}
                            <div className="mt-auto pt-5">
                              <div className="mb-4 flex flex-wrap gap-2">
                                <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/[0.035] px-2.5 py-1.5 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                                  <CheckCircle2 className="h-3 w-3 text-indigo-600 dark:text-indigo-400/70" />
                                  Study Notes
                                </span>

                                <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/[0.035] px-2.5 py-1.5 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                                  <CheckCircle2 className="h-3 w-3 text-indigo-600 dark:text-indigo-400/70" />
                                  Practice Quiz
                                </span>
                              </div>

                              {/* Bottom action */}
                              <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-4">
                                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 transition-colors group-hover:text-indigo-600 dark:text-indigo-400">
                                  Explore Course
                                </span>

                                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800/5 text-slate-500 dark:text-slate-400 transition-all duration-300 group-hover:bg-indigo-600 dark:bg-indigo-500 group-hover:text-white">
                                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                                </span>
                              </div>
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </section>
                )
              )}
            </div>
          )}

        {/* =========================================================
            BOTTOM TIP
        ========================================================= */}
        {!isLoading && !error && courses.length > 0 && (
          <div className="rounded-2xl border border-indigo-100 dark:border-indigo-800 bg-indigo-600 dark:bg-indigo-500/[0.035] px-5 py-4 sm:px-6">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                <BookOpen className="h-4 w-4" />
              </div>

              <div>
                <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  Study smarter for your exit exam
                </p>

                <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-400">
                  Open a course to review structured study notes and test your
                  understanding with course-specific practice quizzes.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
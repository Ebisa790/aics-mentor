import { useState, useEffect } from 'react'
import { 

const API_BASE_URL = import.meta.env.VITE_API_URL || ''
  Users, 
  DollarSign, 
  BookOpen, 
  Database, 
  TrendingUp, 
  TrendingDown,
  AlertTriangle,
      FileText,
  Layers,
    Activity,
  Crown
} from 'lucide-react'


interface AnalyticsData {
  user_stats: {
    total_users: number
    active_users_week: number
    premium_users: number
    free_users: number
    new_users_week: number
    conversion_rate: number
  }
  content_stats: {
    total_courses: number
    total_questions: number
    total_materials: number
    total_notes: number
    approved_notes: number
    draft_notes: number
    rejected_notes: number
    total_flashcards: number
    approved_flashcards: number
  }
  engagement_stats: {
    total_quiz_attempts: number
    total_drill_attempts: number
    total_attempts: number
  }
  revenue_stats: {
    total_payments: number
    total_revenue: number
    revenue_month: number
    revenue_week: number
  }
  alerts: {
    low_coverage_courses: Array<{ course_name: string; coverage: number }>
    pending_review_count: number
    draft_notes_count: number
  }
  popular_courses: Array<{ name: string; code: string; question_count: number }>
}

export function AdminAnalytics() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchAnalytics()
  }, [])

  const fetchAnalytics = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('access_token')
      const response = await fetch('/api/admin/analytics', {
        headers: { 'Authorization': 'Bearer ' + token }
      })
      if (!response.ok) throw new Error('Failed to load analytics')
      const result = await response.json()
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-12 h-12 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin"></div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="text-center py-20">
        <AlertTriangle className="w-12 h-12 mx-auto text-red-500 mb-3" />
        <p className="text-red-600">{error || 'Failed to load'}</p>
        <button onClick={fetchAnalytics} className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-xl">Retry</button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* User Stats */}
      <section>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <Users className="w-5 h-5 text-indigo-600" /> User Statistics
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Total Users</p>
              <Users className="w-4 h-4 text-indigo-500" />
            </div>
            <p className="text-3xl font-bold text-slate-900 dark:text-white mt-2">{data.user_stats.total_users}</p>
            <p className="text-xs text-emerald-600 mt-1">+{data.user_stats.new_users_week} this week</p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Premium Users</p>
              <Crown className="w-4 h-4 text-amber-500" />
            </div>
            <p className="text-3xl font-bold text-slate-900 dark:text-white mt-2">{data.user_stats.premium_users}</p>
            <p className="text-xs text-slate-500 mt-1">{data.user_stats.conversion_rate}% conversion</p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Active This Week</p>
              <Activity className="w-4 h-4 text-emerald-500" />
            </div>
            <p className="text-3xl font-bold text-slate-900 dark:text-white mt-2">{data.user_stats.active_users_week}</p>
            <p className="text-xs text-slate-500 mt-1">Active in last 7 days</p>
          </div>
          <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-5 text-white">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-emerald-100 uppercase">Lifetime Revenue</p>
              <DollarSign className="w-4 h-4 text-white" />
            </div>
            <p className="text-3xl font-bold mt-2">{data.revenue_stats.total_revenue.toFixed(0)} ETB</p>
            <p className="text-xs text-emerald-100 mt-1">{data.revenue_stats.total_payments} lifetime payments</p>
          </div>
        </div>
      </section>

      {/* Content Stats */}
      <section>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <Database className="w-5 h-5 text-indigo-600" /> Content Overview
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 text-center">
            <BookOpen className="w-5 h-5 mx-auto text-indigo-500 mb-2" />
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{data.content_stats.total_courses}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Courses</p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 text-center">
            <Database className="w-5 h-5 mx-auto text-emerald-500 mb-2" />
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{data.content_stats.total_questions}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Questions</p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 text-center">
            <FileText className="w-5 h-5 mx-auto text-blue-500 mb-2" />
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{data.content_stats.total_notes}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Notes</p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 text-center">
            <Layers className="w-5 h-5 mx-auto text-purple-500 mb-2" />
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{data.content_stats.total_flashcards}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Flashcards</p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 text-center">
            <Activity className="w-5 h-5 mx-auto text-amber-500 mb-2" />
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{data.engagement_stats.total_attempts}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Attempts</p>
          </div>
        </div>
      </section>

      {/* Alerts */}
      {data.alerts.low_coverage_courses.length > 0 && (
        <section>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" /> Content Alerts
          </h2>
          <div className="space-y-2">
            {data.alerts.low_coverage_courses.map((course, idx) => (
              <div key={idx} className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">{course.course_name}</p>
                  <p className="text-xs text-amber-600 dark:text-amber-400">Coverage: {course.coverage}% (below 70%)</p>
                </div>
                <TrendingDown className="w-5 h-5 text-amber-500" />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Popular Courses */}
      <section>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-emerald-500" /> Most Popular Courses
        </h2>
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          {data.popular_courses.map((course, idx) => (
            <div key={idx} className="flex items-center justify-between px-5 py-3 border-b border-slate-100 dark:border-slate-800 last:border-b-0">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 bg-indigo-100 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-400 rounded-full flex items-center justify-center text-sm font-bold">
                  {idx + 1}
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{course.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{course.code}</p>
                </div>
              </div>
              <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{course.question_count} Qs</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

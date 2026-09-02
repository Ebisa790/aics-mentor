import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, AlertTriangle, CheckCircle2, Download, Upload, Database } from 'lucide-react'

const API_BASE_URL = import.meta.env.VITE_API_URL || ''

interface CourseCoverage {
  id: string
  name: string
  code: string
  question_count: number
  target: number
  gap: number
  status: string
}

interface CoverageData {
  total_questions: number
  courses: CourseCoverage[]
  difficulty: {
    easy: { count: number; target: number; gap: number; percentage: number }
    medium: { count: number; target: number; gap: number; percentage: number }
    hard: { count: number; target: number; gap: number; percentage: number }
  }
  critical_courses: CourseCoverage[]
  warning_courses: CourseCoverage[]
}

export function AdminQuestionCoverage() {
  const navigate = useNavigate()
  const [data, setData] = useState<CoverageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showExportModal, setShowExportModal] = useState(false)
  const [showPasteModal, setShowPasteModal] = useState(false)
  const [exportPrompt, setExportPrompt] = useState('')
  const [exportCourseId, setExportCourseId] = useState('')
  const [exportDifficulty, setExportDifficulty] = useState('easy')
  const [exportCount, setExportCount] = useState(20)
  const [pastedQuestions, setPastedQuestions] = useState('')
  const [pasteCourseId, setPasteCourseId] = useState('')
  const [pasting, setPasting] = useState(false)
  const [courses, setCourses] = useState<Array<{id: string, name: string}>>([])

  useEffect(() => {
    fetchCoverage()
    fetchCourses()
  }, [])

  const fetchCourses = async () => {
    const token = localStorage.getItem('access_token')
    fetch('/api/courses', { headers: { 'Authorization': 'Bearer ' + token } })
      .then(r => r.json())
      .then(d => setCourses(d))
      .catch(() => {})
  }

  const fetchCoverage = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('access_token')
      const response = await fetch('/api/admin/questions/coverage', {
        headers: { 'Authorization': 'Bearer ' + token }
      })
      if (!response.ok) throw new Error('Failed to load coverage')
      const result = await response.json()
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setLoading(false)
    }
  }

  const handleExportPrompt = async () => {
    try {
      const token = localStorage.getItem('access_token')
      const response = await fetch('/api/admin/questions/export-prompt', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          course_id: exportCourseId,
          difficulty: exportDifficulty,
          count: exportCount
        })
      })
      if (!response.ok) throw new Error('Failed to export')
      const result = await response.json()
      setExportPrompt(result.prompt)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    }
  }

  const handlePasteQuestions = async () => {
    try {
      setPasting(true)
      const questionsData = JSON.parse(pastedQuestions)
      const questionsArray = Array.isArray(questionsData) ? questionsData : [questionsData]
      
      const token = localStorage.getItem('access_token')
      const response = await fetch('/api/admin/questions/bulk-import', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          course_id: pasteCourseId,
          questions: questionsArray
        })
      })
      
      if (!response.ok) throw new Error('Failed to import')
      setShowPasteModal(false)
      setPastedQuestions('')
      fetchCoverage()
    } catch (err) {
      setError('Invalid JSON or failed to import')
    } finally {
      setPasting(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'CRITICAL': return 'bg-red-100 text-red-700 border-red-200'
      case 'WARNING': return 'bg-amber-100 text-amber-700 border-amber-200'
      case 'NEAR_TARGET': return 'bg-indigo-100 text-indigo-700 border-indigo-200'
      case 'GOOD': return 'bg-emerald-100 text-emerald-700 border-emerald-200'
      default: return 'bg-slate-100 text-slate-600'
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'CRITICAL': return ' CRITICAL'
      case 'WARNING': return '️ WARNING'
      case 'NEAR_TARGET': return ' NEAR TARGET'
      case 'GOOD': return ' GOOD'
      default: return status
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
        <p className="text-red-600">{error}</p>
        <button onClick={fetchCoverage} className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-xl">Retry</button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-8 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/admin')} className="p-2 rounded-xl bg-white dark:bg-slate-900 border">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Question Coverage Report</h1>
              <p className="text-sm text-slate-500">Analyze question bank distribution and identify gaps</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPasteModal(true)}
              className="px-4 py-2 bg-purple-600 text-white text-sm font-semibold rounded-xl hover:bg-purple-500 flex items-center gap-2"
            >
              <Upload className="w-4 h-4" /> Paste Questions
            </button>
            <button
              onClick={() => setShowExportModal(true)}
              className="px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-500 flex items-center gap-2"
            >
              <Download className="w-4 h-4" /> Export Prompt
            </button>
            <button
              onClick={fetchCoverage}
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-500"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Total Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 text-center">
            <Database className="w-6 h-6 mx-auto text-indigo-500 mb-2" />
            <p className="text-3xl font-bold text-slate-900 dark:text-white">{data.total_questions}</p>
            <p className="text-xs text-slate-500">Total Questions</p>
          </div>
          <div className="bg-red-50 dark:bg-red-950/30 rounded-2xl border border-red-200 dark:border-red-800 p-5 text-center">
            <AlertTriangle className="w-6 h-6 mx-auto text-red-500 mb-2" />
            <p className="text-3xl font-bold text-red-700 dark:text-red-300">{data.critical_courses.length}</p>
            <p className="text-xs text-red-600 dark:text-red-400">Critical Courses</p>
          </div>
          <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-2xl border border-emerald-200 dark:border-emerald-800 p-5 text-center">
            <CheckCircle2 className="w-6 h-6 mx-auto text-emerald-500 mb-2" />
            <p className="text-3xl font-bold text-emerald-700 dark:text-emerald-300">
              {data.courses.filter(c => c.status === 'GOOD').length}
            </p>
            <p className="text-xs text-emerald-600 dark:text-emerald-400">Good Courses</p>
          </div>
        </div>

        {/* Difficulty Distribution */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 mb-6">
          <h2 className="font-bold text-slate-900 dark:text-white mb-4">Difficulty Distribution</h2>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span> Easy</span>
                <span>{data.difficulty.easy.count} / {data.difficulty.easy.target} ({data.difficulty.easy.percentage}%)</span>
              </div>
              <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(100, data.difficulty.easy.percentage)}%` }} />
              </div>
              {data.difficulty.easy.gap > 0 && (
                <p className="text-xs text-red-500 mt-1">Need {data.difficulty.easy.gap} more Easy questions</p>
              )}
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span> Medium</span>
                <span>{data.difficulty.medium.count} / {data.difficulty.medium.target} ({data.difficulty.medium.percentage}%)</span>
              </div>
              <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-amber-500 rounded-full" style={{ width: `${Math.min(100, data.difficulty.medium.percentage)}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span> Hard</span>
                <span>{data.difficulty.hard.count} / {data.difficulty.hard.target} ({data.difficulty.hard.percentage}%)</span>
              </div>
              <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-red-500 rounded-full" style={{ width: `${Math.min(100, data.difficulty.hard.percentage)}%` }} />
              </div>
              {data.difficulty.hard.gap > 0 && (
                <p className="text-xs text-red-500 mt-1">Need {data.difficulty.hard.gap} more Hard questions</p>
              )}
            </div>
          </div>
        </div>

        {/* Course Breakdown */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
            <h2 className="font-bold text-slate-900 dark:text-white">Course Coverage</h2>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {data.courses.map((course, idx) => (
              <div key={idx} className="px-5 py-4 flex items-center justify-between gap-4">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    {course.name}
                    {course.code && <span className="text-xs text-slate-400 ml-1">({course.code})</span>}
                  </p>
                  <div className="mt-2 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${
                        course.status === 'CRITICAL' ? 'bg-red-500' :
                        course.status === 'WARNING' ? 'bg-amber-500' :
                        course.status === 'NEAR_TARGET' ? 'bg-indigo-500' :
                        'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(100, (course.question_count / course.target) * 100)}%` }}
                    />
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-slate-900 dark:text-white">{course.question_count}</p>
                  <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${getStatusColor(course.status)}`}>
                    {getStatusBadge(course.status)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full max-h-[80vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h3 className="text-lg font-bold">Export Question Prompt</h3>
              <button onClick={() => setShowExportModal(false)} className="p-1 rounded-lg hover:bg-slate-100"></button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 space-y-3">
              {!exportPrompt ? (
                <>
                  <select value={exportCourseId} onChange={(e) => setExportCourseId(e.target.value)} className="w-full px-3 py-2 rounded-xl border text-sm">
                    <option value="">Select Course</option>
                    {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <select value={exportDifficulty} onChange={(e) => setExportDifficulty(e.target.value)} className="w-full px-3 py-2 rounded-xl border text-sm">
                    <option value="easy"> Easy</option>
                    <option value="medium"> Medium</option>
                    <option value="hard"> Hard</option>
                  </select>
                  <input type="number" value={exportCount} onChange={(e) => setExportCount(Number(e.target.value))} min={5} max={100} className="w-full px-3 py-2 rounded-xl border text-sm" />
                  <button onClick={handleExportPrompt} className="w-full py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-500">
                    Generate Prompt
                  </button>
                </>
              ) : (
                <>
                  <textarea value={exportPrompt} readOnly className="w-full h-80 p-3 rounded-xl bg-slate-50 border text-sm font-mono" onClick={(e) => (e.target as HTMLTextAreaElement).select()} />
                  <button onClick={() => { navigator.clipboard.writeText(exportPrompt) }} className="w-full py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-500">
                    Copy Prompt
                  </button>
                  <button onClick={() => setExportPrompt('')} className="w-full py-2 bg-slate-100 text-slate-700 text-sm font-semibold rounded-xl hover:bg-slate-200">
                    Back
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Paste Modal */}
      {showPasteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full max-h-[80vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h3 className="text-lg font-bold">Paste Questions</h3>
              <button onClick={() => setShowPasteModal(false)} className="p-1 rounded-lg hover:bg-slate-100"></button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 space-y-3">
              <select value={pasteCourseId} onChange={(e) => setPasteCourseId(e.target.value)} className="w-full px-3 py-2 rounded-xl border text-sm">
                <option value="">Select Course</option>
                {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <textarea value={pastedQuestions} onChange={(e) => setPastedQuestions(e.target.value)} placeholder='[{"question_text":"...","option_a":"...","option_b":"...","option_c":"...","option_d":"...","correct_option":"A","explanation":"...","difficulty":"easy"}]' className="w-full h-80 p-3 rounded-xl bg-slate-50 border text-sm font-mono" />
            </div>
            <div className="px-6 py-4 border-t flex justify-end gap-2">
              <button onClick={() => setShowPasteModal(false)} className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100">Cancel</button>
              <button onClick={handlePasteQuestions} disabled={pasting || !pasteCourseId || !pastedQuestions} className="px-4 py-2 rounded-xl bg-purple-600 text-white text-sm font-semibold hover:bg-purple-500 disabled:opacity-50">
                {pasting ? 'Importing...' : 'Import Questions'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
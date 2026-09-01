import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { apiClient } from '../api/client'
import { announcementApi, courseApi, departmentApi, adminApi } from '../api'
import type { Announcement, AnnouncementType, Course, Department } from '../api/types'
import { GlobalReviewQueue } from '../components/GlobalReviewQueue'
import { CourseMaterialUpload } from '../components/CourseMaterialUpload'
import { 
  Users, 
  DollarSign, 
  BookOpen, 
  Plus,
  Upload,
  Sparkles,
  FileText,
  Megaphone,
    TrendingUp,
  GraduationCap,
  Database,
  AlertCircle
} from 'lucide-react'

const ANNOUNCEMENT_TYPES: { value: AnnouncementType; label: string }[] = [
  { value: 'platform_news', label: 'Platform News' },
  { value: 'exam_notice', label: 'Exam Notice' },
  { value: 'moe_update', label: 'MoE Update' },
]

export function AdminPage() {
  const navigate = useNavigate()
  const [departments, setDepartments] = useState<Department[]>([])
  const [courses, setCourses] = useState<(Course & { question_count?: number })[]>([])
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [totalQuestions, setTotalQuestions] = useState(0)
  const [totalCourses, setTotalCourses] = useState(0)
  const [reviewRefreshKey, setReviewRefreshKey] = useState<number>(0)
  const [revenueStats, setRevenueStats] = useState<any>(null)

  const [selectedBreakdownCourseId, setSelectedBreakdownCourseId] = useState<string>('')

  const [deptName, setDeptName] = useState('')
  const [deptShortName, setDeptShortName] = useState('')

  const [departmentId, setDepartmentId] = useState<string>('')
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [category, setCategory] = useState('')
  const [ectsCredits, setEctsCredits] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<string | null>(null)

  const [announcementTitle, setAnnouncementTitle] = useState('')
  const [announcementContent, setAnnouncementContent] = useState('')
  const [announcementType, setAnnouncementType] = useState<AnnouncementType>('platform_news')
  const [announcementPinned, setAnnouncementPinned] = useState(false)

  const [notesCourseId, setNotesCourseId] = useState<string>('')
  const [notesFile, setNotesFile] = useState<File | null>(null)
  const [notesLoading, setNotesLoading] = useState(false)
  const [notesStatus, setNotesStatus] = useState<string | null>(null)
  const [notesError, setNotesError] = useState<string | null>(null)

  const [hybridCourseId, setHybridCourseId] = useState<string>('')
  const [hybridFile, setHybridFile] = useState<File | null>(null)
  const [hybridTargetCount, setHybridTargetCount] = useState(20)
  const [hybridLoading, setHybridLoading] = useState(false)
  const [hybridResult, setHybridResult] = useState<any>(null)
  const [hybridError, setHybridError] = useState('')

  const [masterFile, setMasterFile] = useState<File | null>(null)
  const [masterTargetCount, setMasterTargetCount] = useState(100)
  const [masterLoading, setMasterLoading] = useState(false)
  const [masterResult, setMasterResult] = useState<any>(null)
  const [masterError, setMasterError] = useState('')

  const [masterTaskId, setMasterTaskId] = useState<string | null>(null)
  const [masterTaskData, setMasterTaskData] = useState<any>(null)

  const load = async () => {
    try {
      const [deptRes, courseRes, announcementRes, statsRes, revenueRes] = await Promise.all([
        departmentApi.list().catch(() => []),
        courseApi.list().catch(() => []),
        announcementApi.list().catch(() => []),
        apiClient.get<any>('/api/admin/stats').catch(() => ({ data: {} })),
        adminApi.getRevenueStats().catch(() => null),
      ])

      const statsBody = statsRes?.data || statsRes || {}

      setDepartments(deptRes)
      setAnnouncements(announcementRes)
      setTotalQuestions(statsBody.total_questions || 0)
      setTotalCourses(statsBody.total_courses || courseRes.length || 0)
      setRevenueStats(revenueRes)

      const questionCountMap = new Map<string, number>()
      const statsCourses = statsBody.courses || []

      if (Array.isArray(statsCourses)) {
        statsCourses.forEach((item: any) => {
          const courseId = item.course_id || item.id
          const count = item.question_count || 0
          if (courseId) {
            questionCountMap.set(String(courseId).toLowerCase(), count)
          }
        })
      }

      const enrichedCourses = courseRes.map((c: any) => {
        const courseId = String(c.id || c.course_id || '').toLowerCase()
        return {
          ...c,
          question_count: questionCountMap.get(courseId) ?? c.question_count ?? 0,
        }
      })

      setCourses(enrichedCourses)

      if (enrichedCourses.length > 0 && !selectedBreakdownCourseId) {
        setSelectedBreakdownCourseId(String(enrichedCourses[0].id))
      }

      if (!departmentId && deptRes.length > 0) setDepartmentId(String(deptRes[0].id))
    } catch (err) {
      console.error('Error loading admin dashboard data:', err)
    }
  }

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    let interval: any = null
    if (masterTaskId && masterTaskData?.status !== 'SUCCESS' && masterTaskData?.status !== 'FAILURE') {
      interval = setInterval(async () => {
        try {
          const res = await apiClient.get<any>(`/api/admin/tasks/${masterTaskId}`)
          setMasterTaskData(res.data)

          if (res.data.status === 'SUCCESS') {
            setMasterResult(res.data.result)
            setMasterLoading(false)
            clearInterval(interval)
            load()
            setReviewRefreshKey((prev) => prev + 1)
          } else if (res.data.status === 'FAILURE') {
            setMasterError(res.data.result?.error || 'Background task failed.')
            setMasterLoading(false)
            clearInterval(interval)
          }
        } catch (err) {
          console.error('Error polling task status', err)
        }
      }, 2000)
    }
    return () => clearInterval(interval)
  }, [masterTaskId, masterTaskData])

  const handleCreateDepartment = async (e: FormEvent) => {
    e.preventDefault()
    setStatus(null)
    await apiClient.post('/api/departments', { name: deptName, short_name: deptShortName || null })
    setDeptName('')
    setDeptShortName('')
    setStatus('Department created.')
    await load()
  }

  const handleCreateCourse = async (e: FormEvent) => {
    e.preventDefault()
    if (!departmentId) return
    setStatus(null)
    await apiClient.post('/api/courses', {
      department_id: departmentId,
      name,
      code: code || null,
      category,
      description: description || null,
      ects_credits: ectsCredits ? Number(ectsCredits) : null,
    })
    setName('')
    setCode('')
    setCategory('')
    setEctsCredits('')
    setDescription('')
    setStatus('Course created.')
    await load()
  }

  const handleCreateAnnouncement = async (e: FormEvent) => {
    e.preventDefault()
    setStatus(null)
    await announcementApi.create({
      title: announcementTitle,
      content: announcementContent,
      announcement_type: announcementType,
      is_pinned: announcementPinned,
    })
    setAnnouncementTitle('')
    setAnnouncementContent('')
    setAnnouncementType('platform_news')
    setAnnouncementPinned(false)
    setStatus('Announcement published.')
    await load()
  }

  const handleDeleteAnnouncement = async (id: string) => {
    await announcementApi.delete(id)
    await load()
  }

  const handleNotesMaterialUpload = async (e: FormEvent) => {
    e.preventDefault()
    if (!notesCourseId || !notesFile) {
      setNotesError('Please select a course and upload a document.')
      return
    }

    const formData = new FormData()
    formData.append('file', notesFile)
    formData.append('title', notesFile.name.replace(/\.[^.]+$/, ''))  // Use filename as title
    formData.append('material_type', 'note')

    setNotesLoading(true)
    setNotesError(null)
    setNotesStatus(null)

    try {
      const response = await apiClient.post<any>(
        `/api/admin/courses/${notesCourseId}/materials`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      )

      setNotesStatus(response.data.message || 'Course material uploaded!')
      setNotesFile(null)
      const fileInput = document.getElementById('notes-material-file') as HTMLInputElement
      if (fileInput) fileInput.value = ''
      await load()
    } catch (err: any) {
      setNotesError(err.response?.data?.detail || 'Failed to upload course material.')
    } finally {
      setNotesLoading(false)
    }
  }

  const handleSpecificHybridGenerate = async (e: FormEvent) => {
    e.preventDefault()
    if (!hybridCourseId || !hybridFile) {
      setHybridError('Please select a course and upload a file.')
      return
    }

    const formData = new FormData()
    formData.append('file', hybridFile)

    setHybridLoading(true)
    setHybridError('')
    setHybridResult(null)

    try {
      const response = await apiClient.post<any>(
        `/api/admin/courses/${hybridCourseId}/materials/hybrid-generate?target_count=${hybridTargetCount}`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 60000 }
      )

      setHybridResult(response.data)
      await load()
      setReviewRefreshKey((prev) => prev + 1)
    } catch (err: any) {
      if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        setHybridError('Generation is taking longer than expected. Check back shortly!')
      } else {
        setHybridError(err.response?.data?.detail || 'Failed to process material generation.')
      }
    } finally {
      setHybridLoading(false)
    }
  }

  const handleMasterHybridGenerate = async (e: FormEvent) => {
    e.preventDefault()
    if (!masterFile) {
      setMasterError('Please upload a master study material file.')
      return
    }

    const formData = new FormData()
    formData.append('file', masterFile)

    setMasterLoading(true)
    setMasterError('')
    setMasterResult(null)
    setMasterTaskId(null)
    setMasterTaskData(null)

    try {
      const response = await apiClient.post<any>(
        `/api/admin/materials/master-hybrid-generate?target_count=${masterTargetCount}`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      )

      if (response.data.task_id) {
        setMasterTaskId(response.data.task_id)
        setMasterTaskData({ status: 'PENDING', meta: { step: 'Task queued...' } })
      } else {
        setMasterResult(response.data)
        setMasterLoading(false)
        await load()
        setReviewRefreshKey((prev) => prev + 1)
      }
    } catch (err: any) {
      setMasterError(err.response?.data?.detail || 'Failed to process master material generation.')
      setMasterLoading(false)
    }
  }

  const selectedBreakdownCourse = courses.find((c) => String(c.id) === selectedBreakdownCourseId) || courses[0]

  const inputClass = "w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
          <div>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-400">
              Admin Console
            </span>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white mt-2">
              Platform Administration
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/admin/users" className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-slate-700 dark:text-slate-300">
              <Users className="w-4 h-4" /> Users
            </Link>
            <Link to="/admin/pricing" className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-slate-700 dark:text-slate-300">
              <DollarSign className="w-4 h-4" /> Pricing
            </Link>
          </div>
        </header>

        {status && (
          <div className="p-4 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-2xl text-emerald-700 dark:text-emerald-300 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4" /> {status}
          </div>
        )}

        {/* KPI Cards */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-100 dark:bg-indigo-950/50 rounded-xl">
                <BookOpen className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Total Courses</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{totalCourses}</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-100 dark:bg-emerald-950/50 rounded-xl">
                <Database className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Total Questions</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{totalQuestions}</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-100 dark:bg-amber-950/50 rounded-xl">
                <GraduationCap className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Departments</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{departments.length}</p>
              </div>
            </div>
          </div>
          {revenueStats && (
            <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-5 text-white">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white/20 rounded-xl">
                  <TrendingUp className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-emerald-100 uppercase">Total Revenue</p>
                  <p className="text-2xl font-bold">{revenueStats.total_revenue?.toFixed(0) || 0} ETB</p>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Course Question Breakdown */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
          <h2 className="font-bold text-slate-900 dark:text-white mb-4">Course Question Breakdown</h2>
          <select
            value={selectedBreakdownCourseId}
            onChange={(e) => setSelectedBreakdownCourseId(e.target.value)}
            className={inputClass + " max-w-md"}
          >
            <option value="" disabled>Select a course...</option>
            {courses.map((c) => (
              <option key={c.id} value={String(c.id)}>
                {c.code ? `[${c.code}] ` : ''}{c.name} ({c.question_count ?? 0} Qs)
              </option>
            ))}
          </select>
          {selectedBreakdownCourse && (
            <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl flex items-center justify-between flex-wrap gap-3">
              <div>
                <p className="font-bold text-slate-900 dark:text-white">{selectedBreakdownCourse.name}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">{selectedBreakdownCourse.question_count ?? 0} questions</p>
              </div>
              <button 
                onClick={() => navigate(`/admin/courses/${selectedBreakdownCourse.id}`)}
                className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-500 transition-colors"
              >
                Manage Course
              </button>
            </div>
          )}
        </section>

        {/* Forms Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Create Department */}
          <form onSubmit={handleCreateDepartment} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-3">
            <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Plus className="w-4 h-4 text-indigo-600" /> New Department
            </h3>
            <input className={inputClass} placeholder="Department name" required value={deptName} onChange={(e) => setDeptName(e.target.value)} />
            <input className={inputClass} placeholder="Short name (e.g., CS)" value={deptShortName} onChange={(e) => setDeptShortName(e.target.value)} />
            <button type="submit" className="w-full py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-500 transition-colors">
              Create Department
            </button>
          </form>

          {/* Create Course */}
          <form onSubmit={handleCreateCourse} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-3">
            <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-indigo-600" /> New Course
            </h3>
            <select className={inputClass} required value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
              <option value="">Select department...</option>
              {departments.map((d) => <option key={d.id} value={String(d.id)}>{d.name}</option>)}
            </select>
            <input className={inputClass} placeholder="Course name" required value={name} onChange={(e) => setName(e.target.value)} />
            <div className="grid grid-cols-2 gap-3">
              <input className={inputClass} placeholder="Code" value={code} onChange={(e) => setCode(e.target.value)} />
              <input className={inputClass} type="number" placeholder="ECTS" value={ectsCredits} onChange={(e) => setEctsCredits(e.target.value)} />
            </div>
            <input className={inputClass} placeholder="Category" required value={category} onChange={(e) => setCategory(e.target.value)} />
            <textarea className={inputClass} rows={2} placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
            <button type="submit" className="w-full py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-500 transition-colors">
              Create Course
            </button>
          </form>
        </div>

        {/* AI Ingestion Forms */}
        <div className="space-y-6">
          <form onSubmit={handleNotesMaterialUpload} className="bg-white dark:bg-slate-900 rounded-2xl border border-emerald-200 dark:border-emerald-800 p-5 space-y-3">
            <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-600" /> AI Study Notes Material
            </h3>
            <select className={inputClass} required value={notesCourseId} onChange={(e) => setNotesCourseId(e.target.value)}>
              <option value="">Select course...</option>
              {courses.map((c) => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
            </select>
            <input id="notes-material-file" type="file" accept=".pdf,.txt,.md" required onChange={(e) => setNotesFile(e.target.files?.[0] || null)} className="w-full text-sm text-slate-600 dark:text-slate-400" />
            {notesError && <p className="text-red-600 text-xs">{notesError}</p>}
            {notesStatus && <p className="text-emerald-600 text-xs">{notesStatus}</p>}
            <button type="submit" disabled={notesLoading} className="w-full py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-500 transition-colors disabled:opacity-50">
              {notesLoading ? 'Uploading...' : 'Upload Notes Material'}
            </button>
          </form>

          <form onSubmit={handleSpecificHybridGenerate} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-3">
            <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-600" /> Specific Course AI Questions
            </h3>
            <select className={inputClass} required value={hybridCourseId} onChange={(e) => setHybridCourseId(e.target.value)}>
              <option value="">Select course...</option>
              {courses.map((c) => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
            </select>
            <div className="grid grid-cols-2 gap-3">
              <input type="file" accept=".pdf,.docx,.txt" required onChange={(e) => setHybridFile(e.target.files?.[0] || null)} className="w-full text-sm text-slate-600 dark:text-slate-400" />
              <input type="number" min={5} max={100} value={hybridTargetCount} onChange={(e) => setHybridTargetCount(parseInt(e.target.value) || 20)} className={inputClass} />
            </div>
            {hybridError && <p className="text-red-600 text-xs">{hybridError}</p>}
            {hybridResult && <p className="text-emerald-600 text-xs">{hybridResult.message}</p>}
            <button type="submit" disabled={hybridLoading} className="w-full py-2.5 bg-purple-600 text-white text-sm font-semibold rounded-xl hover:bg-purple-500 transition-colors disabled:opacity-50">
              {hybridLoading ? 'Generating...' : 'Run AI Generation'}
            </button>
          </form>

          <form onSubmit={handleMasterHybridGenerate} className="bg-white dark:bg-slate-900 rounded-2xl border border-indigo-200 dark:border-indigo-800 p-5 space-y-3">
            <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Upload className="w-4 h-4 text-indigo-600" /> Master Multi-Course AI
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <input type="file" accept=".pdf,.docx,.txt" required onChange={(e) => setMasterFile(e.target.files?.[0] || null)} className="w-full text-sm text-slate-600 dark:text-slate-400" />
              <input type="number" min={10} max={500} value={masterTargetCount} onChange={(e) => setMasterTargetCount(parseInt(e.target.value) || 100)} className={inputClass} />
            </div>
            {masterError && <p className="text-red-600 text-xs">{masterError}</p>}
            {masterResult && <p className="text-emerald-600 text-xs">{masterResult.message}</p>}
            <button type="submit" disabled={masterLoading} className="w-full py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-500 transition-colors disabled:opacity-50">
              {masterLoading ? 'Processing...' : 'Run Master Generation'}
            </button>
          </form>
        </div>

        {/* Announcements */}
        <form onSubmit={handleCreateAnnouncement} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-3">
          <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-amber-600" /> Broadcast Announcement
          </h3>
          <input className={inputClass} placeholder="Title" required value={announcementTitle} onChange={(e) => setAnnouncementTitle(e.target.value)} />
          <textarea className={inputClass} rows={3} placeholder="Content" required value={announcementContent} onChange={(e) => setAnnouncementContent(e.target.value)} />
          <div className="flex items-center gap-3">
            <select className={inputClass + " max-w-[200px]"} value={announcementType} onChange={(e) => setAnnouncementType(e.target.value as AnnouncementType)}>
              {ANNOUNCEMENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
              <input type="checkbox" checked={announcementPinned} onChange={(e) => setAnnouncementPinned(e.target.checked)} />
              Pin to top
            </label>
          </div>
          <button type="submit" className="w-full py-2.5 bg-amber-600 text-white text-sm font-semibold rounded-xl hover:bg-amber-500 transition-colors">
            Publish Announcement
          </button>
          {announcements.length > 0 && (
            <div className="space-y-2 mt-3">
              {announcements.map((a) => (
                <div key={a.id} className="flex items-center justify-between text-xs py-2 px-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <span className="text-slate-700 dark:text-slate-300">{a.is_pinned && ' '}{a.title}</span>
                  <button type="button" onClick={() => handleDeleteAnnouncement(a.id)} className="text-red-600 font-semibold">Delete</button>
                </div>
              ))}
            </div>
          )}
        </form>

        {/* Review Queue */}
        <GlobalReviewQueue key={reviewRefreshKey} />

        {/* Course Material Upload */}
        <CourseMaterialUpload 
          courses={courses.map((c) => ({ ...c, code: c.code ?? '' }))} 
          onSuccess={load} 
        />
      </div>
    </div>
  )
}
import { useEffect, useState, type FormEvent } from 'react'
import {  useParams, useNavigate } from 'react-router-dom'

import { adminApi, courseApi } from '../api'
import type {
  AIGenerateResponse,
  Course,
  CourseMaterial,
  ExamDifficulty,
  ExamQuestion,
  MaterialContentType,
  ReviewStatus,
} from '../api/types'
import { AIDraftModal } from '../components/AIDraftModal'
import {
  ArrowLeft,
  BookOpen,
  ClipboardCheck,
  Search,
  Plus,
  Trash2,
  CheckCircle2,
  Clock,
  XCircle,
  FileText,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Sparkles,     
} from 'lucide-react'

interface DuplicateGroup {
  count?: number
  questions: ExamQuestion[]
}

type Tab = 'notes' | 'questions'

const REVIEW_BADGE: Record<ReviewStatus, string> = {
  generated: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-400',
  under_review: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400',
  approved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400',
  archived: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
}

export function CourseContentManagerPage() {
  const { id: courseId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [course, setCourse] = useState<Course | null>(null)
  const [tab, setTab] = useState<Tab>('notes')

  useEffect(() => {
    let isMounted = true
    if (!courseId) return

    courseApi.get(courseId).then((res: any) => {
      if (!isMounted) return
      const courseData = res?.data !== undefined ? res.data : res
      setCourse(courseData)
    })

    return () => {
      isMounted = false
    }
  }, [courseId])

  if (!courseId) return null

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-4 sticky top-16 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/admin/courses')}
                className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                  {course?.name || 'Loading...'}
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {course?.code} • Manage study notes and practice questions
                </p>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
              <button
                onClick={() => setTab('notes')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                  tab === 'notes'
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <BookOpen className="w-4 h-4" />
                <span className="hidden sm:inline">Study Notes</span>
                <span className="sm:hidden">Notes</span>
              </button>
              <button
                onClick={() => setTab('questions')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                  tab === 'questions'
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <ClipboardCheck className="w-4 h-4" />
                <span className="hidden sm:inline">Practice Questions</span>
                <span className="sm:hidden">Questions</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto p-4 sm:p-6">
        {tab === 'notes' ? (
          <div>
            {/* Quick Link to Notes Review */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 text-center mb-6">
              <FileText className="w-16 h-16 mx-auto text-indigo-300 dark:text-indigo-600 mb-4" />
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Study Notes Management</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                Generate, review, edit, and approve exam-ready study notes for this course.
              </p>
              <button
                onClick={() => navigate(`/admin/courses/${courseId}/notes/review`)}
                className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-600/20"
              >
                <BookOpen className="w-4 h-4" />
                Open Notes Review
              </button>
            </div>
            <StudyNotesTab courseId={courseId} />
          </div>
        ) : (
          <PracticeQuestionsTab courseId={courseId} />
        )}
      </div>
    </div>
  )
}

// ============================== Study Notes ==============================

const EMPTY_NOTE_FORM = { title: '', content: '', material_type: 'note' as MaterialContentType, is_ai_generated: false }

function StudyNotesTab({ courseId }: { courseId: string }) {
  const [materials, setMaterials] = useState<CourseMaterial[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_NOTE_FORM)

  const [showAIModal, setShowAIModal] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    try {
      const res: any = await adminApi.listMaterials(courseId)
      const data = res?.data !== undefined ? res.data : res
      setMaterials(Array.isArray(data) ? data : [])
    } catch {
      setError('Failed to fetch course materials.')
    }
  }

  useEffect(() => {
    load()
  }, [courseId])

  const startEdit = (m: CourseMaterial) => {
    setEditingId(m.id)
    setForm({ title: m.title, content: m.content, material_type: m.material_type, is_ai_generated: m.is_ai_generated })
    
  }

  const startNew = () => {
    setEditingId('new')
    setForm(EMPTY_NOTE_FORM)
    
  }

  const cancelEdit = () => {
    setEditingId(null)
    setForm(EMPTY_NOTE_FORM)
  }

  const handleAIApply = (result: AIGenerateResponse) => {
    if (result.type !== 'note' || !result.note) return
    setForm({ title: result.note.title, content: result.note.content, material_type: form.material_type, is_ai_generated: true })
    setShowAIModal(false)
    if (editingId === null) setEditingId('new')
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    setError(null)
    try {
      if (editingId && editingId !== 'new') {
        await adminApi.updateMaterial(editingId, { title: form.title, content: form.content, material_type: form.material_type })
      } else {
        await adminApi.createMaterial(courseId, form)
      }
      cancelEdit()
      await load()
    } catch {
      setError('Could not save this note. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this note?')) return
    await adminApi.deleteMaterial(id)
    await load()
  }

  return (
    <div className="space-y-4">
      {editingId ? (
        <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-3">
          {error && <div className="text-sm text-red-600 bg-red-50 dark:bg-red-950/50 rounded-lg px-3 py-2">{error}</div>}
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-sm text-slate-900 dark:text-white">{editingId === 'new' ? 'New Note' : 'Edit Note'}</h2>
            <button type="button" onClick={() => setShowAIModal(true)} className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline">
              ✨ Generate with AI
            </button>
          </div>
          <input
            className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Title"
            required
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          />
          <textarea
            className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-800 dark:text-slate-200 font-mono min-h-[200px] focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Content (Markdown)"
            required
            value={form.content}
            onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
          />
          <div className="flex gap-2">
            <button type="submit" disabled={isSaving} className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-500 disabled:opacity-50">
              {isSaving ? 'Saving...' : 'Save'}
            </button>
            <button type="button" onClick={cancelEdit} className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700">
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button type="button" onClick={startNew} className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-500">
          + New Note
        </button>
      )}

      <div className="space-y-2">
        {materials.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 text-sm text-slate-500 dark:text-slate-400 text-center">
            No notes yet. Click "+ New Note" to add one.
          </div>
        ) : (
          materials.map((m) => (
            <div key={m.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 flex items-center justify-between hover:shadow-md transition-shadow">
              <div>
                <div className="font-medium text-sm text-slate-900 dark:text-white">
                  {m.title} {m.is_ai_generated && <span className="text-xs text-indigo-600 dark:text-indigo-400 ml-1">✨ AI</span>}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{m.material_type.replace('_', ' ')}</div>
              </div>
              <div className="flex gap-3 text-xs font-medium">
                <button type="button" onClick={() => startEdit(m)} className="flex items-center gap-1 text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400">
                  <Pencil className="w-3.5 h-3.5" /> Edit
                </button>
                <button type="button" onClick={() => handleDelete(m.id)} className="flex items-center gap-1 text-red-600 dark:text-red-400 hover:underline">
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {showAIModal && <AIDraftModal courseId={courseId} type="note" onClose={() => setShowAIModal(false)} onApply={handleAIApply} />}
    </div>
  )
}

// ============================== Practice Questions ==============================

const EMPTY_QUESTION_FORM = {
  question_text: '',
  option_a: '',
  option_b: '',
  option_c: '',
  option_d: '',
  correct_option: 'A' as 'A' | 'B' | 'C' | 'D',
  explanation: '',
  difficulty: 'medium' as ExamDifficulty,
  is_ai_generated: false,
  ai_topic: undefined as string | undefined,
}

const STATUS_FILTERS: { value: ReviewStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'generated', label: 'Needs review' },
  { value: 'under_review', label: 'In review' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'archived', label: 'Archived' },
]

function PracticeQuestionsTab({ courseId }: { courseId: string }) {
  const [questions, setQuestions] = useState<ExamQuestion[]>([])
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([])
  const [statusFilter, setStatusFilter] = useState<ReviewStatus | 'all'>('all')
  const [viewDuplicatesOnly, setViewDuplicatesOnly] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const PAGE_SIZE = 20
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_QUESTION_FORM)
  const [showAIModal, setShowAIModal] = useState(false)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = async (isMounted = true) => {
    try {
      const qRes: any = await adminApi.listQuestions(courseId, statusFilter === 'all' ? undefined : statusFilter)
      const qData = qRes?.data !== undefined ? qRes.data : qRes
      if (isMounted) setQuestions(Array.isArray(qData) ? qData : [])
    } catch {
      // Non-blocking catch
    }

    try {
      const dupRes: any = await adminApi.listDuplicates(courseId)
      const dupData = dupRes?.data !== undefined ? dupRes.data : dupRes
      if (isMounted) setDuplicateGroups(Array.isArray(dupData) ? dupData : [])
    } catch {
      // Non-blocking catch
    }
  }

  useEffect(() => {
    let isMounted = true
    load(isMounted)
    return () => {
      isMounted = false
    }
  }, [courseId, statusFilter])

  const filteredQuestions = questions.filter((q) => {
    const matchesStatus = statusFilter === 'all' || q.review_status === statusFilter
    const matchesSearch = !searchQuery || q.question_text.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesStatus && matchesSearch
  })

  const totalPages = Math.ceil(filteredQuestions.length / PAGE_SIZE)
  const paginatedQuestions = filteredQuestions.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  )

  const totalRepeatedCount = duplicateGroups.reduce(
    (sum, g) => sum + Math.max(0, (g.questions?.length || g.count || 0) - 1),
    0
  )

  const stats = {
    total: questions.length,
    approved: questions.filter(q => q.review_status === 'approved').length,
    inReview: questions.filter(q => q.review_status === 'under_review' || q.review_status === 'generated').length,
    rejected: questions.filter(q => q.review_status === 'rejected').length,
  }

  const startEdit = (q: ExamQuestion) => {
    setEditingId(q.id)
    setForm({
      question_text: q.question_text,
      option_a: q.option_a,
      option_b: q.option_b,
      option_c: q.option_c,
      option_d: q.option_d,
      correct_option: q.correct_option,
      explanation: q.explanation,
      difficulty: q.difficulty,
      is_ai_generated: q.is_ai_generated,
      ai_topic: q.ai_topic ?? undefined,
    })
  }

  const startNew = () => {
    setEditingId('new')
    setForm(EMPTY_QUESTION_FORM)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setForm(EMPTY_QUESTION_FORM)
  }

  const handleAIApply = (result: AIGenerateResponse, topic?: string) => {
    if (result.type !== 'question' || !result.question) return
    setForm({ ...result.question, is_ai_generated: true, ai_topic: topic, difficulty: form.difficulty })
    setShowAIModal(false)
    if (editingId === null) setEditingId('new')
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    setError(null)
    try {
      if (editingId && editingId !== 'new') {
        await adminApi.updateQuestion(editingId, form)
      } else {
        await adminApi.createQuestion(courseId, form)
      }
      cancelEdit()
      await load()
    } catch {
      setError('Could not save this question.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this question?')) return
    await adminApi.deleteQuestion(id)
    await load()
  }

  const handleBulkDelete = async (ids: string[]) => {
    if (ids.length === 0) return
    if (!confirm(`Are you sure you want to bulk-delete ${ids.length} question(s)?`)) return
    setIsSaving(true)
    try {
      await adminApi.bulkDeleteQuestions(ids)
      await load()
    } catch {
      setError('Could not complete bulk deletion.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleKeepOneAndDeleteOthers = (group: DuplicateGroup, keepId: string) => {
    if (!group.questions) return
    const toDelete = group.questions.filter((q: ExamQuestion) => q.id !== keepId).map((q: ExamQuestion) => q.id)
    handleBulkDelete(toDelete)
  }

  const handlePurgeAllDuplicates = () => {
    const toDelete: string[] = []
    duplicateGroups.forEach((group: DuplicateGroup) => {
      if (group.questions && group.questions.length > 1) {
        group.questions.slice(1).forEach((q: ExamQuestion) => toDelete.push(q.id))
      }
    })
    handleBulkDelete(toDelete)
  }

  const handleApprove = async (id: string) => {
    await adminApi.reviewQuestion(id, 'approve')
    await load()
  }

  const handleArchive = async (id: string) => {
    await adminApi.reviewQuestion(id, 'archive')
    await load()
  }

  const confirmReject = async (id: string) => {
    if (!rejectionReason.trim()) return
    await adminApi.reviewQuestion(id, 'reject', rejectionReason.trim())
    setRejectingId(null)
    setRejectionReason('')
    await load()
  }

  const canEdit = (_s: ReviewStatus) => true
  const canDelete = (_s: ReviewStatus) => true
  const canArchive = (s: ReviewStatus) => s === 'approved' || s === 'rejected'

  return (
    <div className="space-y-6">

      {/* ─────────── DUPLICATES VIEW ─────────── */}
      {viewDuplicatesOnly && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setViewDuplicatesOnly(false)}
              className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to all questions
            </button>

            {duplicateGroups.length > 0 && (
              <button
                type="button"
                onClick={handlePurgeAllDuplicates}
                disabled={isSaving}
                className="inline-flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                Purge all duplicates ({totalRepeatedCount})
              </button>
            )}
          </div>

          {duplicateGroups.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center">
              <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-400 mb-3" />
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                No duplicates found
              </p>
            </div>
          ) : (
            duplicateGroups.map((group, gi) => (
              <div
                key={gi}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-amber-200 dark:border-amber-500/30 overflow-hidden"
              >
                <div className="bg-amber-50 dark:bg-amber-500/10 px-4 py-3 border-b border-amber-200 dark:border-amber-500/30">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <span className="text-sm font-bold text-amber-800 dark:text-amber-300">
                      {group.questions?.length || group.count || 0} identical questions
                    </span>
                  </div>
                  <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                    Keep the best one — the rest will be deleted.
                  </p>
                </div>

                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {(group.questions || []).map((q) => (
                    <div key={q.id} className="p-4 flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${REVIEW_BADGE[q.review_status as ReviewStatus]}`}>
                            {(q.review_status || 'generated').replace('_', ' ')}
                          </span>
                          <span className="text-[10px] text-slate-400">{q.difficulty}</span>
                        </div>
                        <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed">
                          {q.question_text}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleKeepOneAndDeleteOthers(group, q.id)}
                        disabled={isSaving}
                        className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs font-semibold rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Keep this one
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ─────────── MAIN CONTENT (hidden while duplicates open) ─────────── */}
      {!viewDuplicatesOnly && (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Total</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{stats.total}</p>
        </div>
        <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-2xl border border-emerald-200 dark:border-emerald-800 p-4">
          <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Approved</p>
          <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 mt-1">{stats.approved}</p>
        </div>
        <div className="bg-amber-50 dark:bg-amber-950/30 rounded-2xl border border-amber-200 dark:border-amber-800 p-4">
          <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">In Review</p>
          <p className="text-2xl font-bold text-amber-700 dark:text-amber-300 mt-1">{stats.inReview}</p>
        </div>
        <div className="bg-red-50 dark:bg-red-950/30 rounded-2xl border border-red-200 dark:border-red-800 p-4">
          <p className="text-xs text-red-600 dark:text-red-400 font-medium">Rejected</p>
          <p className="text-2xl font-bold text-red-700 dark:text-red-300 mt-1">{stats.rejected}</p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search questions..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              setCurrentPage(1)
            }}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as ReviewStatus | 'all')
            setCurrentPage(1)
          }}
          className="px-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {STATUS_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
        {editingId === null && (
          <button onClick={startNew} className="flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-500 transition-colors shadow-md shadow-indigo-600/20">
            <Plus className="w-4 h-4" />
            New Question
          </button>
        )}
      </div>

      {/* Duplicate Warning */}
      {duplicateGroups.length > 0 && !viewDuplicatesOnly && (
        <button
          onClick={() => setViewDuplicatesOnly(true)}
          className="w-full flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-2xl text-left hover:bg-amber-100 dark:hover:bg-amber-950/50 transition-colors"
        >
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
          <div>
            <p className="text-sm font-bold text-amber-800 dark:text-amber-300">
              {duplicateGroups.length} duplicate group(s) found ({totalRepeatedCount} repeated questions)
            </p>
            <p className="text-xs text-amber-600 dark:text-amber-400">Click to review and clean up duplicates</p>
          </div>
        </button>
      )}

      {/* Editing Form */}
      {editingId && (
        <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-3">
          {error && <div className="text-sm text-red-600 bg-red-50 dark:bg-red-950/50 rounded-lg px-3 py-2">{error}</div>}
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-sm text-slate-900 dark:text-white">{editingId === 'new' ? 'New Question' : 'Edit Question'}</h2>
            <button type="button" onClick={() => setShowAIModal(true)} className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline">
              ✨ AI MCQ Generator
            </button>
          </div>
          <textarea
            className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Question text"
            required
            value={form.question_text}
            onChange={(e) => setForm((f) => ({ ...f, question_text: e.target.value }))}
          />
          {(['a', 'b', 'c', 'd'] as const).map((key) => (
            <div key={key} className="flex items-center gap-2">
              <span className="text-sm font-bold w-5 text-slate-700 dark:text-slate-300">{key.toUpperCase()}</span>
              <input
                className="flex-1 px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder={`Option ${key.toUpperCase()}`}
                required
                value={form[`option_${key}` as 'option_a']}
                onChange={(e) => setForm((f) => ({ ...f, [`option_${key}`]: e.target.value }))}
              />
            </div>
          ))}
          <div className="flex gap-3">
            <select
              className="flex-1 px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={form.correct_option}
              onChange={(e) => setForm((f) => ({ ...f, correct_option: e.target.value as 'A' | 'B' | 'C' | 'D' }))}
            >
              {['A', 'B', 'C', 'D'].map((k) => (
                <option key={k} value={k}>Correct: {k}</option>
              ))}
            </select>
            <select
              className="flex-1 px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={form.difficulty}
              onChange={(e) => setForm((f) => ({ ...f, difficulty: e.target.value as ExamDifficulty }))}
            >
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>
          <textarea
            className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Explanation"
            required
            value={form.explanation}
            onChange={(e) => setForm((f) => ({ ...f, explanation: e.target.value }))}
          />
          <div className="flex gap-2">
            <button type="submit" disabled={isSaving} className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-500 disabled:opacity-50">
              {isSaving ? 'Saving...' : 'Save'}
            </button>
            <button type="button" onClick={cancelEdit} className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Question List */}
      {filteredQuestions.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center">
          <ClipboardCheck className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
          <p className="text-sm text-slate-500 dark:text-slate-400">No questions found</p>
        </div>
      ) : (
        <div className="space-y-3">
        {paginatedQuestions.map((q) => (
  <div
    key={q.id}
    className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 hover:shadow-md transition-shadow"
  >
    {/* Header row: badges + delete button */}
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${REVIEW_BADGE[q.review_status as ReviewStatus]}`}
          >
            {q.review_status === 'approved' && (
              <CheckCircle2 className="w-3 h-3" />
            )}
            {q.review_status === 'under_review' && (
              <Clock className="w-3 h-3" />
            )}
            {q.review_status === 'rejected' && (
              <XCircle className="w-3 h-3" />
            )}
            {(q.review_status || 'generated').replace('_', ' ')}
          </span>
          <span className="text-xs text-slate-400 flex items-center gap-1">
            {q.difficulty}
            {q.is_ai_generated && (
              <>
                <span>•</span>
                <Sparkles className="w-3 h-3" />
                <span>AI</span>
              </>
            )}
          </span>
        </div>
        <p className="text-sm text-slate-800 dark:text-slate-200 font-medium leading-relaxed">
          {q.question_text}
        </p>
      </div>
      {/* Delete icon button — always visible when allowed */}
      {canDelete(q.review_status) && (
        <button
          type="button"
          onClick={() => handleDelete(q.id)}
          className="shrink-0 p-2 rounded-lg text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
          title="Delete question"
          aria-label="Delete question"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}
    </div>

    {/* MCQ options grid */}
    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
      {(['A', 'B', 'C', 'D'] as const).map((key) => {
        const optionText = q[`option_${key.toLowerCase()}` as 'option_a']
        const isCorrect = q.correct_option === key
        return (
          <div
            key={key}
            className={`flex items-start gap-2.5 px-3 py-2 rounded-xl border text-sm ${
              isCorrect
                ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300'
                : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
            }`}
          >
            <span
              className={`shrink-0 inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold ${
                isCorrect
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
              }`}
            >
              {key}
            </span>
            <span className="leading-snug flex-1">{optionText}</span>
            {isCorrect && (
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            )}
          </div>
        )
      })}
    </div>

    {/* Explanation */}
    {q.explanation && (
      <div className="mt-3 px-3 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20">
        <p className="text-xs text-indigo-700 dark:text-indigo-300 leading-relaxed">
          <span className="font-bold">Explanation: </span>
          {q.explanation}
        </p>
      </div>
    )}

    {/* Reject input OR action links */}
    {rejectingId === q.id ? (
      <div className="mt-3 flex gap-2">
        <input
          className="flex-1 px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500"
          placeholder="Reason for rejection"
          value={rejectionReason}
          onChange={(e) => setRejectionReason(e.target.value)}
          autoFocus
        />
        <button
          onClick={() => confirmReject(q.id)}
          disabled={!rejectionReason.trim()}
          className="px-3 py-2 bg-rose-600 text-white text-sm font-semibold rounded-xl disabled:opacity-50"
        >
          Confirm
        </button>
        <button
          onClick={() => {
            setRejectingId(null)
            setRejectionReason('')
          }}
          className="px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm rounded-xl"
        >
          Cancel
        </button>
      </div>
    ) : (
      <div className="flex gap-3 text-xs font-medium mt-3 flex-wrap items-center">
        {(q.review_status === 'generated' ||
          q.review_status === 'under_review') && (
          <>
            <button
              onClick={() => handleApprove(q.id)}
              className="text-emerald-600 dark:text-emerald-400 hover:underline"
            >
              Approve
            </button>
            <button
              onClick={() => setRejectingId(q.id)}
              className="text-rose-600 dark:text-rose-400 hover:underline"
            >
              Reject
            </button>
          </>
        )}
        {canEdit(q.review_status) && (
          <button
            onClick={() => startEdit(q)}
            className="text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400"
          >
            Edit
          </button>
        )}
              {canArchive(q.review_status) && (
          <button
            onClick={() => handleArchive(q.id)}
            className="text-slate-600 dark:text-slate-400 hover:underline"
          >
            Archive
          </button>
        )}
               <button
          onClick={() => handleDelete(q.id)}
          className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 hover:underline"
        >
          <Trash2 className="w-3 h-3" />
          Delete
        </button>
      </div>
    )}
  </div>
))}
        </div>
      )}

     
                       {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 disabled:opacity-30 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm text-slate-600 dark:text-slate-400 font-medium">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 disabled:opacity-30 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      )}

      {showAIModal && <AIDraftModal courseId={courseId} type="question" onClose={() => setShowAIModal(false)} onApply={handleAIApply} />}
    </div>
  )
}

import { useEffect, useState, useRef, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { marked } from 'marked'
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
import { FormattedQuestionText } from '../components/FormattedQuestionText'
import { Archive, CheckCircle2, XCircle, Pencil, Trash2, ChevronLeft, ChevronRight, ClipboardCheck, Plus, Search } from 'lucide-react'

interface DuplicateGroup {
  count?: number
  questions: ExamQuestion[]
}

type Tab = 'notes' | 'questions'

const REVIEW_BADGE: Record<ReviewStatus, string> = {
  generated: 'bg-canvas text-ink/60',
  under_review: 'bg-warn/10 text-warn',
  approved: 'bg-accent-light text-accent-dark',
  rejected: 'bg-danger/10 text-danger',
  archived: 'bg-ink/5 text-ink/40',
}

export function CourseContentManagerPage() {
  const { id: courseId } = useParams<{ id: string }>()
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
    <div className="space-y-6 max-w-3xl">
      <div>
        <Link to="/admin" className="text-sm text-ink/50 hover:text-ink">
          ← Admin
        </Link>
        <h1 className="font-display text-2xl font-semibold mt-2">{course?.name ?? 'Course content'}</h1>
        <p className="text-ink/60 mt-1">Manage study notes and the practice-question review queue.</p>
      </div>

      <div className="flex gap-2 border-b border-border">
        {(['notes', 'questions'] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t ? 'border-accent text-accent-dark' : 'border-transparent text-ink/50 hover:text-ink'
            }`}
          >
            {t === 'notes' ? 'Study Notes' : 'Practice Questions'}
          </button>
        ))}
      </div>

      {tab === 'notes' ? <StudyNotesTab courseId={courseId} /> : <PracticeQuestionsTab courseId={courseId} />}
    </div>
  )
}

// ============================== Study Notes ==============================

const EMPTY_NOTE_FORM = { title: '', content: '', material_type: 'note' as MaterialContentType, is_ai_generated: false }

function StudyNotesTab({ courseId }: { courseId: string }) {
  const [materials, setMaterials] = useState<CourseMaterial[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_NOTE_FORM)
  const [showPreview, setShowPreview] = useState(false)
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
    setShowPreview(false)
  }

  const startNew = () => {
    setEditingId('new')
    setForm(EMPTY_NOTE_FORM)
    setShowPreview(false)
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
    <div className="space-y-6">
      {editingId ? (
        <form onSubmit={handleSubmit} className="card p-5 space-y-3">
          {error && <div className="text-sm text-danger bg-danger/10 rounded-lg px-3 py-2">{error}</div>}
          <div className="flex items-center justify-between">
            <h2 className="font-display font-semibold text-sm">{editingId === 'new' ? 'New note' : 'Edit note'}</h2>
            <button type="button" onClick={() => setShowAIModal(true)} className="text-xs font-medium text-accent-dark hover:underline">
               Generate with AI
            </button>
          </div>
          <input
            className="input"
            placeholder="Title"
            required
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          />
          <select
            className="input"
            value={form.material_type}
            onChange={(e) => setForm((f) => ({ ...f, material_type: e.target.value as MaterialContentType }))}
          >
            <option value="note">Note</option>
            <option value="summary">Summary</option>
            <option value="slide_deck">Slide deck</option>
          </select>
          <div className="flex items-center justify-between">
            <label className="label mb-0">Content (Markdown)</label>
            <button type="button" onClick={() => setShowPreview((p) => !p)} className="text-xs text-ink/50 hover:text-ink">
              {showPreview ? 'Edit' : 'Preview'}
            </button>
          </div>
          {showPreview ? (
            <div
              className="input min-h-[200px] prose prose-sm max-w-none overflow-auto"
              dangerouslySetInnerHTML={{ __html: marked.parse(form.content || '_Nothing yet_') as string }}
            />
          ) : (
            <textarea
              className="input min-h-[200px] font-mono text-sm"
              required
              value={form.content}
              onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
            />
          )}
          <div className="flex gap-2">
            <button type="submit" disabled={isSaving} className="btn-primary">
              {isSaving ? 'Saving…' : 'Save'}
            </button>
            <button type="button" onClick={cancelEdit} className="btn-secondary">
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button type="button" onClick={startNew} className="btn-primary">
          + New note
        </button>
      )}

      <div className="space-y-2">
        {materials.length === 0 ? (
          <div className="card p-4 text-sm text-ink/50">No notes yet.</div>
        ) : (
          materials.map((m) => (
            <div key={m.id} className="card p-4 flex items-center justify-between">
              <div>
                <div className="font-medium text-sm">
                  {m.title} {m.is_ai_generated && <span className="text-xs text-accent-dark ml-1"> AI</span>}
                </div>
                <div className="text-xs text-ink/50 mt-0.5">{m.material_type.replace('_', ' ')}</div>
              </div>
              <div className="flex gap-3 text-xs font-medium">
                <button type="button" onClick={() => startEdit(m)} className="text-ink/60 hover:text-ink">
                  Edit
                </button>
                <button type="button" onClick={() => handleDelete(m.id)} className="text-danger hover:underline">
                  Delete
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
  const [difficultyFilter, setDifficultyFilter] = useState<'all' | 'easy' | 'medium' | 'hard'>('all')
  const [aiFilter, setAiFilter] = useState<'all' | 'ai' | 'human'>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const PAGE_SIZE = 20
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_QUESTION_FORM)
  const [showAIModal, setShowAIModal] = useState(false)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [focusedIdx, setFocusedIdx] = useState(0)
  const focusedCardRef = useRef<HTMLDivElement | null>(null)

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

  useEffect(() => {
    setCurrentPage(1)
    setSelectedIds([])
  }, [difficultyFilter, aiFilter, searchQuery])

  const filteredQuestions = questions.filter((q) => {
    const matchesStatus = statusFilter === 'all' || q.review_status === statusFilter
    const matchesSearch = !searchQuery || q.question_text.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesDifficulty = difficultyFilter === 'all' || q.difficulty === difficultyFilter
    const matchesAi =
      aiFilter === 'all' ||
      (aiFilter === 'ai' && q.is_ai_generated) ||
      (aiFilter === 'human' && !q.is_ai_generated)
    return matchesStatus && matchesSearch && matchesDifficulty && matchesAi
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
      setError('Could not save this question. If it was already approved, archive it and create a new draft instead.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    const target = questions.find((x: ExamQuestion) => x.id === id)
    const isApproved = target?.review_status === 'approved'
    const msg = isApproved
      ? 'This question is APPROVED and live for students. It will be archived and then permanently removed from the exam bank. This cannot be undone. Continue?'
      : 'Are you sure you want to delete this question? This cannot be undone.'
    if (!confirm(msg)) return
    try {
      await adminApi.deleteQuestion(id)
      await load()
    } catch (err) {
      console.error('Delete failed:', err)
    }
  }

  const handleBulkDelete = async (ids: string[]) => {
    if (ids.length === 0) return
    if (!confirm(`Are you sure you want to bulk-delete ${ids.length} question(s)?`)) return
    setIsSaving(true)
    try {
      await adminApi.bulkDeleteQuestions(ids)
      await load()
    } catch {
      setError('Could not complete bulk deletion. Please try again.')
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

  // ---- Bulk selection ----
  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const toggleSelectAllVisible = () => {
    const visibleIds = filteredQuestions.map((q) => q.id)
    const allSelected =
      visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id))
    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !visibleIds.includes(id)))
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...visibleIds])))
    }
  }

  const handleBatchDelete = async () => {
    if (selectedIds.length === 0) return
    if (!confirm(`Delete ${selectedIds.length} question(s) permanently? This cannot be undone.`)) return
    setIsSaving(true)
    setError(null)
    try {
      await adminApi.bulkDeleteQuestions(selectedIds)
      setSelectedIds([])
      await load()
    } catch {
      setError('Bulk delete failed.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleBatchApprove = async () => {
    if (selectedIds.length === 0) return
    if (!confirm(`Approve ${selectedIds.length} question(s)?`)) return
    setIsSaving(true)
    setError(null)
    try {
      await adminApi.batchReviewQuestions(selectedIds, 'approve')
      setSelectedIds([])
      await load()
    } catch {
      setError('Bulk approve failed.')
    } finally {
      setIsSaving(false)
    }
  }

  // ---- Keyboard shortcuts + focus management ----
  useEffect(() => {
    if (focusedIdx >= filteredQuestions.length) {
      setFocusedIdx(Math.max(0, filteredQuestions.length - 1))
    }
  }, [filteredQuestions.length, focusedIdx])

  useEffect(() => {
    setFocusedIdx(0)
  }, [statusFilter, difficultyFilter, aiFilter, searchQuery, courseId])

  useEffect(() => {
    focusedCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [focusedIdx])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target) {
        const tag = target.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) return
      }
      if (editingId !== null || rejectingId !== null) return
      if (filteredQuestions.length === 0) return

      const focusedQ = paginatedQuestions[focusedIdx]
      if (!focusedQ) return

      const key = e.key

      if (key === 'j' || key === 'J' || key === 'ArrowDown') {
        e.preventDefault()
        if (focusedIdx < paginatedQuestions.length - 1) {
          setFocusedIdx(focusedIdx + 1)
        } else if (currentPage < totalPages) {
          setCurrentPage(currentPage + 1)
          setFocusedIdx(0)
        }
        return
      }
      if (key === 'k' || key === 'K' || key === 'ArrowUp') {
        e.preventDefault()
        if (focusedIdx > 0) {
          setFocusedIdx(focusedIdx - 1)
        } else if (currentPage > 1) {
          setCurrentPage(currentPage - 1)
          setFocusedIdx(PAGE_SIZE - 1)
        }
        return
      }
      if (key === 'a' || key === 'A') {
        e.preventDefault()
        handleApprove(focusedQ.id)
        return
      }
      if (key === 'r' || key === 'R') {
        e.preventDefault()
        setRejectingId(focusedQ.id)
        return
      }
      if (key === 'd' || key === 'D') {
        e.preventDefault()
        handleDelete(focusedQ.id)
        return
      }
      if (key === 'e' || key === 'E') {
        e.preventDefault()
        startEdit(focusedQ)
        return
      }
      if (key === 'x' || key === 'X' || key === ' ') {
        e.preventDefault()
        toggleSelectOne(focusedQ.id)
        return
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [focusedIdx, filteredQuestions, paginatedQuestions, editingId, rejectingId, currentPage, totalPages])

  const canEdit = (s: ReviewStatus) => s === 'generated' || s === 'under_review'
  const canDelete = (_s: ReviewStatus) => true
  const canArchive = (s: ReviewStatus) => s === 'approved' || s === 'rejected'

  return (
    <div className="space-y-6">

      {selectedIds.length > 0 && (
        <div className="sticky top-2 z-20 flex items-center justify-between gap-3 rounded-2xl border border-indigo-300 bg-indigo-50 px-4 py-2.5 shadow-lg dark:border-indigo-800 dark:bg-indigo-950/80">
          <span className="text-xs font-semibold text-indigo-800 dark:text-indigo-200">
            {selectedIds.length} question{selectedIds.length === 1 ? '' : 's'} selected
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="text-xs px-3 py-1.5 rounded-lg bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-100 transition-colors dark:bg-slate-900 dark:border-slate-700 dark:text-slate-300"
            >
              Clear
            </button>
            <button
              type="button"
              disabled={isSaving}
              onClick={handleBatchApprove}
              className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-500 transition-colors disabled:opacity-50"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Approve Selected
            </button>
            <button
              type="button"
              disabled={isSaving}
              onClick={handleBatchDelete}
              className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-500 transition-colors disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete Selected
            </button>
          </div>
        </div>
      )}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex gap-1.5 flex-wrap items-center">
          <input
            type="text"
            placeholder="Search questions..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              setCurrentPage(1)
            }}
            className="px-3 py-1.5 border border-slate-300 rounded-xl text-xs w-48 focus:outline-none focus:border-indigo-500"
          />
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => {
                setStatusFilter(f.value)
                setViewDuplicatesOnly(false)
              }}
              className={`text-xs font-medium px-2.5 py-1 rounded-full transition-colors ${
                !viewDuplicatesOnly && statusFilter === f.value
                  ? 'bg-primary text-white'
                  : 'bg-canvas text-ink/60 hover:bg-border'
              }`}
            >
              {f.label}
            </button>
          ))}

          <select
            value={difficultyFilter}
            onChange={(e) => setDifficultyFilter(e.target.value as typeof difficultyFilter)}
            className="text-xs px-2.5 py-1 rounded-full border border-slate-300 bg-white text-slate-700 focus:outline-none focus:border-indigo-500 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-300"
          >
            <option value="all">Difficulty: All</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>

          <select
            value={aiFilter}
            onChange={(e) => setAiFilter(e.target.value as typeof aiFilter)}
            className="text-xs px-2.5 py-1 rounded-full border border-slate-300 bg-white text-slate-700 focus:outline-none focus:border-indigo-500 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-300"
          >
            <option value="all">Source: All</option>
            <option value="ai">AI Generated</option>
            <option value="human">Manually Added</option>
          </select>

          <label className="inline-flex items-center gap-1.5 text-xs font-medium text-ink/70 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={filteredQuestions.length > 0 && filteredQuestions.every((q) => selectedIds.includes(q.id))}
              onChange={toggleSelectAllVisible}
              className="w-3.5 h-3.5 rounded cursor-pointer accent-indigo-600"
            />
            Select visible ({filteredQuestions.length})
          </label>

          {duplicateGroups.length > 0 && (
            <button
              type="button"
              onClick={() => setViewDuplicatesOnly((prev) => !prev)}
              className={`text-xs font-semibold px-2.5 py-1 rounded-full border transition-all flex items-center gap-1 ${
                viewDuplicatesOnly
                  ? 'bg-amber-500 text-white border-amber-600 shadow-sm'
                  : 'bg-amber-500/10 text-amber-700 border-amber-500/30 hover:bg-amber-500/20'
              }`}
            >
              <span>️ Repeated ({totalRepeatedCount})</span>
            </button>
          )}
        </div>

        {editingId === null && (
          <button type="button" onClick={startNew} className="btn-primary text-sm py-1.5 px-3">
            + New question
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 rounded-xl bg-canvas/60 border border-border text-[10px] font-mono text-ink/60">
        <span className="font-semibold uppercase tracking-wider text-ink/40">Shortcuts:</span>
        <span><kbd className="px-1.5 py-0.5 rounded bg-white border border-border">A</kbd> Approve</span>
        <span><kbd className="px-1.5 py-0.5 rounded bg-white border border-border">R</kbd> Reject</span>
        <span><kbd className="px-1.5 py-0.5 rounded bg-white border border-border">D</kbd> Delete</span>
        <span><kbd className="px-1.5 py-0.5 rounded bg-white border border-border">E</kbd> Edit</span>
        <span><kbd className="px-1.5 py-0.5 rounded bg-white border border-border">X</kbd> Select</span>
        <span><kbd className="px-1.5 py-0.5 rounded bg-white border border-border">J</kbd>/<kbd className="px-1.5 py-0.5 rounded bg-white border border-border">K</kbd> Navigate</span>
      </div>

      {editingId && (
        <form onSubmit={handleSubmit} className="card p-5 space-y-3">
          {error && <div className="text-sm text-danger bg-danger/10 rounded-lg px-3 py-2">{error}</div>}
          <div className="flex items-center justify-between">
            <h2 className="font-display font-semibold text-sm">{editingId === 'new' ? 'New question' : 'Edit question'}</h2>
            <button type="button" onClick={() => setShowAIModal(true)} className="text-xs font-medium text-accent-dark hover:underline">
               AI MCQ Generator
            </button>
          </div>
          <textarea
            className="input"
            placeholder="Question text"
            required
            value={form.question_text}
            onChange={(e) => setForm((f) => ({ ...f, question_text: e.target.value }))}
          />
          {(['a', 'b', 'c', 'd'] as const).map((key) => (
            <div key={key} className="flex items-center gap-2">
              <span className="text-sm font-medium w-5">{key.toUpperCase()}</span>
              <input
                className="input"
                required
                value={form[`option_${key}` as 'option_a']}
                onChange={(e) => setForm((f) => ({ ...f, [`option_${key}`]: e.target.value }))}
              />
            </div>
          ))}
          <div className="flex gap-3">
            <select
              className="input"
              value={form.correct_option}
              onChange={(e) => setForm((f) => ({ ...f, correct_option: e.target.value as 'A' | 'B' | 'C' | 'D' }))}
            >
              {['A', 'B', 'C', 'D'].map((k) => (
                <option key={k} value={k}>
                  Correct: {k}
                </option>
              ))}
            </select>
            <select
              className="input"
              value={form.difficulty}
              onChange={(e) => setForm((f) => ({ ...f, difficulty: e.target.value as ExamDifficulty }))}
            >
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>
          <textarea
            className="input"
            placeholder="Explanation"
            required
            value={form.explanation}
            onChange={(e) => setForm((f) => ({ ...f, explanation: e.target.value }))}
          />
          <div className="flex gap-2">
            <button type="submit" disabled={isSaving} className="btn-primary">
              {isSaving ? 'Saving…' : 'Save'}
            </button>
            <button type="button" onClick={cancelEdit} className="btn-secondary">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* VIEW MODE A: DUPLICATES MANAGEMENT QUEUE */}
      {viewDuplicatesOnly ? (
        <div className="space-y-4">
          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-800 flex items-center justify-between gap-2 flex-wrap">
            <span>
              Showing <strong>{duplicateGroups.length} duplicate groups</strong> ({totalRepeatedCount} repeated entry questions). Compare entries to approve one and delete or archive duplicates.
            </span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handlePurgeAllDuplicates}
                disabled={isSaving || totalRepeatedCount === 0}
                className="font-semibold text-danger hover:underline disabled:opacity-50"
              >
                ️ Bulk Purge All Duplicates ({totalRepeatedCount})
              </button>
              <button type="button" onClick={() => setViewDuplicatesOnly(false)} className="underline font-semibold">
                Clear Filter
              </button>
            </div>
          </div>

          {duplicateGroups.map((group: DuplicateGroup, groupIdx: number) => {
            const groupKey = group.questions?.[0]?.id ?? `group-${groupIdx}`
            return (
              <div key={groupKey} className="card p-4 border-2 border-amber-500/30 bg-canvas space-y-3">
                <div className="flex items-center justify-between border-b border-border pb-2">
                  <div className="text-xs font-bold text-amber-700 uppercase tracking-wider">
                    Duplicate Group #{groupIdx + 1} ({group.questions?.length || 0} occurrences)
                  </div>
                  {group.questions?.[0]?.id && (
                    <button
                      type="button"
                      onClick={() => handleKeepOneAndDeleteOthers(group, group.questions[0].id)}
                      disabled={isSaving}
                      className="text-xs font-medium text-danger hover:underline"
                    >
                      Keep Entry #1 & Delete Rest
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {group.questions?.map((q: ExamQuestion, idx: number) => (
                    <div key={q.id} className="p-3 bg-background border border-border rounded-lg space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(q.id)}
                          onChange={() => toggleSelectOne(q.id)}
                          className="mt-1 w-4 h-4 rounded cursor-pointer accent-indigo-600 shrink-0"
                        />
                        <div>
                          <span className="text-[10px] font-mono text-ink/40">Entry #{idx + 1} · ID: {q.id.slice(0, 8)}</span>
                          <p className="text-sm font-medium mt-0.5">{q.question_text}</p>
                        </div>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${REVIEW_BADGE[q.review_status as ReviewStatus]}`}>
                          {q.review_status.replace('_', ' ')}
                        </span>
                      </div>

                      <div className="text-xs text-ink/50">
                        {q.difficulty} {q.is_ai_generated && <span className="text-accent-dark">·  AI{q.ai_topic ? `: ${q.ai_topic}` : ''}</span>}
                      </div>

                      <div className="flex flex-wrap gap-2 text-xs font-semibold pt-2 border-t border-border/50">
                        {(q.review_status === 'generated' || q.review_status === 'under_review') && (
                          <button
                            type="button"
                            onClick={() => handleApprove(q.id)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-colors dark:bg-emerald-950/40 dark:text-emerald-300"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Keep This One
                          </button>
                        )}
                        {canArchive(q.review_status) && (
                          <button
                            type="button"
                            onClick={() => handleArchive(q.id)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors dark:bg-slate-800 dark:text-slate-300"
                          >
                            <Archive className="w-3.5 h-3.5" />
                            Archive
                          </button>
                        )}
                        {canDelete(q.review_status) && (
                          <button
                            type="button"
                            onClick={() => handleDelete(q.id)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition-colors dark:bg-red-950/40 dark:text-red-300 ml-auto"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Delete Duplicate
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        /* VIEW MODE B: STANDARD QUESTION LIST */
        <div className="space-y-2">
          {filteredQuestions.length === 0 ? (
            questions.length === 0 ? (
              <div className="card p-12 text-center">
                <ClipboardCheck className="w-12 h-12 mx-auto text-ink/30 mb-3" />
                <h3 className="text-base font-semibold text-ink mb-1">No questions yet</h3>
                <p className="text-sm text-ink/50 mb-4">Add your first question to get started.</p>
                <button
                  type="button"
                  onClick={startNew}
                  className="btn-primary text-sm px-4 py-2 inline-flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  New Question
                </button>
              </div>
            ) : (
              <div className="card p-8 text-center">
                <Search className="w-10 h-10 mx-auto text-ink/30 mb-3" />
                <h3 className="text-base font-semibold text-ink mb-1">No matches</h3>
                <p className="text-sm text-ink/50">Try adjusting your search or filters.</p>
              </div>
            )
          ) : (
            paginatedQuestions.map((q, idx) => (
              <div
                key={q.id}
                ref={focusedIdx === idx ? focusedCardRef : null}
                onClick={() => setFocusedIdx(idx)}
                className={`card p-4 cursor-pointer transition-shadow ${focusedIdx === idx ? 'ring-2 ring-indigo-500 ring-inset' : ''}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0 text-ink">
                    <FormattedQuestionText text={q.question_text} />
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${REVIEW_BADGE[q.review_status as ReviewStatus]}`}>
                    {q.review_status.replace('_', ' ')}
                  </span>
                </div>
                <div className="text-xs text-ink/50 mt-1">
                  {q.difficulty} {q.is_ai_generated && <span className="text-accent-dark">· AI{q.ai_topic ? `: ${q.ai_topic}` : ''}</span>}
                </div>

                {/* Options + correct answer */}
                <div className="mt-3 space-y-1.5">
                  {(['A', 'B', 'C', 'D'] as const).map((letter) => {
                    const optKey = `option_${letter.toLowerCase()}` as 'option_a' | 'option_b' | 'option_c' | 'option_d'
                    const optValue = q[optKey] || ''
                    const isCorrect = q.correct_option === letter
                    return (
                      <div
                        key={letter}
                        className={`flex items-start gap-2 px-2.5 py-1.5 rounded-lg text-xs leading-snug border ${
                          isCorrect
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-900 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-200 font-semibold'
                            : 'bg-canvas border-border text-ink/80'
                        }`}
                      >
                        <span className={`shrink-0 font-mono font-bold ${isCorrect ? 'text-emerald-700 dark:text-emerald-400' : 'text-ink/50'}`}>
                          {letter}
                        </span>
                        <span className="flex-1">{optValue}</span>
                        {isCorrect && (
                          <span className="shrink-0 text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                            ✓
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Explanation */}
                {q.explanation && (
                  <div className="mt-2 text-[11px] text-ink/70 bg-canvas/60 px-2.5 py-1.5 rounded-lg border border-border/50 leading-snug">
                    <span className="font-bold text-ink/80">💡 </span>
                    <span>{q.explanation}</span>
                  </div>
                )}

                {q.review_status === 'rejected' && q.rejection_reason && (
                  <div className="text-xs text-danger mt-1">Rejected: {q.rejection_reason}</div>
                )}

                {rejectingId === q.id ? (
                  <div className="mt-3 flex gap-2">
                    <input
                      className="input text-sm"
                      placeholder="Reason for rejection"
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      autoFocus
                    />
                    <button type="button" onClick={() => confirmReject(q.id)} disabled={!rejectionReason.trim()} className="btn-primary text-sm px-3">
                      Confirm
                    </button>
                    <button type="button" onClick={() => setRejectingId(null)} className="btn-secondary text-sm px-3">
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2 text-xs font-semibold mt-3">
                    {(q.review_status === 'generated' || q.review_status === 'under_review') && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleApprove(q.id)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-colors dark:bg-emerald-950/40 dark:text-emerald-300"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => setRejectingId(q.id)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors dark:bg-amber-950/40 dark:text-amber-300"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          Reject
                        </button>
                      </>
                    )}
                    {canEdit(q.review_status) && (
                      <button
                        type="button"
                        onClick={() => startEdit(q)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors dark:bg-slate-800 dark:text-slate-300"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        Edit
                      </button>
                    )}
                    {canArchive(q.review_status) && (
                      <button
                        type="button"
                        onClick={() => handleArchive(q.id)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors dark:bg-slate-800 dark:text-slate-300"
                      >
                        <Archive className="w-3.5 h-3.5" />
                        Archive
                      </button>
                    )}
                    {canDelete(q.review_status) && (
                      <button
                        type="button"
                        onClick={() => handleDelete(q.id)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition-colors dark:bg-red-950/40 dark:text-red-300"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-3 py-1 border border-slate-300 rounded-lg text-xs disabled:opacity-50"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs text-slate-600">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="px-3 py-1 border border-slate-300 rounded-lg text-xs disabled:opacity-50"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {showAIModal && <AIDraftModal courseId={courseId} type="question" onClose={() => setShowAIModal(false)} onApply={handleAIApply} />}

      {/* Floating New Question FAB */}
      {editingId === null && selectedIds.length === 0 && (
        <button
          type="button"
          onClick={startNew}
          className="fixed bottom-6 right-6 z-30 inline-flex items-center gap-2 px-5 py-3 rounded-full bg-indigo-600 text-white text-sm font-bold shadow-2xl shadow-indigo-600/30 hover:bg-indigo-500 hover:shadow-indigo-500/40 active:scale-95 transition-all"
          title="Add a new question"
        >
          <Plus className="w-5 h-5" />
          <span className="hidden sm:inline">New Question</span>
        </button>
      )}
    </div>
  )
}
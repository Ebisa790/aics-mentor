import { useEffect, useState, useMemo } from 'react'
import { apiClient } from '../api/client'

export interface Question {
  id: string
  course_id: string
  course_code?: string
  course_name?: string
  ai_model?: string
  question_text: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  correct_option: 'A' | 'B' | 'C' | 'D'
  explanation?: string
}

interface ReviewQueueResponse {
  count: number
  questions: Question[]
}

export function GlobalReviewQueue() {
  const [data, setData] = useState<ReviewQueueResponse>({ count: 0, questions: [] })
  const [loading, setLoading] = useState<boolean>(true)
  const [refreshing, setRefreshing] = useState<boolean>(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [isSubmittingBatch, setIsSubmittingBatch] = useState<boolean>(false)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [selectedCourse, setSelectedCourse] = useState<string>('all')

  // Inline Editing
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<Question>>({})
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false)

  const fetchGlobalPending = async (isManualRefresh = false) => {
    try {
      if (isManualRefresh) setRefreshing(true)
      setErrorMessage(null)
      const res = await apiClient.get<ReviewQueueResponse>('/api/admin/questions/pending-review')
      setData(res.data)
    } catch (err: any) {
      console.error('Failed to load global review queue:', err)
      setErrorMessage(err.response?.data?.detail || 'Failed to fetch pending questions.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchGlobalPending()
  }, [])

  // Extract unique courses for filtering dropdown
  const availableCourses = useMemo(() => {
    const map = new Map<string, string>()
    data.questions.forEach((q) => {
      const label = q.course_code ? `${q.course_code} - ${q.course_name || ''}` : `Course ${q.course_id}`
      map.set(q.course_id, label)
    })
    return Array.from(map.entries()).map(([id, label]) => ({ id, label }))
  }, [data.questions])

  // Client-side filtered list
  const filteredQuestions = useMemo(() => {
    return data.questions.filter((q) => {
      const matchesCourse = selectedCourse === 'all' || q.course_id === selectedCourse
      const matchesSearch =
        searchQuery === '' ||
        q.question_text.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (q.course_code && q.course_code.toLowerCase().includes(searchQuery.toLowerCase()))
      return matchesCourse && matchesSearch
    })
  }, [data.questions, selectedCourse, searchQuery])

  // Single review action
  const handleAction = async (questionId: string, action: 'approve' | 'reject') => {
    let rejectionReason: string | null = null
    
    if (action === 'reject') {
      rejectionReason = window.prompt('Please enter the reason for rejection:')
      if (!rejectionReason || !rejectionReason.trim()) {
        return
      }
    }
    
    setProcessingId(questionId)
    setErrorMessage(null)
    try {
      const body: any = { action }
      if (rejectionReason) {
        body.rejection_reason = rejectionReason.trim()
      }
      await apiClient.patch(`/api/admin/questions/${questionId}/review`, body)
      setData((prev) => ({
        ...prev,
        count: Math.max(0, prev.count - 1),
        questions: prev.questions.filter((q) => q.id !== questionId),
      }))
      setSelectedIds((prev) => prev.filter((id) => id !== questionId))
    } catch (err: any) {
      setErrorMessage(err.response?.data?.detail || `Failed to ${action} question.`)
    } finally {
      setProcessingId(null)
    }
  }

  // Toggle selection
  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }

  // Select/Deselect visible matching questions
  const toggleSelectAllVisible = () => {
    const visibleIds = filteredQuestions.map((q) => q.id)
    const allVisibleSelected = visibleIds.every((id) => selectedIds.includes(id))

    if (allVisibleSelected) {
      setSelectedIds((prev) => prev.filter((id) => !visibleIds.includes(id)))
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...visibleIds])))
    }
  }

  // Batch review action
  const handleBatchAction = async (action: 'approve' | 'reject') => {
    if (selectedIds.length === 0) return
    setIsSubmittingBatch(true)
    setErrorMessage(null)
    try {
      await apiClient.patch('/api/admin/questions/batch-review', {
        question_ids: selectedIds,
        action: action,
      })

      setData((prev) => ({
        ...prev,
        count: Math.max(0, prev.count - selectedIds.length),
        questions: prev.questions.filter((q) => !selectedIds.includes(q.id)),
      }))
      setSelectedIds([])
    } catch (err: any) {
      setErrorMessage(err.response?.data?.detail || 'Batch action failed.')
    } finally {
      setIsSubmittingBatch(false)
    }
  }

  // Inline edit handlers
  const startEdit = (q: Question) => {
    setEditingId(q.id)
    setEditForm({ ...q })
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditForm({})
  }

  const saveEdit = async (questionId: string) => {
    setIsSavingEdit(true)
    setErrorMessage(null)
    try {
      await apiClient.put(`/api/admin/questions/${questionId}`, editForm)
      setData((prev) => ({
        ...prev,
        questions: prev.questions.map((q) => (q.id === questionId ? ({ ...q, ...editForm } as Question) : q)),
      }))
      setEditingId(null)
    } catch (err: any) {
      setErrorMessage(err.response?.data?.detail || 'Failed to update question details.')
    } finally {
      setIsSavingEdit(false)
    }
  }

  if (loading) return <div className="p-6 text-sm text-ink/50">Loading global review items...</div>

  const allVisibleSelected =
    filteredQuestions.length > 0 && filteredQuestions.every((q) => selectedIds.includes(q.id))
  const isBusy = isSubmittingBatch || processingId !== null || isSavingEdit

  return (
    <div className="card overflow-hidden my-6 space-y-0">
      {/* Header Bar */}
      <div className="p-6 border-b border-border bg-canvas space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h3 className="text-lg font-display font-semibold text-ink flex items-center gap-2">
              Global AI Review Queue
              <span className="bg-amber-500/10 text-amber-700 text-xs px-2.5 py-0.5 rounded-full font-mono border border-amber-500/20">
                {data.count} Pending
              </span>
            </h3>
            <p className="text-sm text-ink/60">
              Review, edit, and approve auto-routed questions across all courses.
            </p>
          </div>

          <button
            type="button"
            onClick={() => fetchGlobalPending(true)}
            disabled={refreshing}
            className="text-xs font-medium text-accent hover:underline disabled:opacity-50 flex items-center gap-1 shrink-0"
          >
            {refreshing ? 'Refreshing...' : ' Refresh Queue'}
          </button>
        </div>

        {/* Filter Controls */}
        {data.questions.length > 0 && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-2 flex-1 max-w-xl">
              <input
                type="text"
                placeholder="Search question text or course..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input py-1.5 text-xs flex-1"
              />
              {availableCourses.length > 0 && (
                <select
                  value={selectedCourse}
                  onChange={(e) => setSelectedCourse(e.target.value)}
                  className="input py-1.5 text-xs max-w-[200px]"
                >
                  <option value="all">All Courses ({data.questions.length})</option>
                  {availableCourses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <input
                type="checkbox"
                checked={allVisibleSelected}
                onChange={toggleSelectAllVisible}
                className="w-4 h-4 accent-accent rounded cursor-pointer"
                id="selectAllHeader"
              />
              <label htmlFor="selectAllHeader" className="text-xs font-medium text-ink/70 cursor-pointer hover:underline">
                {allVisibleSelected ? 'Deselect Visible' : `Select Visible (${filteredQuestions.length})`}
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Error Alert Banner */}
      {errorMessage && (
        <div className="bg-danger/10 border-b border-danger/20 px-6 py-3 text-xs text-danger flex items-center justify-between">
          <span>{errorMessage}</span>
          <button type="button" onClick={() => setErrorMessage(null)} className="font-bold hover:opacity-75">
            
          </button>
        </div>
      )}

      {/* Floating Batch Action Bar */}
      {selectedIds.length > 0 && (
        <div className="bg-accent-light/90 backdrop-blur border-y border-accent/30 px-6 py-3 flex items-center justify-between sticky top-0 z-10 animate-fade-in">
          <span className="text-xs font-semibold text-accent-dark">
            {selectedIds.length} question(s) selected
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isBusy}
              onClick={() => handleBatchAction('reject')}
              className="border border-danger/30 text-danger bg-white/80 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-danger/10 transition-colors disabled:opacity-50"
            >
              Reject Selected
            </button>
            <button
              type="button"
              disabled={isBusy}
              onClick={() => handleBatchAction('approve')}
              className="bg-emerald-600 text-white px-4 py-1.5 rounded-lg text-xs font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 shadow-sm"
            >
              {isSubmittingBatch ? 'Processing Batch...' : ' Approve & Promote Selected'}
            </button>
          </div>
        </div>
      )}

      {/* Empty State */}
      {data.questions.length === 0 ? (
        <div className="card p-12 text-center text-ink/50 space-y-2">
          <p className="font-medium"> Queue clean! No pending questions waiting for review.</p>
          <p className="text-xs text-ink/40">Upload study materials or trigger AI generation to auto-route items here.</p>
        </div>
      ) : filteredQuestions.length === 0 ? (
        <div className="p-8 text-center text-sm text-ink/50">
          No questions match your filter query.
        </div>
      ) : (
        /* Questions List */
        <div className="divide-y divide-border max-h-[650px] overflow-y-auto">
          {filteredQuestions.map((q) => {
            const isSelected = selectedIds.includes(q.id)
            const isItemProcessing = processingId === q.id
            const isEditing = editingId === q.id

            return (
              <div
                key={q.id}
                className={`p-6 space-y-3 transition ${
                  isSelected ? 'bg-accent-light/20 border-l-4 border-l-accent' : 'hover:bg-canvas/40'
                }`}
              >
                {/* Item Meta Header */}
                <div className="flex justify-between items-center text-xs">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      disabled={isBusy}
                      onChange={() => toggleSelectOne(q.id)}
                      className="w-4 h-4 accent-accent rounded cursor-pointer disabled:opacity-50"
                    />
                    <span className="bg-accent-light text-accent-dark font-semibold px-2.5 py-0.5 rounded-md">
                      {q.course_code ? `${q.course_code} — ${q.course_name || ''}` : `Course ID: ${q.course_id}`}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-ink/40 font-mono">Model: {q.ai_model || 'Groq'}</span>
                    {!isEditing && (
                      <button
                        type="button"
                        onClick={() => startEdit(q)}
                        className="text-ink/60 hover:text-ink font-medium underline"
                      >
                        Edit
                      </button>
                    )}
                  </div>
                </div>

                {/* Question Body: Edit Mode vs View Mode */}
                {isEditing ? (
                  <div className="pl-7 space-y-3 bg-canvas p-4 rounded-lg border border-border">
                    <div>
                      <label className="text-xs font-semibold text-ink/70">Question Text</label>
                      <textarea
                        className="input text-xs w-full mt-1"
                        rows={2}
                        value={editForm.question_text || ''}
                        onChange={(e) => setEditForm((f) => ({ ...f, question_text: e.target.value }))}
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {(['a', 'b', 'c', 'd'] as const).map((key) => {
                        const optKey = `option_${key}` as keyof Question
                        return (
                          <div key={key}>
                            <label className="text-[10px] font-bold text-ink/50 uppercase">Option {key}</label>
                            <input
                              className="input text-xs w-full mt-0.5"
                              value={(editForm[optKey] as string) || ''}
                              onChange={(e) => setEditForm((f) => ({ ...f, [optKey]: e.target.value }))}
                            />
                          </div>
                        )
                      })}
                    </div>

                    <div className="flex items-center gap-4">
                      <div>
                        <label className="text-xs font-semibold text-ink/70 mr-2">Correct Answer:</label>
                        <select
                          className="input text-xs py-1 px-2"
                          value={editForm.correct_option}
                          onChange={(e) =>
                            setEditForm((f) => ({ ...f, correct_option: e.target.value as Question['correct_option'] }))
                          }
                        >
                          <option value="A">A</option>
                          <option value="B">B</option>
                          <option value="C">C</option>
                          <option value="D">D</option>
                        </select>
                      </div>

                      <div className="flex-1">
                        <label className="text-xs font-semibold text-ink/70">Explanation</label>
                        <input
                          className="input text-xs w-full mt-0.5"
                          value={editForm.explanation || ''}
                          onChange={(e) => setEditForm((f) => ({ ...f, explanation: e.target.value }))}
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                      <button type="button" onClick={cancelEdit} className="btn-secondary py-1 px-3 text-xs">
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={isSavingEdit}
                        onClick={() => saveEdit(q.id)}
                        className="btn-primary py-1 px-3 text-xs bg-accent text-white"
                      >
                        {isSavingEdit ? 'Saving...' : 'Save Changes'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="font-medium text-ink pl-7">{q.question_text}</p>

                    {/* Options Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm pl-7">
                      <div
                        className={`p-2 rounded border ${
                          q.correct_option === 'A'
                            ? 'bg-emerald-50 border-emerald-300 font-semibold text-emerald-900'
                            : 'bg-canvas text-ink/80 border-border'
                        }`}
                      >
                        A: {q.option_a}
                      </div>
                      <div
                        className={`p-2 rounded border ${
                          q.correct_option === 'B'
                            ? 'bg-emerald-50 border-emerald-300 font-semibold text-emerald-900'
                            : 'bg-canvas text-ink/80 border-border'
                        }`}
                      >
                        B: {q.option_b}
                      </div>
                      <div
                        className={`p-2 rounded border ${
                          q.correct_option === 'C'
                            ? 'bg-emerald-50 border-emerald-300 font-semibold text-emerald-900'
                            : 'bg-canvas text-ink/80 border-border'
                        }`}
                      >
                        C: {q.option_c}
                      </div>
                      <div
                        className={`p-2 rounded border ${
                          q.correct_option === 'D'
                            ? 'bg-emerald-50 border-emerald-300 font-semibold text-emerald-900'
                            : 'bg-canvas text-ink/80 border-border'
                        }`}
                      >
                        D: {q.option_d}
                      </div>
                    </div>

                    {q.explanation && (
                      <p className="text-xs text-ink/60 pl-7 italic bg-canvas/60 p-2 rounded border border-border/50">
                        <span className="font-semibold not-italic">Explanation:</span> {q.explanation}
                      </p>
                    )}
                  </>
                )}

                {/* Single Question Actions */}
                {!isEditing && (
                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleAction(q.id, 'reject')}
                      className="border border-danger/30 text-danger px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-danger/5 transition-colors disabled:opacity-50"
                    >
                      {isItemProcessing ? 'Processing...' : 'Reject'}
                    </button>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleAction(q.id, 'approve')}
                      className="bg-emerald-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 shadow-sm"
                    >
                      {isItemProcessing ? 'Processing...' : 'Approve & Promote'}
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
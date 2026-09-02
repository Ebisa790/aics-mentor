import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'

import {

const API_BASE_URL = import.meta.env.VITE_API_URL || ''
  ArrowLeft,
  Check,
  X,
  Edit3,
  Save,
    AlertCircle,
  ChevronLeft,
  ChevronRight,
  FileText,
  CheckCircle2,
  XCircle,
  History,
  RefreshCw,

} from 'lucide-react'

interface CourseModule {
  title: string
  content: string
}

interface NoteVersion {
  id: string
  version: number
  status: string
  modules: CourseModule[]
  source_type: string
  created_at: string
  updated_at: string | null
  reviewed_by_id: string | null
  reviewed_at: string | null
  review_notes: string | null
  coverage_score: number | null
  total_modules: number
}

interface ReviewData {
  course_id: string
  course_name: string
  course_code: string
  versions: NoteVersion[]
  latest_version: number
  message?: string
}

export function AdminNoteReview() {
  const { courseId } = useParams<{ courseId: string }>()
  const navigate = useNavigate()

  const [reviewData, setReviewData] = useState<ReviewData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedVersion, setSelectedVersion] = useState<number>(0)
  const [currentModule, setCurrentModule] = useState(0)
  const [editingModule, setEditingModule] = useState(false)
  const [editedContent, setEditedContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [approving, setApproving] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [showPasteModal, setShowPasteModal] = useState(false)
  const [pastedContent, setPastedContent] = useState('')
  const [pasting, setPasting] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)
  const [exportedPrompt, setExportedPrompt] = useState('')
  const [exporting, setExporting] = useState(false)

  const fetchReviewData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const token = localStorage.getItem('access_token')
      const response = await fetch('/api/courses/' + courseId + '/notes/review', {
        headers: { 'Authorization': 'Bearer ' + token }
      })
      if (!response.ok) throw new Error('Failed to load notes for review')
      const data = await response.json()
      setReviewData(data)
      if (data.versions && data.versions.length > 0) {
        setSelectedVersion(0)
        setCurrentModule(0)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }, [courseId])

  useEffect(() => {
    if (courseId) fetchReviewData()
  }, [courseId, fetchReviewData])

  const handleExportPrompt = async () => {
    try {
      setExporting(true)
      setShowExportModal(true)
      const token = localStorage.getItem('access_token')
      const response = await fetch('/api/courses/' + courseId + '/notes/export-prompt', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          module_title: version?.modules[currentModule]?.title || 'Full Course',
          source_text: version?.modules[currentModule]?.content || ''
        })
      })
      if (!response.ok) throw new Error('Failed to export prompt')
      const data = await response.json()
      setExportedPrompt(data.prompt)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export')
    } finally {
      setExporting(false)
    }
  }

  const handlePasteNotes = async () => {
    if (!pastedContent.trim() || pastedContent.length < 100) {
      setError('Please paste complete notes (at least 100 characters)')
      return
    }
    try {
      setPasting(true)
      // Preserve markdown formatting
      let cleanContent = pastedContent
      // Preserve markdown line breaks
      cleanContent = cleanContent.replace(/\r\n/g, '\n')
      cleanContent = cleanContent.replace(/\r/g, '\n')
      
      const token = localStorage.getItem('access_token')
      const response = await fetch('/api/courses/' + courseId + '/notes/manual', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content: cleanContent,
          source_type: 'manual_upload'
        })
      })
      if (!response.ok) throw new Error('Failed to upload notes')
      setShowPasteModal(false)
      setPastedContent('')
      setSuccessMessage('Manual notes uploaded! Review and approve them.')
      setTimeout(() => setSuccessMessage(null), 3000)
      fetchReviewData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload notes')
    } finally {
      setPasting(false)
    }
  }

  const handleGenerateFlashcards = async () => {
    try {
      const token = localStorage.getItem('access_token')
      const response = await fetch('/api/courses/' + courseId + '/flashcards/generate', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token }
      })
      if (!response.ok) throw new Error('Failed to generate flashcards')
      const data = await response.json()
      setSuccessMessage(data.message || 'Flashcards generated!')
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate')
    }
  }

  const handleReopenNotes = async () => {
    try {
      const token = localStorage.getItem('access_token')
      const response = await fetch('/api/courses/' + courseId + '/notes/reopen', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token }
      })
      if (!response.ok) throw new Error('Failed to reopen notes')
      setSuccessMessage('Notes reopened for review!')
      setTimeout(() => setSuccessMessage(null), 3000)
      fetchReviewData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reopen')
    }
  }

  const handleDeleteNotes = async () => {
    const currentVersion = getCurrentVersion()
    if (!currentVersion) return
    
    if (!confirm('Are you sure you want to delete this note version? This cannot be undone.')) return
    
    try {
      const token = localStorage.getItem('access_token')
      const response = await fetch('/api/courses/' + courseId + '/notes/' + currentVersion.id, {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer ' + token }
      })
      if (!response.ok) throw new Error('Failed to delete notes')
      setSuccessMessage('Note version deleted successfully!')
      setTimeout(() => setSuccessMessage(null), 3000)
      fetchReviewData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  const handleGenerateNotes = async () => {
    try {
      setGenerating(true)
      setError(null)
      setSuccessMessage(null)
      const token = localStorage.getItem('access_token')
      const response = await fetch('/api/courses/' + courseId + '/notes?regenerate=true', {
        headers: { 'Authorization': 'Bearer ' + token }
      })
      if (!response.ok) throw new Error('Failed to generate notes')
      setSuccessMessage('Notes generated successfully! Now you can review them.')
      setTimeout(() => setSuccessMessage(null), 3000)
      fetchReviewData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate notes')
    } finally {
      setGenerating(false)
    }
  }

  const getCurrentVersion = (): NoteVersion | null => {
    if (!reviewData?.versions || reviewData.versions.length === 0) return null
    return reviewData.versions[selectedVersion] || null
  }

  const handleApprove = async () => {
    const version = getCurrentVersion()
    if (!version) return
    try {
      setApproving(true)
      const token = localStorage.getItem('access_token')
      const response = await fetch('/api/courses/' + courseId + '/notes/approve', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + token,
          'Content-Type': 'application/json'
        }
      })
      if (!response.ok) throw new Error('Failed to approve notes')
      setSuccessMessage('Version ' + version.version + ' approved successfully!')
      setTimeout(() => setSuccessMessage(null), 3000)
      fetchReviewData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve')
    } finally {
      setApproving(false)
    }
  }

  const handleReject = async () => {
    const version = getCurrentVersion()
    if (!version) return
    try {
      setRejecting(true)
      const token = localStorage.getItem('access_token')
      const response = await fetch('/api/courses/' + courseId + '/notes/reject', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ review_notes: rejectReason })
      })
      if (!response.ok) throw new Error('Failed to reject notes')
      setShowRejectModal(false)
      setRejectReason('')
      setSuccessMessage('Version ' + version.version + ' rejected')
      setTimeout(() => setSuccessMessage(null), 3000)
      fetchReviewData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject')
    } finally {
      setRejecting(false)
    }
  }

  const handleEditModule = () => {
    const version = getCurrentVersion()
    if (!version?.modules[currentModule]) return
    setEditedContent(version.modules[currentModule].content)
    setEditingModule(true)
  }

  const handleSaveModule = async () => {
    const version = getCurrentVersion()
    if (!version) return
    try {
      setSaving(true)
      const token = localStorage.getItem('access_token')
      const response = await fetch('/api/courses/notes/' + version.id + '/module/' + currentModule, {
        method: 'PUT',
        headers: {
          'Authorization': 'Bearer ' + token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content: editedContent })
      })
      if (!response.ok) throw new Error('Failed to save module')
      setEditingModule(false)
      setSuccessMessage('Module updated successfully!')
      setTimeout(() => setSuccessMessage(null), 3000)
      fetchReviewData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const version = getCurrentVersion()

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'APPROVED': return 'bg-emerald-100 text-emerald-700'
      case 'DRAFT': return 'bg-amber-100 text-amber-700'
      case 'REJECTED': return 'bg-red-100 text-red-700'
      case 'ARCHIVED': return 'bg-slate-100 text-slate-600'
      default: return 'bg-slate-100 text-slate-600'
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/admin')}
              className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-indigo-600 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                Note Review: {reviewData?.course_name || 'Loading...'}
              </h1>
              <p className="text-sm text-slate-500">
                {reviewData?.course_code} - Review and approve notes before students see them
                {version && version.coverage_score !== null && version.coverage_score !== undefined && (
                  <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-700">
                    Coverage: {version.coverage_score}%
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          {version && (
            <div className="flex items-center gap-2">
              {/* Regenerate button - always available */}              {/* Export Prompt Button */}
              <button
                onClick={handleExportPrompt}
                disabled={exporting}
                className="inline-flex items-center px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-500 transition-colors disabled:opacity-50 shadow-md"
                title="Export prompt for Claude/ChatGPT"
              >
                 Export
              </button>

              {/* Paste Notes Button */}
              <button
                onClick={() => setShowPasteModal(true)}
                className="inline-flex items-center px-4 py-2 rounded-xl bg-purple-600 text-white text-sm font-semibold hover:bg-purple-500 transition-colors shadow-md"
                title="Paste notes from Claude/ChatGPT"
              >
                 Paste
              </button>

              {/* Generate Flashcards Button - only for APPROVED */}
              {version.status === 'APPROVED' && (
                <button
                  onClick={handleGenerateFlashcards}
                  className="inline-flex items-center px-4 py-2 rounded-xl bg-teal-600 text-white text-sm font-semibold hover:bg-teal-500 transition-colors shadow-md"
                >
                  Generate Flashcards
                </button>
              )}

              {/* Review Flashcards Button */}
              <button
                onClick={() => navigate('/admin/courses/' + courseId + '/flashcards')}
                className="inline-flex items-center px-4 py-2 rounded-xl bg-orange-600 text-white text-sm font-semibold hover:bg-orange-500 transition-colors shadow-md"
                title="Review flashcards"
              >
                Review Flashcards
              </button>

              {/* Delete Button */}
              <button
                onClick={handleDeleteNotes}
                className="inline-flex items-center px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-500 transition-colors shadow-md"
                title="Delete this note version"
              >
                ️ Delete
              </button>

              {/* Regenerate button - always available */}
              <button
                onClick={handleGenerateNotes}
                disabled={generating}
                className="inline-flex items-center px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-500 transition-colors disabled:opacity-50 shadow-md"
              >
                <RefreshCw className={`w-4 h-4 mr-1.5 ${generating ? 'animate-spin' : ''}`} />
                {generating ? 'Generating...' : 'Regenerate'}
              </button>

              {/* Reopen button for REJECTED notes */}
              {version.status === 'REJECTED' && (
                <button
                  onClick={handleReopenNotes}
                  className="inline-flex items-center px-4 py-2 rounded-xl bg-amber-600 text-white text-sm font-semibold hover:bg-amber-500 transition-colors shadow-md"
                  title="Reopen for re-approval"
                >
                   Reopen
                </button>
              )}

              {/* Approve/Reject only for DRAFT */}
              {version.status === 'DRAFT' && (
                <>
                  <button
                    onClick={() => setShowRejectModal(true)}
                    disabled={rejecting}
                    className="inline-flex items-center px-4 py-2 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-semibold hover:bg-red-100 transition-colors disabled:opacity-50"
                  >
                    <XCircle className="w-4 h-4 mr-1.5" />
                    Reject
                  </button>
                  <button
                    onClick={handleApprove}
                    disabled={approving}
                    className="inline-flex items-center px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500 transition-colors disabled:opacity-50 shadow-md"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-1.5" />
                    {approving ? 'Approving...' : 'Approve Notes'}
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Success Message */}
        {successMessage && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-sm font-medium flex items-center">
            <Check className="w-4 h-4 mr-2" />
            {successMessage}
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm font-medium flex items-center">
            <AlertCircle className="w-4 h-4 mr-2" />
            {error}
          </div>
        )}

        {/* Loading */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-12 h-12 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin"></div>
          </div>
        ) : !version ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-slate-200">
            <FileText className="w-16 h-16 mx-auto text-slate-400 mb-4" />
            <h3 className="text-lg font-bold text-slate-700">No notes generated yet</h3>
            <p className="text-sm text-slate-500 mt-2">Upload materials first, then generate notes.</p>
            <button
              onClick={handleGenerateNotes}
              disabled={generating}
              className="inline-flex items-center mt-4 px-6 py-3 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50 shadow-md"
            >
              {generating ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Generate Notes
                </>
              )}
            </button>
          </div>
        ) : (
          <>
            {/* Version Selector */}
            {reviewData && reviewData.versions.length > 0 && (
              <div className="mb-6 flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-slate-500 flex items-center">
                  <History className="w-3.5 h-3.5 mr-1" />
                  Versions:
                </span>
                {reviewData.versions.map((v, idx) => (
                  <button
                    key={v.id}
                    onClick={() => {
                      setSelectedVersion(idx)
                      setCurrentModule(0)
                      setEditingModule(false)
                    }}
                    className={'px-3 py-1.5 rounded-lg text-xs font-bold transition-all ' + (selectedVersion === idx ? 'bg-indigo-600 text-white shadow-md' : 'bg-white border border-slate-200 text-slate-600 hover:border-indigo-300')}
                  >
                    v{v.version}
                    <span className={'ml-1.5 px-1.5 py-0.5 rounded text-[10px] ' + getStatusColor(v.status)}>
                      {v.status}
                    </span>
                    {v.coverage_score !== null && v.coverage_score !== undefined && (
                      <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] bg-indigo-100 text-indigo-700">
                        {v.coverage_score}%
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              <div className="lg:col-span-1 space-y-2">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">
                  Modules ({version.total_modules})
                </h3>
                {version.modules.map((mod, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setCurrentModule(idx)
                      setEditingModule(false)
                    }}
                    className={'w-full text-left p-3 rounded-xl transition-all ' + (currentModule === idx ? 'bg-indigo-50 border border-indigo-200' : 'bg-white border border-slate-200 hover:border-slate-300')}
                  >
                    <span className="text-xs font-bold text-slate-700 block truncate">
                      {idx + 1}. {mod.title.replace(/^[#*-\s]+/, '').substring(0, 40)}
                    </span>
                  </button>
                ))}
              </div>

              <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                  <h2 className="text-sm font-bold text-slate-800 truncate">
                    {version.modules[currentModule]?.title || 'Module'}
                  </h2>
                  {!editingModule ? (
                    <button
                      onClick={handleEditModule}
                      className="inline-flex items-center px-3 py-1.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-semibold hover:bg-indigo-100 transition-colors"
                    >
                      <Edit3 className="w-3.5 h-3.5 mr-1.5" />
                      Edit Module
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setEditingModule(false)}
                        className="inline-flex items-center px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-xs font-semibold hover:bg-slate-200 transition-colors"
                      >
                        <X className="w-3.5 h-3.5 mr-1.5" />
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveModule}
                        disabled={saving}
                        className="inline-flex items-center px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-500 transition-colors disabled:opacity-50"
                      >
                        <Save className="w-3.5 h-3.5 mr-1.5" />
                        {saving ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  )}
                </div>

                <div className="p-6 min-h-[500px]">
                  {editingModule ? (
                    <textarea
                      value={editedContent}
                      onChange={(e) => setEditedContent(e.target.value)}
                      className="w-full h-[600px] p-4 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y whitespace-pre-wrap"
                    />
                  ) : (
                    <div className="prose max-w-none text-slate-800 text-sm leading-relaxed">
                      <div className="prose prose-slate max-w-none dark:prose-invert">
  <ReactMarkdown
    remarkPlugins={[remarkGfm, remarkMath]}
    rehypePlugins={[rehypeKatex]}
    components={{
      table: ({node, ...props}) => (
        <div className="overflow-x-auto my-4">
          <table className="min-w-full border-collapse border border-slate-300 dark:border-slate-700" {...props} />
        </div>
      ),
      th: ({node, ...props}) => (
        <th className="border border-slate-300 dark:border-slate-700 px-3 py-2 bg-slate-100 dark:bg-slate-800 font-semibold text-left" {...props} />
      ),
      td: ({node, ...props}) => (
        <td className="border border-slate-300 dark:border-slate-700 px-3 py-2 align-top" {...props} />
      ),
      ol: ({node, ...props}) => (
        <ol className="list-decimal ml-6 space-y-1 my-3" {...props} />
      ),
      ul: ({node, ...props}) => (
        <ul className="list-disc ml-6 space-y-1 my-3" {...props} />
      ),
      li: ({node, ...props}) => (
        <li className="pl-1 leading-relaxed" {...props} />
      ),
      h1: ({node, ...props}) => (
        <h1 className="text-2xl font-bold mt-6 mb-3 text-slate-900 dark:text-white" {...props} />
      ),
      h2: ({node, ...props}) => (
        <h2 className="text-xl font-bold mt-5 mb-2 text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700 pb-2" {...props} />
      ),
      h3: ({node, ...props}) => (
        <h3 className="text-lg font-semibold mt-4 mb-2 text-slate-900 dark:text-white" {...props} />
      ),
      p: ({node, ...props}) => (
        <p className="my-2 leading-relaxed" {...props} />
      ),
      strong: ({node, ...props}) => (
        <strong className="font-bold text-slate-900 dark:text-white" {...props} />
      ),
    }}
  >
    {version.modules[currentModule]?.content || ''}
  </ReactMarkdown>
</div>
                    </div>
                  )}
                </div>

                <div className="px-6 py-3 border-t border-slate-200 flex items-center justify-between">
                  <button
                    onClick={() => {
                      setCurrentModule(Math.max(0, currentModule - 1))
                      setEditingModule(false)
                    }}
                    disabled={currentModule === 0}
                    className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-30 transition-colors"
                  >
                    <ChevronLeft className="w-3.5 h-3.5 mr-1" />
                    Previous
                  </button>
                  <span className="text-xs font-mono text-slate-500">
                    {currentModule + 1} / {version.total_modules}
                  </span>
                  <button
                    onClick={() => {
                      setCurrentModule(Math.min(version.total_modules - 1, currentModule + 1))
                      setEditingModule(false)
                    }}
                    disabled={currentModule === version.total_modules - 1}
                    className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-30 transition-colors"
                  >
                    Next
                    <ChevronRight className="w-3.5 h-3.5 ml-1" />
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Export Prompt Modal */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full max-h-[80vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h3 className="text-lg font-bold">Export AI Prompt</h3>
              <button onClick={() => setShowExportModal(false)} className="p-1 rounded-lg hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              <p className="text-xs text-slate-500 mb-3">
                Copy this prompt to Claude/ChatGPT. Upload your course material there, then paste the generated notes back using "Paste Notes".
              </p>
              <textarea
                value={exportedPrompt}
                readOnly
                className="w-full h-96 p-3 rounded-xl bg-slate-50 border text-sm font-mono"
                onClick={(e) => (e.target as HTMLTextAreaElement).select()}
              />
            </div>
            <div className="px-6 py-4 border-t flex justify-end gap-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(exportedPrompt)
                  setSuccessMessage('Prompt copied to clipboard!')
                  setTimeout(() => setSuccessMessage(null), 2000)
                }}
                className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-500"
              >
                Copy Prompt
              </button>
              <button
                onClick={() => setShowExportModal(false)}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Paste Notes Modal */}
      {showPasteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full max-h-[80vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h3 className="text-lg font-bold">Paste Notes from Claude/ChatGPT</h3>
              <button onClick={() => setShowPasteModal(false)} className="p-1 rounded-lg hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              <p className="text-xs text-slate-500 mb-3">
                Paste the complete notes generated by Claude/ChatGPT below.
              </p>
              <textarea
                value={pastedContent}
                onChange={(e) => setPastedContent(e.target.value)}
                onPaste={() => {
                  // Let the browser paste normally - textarea preserves text
                  // No special handling needed as textarea keeps raw text
                }}
                placeholder="Paste your notes here... (Markdown formatting will be preserved)"
                className="w-full h-96 p-3 rounded-xl bg-slate-50 border text-sm font-mono focus:outline-none focus:ring-2 focus:ring-purple-500 whitespace-pre-wrap"
              />
            </div>
            <div className="px-6 py-4 border-t flex justify-end gap-2">
              <button
                onClick={() => setShowPasteModal(false)}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handlePasteNotes}
                disabled={pasting || pastedContent.length < 100}
                className="px-4 py-2 rounded-xl bg-purple-600 text-white text-sm font-semibold hover:bg-purple-500 disabled:opacity-50"
              >
                {pasting ? 'Uploading...' : 'Upload Notes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Reject Notes</h3>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Enter rejection reason..."
              className="w-full h-32 p-3 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none mb-4"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setShowRejectModal(false)}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={rejecting}
                className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-500 transition-colors disabled:opacity-50"
              >
                {rejecting ? 'Rejecting...' : 'Confirm Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
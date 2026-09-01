import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Trash2, CheckCircle2, XCircle, FileText, Upload, Download } from 'lucide-react'

interface Drill {
  id: string
  subject: string
  topic: string
  difficulty: string
  priority: string
  status: string
  source_type: string
  created_at: string | null
}

export function AdminDrillManagement() {
  const navigate = useNavigate()
  const [drills, setDrills] = useState<Drill[]>([])
  const [subjectFilter, setSubjectFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showPasteModal, setShowPasteModal] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)
  const [pastedContent, setPastedContent] = useState('')
  const [exportedPrompt, setExportedPrompt] = useState('')
  const [exportSubject, setExportSubject] = useState('cpp-programming')
  const [exportCount] = useState(10)
  const [exportDifficulty] = useState('medium')
  const [loading, setLoading] = useState(true)
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchDrills()
  }, [subjectFilter, statusFilter])

  const fetchDrills = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('access_token')
     const response = await fetch(`/api/drills/admin/list?subject=${subjectFilter}&status_filter=${statusFilter}`, {
        headers: { 'Authorization': 'Bearer ' + token }
      })
      if (!response.ok) throw new Error('Failed to load drills')
      const data = await response.json()
      setDrills(data.drills || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  const handleApproveAll = async () => {
    try {
      const token = localStorage.getItem('access_token')
      const response = await fetch('/api/drills/admin/approve-all', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token }
      })
      if (!response.ok) throw new Error('Failed to approve all')
      const data = await response.json()
      setSuccess(data.message)
      setTimeout(() => setSuccess(null), 2000)
      fetchDrills()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    }
  }

  const handleApprove = async (id: string) => {
    try {
      const token = localStorage.getItem('access_token')
      const response = await fetch(`/api/drills/admin/${id}/approve`, {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token }
      })
      if (!response.ok) throw new Error('Failed to approve')
      setSuccess('Drill approved!')
      setTimeout(() => setSuccess(null), 2000)
      fetchDrills()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    }
  }

  const handleReject = async (id: string) => {
    try {
      const token = localStorage.getItem('access_token')
      const response = await fetch(`/api/drills/admin/${id}/reject`, {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token }
      })
      if (!response.ok) throw new Error('Failed to reject')
      setSuccess('Drill rejected!')
      setTimeout(() => setSuccess(null), 2000)
      fetchDrills()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this drill?')) return
    try {
      const token = localStorage.getItem('access_token')
      const response = await fetch(`/api/drills/admin/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer ' + token }
      })
      if (!response.ok) throw new Error('Failed to delete')
      setSuccess('Drill deleted!')
      setTimeout(() => setSuccess(null), 2000)
      fetchDrills()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    }
  }

  const handlePaste = async () => {
    try {
      const drillsData = JSON.parse(pastedContent)
      const drillsArray = Array.isArray(drillsData) ? drillsData : [drillsData]
      
      const token = localStorage.getItem('access_token')
      const response = await fetch('/api/drills/admin/generate', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ drills: drillsArray })
      })
      
      if (!response.ok) throw new Error('Failed to save drills')
      const data = await response.json()
      setSuccess(data.message)
      setShowPasteModal(false)
      setPastedContent('')
      setTimeout(() => setSuccess(null), 3000)
      fetchDrills()
    } catch (err) {
      setError('Invalid JSON format. Please paste valid JSON from ChatGPT.')
    }
  }

  const handleExportPrompt = async () => {
    try {
      const token = localStorage.getItem('access_token')
      const response = await fetch('/api/drills/admin/export-prompt', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          subject: exportSubject,
          count: exportCount,
          difficulty: exportDifficulty
        })
      })
      if (!response.ok) throw new Error('Failed to export')
      const data = await response.json()
      setExportedPrompt(data.prompt)
      setShowExportModal(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'APPROVED': return 'bg-emerald-100 text-emerald-700'
      case 'DRAFT': return 'bg-amber-100 text-amber-700'
      case 'REJECTED': return 'bg-red-100 text-red-700'
      default: return 'bg-slate-100 text-slate-600'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'HIGH': return 'bg-red-100 text-red-700'
      case 'MEDIUM': return 'bg-amber-100 text-amber-700'
      case 'LOW': return 'bg-emerald-100 text-emerald-700'
      default: return 'bg-slate-100 text-slate-600'
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-8 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/admin')} className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Code Trace Drill Management</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">Manage C++, OOP, and DSA output questions</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={exportSubject}
              onChange={(e) => setExportSubject(e.target.value)}
              className="px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm"
              title="Select subject for export"
            >
              <option value="cpp-programming">C++ (Output)</option>
              <option value="oop">OOP (Java)</option>
              <option value="dsa-trace">DSA (Pseudocode)</option>
            </select>
            <button
              onClick={handleExportPrompt}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-500"
            >
              <Download className="w-4 h-4" /> Export Prompt
            </button>
            <button
              onClick={handleApproveAll}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-500"
            >
              <CheckCircle2 className="w-4 h-4" /> Approve All
            </button>
            <button
              onClick={() => setShowPasteModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-sm font-semibold rounded-xl hover:bg-purple-500"
            >
              <Upload className="w-4 h-4" /> Paste Drills
            </button>
          </div>
        </div>

        {/* Success/Error Messages */}
        {success && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-sm">{success}</div>
        )}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>
        )}

        {/* Filters */}
        <div className="flex items-center gap-3 mb-6">
          <select
            value={subjectFilter}
            onChange={(e) => setSubjectFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm"
          >
            <option value="all">All Subjects</option>
            <option value="cpp-programming">C++ Programming (Output)</option>
            <option value="oop">OOP (Java - Constructors/Inheritance)</option>
            <option value="dsa-trace">DSA (Pseudocode Tracing)</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm"
          >
            <option value="all">All Status</option>
            <option value="DRAFT">Draft</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>

        {/* Drills List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-10 h-10 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin"></div>
          </div>
        ) : drills.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center">
            <FileText className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <p className="text-sm text-slate-500">No drills found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {drills.map((drill) => (
              <div key={drill.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className={'px-2 py-0.5 rounded-full text-xs font-bold ' + getStatusColor(drill.status)}>
                        {drill.status}
                      </span>
                      <span className={'px-2 py-0.5 rounded-full text-xs font-bold ' + getPriorityColor(drill.priority)}>
                        {drill.priority}
                      </span>
                      <span className="text-xs text-slate-400">{drill.subject}</span>
                      <span className="text-xs text-slate-400">• {drill.difficulty}</span>
                    </div>
                    <p className="text-sm text-slate-800 dark:text-slate-200 font-medium">{drill.topic}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {drill.status === 'DRAFT' && (
                      <>
                        <button onClick={() => handleApprove(drill.id)} className="p-2 rounded-lg text-emerald-600 hover:bg-emerald-50" title="Approve">
                          <CheckCircle2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleReject(drill.id)} className="p-2 rounded-lg text-red-600 hover:bg-red-50" title="Reject">
                          <XCircle className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    <button onClick={() => handleDelete(drill.id)} className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50" title="Delete">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Paste Modal */}
        {showPasteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70">
            <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full max-h-[80vh] flex flex-col overflow-hidden">
              <div className="px-6 py-4 border-b flex items-center justify-between">
                <h3 className="text-lg font-bold">Paste Drills from ChatGPT</h3>
                <button onClick={() => setShowPasteModal(false)} className="p-1 rounded-lg hover:bg-slate-100"></button>
              </div>
              <div className="p-4 overflow-y-auto flex-1">
                <p className="text-xs text-slate-500 mb-3">Paste the JSON array of drills from ChatGPT.</p>
                <textarea
                  value={pastedContent}
                  onChange={(e) => setPastedContent(e.target.value)}
                  placeholder='[{"subject":"cpp-programming","topic":"...","code_snippet":"...","options":[...],"correct_option_index":0,"trace_steps":[...],"exit_exam_question":"...","distractor_explanation":"..."}]'
                  className="w-full h-80 p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border text-sm font-mono focus:outline-none"
                />
              </div>
              <div className="px-6 py-4 border-t flex justify-end gap-2">
                <button onClick={() => setShowPasteModal(false)} className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100">Cancel</button>
                <button onClick={handlePaste} className="px-4 py-2 rounded-xl bg-purple-600 text-white text-sm font-semibold hover:bg-purple-500">Save Drills</button>
              </div>
            </div>
          </div>
        )}

        {/* Export Modal */}
        {showExportModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70">
            <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full max-h-[80vh] flex flex-col overflow-hidden">
              <div className="px-6 py-4 border-b flex items-center justify-between">
                <h3 className="text-lg font-bold">Export Prompt for ChatGPT</h3>
                <button onClick={() => setShowExportModal(false)} className="p-1 rounded-lg hover:bg-slate-100"></button>
              </div>
              <div className="p-4 overflow-y-auto flex-1">
                <textarea
                  value={exportedPrompt}
                  readOnly
                  className="w-full h-80 p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border text-sm font-mono"
                  onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                />
              </div>
              <div className="px-6 py-4 border-t flex justify-end gap-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(exportedPrompt)
                    setSuccess('Prompt copied!')
                    setTimeout(() => setSuccess(null), 2000)
                  }}
                  className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-500"
                >
                  Copy Prompt
                </button>
                <button onClick={() => setShowExportModal(false)} className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100">Close</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Edit3,  Trash2 } from 'lucide-react'

const API_BASE_URL = import.meta.env.VITE_API_URL || ''

interface Flashcard {
  id: string
  front: string
  back: string
  exam_weight: string
  module_title: string | null
}

export function AdminFlashcardReview() {
  const { courseId } = useParams<{ courseId: string }>()
  const navigate = useNavigate()
  
  const [flashcards, setFlashcards] = useState<Flashcard[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editedFront, setEditedFront] = useState('')
  const [editedBack, setEditedBack] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  useEffect(() => {
    fetchFlashcards()
  }, [courseId])

  const fetchFlashcards = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('access_token')
      const response = await fetch('/api/courses/' + courseId + '/flashcards', {
        headers: { 'Authorization': 'Bearer ' + token }
      })
      if (!response.ok) throw new Error('Failed to load flashcards')
      const data = await response.json()
      setFlashcards(data.flashcards || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (card: Flashcard) => {
    setEditingId(card.id)
    setEditedFront(card.front)
    setEditedBack(card.back)
  }

  const handleSave = async (cardId: string) => {
    try {
      const token = localStorage.getItem('access_token')
      const response = await fetch('/api/courses/flashcards/' + cardId, {
        method: 'PUT',
        headers: {
          'Authorization': 'Bearer ' + token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          front: editedFront,
          back: editedBack
        })
      })
      if (!response.ok) throw new Error('Failed to save')
      setEditingId(null)
      setSuccessMessage('Flashcard updated!')
      setTimeout(() => setSuccessMessage(null), 2000)
      fetchFlashcards()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    }
  }

  const handleApproveAll = async () => {
    try {
      const token = localStorage.getItem('access_token')
      const response = await fetch('/api/courses/' + courseId + '/flashcards/approve-all', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token }
      })
      if (!response.ok) throw new Error('Failed to approve')
      const data = await response.json()
      setSuccessMessage(data.message || 'Flashcards approved!')
      setTimeout(() => setSuccessMessage(null), 3000)
      fetchFlashcards()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve')
    }
  }

  const handleDelete = async (cardId: string) => {
    if (!confirm('Delete this flashcard?')) return
    try {
      const token = localStorage.getItem('access_token')
      const response = await fetch('/api/courses/flashcards/' + cardId, {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer ' + token }
      })
      if (!response.ok) throw new Error('Failed to delete')
      setSuccessMessage('Flashcard deleted!')
      setTimeout(() => setSuccessMessage(null), 2000)
      fetchFlashcards()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  const getWeightColor = (weight: string) => {
    switch (weight) {
      case 'HIGH': return 'bg-red-100 text-red-700'
      case 'MEDIUM': return 'bg-amber-100 text-amber-700'
      case 'LOW': return 'bg-emerald-100 text-emerald-700'
      default: return 'bg-slate-100 text-slate-600'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Flashcard Review</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">{flashcards.length} flashcards</p>
            </div>
          </div>
          <button
            onClick={handleApproveAll}
            className="inline-flex items-center px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500 transition-colors shadow-md"
          >
             Approve All
          </button>
        </div>

        {successMessage && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-sm">
            {successMessage}
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Flashcards List */}
        <div className="space-y-3">
          {flashcards.map((card) => (
            <div key={card.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
              {editingId === card.id ? (
                <div className="space-y-3">
                  <input
                    value={editedFront}
                    onChange={(e) => setEditedFront(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                    placeholder="Front (Question)"
                  />
                  <textarea
                    value={editedBack}
                    onChange={(e) => setEditedBack(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                    rows={2}
                    placeholder="Back (Answer)"
                  />
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setEditingId(null)} className="px-3 py-1.5 rounded-lg text-sm text-slate-600 hover:bg-slate-100">
                      Cancel
                    </button>
                    <button onClick={() => handleSave(card.id)} className="px-3 py-1.5 rounded-lg text-sm bg-emerald-600 text-white hover:bg-emerald-500">
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={'px-2 py-0.5 rounded-full text-xs font-bold ' + getWeightColor(card.exam_weight)}>
                          {card.exam_weight}
                        </span>
                        {card.module_title && (
                          <span className="text-xs text-slate-400">{card.module_title}</span>
                        )}
                      </div>
                      <p className="font-bold text-slate-900 dark:text-white">{card.front}</p>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{card.back}</p>
                    </div>
                    <div className="flex items-center gap-1 ml-4">
                      <button onClick={() => handleEdit(card)} className="p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50">
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(card.id)} className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {flashcards.length === 0 && (
          <div className="text-center py-20">
            <p className="text-slate-500">No flashcards yet. Generate them from the Review Notes page.</p>
          </div>
        )}
      </div>
    </div>
  )
}

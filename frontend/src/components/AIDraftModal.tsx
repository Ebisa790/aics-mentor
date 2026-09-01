import { useState, KeyboardEvent } from 'react'
import axios from 'axios'
import { adminApi } from '../api'
import type { AIGenerateResponse, ExamDifficulty, MaterialContentType } from '../api/types'

interface AIDraftModalProps {
  courseId: string
  type: 'note' | 'question'
  onClose: () => void
  onApply: (result: AIGenerateResponse, topic: string) => void
}

export function AIDraftModal({ courseId, type, onClose, onApply }: AIDraftModalProps) {
  const [topic, setTopic] = useState('')
  const [difficulty, setDifficulty] = useState<ExamDifficulty>('medium')
  const [materialType, setMaterialType] = useState<MaterialContentType>('note')
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleGenerate = async () => {
    if (!topic.trim() || isGenerating) return
    setIsGenerating(true)
    setError(null)
    try {
      // Updated to match the unwrapped return value from src/api/index.ts
      const result = await adminApi.generateAICourseContent({
        course_id: courseId,
        type,
        topic: topic.trim(),
        difficulty,
        material_type: materialType,
      })
      onApply(result, topic.trim())
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data?.detail) {
        setError(err.response.data.detail)
      } else {
        setError('Could not generate content. Please try again.')
      }
    } finally {
      setIsGenerating(false)
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleGenerate()
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="card p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-display font-semibold text-lg mb-1">
           Generate {type === 'note' ? 'a study note' : 'an MCQ'} with AI
        </h2>
        <p className="text-sm text-ink/50 mb-4">
          Give a topic — you'll be able to review and edit the draft before saving it.
        </p>

        {error && <div className="text-sm text-danger bg-danger/10 rounded-lg px-3 py-2 mb-3">{error}</div>}

        <label className="label">Topic</label>
        <input
          className="input mb-3"
          placeholder={type === 'note' ? 'e.g. Pointers in C++' : 'e.g. Deadlock prevention'}
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
        />

        {type === 'note' ? (
          <>
            <label className="label">Content type</label>
            <select
              className="input mb-4"
              value={materialType}
              onChange={(e) => setMaterialType(e.target.value as MaterialContentType)}
            >
              <option value="note">Note</option>
              <option value="summary">Summary</option>
              <option value="slide_deck">Slide deck</option>
            </select>
          </>
        ) : (
          <>
            <label className="label">Difficulty</label>
            <select
              className="input mb-4"
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as ExamDifficulty)}
            >
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </>
        )}

        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn-primary" onClick={handleGenerate} disabled={isGenerating || !topic.trim()}>
            {isGenerating ? 'Generating…' : 'Generate'}
          </button>
        </div>
      </div>
    </div>
  )
}
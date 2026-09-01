import { useState, useRef, type FormEvent, type DragEvent } from 'react'
import { Upload, FileText, X, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { apiClient } from '../api/client'

export interface CourseOut {
  id: string
  name: string
  code: string
  category?: string
  question_count?: number
}

interface CourseMaterialUploadProps {
  courses: CourseOut[]
  initialCourseId?: string
  onSuccess?: () => void
}

export function CourseMaterialUpload({ courses, initialCourseId = '', onSuccess }: CourseMaterialUploadProps) {
  const [selectedCourseId, setSelectedCourseId] = useState<string>(initialCourseId)
  const [file, setFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState<boolean>(false)
  const [loading, setLoading] = useState<boolean>(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (selectedFile: File | null) => {
    if (!selectedFile) return

    const allowedExtensions = ['pdf', 'txt', 'md']
    const ext = selectedFile.name.split('.').pop()?.toLowerCase()
    
    if (!ext || !allowedExtensions.includes(ext)) {
      setError('Invalid file type. Please upload a .pdf, .txt, or .md document.')
      setFile(null)
      return
    }

    setError(null)
    setStatusMessage(null)
    setFile(selectedFile)
  }

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0])
    }
  }

  const clearFile = () => {
    setFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    if (!selectedCourseId) {
      setError('Please select a target course.')
      return
    }

    if (!file) {
      setError('Please select or drop a file to upload.')
      return
    }

    setLoading(true)
    setError(null)
    setStatusMessage(null)

    const formData = new FormData()
    formData.append('file', file)

    try {
  const response = await apiClient.post<{ message: string; material_id: string }>(
    `/api/courses/${selectedCourseId}/materials`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  )

  setStatusMessage(response.data.message || 'Material uploaded and processed successfully!')
  clearFile()

  if (onSuccess) onSuccess()
} catch (err: any) {
      const detail = err.response?.data?.detail
      if (typeof detail === 'string') {
        setError(detail)
      } else if (Array.isArray(detail) && detail[0]?.msg) {
        setError(detail[0].msg)
      } else {
        setError('Failed to upload material. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm space-y-5">
      <div>
        <h2 className="font-semibold text-base text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Upload className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          Upload Course Source Material
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Upload course materials (.pdf, .txt, .md). The extracted content will automatically train the AI study note generator and update cached notes.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Course Dropdown Selector */}
        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            Target Course
          </label>
          <select
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
            value={selectedCourseId}
            onChange={(e) => setSelectedCourseId(e.target.value)}
            required
          >
            <option value="">-- Select Course --</option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.code ? `[${course.code}] ` : ''}{course.name}
              </option>
            ))}
          </select>
        </div>

        {/* Interactive Drag & Drop Area */}
        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            Material Document
          </label>
          
          <input
            ref={fileInputRef}
            id="material-file-input"
            type="file"
            accept=".pdf,.txt,.md"
            onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
            className="hidden"
          />

          {!file ? (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                isDragging
                  ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30'
                  : 'border-slate-300 dark:border-slate-700 hover:border-indigo-400 bg-slate-50/50 dark:bg-slate-800/40'
              }`}
            >
              <FileText className="w-8 h-8 mx-auto text-slate-400 dark:text-slate-500 mb-2" />
              <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Click to browse or drag and drop file here
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                Supports PDF, TXT, or Markdown (.pdf, .txt, .md)
              </p>
            </div>
          ) : (
            <div className="flex items-center justify-between p-3.5 rounded-xl border border-indigo-200 dark:border-indigo-800/60 bg-indigo-50/50 dark:bg-indigo-950/20">
              <div className="flex items-center space-x-3 truncate">
                <div className="p-2 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg text-indigo-600 dark:text-indigo-300">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="truncate">
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                    {file.name}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={clearFile}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition-colors"
                title="Remove file"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Status Messages */}
        {statusMessage && (
          <div className="flex items-start gap-2 text-xs text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300 p-3 rounded-xl border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
            <span>{statusMessage}</span>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 text-xs text-rose-700 bg-rose-50 dark:bg-rose-950/40 dark:text-rose-300 p-3 rounded-xl border border-rose-200 dark:border-rose-800">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm shadow-indigo-500/20 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Uploading & Processing Text...</span>
            </>
          ) : (
            <>
              <Upload className="w-4 h-4" />
              <span>Upload Course Material</span>
            </>
          )}
        </button>
      </form>
    </div>
  )
}
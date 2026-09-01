import { useEffect, useState, type FormEvent } from 'react'
import { materialApi } from '../api'
import type { Material } from '../api/types'

export function MaterialsPage() {
  const [materials, setMaterials] = useState<Material[]>([])
  const [title, setTitle] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [fileInputKey, setFileInputKey] = useState(0)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    try {
      const res: any = await materialApi.list()
      const data = res?.data !== undefined ? res.data : res
      setMaterials(Array.isArray(data) ? data : data?.materials ?? [])
    } catch {
      setError('Failed to load materials.')
    }
  }

  useEffect(() => {
    load()
  }, [])

  const handleUpload = async (e: FormEvent) => {
    e.preventDefault()
    if (!file || !title.trim()) return
    setIsUploading(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('title', title)
      formData.append('file', file)
      await materialApi.upload(formData)
      setTitle('')
      setFile(null)
      setFileInputKey((prev) => prev + 1) // Reset file input element
      await load()
    } catch {
      setError('Upload failed. Allowed types: PDF, DOCX, TXT (max 20MB).')
    } finally {
      setIsUploading(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await materialApi.delete(id)
      await load()
    } catch {
      setError('Failed to delete material.')
    }
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="font-display text-2xl font-semibold">My Notes</h1>
        <p className="text-ink/60 mt-1">Upload your own notes and PDFs alongside official course materials.</p>
      </div>

      <form onSubmit={handleUpload} className="card p-4 space-y-3">
        {error && <div className="text-sm text-danger bg-danger/10 rounded-lg px-3 py-2">{error}</div>}
        <div>
          <label className="label">Title</label>
          <input
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. OS Chapter 4 notes"
          />
        </div>
        <div>
          <label className="label">File (PDF, DOCX, or TXT)</label>
          <input
            key={fileInputKey}
            type="file"
            accept=".pdf,.docx,.txt"
            className="text-sm"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>
        <button type="submit" disabled={isUploading || !file || !title.trim()} className="btn-primary">
          {isUploading ? 'Uploading…' : 'Upload'}
        </button>
      </form>

      <div className="space-y-2">
        {materials.length === 0 ? (
          <div className="card p-4 text-sm text-ink/50">No materials uploaded yet.</div>
        ) : (
          materials.map((m) => (
            <div key={m.id} className="card p-3 flex items-center justify-between">
              <div>
                <div className="font-medium text-sm">{m.title}</div>
                <div className="text-xs text-ink/50">
                  {m.file_type?.toUpperCase()} · {m.source === 'admin_official' ? 'Official' : 'Personal'}
                </div>
              </div>
              <button onClick={() => handleDelete(m.id)} className="text-xs text-danger hover:underline">
                Delete
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
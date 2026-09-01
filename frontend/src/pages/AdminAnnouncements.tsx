import { useState, useEffect, type FormEvent } from 'react'
import { announcementApi } from '../api'
import type { Announcement, AnnouncementType } from '../api/types'

const ANNOUNCEMENT_TYPES: { value: AnnouncementType; label: string }[] = [
  { value: 'platform_news', label: 'Platform News' },
  { value: 'exam_notice', label: 'Exam Notice' },
  { value: 'moe_update', label: 'MoE Update' },
]

export function AdminAnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [announcementType, setAnnouncementType] = useState<AnnouncementType>('platform_news')
  const [isPinned, setIsPinned] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  useEffect(() => { loadAnnouncements() }, [])

  const loadAnnouncements = async () => {
    try {
      const res = await announcementApi.list()
      const data = Array.isArray(res) ? res : (res as any)?.data || []
      setAnnouncements(data)
    } catch (err) { console.error(err) }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setStatus(null)
    try {
      await announcementApi.create({ title, content, announcement_type: announcementType, is_pinned: isPinned })
      setTitle(''); setContent(''); setAnnouncementType('platform_news'); setIsPinned(false)
      setStatus('Announcement published!')
      await loadAnnouncements()
    } catch { setStatus('Failed to publish.') } finally { setIsSubmitting(false) }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete?')) return
    await announcementApi.delete(id)
    await loadAnnouncements()
  }

  return (
    <div className="space-y-8">
      <div><h1 className="text-2xl font-bold">Announcements</h1><p className="text-slate-500">Broadcast messages to students</p></div>
      {status && <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-sm">{status}</div>}
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border p-6 space-y-4">
        <h2 className="font-bold">Create Announcement</h2>
        <input type="text" placeholder="Title" required value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-4 py-2 border rounded-xl" />
        <textarea rows={4} placeholder="Content..." required value={content} onChange={(e) => setContent(e.target.value)} className="w-full px-4 py-2 border rounded-xl" />
        <div className="flex gap-4">
          <select value={announcementType} onChange={(e) => setAnnouncementType(e.target.value as AnnouncementType)} className="px-3 py-2 border rounded-xl">
            {ANNOUNCEMENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={isPinned} onChange={(e) => setIsPinned(e.target.checked)} /> Pin</label>
        </div>
        <button type="submit" disabled={isSubmitting} className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl">{isSubmitting ? 'Publishing...' : 'Publish'}</button>
      </form>
      <div className="space-y-3">
        <h2 className="font-bold">Published</h2>
        {announcements.length === 0 ? <p className="text-slate-500">No announcements.</p> : announcements.map((a) => (
          <div key={a.id} className="bg-white rounded-2xl border p-5">
            <div className="flex justify-between"><h3 className="font-bold">{a.is_pinned && '?? '}{a.title}</h3><button onClick={() => handleDelete(a.id)} className="text-red-600 text-xs">Delete</button></div>
            <p className="text-sm text-slate-600 mt-2">{a.content}</p>
            <div className="mt-3 flex gap-3"><span className="text-xs bg-slate-100 px-2 py-0.5 rounded">{a.announcement_type}</span><span className="text-xs text-slate-400">{new Date(a.created_at).toLocaleDateString()}</span></div>
          </div>
        ))}
      </div>
    </div>
  )
}

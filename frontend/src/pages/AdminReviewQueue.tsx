import { useState } from 'react'
import { GlobalReviewQueue } from '../components/GlobalReviewQueue'

export function AdminReviewQueuePage() {
  const [refreshKey, setRefreshKey] = useState(0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Review Queue</h1>
          <p className="text-slate-500 mt-1">Review, approve, and manage AI-generated questions</p>
        </div>
        <button
          onClick={() => setRefreshKey(prev => prev + 1)}
          className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700"
        >
          ?? Refresh Queue
        </button>
      </div>
      <GlobalReviewQueue key={refreshKey} />
    </div>
  )
}

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { courseApi } from '../api'
import type { Course } from '../api/types'

export function AdminCoursesPage() {
  const [courses, setCourses] = useState<(Course & { question_count?: number })[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    loadCourses()
  }, [])

  const loadCourses = async () => {
    setIsLoading(true)
    try {
      const res = await courseApi.list()
      const data = Array.isArray(res) ? res : (res as any)?.data || []
      setCourses(data)
    } catch (err) {
      console.error('Failed to load courses:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const filteredCourses = courses.filter((c) => {
    const query = searchQuery.toLowerCase()
    return !query || c.name.toLowerCase().includes(query) || (c.code && c.code.toLowerCase().includes(query))
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Content Management</h1>
        <p className="text-slate-500 mt-1">Manage courses, questions, and study materials</p>
      </div>

      <div className="flex items-center justify-between gap-4">
        <input
          type="text"
          placeholder="Search courses by name or code..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full max-w-md px-4 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-indigo-500"
        />
        <span className="text-xs text-slate-500 font-semibold">{courses.length} Courses</span>
      </div>

      {isLoading ? (
        <div className="py-10 text-center text-slate-500">Loading courses...</div>
      ) : filteredCourses.length === 0 ? (
        <div className="py-10 text-center text-slate-500">No courses found.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCourses.map((course) => (
            <Link key={course.id} to={`/admin/courses/${course.id}`}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:border-indigo-400 hover:shadow-md transition-all">
              <div className="flex items-center justify-between mb-3">
                {course.code && <span className="text-xs font-mono font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{course.code}</span>}
                {course.ects_credits && <span className="text-xs text-slate-400">{course.ects_credits} ECTS</span>}
              </div>
              <h3 className="font-bold text-slate-900">{course.name}</h3>
              <p className="text-xs text-slate-500 mt-1 line-clamp-2">{course.description || 'No description'}</p>
              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs text-slate-400">{course.category}</span>
                <span className="text-xs font-semibold text-indigo-600">Manage ?</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

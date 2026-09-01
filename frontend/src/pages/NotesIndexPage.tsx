import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  BookOpen, 
  FileText, 
  ChevronRight, 
  Search,
  Clock,
  BarChart3,
  ArrowRight,
  GraduationCap
} from 'lucide-react'
import { apiClient } from '../api/client'

interface CourseWithNotes {
  id: string
  name: string
  code: string
  has_notes: boolean
  notes_count?: number
  description?: string
}

export function NotesIndexPage() {
  const navigate = useNavigate()
  const [courses, setCourses] = useState<CourseWithNotes[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchCourses()
  }, [])

  const fetchCourses = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await apiClient.get('/api/courses')
      const coursesData = Array.isArray(response.data) 
        ? response.data 
        : response.data?.data || []
      
      setCourses(coursesData)
    } catch (err) {
      console.error('Failed to fetch courses:', err)
      setError('Could not load courses. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const filteredCourses = courses.filter(course =>
    course.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    course.code?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-8 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header Section */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-700 text-white shadow-xl shadow-indigo-600/20">
          <div className="pointer-events-none absolute right-0 top-0 h-64 w-64 opacity-10">
            <GraduationCap className="h-full w-full" />
          </div>
          
          <div className="relative z-10 p-8 md:p-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-indigo-100">
              <FileText className="h-3.5 w-3.5" />
              Study Materials
            </div>
            
            <h1 className="mt-4 text-3xl md:text-4xl font-bold tracking-tight">
              Course Notes
            </h1>
            
            <p className="mt-3 max-w-2xl text-sm md:text-base text-indigo-100 leading-relaxed">
              Access comprehensive study notes for all 16 Computer Science courses.
              Select a course to start studying.
            </p>
            
            {/* Stats */}
            <div className="mt-6 flex flex-wrap gap-4">
              <div className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 backdrop-blur-sm">
                <BookOpen className="h-4 w-4 text-indigo-200" />
                <span className="text-sm font-semibold">{courses.length} Courses</span>
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 backdrop-blur-sm">
                <FileText className="h-4 w-4 text-indigo-200" />
                <span className="text-sm font-semibold">Study Notes</span>
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 backdrop-blur-sm">
                <Clock className="h-4 w-4 text-indigo-200" />
                <span className="text-sm font-semibold">Updated Regularly</span>
              </div>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by course name or code (e.g., Database, CoSc2041)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-14 pl-12 pr-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all shadow-sm"
          />
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-12 h-12 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin"></div>
            <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">Loading courses...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-2xl p-8 text-center">
            <p className="text-red-700 dark:text-red-300">{error}</p>
            <button 
              onClick={fetchCourses}
              className="mt-4 px-5 py-2.5 bg-red-600 text-white text-sm font-semibold rounded-xl hover:bg-red-700 transition"
            >
              Retry
            </button>
          </div>
        ) : filteredCourses.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-16 text-center">
            <div className="w-20 h-20 mx-auto bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-5">
              <BookOpen className="w-10 h-10 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              {searchTerm ? 'No courses found' : 'No courses available'}
            </h3>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              {searchTerm 
                ? 'Try searching with a different term' 
                : 'Courses will appear here once they are added'}
            </p>
          </div>
        ) : (
          <>
            {/* Results Count */}
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {filteredCourses.length} {filteredCourses.length === 1 ? 'course' : 'courses'} available
              </p>
            </div>

            {/* Course Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredCourses.map((course, index) => (
                <button
                  key={course.id}
                  onClick={() => navigate(`/courses/${course.id}/notes`)}
                  className="group relative bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 text-left hover:border-indigo-400 dark:hover:border-indigo-700 hover:shadow-xl hover:shadow-indigo-500/5 transition-all duration-300"
                >
                  {/* Hover gradient border effect */}
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-indigo-500/0 via-indigo-500/0 to-purple-500/0 group-hover:from-indigo-500/5 group-hover:via-indigo-500/5 group-hover:to-purple-500/5 transition-all pointer-events-none" />
                  
                  <div className="relative z-10">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-4">
                        {/* Icon with gradient */}
                        <div className="relative">
                          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/50 dark:to-purple-950/50 border border-indigo-100 dark:border-indigo-800 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <FileText className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                          </div>
                          {/* Index badge */}
                          <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center">
                            {index + 1}
                          </span>
                        </div>
                        
                        <div>
                          <h3 className="font-semibold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors text-base">
                            {course.name}
                          </h3>
                          {course.code && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono">
                              {course.code}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      <ChevronRight className="w-5 h-5 text-slate-300 dark:text-slate-600 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" />
                    </div>
                    
                    {/* Bottom info */}
                    <div className="mt-4 flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-4">
                      <span className="inline-flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-indigo-500" />
                        Study Notes
                      </span>
                      <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
                      <span className="inline-flex items-center gap-1.5">
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-500 transition-colors" />
                        View Notes
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        {/* Help Section */}
        {!loading && !error && filteredCourses.length > 0 && (
          <div className="bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-800 rounded-2xl p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
              <BarChart3 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-indigo-900 dark:text-indigo-300">
                Study Tip
              </h3>
              <p className="text-xs text-indigo-700 dark:text-indigo-400 mt-1 leading-relaxed">
                Focus on one course at a time. Review notes regularly and practice with quizzes to strengthen your understanding.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default NotesIndexPage
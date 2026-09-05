import {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from 'react'

import { useParams, useNavigate } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import UpgradeModal from '../components/UpgradeModal'

import {
  ArrowLeft,
  BookOpen,
  Copy,
  Check,
  AlertCircle,
  X,
  Printer,
  ChevronLeft,
  ChevronRight,
  BookmarkCheck,
  Bookmark,
  Palette,
  Maximize2,
  Lock,
  Crown,
  FileText,
  Search,
  Sparkles,
  Minus,
  Plus,
  Sun,
  Moon,
  LayoutGrid,
  Type,
  Clock3,
  Keyboard,
  Command,
  Target,
} from 'lucide-react'

import { useAuth } from '../context/AuthContext'

const API_BASE_URL = import.meta.env.VITE_API_URL || ''

interface CourseModule {
  title: string
  content: string
  is_preview?: boolean
  preview_percentage?: number
}

interface CourseNotes {
  id: string
  course_id: string
  modules: CourseModule[]
  source_type: string
  created_at: string
  is_premium_user?: boolean
  total_modules?: number
}

export function CourseNotesPage() {
  const { courseId } = useParams<{ courseId: string }>()
  const navigate = useNavigate()
  const { isPremium, isAdmin } = useAuth()

  const [notes, setNotes] = useState<CourseNotes | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [generating, setGenerating] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  const [copied, setCopied] = useState<boolean>(false)
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState<boolean>(false)

  const [paperTheme, setPaperTheme] = useState<'white' | 'warm'>('warm')
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false)
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() =>
    document.documentElement.classList.contains('dark')
  )

  const [currentPage, setCurrentPage] = useState<number>(0)
  const [isTOCModalOpen, setIsTOCModalOpen] = useState<boolean>(false)

  const [scrollProgress, setScrollProgress] = useState<number>(0)
  const [fontSize, setFontSize] = useState<'small' | 'medium' | 'large'>('medium')

  const [readModules, setReadModules] = useState<Set<number>>(new Set())
  const [bookmarkedModules, setBookmarkedModules] = useState<Set<number>>(new Set())

  const [showSearch, setShowSearch] = useState<boolean>(false)
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [searchResults, setSearchResults] = useState<number[]>([])

  const [selectedText, setSelectedText] = useState<string>('')
  const [showAskAI, setShowAskAI] = useState<boolean>(false)
  const [aiQuestion, setAiQuestion] = useState<string>('')
  const [aiAnswer, setAiAnswer] = useState<string>('')
  const [aiLoading, setAiLoading] = useState<boolean>(false)


  const [showCompletionToast, setShowCompletionToast] = useState<boolean>(false)
  const [pageTransition, setPageTransition] = useState<boolean>(false)
  const [readingFont, setReadingFont] = useState<'sans' | 'serif' | 'mono'>('sans')
  const [showCommandPalette, setShowCommandPalette] = useState<boolean>(false)
  const [commandQuery, setCommandQuery] = useState<string>('')

  const contentContainerRef = useRef<HTMLDivElement>(null)
  const fullscreenContainerRef = useRef<HTMLDivElement>(null)

  const pages = useMemo(() => {
    if (!notes?.modules || notes.modules.length === 0) return []
    return notes.modules.map((module) => module.content)
  }, [notes?.modules])

  const tableOfContents = useMemo(() => {
    if (!notes?.modules) return []
    return notes.modules.map((module, index) => {
      const cleanTitle = module.title.replace(/^[#*\-\s]+/, '').trim()
      return {
        index,
        title: cleanTitle.length > 60 ? `${cleanTitle.substring(0, 57)}...` : cleanTitle || `Module ${index + 1}`,
      }
    })
  }, [notes?.modules])

  const progressPercentage = useMemo(() => {
    if (!pages.length) return 0
    return Math.round((readModules.size / pages.length) * 100)
  }, [pages.length, readModules.size])

  const timeRemaining = useMemo(() => {
    return (pages.length - readModules.size) * 10
  }, [pages.length, readModules.size])

  const circumference = 2 * Math.PI * 35
  const progressOffset = circumference - (progressPercentage / 100) * circumference

  const readingFontClass =
    readingFont === 'serif' ? 'font-serif' : readingFont === 'mono' ? 'font-mono' : 'font-sans'

  const fetchNotes = useCallback(
    async (forceRegenerate = false) => {
      try {
        if (forceRegenerate) setGenerating(true)
        else setLoading(true)
        setError(null)
        const token = localStorage.getItem('access_token')
        const endpoint = forceRegenerate
       ? `${API_BASE_URL}/api/courses/${courseId}/notes?regenerate=true`
       : `${API_BASE_URL}/api/courses/${courseId}/notes`
        const response = await fetch(endpoint, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!response.ok) throw new Error('Failed to load course study notes. Please try again.')
        const data: CourseNotes = await response.json()
        setNotes(data)
        setCurrentPage(0)
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'An unexpected error occurred.'
        setError(message)
      } finally {
        setLoading(false)
        setGenerating(false)
      }
    },
    [courseId]
  )

  useEffect(() => {
    if (courseId) fetchNotes()
  }, [courseId, fetchNotes])

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDarkMode(document.documentElement.classList.contains('dark'))
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setShowCommandPalette(true)
      }
      if (e.key === 'Escape') {
        setShowCommandPalette(false)
        setShowAskAI(false)
      }
      if (e.key === 'ArrowLeft' && !showAskAI && !showCommandPalette) {
        handlePageChange(currentPage - 1)
      }
      if (e.key === 'ArrowRight' && !showAskAI && !showCommandPalette) {
        handlePageChange(currentPage + 1)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentPage, pages.length, showAskAI, showCommandPalette])

  const handleTextSelection = () => {
    if (!isPremium) {
      setIsUpgradeModalOpen(true)
      return
    }
    const selection = window.getSelection()
    if (!selection) return
    const text = selection.toString().trim()
    if (text.length > 0) {
      setSelectedText(text)
      setShowAskAI(true)
      setAiAnswer('')
    }
  }

  const cleanAIAnswer = (answer: string) => {
    let cleanAnswer = answer || ''
    cleanAnswer = cleanAnswer.replace(/<think>[\s\S]*?<\/think>/gi, '')
    cleanAnswer = cleanAnswer.replace(/<\/?think>/gi, '')
    cleanAnswer = cleanAnswer.replace(/^#{1,6}\s+/gm, '')
    cleanAnswer = cleanAnswer.replace(/^\s*[-*]\s+/gm, '• ')
    return cleanAnswer.trim()
  }

  const handleAskAI = async () => {
    if (!aiQuestion.trim() || !selectedText) return
    try {
      setAiLoading(true)
      
      setAiAnswer('')
      const token = localStorage.getItem('access_token')
      const response = await fetch(`${API_BASE_URL}/api/courses/${courseId}/notes/ask`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: aiQuestion,
          selected_text: selectedText,
          page_content: pages[currentPage] || '',
        }),
      })
      if (!response.ok) throw new Error('Failed to get AI answer.')
      const data = await response.json()
      setAiAnswer(cleanAIAnswer(data.answer))
    } catch (err) {
      
    } finally {
      setAiLoading(false)
    }
  }

  const toggleFullscreenMode = () => {
    if (!isFullscreen) {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {})
      }
      setIsFullscreen(true)
    } else {
      if (document.exitFullscreen && document.fullscreenElement) {
        document.exitFullscreen().catch(() => {})
      }
      setIsFullscreen(false)
    }
  }

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement))
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  useEffect(() => {
    const handleScroll = () => {
      if (isFullscreen && fullscreenContainerRef.current) {
        const container = fullscreenContainerRef.current
        const totalScroll = container.scrollHeight - container.clientHeight
        if (totalScroll > 0) {
          const progress = (container.scrollTop / totalScroll) * 100
          setScrollProgress(Math.min(100, Math.max(0, progress)))
        }
        return
      }
      const documentHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight
      if (documentHeight > 0) {
        const progress = (window.scrollY / documentHeight) * 100
        setScrollProgress(Math.min(100, Math.max(0, progress)))
      }
    }
    if (isFullscreen) {
      const container = fullscreenContainerRef.current
      if (container) {
        container.addEventListener('scroll', handleScroll)
      }
      return () => {
        if (container) {
          container.removeEventListener('scroll', handleScroll)
        }
      }
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [isFullscreen])

  const handlePageChange = (newPage: number) => {
    if (newPage < 0 || newPage >= pages.length) return
    setPageTransition(true)
    setTimeout(() => {
      setCurrentPage(newPage)
      setIsTOCModalOpen(false)
      setShowCommandPalette(false)
      setReadModules((previous) => {
        const updated = new Set(previous)
        updated.add(newPage)
        return updated
      })
      setPageTransition(false)
      if (isFullscreen && fullscreenContainerRef.current) {
        fullscreenContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' })
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }
    }, 150)
  }

  const handleCopy = async () => {
    if (!notes?.modules) return
    try {
      const fullText = notes.modules.map((module) => module.content).join('\n\n---\n\n')
      await navigator.clipboard.writeText(fullText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  const handleSearch = (query: string) => {
    setSearchQuery(query)
    if (!query.trim() || !pages.length) {
      setSearchResults([])
      return
    }
    const results: number[] = []
    const searchLower = query.toLowerCase()
    pages.forEach((content, index) => {
      if (content.toLowerCase().includes(searchLower)) {
        results.push(index)
      }
    })
    setSearchResults(results)
  }

  const toggleBookmark = (moduleIndex: number) => {
    setBookmarkedModules((previous) => {
      const updated = new Set(previous)
      if (updated.has(moduleIndex)) updated.delete(moduleIndex)
      else updated.add(moduleIndex)
      return updated
    })
  }

  const handlePrint = () => {
    if (!isPremium) {
      setIsUpgradeModalOpen(true)
      return
    }
    window.print()
  }

  const increaseFontSize = () => {
    setFontSize((current) => {
      if (current === 'small') return 'medium'
      if (current === 'medium') return 'large'
      return 'large'
    })
  }

  const decreaseFontSize = () => {
    setFontSize((current) => {
      if (current === 'large') return 'medium'
      if (current === 'medium') return 'small'
      return 'small'
    })
  }



  const markCurrentModuleRead = () => {
    setReadModules((previous) => {
      const updated = new Set(previous)
      updated.add(currentPage)
      return updated
    })
    setShowCompletionToast(true)
    setTimeout(() => setShowCompletionToast(false), 2000)
  }

  const bodyTextSize =
    fontSize === 'small' ? 'text-[15px]' : fontSize === 'large' ? 'text-[19px]' : 'text-[17px]'

  const readingBackground =
    paperTheme === 'warm' ? 'bg-[#FBF8F1] dark:bg-slate-900' : 'bg-white dark:bg-slate-900'

  const markdownComponents = {
    table: ({ node, ...props }: any) => (
      <div className={`overflow-x-auto my-7 rounded-2xl border shadow-sm ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
        <table className="min-w-full border-collapse" {...props} />
      </div>
    ),
    th: ({ node, ...props }: any) => (
      <th className={`border-b px-4 py-3 font-bold text-left text-sm ${isDarkMode ? 'border-slate-700 bg-slate-800 text-slate-200' : 'border-slate-200 bg-slate-100 text-slate-900'}`} {...props} />
    ),
    td: ({ node, ...props }: any) => (
      <td className={`border-b px-4 py-3 align-top text-sm ${isDarkMode ? 'border-slate-800 text-slate-300' : 'border-slate-100 text-slate-700'}`} {...props} />
    ),
    h1: ({ node, ...props }: any) => (
      <h1 className={`text-2xl sm:text-3xl font-black tracking-tight mt-10 mb-5 ${isDarkMode ? 'text-white' : 'text-slate-900'}`} {...props} />
    ),
    h2: ({ node, ...props }: any) => (
      <h2 className={`text-xl sm:text-2xl font-extrabold tracking-tight mt-9 mb-4 ${isDarkMode ? 'text-white' : 'text-slate-900'}`} {...props} />
    ),
    h3: ({ node, ...props }: any) => (
      <h3 className={`text-lg sm:text-xl font-bold mt-7 mb-3 ${isDarkMode ? 'text-white' : 'text-slate-900'}`} {...props} />
    ),
    p: ({ node, ...props }: any) => (
      <p className={`leading-[1.85] mb-5 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`} {...props} />
    ),
    ul: ({ node, ...props }: any) => (
      <ul className={`list-disc ml-6 space-y-2 my-5 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`} {...props} />
    ),
    ol: ({ node, ...props }: any) => (
      <ol className={`list-decimal ml-6 space-y-2 my-5 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`} {...props} />
    ),
    blockquote: ({ node, ...props }: any) => (
      <blockquote className={`border-l-4 rounded-r-2xl px-5 py-4 not-italic my-6 ${isDarkMode ? 'border-indigo-500 bg-indigo-950/30 text-slate-300' : 'border-indigo-500 bg-indigo-50 text-slate-700'}`} {...props} />
    ),
    code: ({ node, className, children, ...props }: any) => (
      <code className={`rounded-md px-1.5 py-0.5 text-[0.9em] font-mono ${isDarkMode ? 'bg-slate-800 text-emerald-300 border border-slate-700' : 'bg-slate-100 text-slate-800 border border-slate-200'}`} {...props}>{children}</code>
    ),
    pre: ({ node, children, ...props }: any) => (
      <pre className={`my-5 rounded-xl overflow-x-auto p-4 ${isDarkMode ? 'bg-slate-950 border border-slate-700' : 'bg-slate-900 border border-slate-700'}`} {...props}>{children}</pre>
    ),
  }

  if (isFullscreen) {
    return (
      <div ref={fullscreenContainerRef} className={`fixed inset-0 z-[100] overflow-y-auto transition-colors ${isDarkMode ? 'bg-slate-950 text-slate-100' : paperTheme === 'warm' ? 'bg-[#FBF8F1] text-slate-900' : 'bg-white text-slate-900'}`}>
        <div className={`fixed top-0 left-0 right-0 z-[120] h-1 ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200/50'}`}>
          <div className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600 transition-all duration-150" style={{ width: `${scrollProgress}%` }} />
        </div>
        <header className={`sticky top-0 z-[110] border-b shadow-lg backdrop-blur-xl ${isDarkMode ? 'border-slate-700 bg-slate-900/95 text-white' : 'border-slate-200 bg-white/95 text-slate-900'}`}>
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isDarkMode ? 'bg-indigo-600/20 border border-indigo-500/30' : 'bg-indigo-50 border border-indigo-200'}`}>
                  <BookOpen className={`w-4 h-4 ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`} />
                </div>
                <div className="min-w-0">
                  <span className={`text-[11px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-indigo-300' : 'text-indigo-600'}`}>Focus Reading</span>
                  <p className={`text-xs mt-0.5 truncate ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Module {currentPage + 1} of {pages.length}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button onClick={decreaseFontSize} className={`hidden sm:flex w-9 h-9 items-center justify-center rounded-xl transition-colors ${isDarkMode ? 'text-slate-300 hover:bg-white/10' : 'text-slate-600 hover:bg-slate-100'}`}>
                  <Minus className="w-4 h-4" />
                    </button>
                
                <button onClick={increaseFontSize} className={`hidden sm:flex w-9 h-9 items-center justify-center rounded-xl transition-colors ${isDarkMode ? 'text-slate-300 hover:bg-white/10' : 'text-slate-600 hover:bg-slate-100'}`}>
                  <Plus className="w-4 h-4" />
                </button>
                <button onClick={toggleFullscreenMode} className="ml-1 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold transition-colors shadow-lg shadow-indigo-600/20 text-white">
                  Exit Focus
                </button>
              </div>
            </div>
          </div>
        </header>
        <main className="max-w-4xl mx-auto px-5 sm:px-10 lg:px-14 py-10 sm:py-16">
          <h1 className={`text-2xl sm:text-3xl font-black mb-8 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
            {tableOfContents[currentPage]?.title}
          </h1>
          <article onMouseUp={handleTextSelection} className={`prose max-w-none ${bodyTextSize} leading-[1.85] ${isDarkMode ? 'prose-invert' : 'prose-slate'} ${readingFontClass}`}>
            <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]} components={markdownComponents}>
              {pages[currentPage] || ''}
            </ReactMarkdown>
          </article>
        </main>
        <footer className={`sticky bottom-0 z-[105] border-t backdrop-blur-xl ${isDarkMode ? 'border-slate-700 bg-slate-900/95' : 'border-slate-200 bg-white/95'}`}>
          <div className="max-w-4xl mx-auto px-5 sm:px-10 py-3 flex items-center justify-between">
            <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 0} className={`px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-30 ${isDarkMode ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-700 hover:bg-slate-50'}`}>
              ← Previous
            </button>
            <span className={`text-xs font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{currentPage + 1} / {pages.length}</span>
            <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === pages.length - 1} className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-500 disabled:opacity-30">
              Next →
            </button>
          </div>
        </footer>
      </div>
    )
  }

  return (
    <div className={`min-h-screen py-5 sm:py-8 px-3 sm:px-6 lg:px-8 transition-colors print:bg-white print:p-0 ${paperTheme === 'warm' ? 'bg-[#F4EFE6]' : 'bg-slate-50'} text-slate-900 dark:bg-slate-950 dark:text-slate-100`}>
      {/* Reading Progress */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-slate-200/40 z-[100] print:hidden">
        <div className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600 transition-all duration-150" style={{ width: `${scrollProgress}%` }} />
      </div>

      {/* Completion Toast */}
      {showCompletionToast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl bg-emerald-500 text-white text-sm font-bold shadow-xl animate-bounce">
          Module completed!
        </div>
      )}

      {/* Floating Navigation Arrows */}
      {!loading && !error && pages.length > 1 && (
        <>
          <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 0} className="fixed left-4 top-1/2 -translate-y-1/2 z-40 hidden lg:flex w-12 h-12 rounded-full bg-white dark:bg-slate-800 shadow-xl border border-slate-200 dark:border-slate-700 items-center justify-center disabled:opacity-20 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:border-indigo-300 transition-all">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === pages.length - 1} className="fixed right-4 top-1/2 -translate-y-1/2 z-40 hidden lg:flex w-12 h-12 rounded-full bg-white dark:bg-slate-800 shadow-xl border border-slate-200 dark:border-slate-700 items-center justify-center disabled:opacity-20 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:border-indigo-300 transition-all">
            <ChevronRight className="w-6 h-6" />
          </button>
        </>
      )}

      <div className="max-w-5xl mx-auto print:max-w-none">
        {/* Top Navigation */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5 print:hidden">
          <div className="flex items-center gap-2">
            <button onClick={() => navigate(-1)} className="group inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:border-indigo-300 hover:text-indigo-600 transition-all shadow-sm">
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
              <span>Back</span>
            </button>
            <span className="hidden sm:block text-slate-300">/</span>
            <span className="hidden sm:block text-sm font-medium text-slate-500">Study Notes</span>
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-end">
            {/* Premium Badge */}
            <span className={`hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[10px] font-bold uppercase tracking-wider ${isPremium ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-slate-100 border-slate-200 text-slate-500'}`}>
              <Crown className={`w-3 h-3 ${isPremium ? 'text-amber-500 fill-amber-500' : 'text-slate-400'}`} />
              {isPremium ? 'Premium' : 'Free'}
            </span>

            {/* Quick Stats */}
            <div className="hidden md:flex items-center gap-3 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[10px] font-semibold text-slate-500">
              <span className="flex items-center gap-1"><Target className="w-3 h-3 text-emerald-500" />{readModules.size}/{pages.length}</span>
              <span className="flex items-center gap-1"><Clock3 className="w-3 h-3 text-indigo-500" />~{timeRemaining} min</span>
              <span className="flex items-center gap-1"><Keyboard className="w-3 h-3 text-purple-500" />Ctrl+K</span>
            </div>

            {/* Toolbar */}
            <div className="flex items-center gap-0.5 p-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
              <button onClick={toggleFullscreenMode} className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 transition-colors" title="Focus mode">
                <Maximize2 className="w-4 h-4" />
              </button>
              <button onClick={() => setIsDarkMode(prev => { document.documentElement.classList.toggle('dark', !prev); return !prev })} className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 transition-colors" title="Toggle dark mode">
                {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
              <button onClick={() => setReadingFont(f => f === 'sans' ? 'serif' : f === 'serif' ? 'mono' : 'sans')} className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 transition-colors" title="Change font">
                <Type className="w-4 h-4" />
              </button>
              <button onClick={() => setPaperTheme((theme) => (theme === 'warm' ? 'white' : 'warm'))} className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 transition-colors" title="Change theme">
                <Palette className={`w-4 h-4 ${paperTheme === 'warm' ? 'text-amber-500' : 'text-indigo-500'}`} />
              </button>
              <button onClick={() => setIsTOCModalOpen(true)} disabled={!pages.length} className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-40 transition-colors" title="Course index">
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button onClick={() => setShowSearch((value) => !value)} disabled={!pages.length} className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-40 transition-colors" title="Search notes">
                <Search className="w-4 h-4" />
              </button>
              <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-0.5" />
              <button onClick={decreaseFontSize} className="hidden sm:flex w-9 h-9 rounded-lg items-center justify-center text-slate-500 hover:bg-slate-100 transition-colors" title="Decrease text size">
                <Minus className="w-4 h-4" />
              </button>
              <button onClick={increaseFontSize} className="hidden sm:flex w-9 h-9 rounded-lg items-center justify-center text-slate-500 hover:bg-slate-100 transition-colors" title="Increase text size">
                <Plus className="w-4 h-4" />
              </button>
              <button onClick={handlePrint} disabled={!notes} className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-40 transition-colors relative" title={isPremium ? 'Print' : 'Premium feature'}>
                <Printer className="w-4 h-4" />
                {!isPremium && <Lock className="absolute -right-0.5 -bottom-0.5 w-2.5 h-2.5 text-amber-500" />}
              </button>
              <button onClick={() => toggleBookmark(currentPage)} disabled={!pages.length} className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${bookmarkedModules.has(currentPage) ? 'bg-amber-50 text-amber-600' : 'text-slate-500 hover:bg-amber-50 hover:text-amber-600'}`} title="Bookmark">
                {bookmarkedModules.has(currentPage) ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
              </button>
              <button onClick={handleCopy} disabled={!notes} className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-40 transition-colors" title="Copy notes">
                {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>

            {/* Flashcards Button */}
            <button
              onClick={() => navigate(`/courses/${courseId}/flashcards`)}
              className="group inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 text-white text-xs font-bold shadow-md shadow-teal-600/20 hover:shadow-lg hover:from-teal-500 hover:to-emerald-500 transition-all active:scale-[0.98]"
            >
              <BookOpen className="w-4 h-4 group-hover:-rotate-3 transition-transform" />
              <span>Flashcards</span>
              <span className="hidden lg:inline-flex px-1.5 py-0.5 rounded-md bg-white/15 text-[9px]">Active Recall</span>
            </button>

            {isAdmin && (
              <button onClick={() => navigate(`/admin/courses/${courseId}/notes/review`)} className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-500 transition-colors">
                <FileText className="w-3.5 h-3.5" />
                Review
              </button>
            )}
          </div>
        </div>

        {/* Search */}
        {showSearch && (
          <div className="mb-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 shadow-sm">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="text" autoFocus value={searchQuery} onChange={(event) => handleSearch(event.target.value)} placeholder="Search across your study notes..." className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400" />
            </div>
            {searchQuery && (
              <div className="mt-2">
                {searchResults.length > 0 ? (
                  <div className="max-h-52 overflow-y-auto space-y-1">
                    {searchResults.map((index) => (
                      <button key={index} onClick={() => { handlePageChange(index); setShowSearch(false); setSearchQuery('') }} className="w-full text-left p-3 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors">
                        <span className="text-[10px] font-bold text-indigo-600">MODULE {index + 1}</span>
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mt-0.5">{tableOfContents[index]?.title || 'Untitled'}</p>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="py-4 text-sm text-slate-500 text-center">No modules found</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Main Card with Glassmorphism */}
        <div className={`rounded-[28px] overflow-hidden border shadow-xl shadow-slate-900/5 dark:shadow-none ${paperTheme === 'warm' ? 'bg-[#FBF8F1]/80 backdrop-blur-xl border-amber-200/70 dark:bg-slate-900/80 dark:border-slate-700' : 'bg-white/80 backdrop-blur-xl border-slate-200 dark:bg-slate-900/80 dark:border-slate-700'}`}>
          {/* Hero with Progress Ring */}
          <section className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-indigo-950 to-indigo-900 px-5 sm:px-8 lg:px-10 py-8 text-white">
            <div className="flex items-center gap-6">
              <div className="relative w-20 h-20 shrink-0">
                <svg className="w-20 h-20 -rotate-90">
                  <circle cx="40" cy="40" r="35" stroke="rgba(255,255,255,0.15)" strokeWidth="5" fill="none" />
                  <circle cx="40" cy="40" r="35" stroke="url(#progressGradient)" strokeWidth="5" fill="none" strokeDasharray={circumference} strokeDashoffset={progressOffset} strokeLinecap="round" className="transition-all duration-1000" />
                  <defs>
                    <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#34D399" />
                      <stop offset="100%" stopColor="#818CF8" />
                    </linearGradient>
                  </defs>
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-sm font-black">{progressPercentage}%</span>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 border border-white/10 text-[10px] font-bold uppercase tracking-wider text-indigo-200">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    Exit Exam Study Guide
                  </span>
                  {!isPremium && notes && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-400/10 border border-amber-400/20 text-[10px] font-bold text-amber-300">
                      <Lock className="w-3 h-3" />
                      Free Preview
                    </span>
                  )}
                </div>
                <h1 className="text-xl sm:text-2xl font-black">National Exit Exam</h1>
                <p className="text-xs text-indigo-200 mt-1">Module {currentPage + 1} of {pages.length} · ~{timeRemaining} min remaining</p>
              </div>
            </div>
          </section>

          {/* Module Toolbar */}
          {!loading && !error && pages.length > 0 && (
            <div className="sticky top-0 z-30 bg-slate-950/95 backdrop-blur-xl border-b border-slate-800 text-slate-200">
              <div className="px-4 sm:px-6 py-3">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-xs font-semibold">Module <span className="text-white">{currentPage + 1}</span> / {pages.length}</span>
                  <div className="hidden md:flex items-center gap-1 overflow-x-auto max-w-[45%] py-1">
                    {pages.map((_, index) => (
                      <button key={index} onClick={() => handlePageChange(index)} className={`h-1.5 rounded-full shrink-0 transition-all ${index === currentPage ? 'w-7 bg-indigo-500' : readModules.has(index) ? 'w-2 bg-emerald-500' : 'w-2 bg-slate-700'}`} />
                    ))}
                  </div>
                  <button onClick={() => setIsTOCModalOpen(true)} className="text-xs font-semibold text-indigo-400">
                    <LayoutGrid className="w-3.5 h-3.5 inline" /> <span className="hidden sm:inline">Index</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Body */}
          <div ref={contentContainerRef} className={`px-5 sm:px-8 lg:px-12 py-8 sm:py-12 min-h-[520px] transition-opacity duration-150 ${pageTransition ? 'opacity-0' : 'opacity-100'} ${readingBackground} ${readingFontClass}`}>
            {loading ? (
              <div className="min-h-[480px] flex items-center justify-center">
                <div className="text-center">
                  <div className="w-14 h-14 mx-auto border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                  <h3 className="text-sm font-bold mt-4 text-slate-800 dark:text-slate-200">Preparing your study guide</h3>
                </div>
              </div>
            ) : error ? (
              <div className="min-h-[420px] flex items-center justify-center text-center">
                <div>
                  <AlertCircle className="w-12 h-12 mx-auto text-red-500 mb-3" />
                  <p className="text-red-500">{error}</p>
                  <button onClick={() => fetchNotes()} className="mt-4 px-5 py-2.5 bg-indigo-600 text-white rounded-xl">Retry</button>
                </div>
              </div>
            ) : (
              <>
                <div className="mb-8 pb-6 border-b border-slate-200/70 dark:border-slate-800">
                  <h2 className={`text-xl sm:text-2xl font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    {tableOfContents[currentPage]?.title || `Module ${currentPage + 1}`}
                  </h2>
                </div>

                <article onMouseUp={handleTextSelection} className={`prose prose-slate dark:prose-invert max-w-none ${bodyTextSize} leading-[1.8]`}>
                  <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]} components={markdownComponents}>
                    {pages[currentPage] || ''}
                  </ReactMarkdown>
                </article>

               {/* Ask AI - Improved UX */}
{showAskAI && (
  <aside className="fixed right-0 top-0 bottom-0 z-[90] w-full sm:w-[420px] overflow-y-auto bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
    {/* Header */}
    <div className="px-5 py-4 bg-gradient-to-r from-purple-600 via-indigo-600 to-indigo-700 text-white shrink-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-300" />
          <h3 className="font-bold text-sm">Study Assistant</h3>
        </div>
        <button 
          onClick={() => setShowAskAI(false)} 
          className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/15 transition-colors active:scale-95"
          title="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <p className="text-[11px] text-indigo-200 mt-1">Ask about anything in your notes</p>
    </div>

    {/* Content */}
    <div className="flex-1 overflow-y-auto p-5 space-y-4">
      {/* Selected Text */}
      {selectedText && (
        <div className="rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/50 p-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 mb-1">
            Selected Text
          </p>
          <p className="text-xs text-slate-600 dark:text-slate-400 italic line-clamp-3">
            "{selectedText.substring(0, 200)}"
          </p>
        </div>
      )}

      {/* Question Input */}
      <div>
        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
          Your Question
        </label>
        <textarea 
          value={aiQuestion} 
          onChange={(e) => setAiQuestion(e.target.value)} 
          placeholder="e.g., Can you explain this concept more simply?" 
          className="w-full h-28 p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 resize-none transition-all"
          autoFocus
        />
      </div>

      {/* Ask Button */}
      <button 
        onClick={handleAskAI} 
        disabled={!aiQuestion.trim() || aiLoading} 
        className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-bold hover:from-indigo-500 hover:to-purple-500 disabled:opacity-40 transition-all active:scale-95 shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2"
      >
        {aiLoading ? (
          <>
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Thinking...
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4 text-amber-300" />
            Ask AI
          </>
        )}
      </button>

      {/* Quick Questions */}
      {!aiAnswer && !aiLoading && (
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Quick Questions</p>
          {[
            "Explain this in simpler terms",
            "Give me an example",
            "What's the exam tip for this?",
            "Why is this important?",
          ].map((q) => (
            <button
              key={q}
              onClick={() => setAiQuestion(q)}
              className="w-full text-left px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-xs text-slate-600 dark:text-slate-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors active:scale-95"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* AI Answer */}
      {aiLoading && (
        <div className="rounded-xl p-4 bg-slate-50 dark:bg-slate-800 space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-indigo-600 dark:text-indigo-400">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            Generating answer...
          </div>
          <div className="space-y-2">
            <div className="h-2.5 bg-slate-200 dark:bg-slate-700 rounded-full animate-pulse w-full" />
            <div className="h-2.5 bg-slate-200 dark:bg-slate-700 rounded-full animate-pulse w-3/4" />
            <div className="h-2.5 bg-slate-200 dark:bg-slate-700 rounded-full animate-pulse w-1/2" />
          </div>
        </div>
      )}

      {aiAnswer && !aiLoading && (
        <div className={`rounded-xl p-4 ${isDarkMode ? 'bg-indigo-950/40 border border-indigo-900/50' : 'bg-indigo-50 border border-indigo-100'}`}>
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <p className="text-xs font-bold text-indigo-700 dark:text-indigo-300">AI Answer</p>
          </div>
          <div className={`text-sm leading-relaxed ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
              {aiAnswer}
            </ReactMarkdown>
          </div>
          <button
            onClick={() => {
              navigator.clipboard.writeText(aiAnswer)
              setCopied(true)
              setTimeout(() => setCopied(false), 2000)
            }}
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-500" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                Copy answer
              </>
            )}
          </button>
        </div>
      )}
    </div>

    {/* Footer */}
    <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 shrink-0">
      <p className="text-[10px] text-slate-400 text-center">
        AI answers are based on your study notes and may need verification.
      </p>
    </div>
  </aside>
)}

                {/* Complete Button */}
                <div className="mt-10 pt-7 border-t border-slate-200/70 dark:border-slate-800 flex justify-center">
                  <button onClick={markCurrentModuleRead} className={`px-6 py-3 rounded-2xl text-sm font-bold transition-all ${readModules.has(currentPage) ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-lg shadow-indigo-600/20'}`}>
                    {readModules.has(currentPage) ? '✓ Completed' : 'Mark as Complete'}
                  </button>
                </div>

                {!isPremium && notes?.modules && currentPage === pages.length - 1 && (
                  <div className="mt-8 flex justify-center">
                    <button onClick={() => setIsUpgradeModalOpen(true)} className="px-6 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-bold shadow-lg">
                      <Crown className="w-4 h-4 inline mr-1 text-amber-300 fill-amber-300" />
                      Get Full Study Guide
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Bottom Navigation */}
          {!loading && !error && pages.length > 1 && (
            <div className={`border-t px-6 py-4 flex items-center justify-between ${isDarkMode ? 'bg-slate-900/80 border-slate-700' : 'bg-white/80 border-slate-200'}`}>
              <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 0} className="px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-30 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700">
                ← Previous
              </button>
              <span className="text-xs font-bold">{currentPage + 1} / {pages.length}</span>
              <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === pages.length - 1} className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-500 disabled:opacity-30">
                Next →
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Command Palette */}
      {showCommandPalette && (
        <div className="fixed inset-0 z-[300] flex items-start justify-center pt-20 px-4 bg-slate-950/70 backdrop-blur-sm">
          <div className={`w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden ${isDarkMode ? 'bg-slate-900 border border-slate-700' : 'bg-white'}`}>
            <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 dark:border-slate-700">
              <Command className={`w-4 h-4 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} />
              <input autoFocus type="text" placeholder="Search modules..." value={commandQuery} onChange={(e) => setCommandQuery(e.target.value)} className={`flex-1 bg-transparent outline-none text-sm ${isDarkMode ? 'text-white' : 'text-slate-900'}`} />
              <kbd className="px-2 py-1 rounded text-[10px] font-mono bg-slate-100 dark:bg-slate-800">ESC</kbd>
            </div>
            <div className="max-h-60 overflow-y-auto p-2">
              {tableOfContents.filter(item => item.title.toLowerCase().includes(commandQuery.toLowerCase())).map((item) => (
                <button key={item.index} onClick={() => { handlePageChange(item.index); setShowCommandPalette(false); setCommandQuery(''); }} className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center gap-3 ${currentPage === item.index ? 'bg-indigo-50 dark:bg-indigo-950/50' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                  <span className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold ${readModules.has(item.index) ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300'}`}>
                    {readModules.has(item.index) ? <Check className="w-3 h-3" /> : item.index + 1}
                  </span>
                  <span className={`text-sm flex-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>{item.title}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TOC Modal */}
      {isTOCModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="w-full max-w-xl max-h-[85vh] bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-bold">Course Index</h3>
              <button onClick={() => setIsTOCModalOpen(false)} className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[65vh] space-y-1.5">
              {tableOfContents.map((item) => (
                <button key={item.index} onClick={() => handlePageChange(item.index)} className={`w-full text-left p-3 rounded-2xl flex items-center gap-3 ${currentPage === item.index ? 'bg-indigo-50 dark:bg-indigo-950/50' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                  <span className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold ${currentPage === item.index ? 'bg-indigo-600 text-white' : readModules.has(item.index) ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                    {readModules.has(item.index) ? <Check className="w-4 h-4" /> : item.index + 1}
                  </span>
                  <span className="text-sm flex-1">{item.title}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Generating Overlay */}
      {generating && (
        <div className="fixed inset-0 z-[400] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-7 text-center">
            <div className="w-14 h-14 mx-auto border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
            <h3 className="font-bold mt-4">Regenerating study notes</h3>
          </div>
        </div>
      )}

      <UpgradeModal isOpen={isUpgradeModalOpen} onClose={() => setIsUpgradeModalOpen(false)} customMessage="Get the complete Exit Exam preparation experience and study without limits." />
    </div>
  )
}

export default CourseNotesPage
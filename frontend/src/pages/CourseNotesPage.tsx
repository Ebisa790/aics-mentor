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
import { AskAIPanel } from './CourseNotes/AskAIPanel'
import { FullscreenView } from './CourseNotes/NotesShell'
import { Modals } from './CourseNotes/Modals'
import { NotesToolbar } from './CourseNotes/NotesToolbar'

import {
  Check,
  AlertCircle,
  Lock,
  Crown,
  Sparkles,
  LayoutGrid,
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
        const message = (err as any)?.friendlyMessage || (err instanceof Error ? err.message : 'An unexpected error occurred.')
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
      // Show soft toast instead of blocking modal
      setShowCompletionToast(true)
      setTimeout(() => setShowCompletionToast(false), 3000)
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

  const handleCopyAnswer = () => {
    navigator.clipboard.writeText(aiAnswer)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
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
      <FullscreenView
        containerRef={fullscreenContainerRef}
        isDarkMode={isDarkMode}
        paperTheme={paperTheme}
        scrollProgress={scrollProgress}
        currentPage={currentPage}
        pages={pages}
        tableOfContents={tableOfContents}
        bodyTextSize={bodyTextSize}
        readingFontClass={readingFontClass}
        markdownComponents={markdownComponents}
        onDecreaseFontSize={decreaseFontSize}
        onIncreaseFontSize={increaseFontSize}
        onToggleFullscreen={toggleFullscreenMode}
        onPageChange={handlePageChange}
        onTextSelection={handleTextSelection}
      />
    )
  }

  return (
    <div className={`min-h-screen py-5 sm:py-8 px-3 sm:px-6 lg:px-8 transition-colors print:bg-white print:p-0 ${paperTheme === 'warm' ? 'bg-[#F4EFE6]' : 'bg-slate-50'} text-slate-900 dark:bg-slate-950 dark:text-slate-100`}>
      {/* Reading Progress */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-slate-200/40 z-[100] print:hidden">
        <div className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600 transition-all duration-150" style={{ width: `${scrollProgress}%` }} />
      </div>

      <NotesToolbar
        showCompletionToast={showCompletionToast}
        loading={loading}
        error={error}
        pages={pages}
        currentPage={currentPage}
        onPageChange={handlePageChange}
        onBack={() => navigate(-1)}
        isPremium={isPremium}
        isAdmin={isAdmin}
        readModules={readModules}
        timeRemaining={timeRemaining}
        onGoToFlashcards={() => navigate(`/courses/${courseId}/flashcards`)}
        onGoToReview={() => navigate(`/admin/courses/${courseId}/notes/review`)}
        onToggleFullscreen={toggleFullscreenMode}
        isDarkMode={isDarkMode}
        setIsDarkMode={setIsDarkMode}
        setReadingFont={setReadingFont}
        paperTheme={paperTheme}
        setPaperTheme={setPaperTheme}
        onOpenTOC={() => setIsTOCModalOpen(true)}
        onToggleSearch={() => setShowSearch(v => !v)}
        onDecreaseFontSize={decreaseFontSize}
        onIncreaseFontSize={increaseFontSize}
        onPrint={handlePrint}
        notes={notes}
        bookmarkedModules={bookmarkedModules}
        onToggleBookmark={toggleBookmark}
        onCopy={handleCopy}
        copied={copied}
        showSearch={showSearch}
        searchQuery={searchQuery}
        onSearch={handleSearch}
        searchResults={searchResults}
        tableOfContents={tableOfContents}
        onCloseSearch={() => setShowSearch(false)}
        setSearchQuery={setSearchQuery}
      />


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
<AskAIPanel
        isOpen={showAskAI}
        onClose={() => setShowAskAI(false)}
        isDarkMode={isDarkMode}
        selectedText={selectedText}
        aiQuestion={aiQuestion}
        setAiQuestion={setAiQuestion}
        aiAnswer={aiAnswer}
        aiLoading={aiLoading}
        copied={copied}
        onAsk={handleAskAI}
        onCopyAnswer={handleCopyAnswer}
        markdownComponents={markdownComponents}
      />

{/* Premium Gate - Beautiful Upgrade Section */}
{!isPremium && notes?.modules?.[currentPage]?.is_preview && (
  <div className="mt-8 rounded-2xl bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 dark:from-amber-950/40 dark:via-orange-950/40 dark:to-yellow-950/40 border border-amber-200 dark:border-amber-800 p-6 sm:p-8 text-center">
    <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-amber-400 to-yellow-500 text-white mb-4 shadow-lg shadow-amber-500/30">
      <Lock className="w-7 h-7" />
    </div>
    
    <h3 className="text-lg font-black text-amber-900 dark:text-amber-100 mb-2">
      You're viewing {notes.modules[currentPage].preview_percentage || 20}% of this module
    </h3>
    
    <p className="text-sm text-amber-700 dark:text-amber-300 mb-5 max-w-md mx-auto">
      Premium unlocks the complete study guide with everything you need to pass
    </p>
    
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-6 max-w-md mx-auto text-left">
      {[
        "Complete definitions & explanations",
        "Exam traps & common mistakes",
        "Memory aids & mnemonics",
        "Quick revision summary",
      ].map((feature) => (
        <div key={feature} className="flex items-center gap-2 text-xs text-amber-800 dark:text-amber-200 bg-white/50 dark:bg-white/5 rounded-lg px-3 py-2">
          <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
          <span>{feature}</span>
        </div>
      ))}
    </div>
    
    <button
      onClick={() => setIsUpgradeModalOpen(true)}
      className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 text-white font-bold text-sm shadow-lg shadow-amber-500/30 hover:from-amber-400 hover:to-yellow-400 transition-all active:scale-95"
    >
      <Crown className="w-4 h-4 fill-amber-200" />
      Upgrade to Premium
    </button>
    
    <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-3">
      One-time payment · Lifetime access · Instant unlock
    </p>
  </div>
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

      <Modals
        isDarkMode={isDarkMode}
        currentPage={currentPage}
        tableOfContents={tableOfContents}
        readModules={readModules}
        onPageChange={handlePageChange}
        showCommandPalette={showCommandPalette}
        commandQuery={commandQuery}
        setCommandQuery={setCommandQuery}
        onCloseCommandPalette={() => setShowCommandPalette(false)}
        isTOCModalOpen={isTOCModalOpen}
        onCloseTOC={() => setIsTOCModalOpen(false)}
        generating={generating}
      />

      <UpgradeModal isOpen={isUpgradeModalOpen} onClose={() => setIsUpgradeModalOpen(false)} customMessage="Get the complete Exit Exam preparation experience and study without limits." />
    </div>
  )
}

export default CourseNotesPage
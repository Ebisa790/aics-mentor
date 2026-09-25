import {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from 'react'

import { useParams, useNavigate } from 'react-router-dom'
import UpgradeModal from '../components/UpgradeModal'
import { FullscreenView } from './CourseNotes/NotesShell'
import { Modals } from './CourseNotes/Modals'
import { NotesToolbar } from './CourseNotes/NotesToolbar'
import { NotesBody } from './CourseNotes/NotesBody'

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
        onOpenAskAI={() => {
          if (!isPremium) {
            setShowCompletionToast(true)
            setTimeout(() => setShowCompletionToast(false), 3000)
            return
          }
          setShowAskAI(true)
        }}
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


      {/* Main Card */}
      <NotesBody
        notes={notes}
        pages={pages}
        tableOfContents={tableOfContents}
        loading={loading}
        error={error}
        pageTransition={pageTransition}
        currentPage={currentPage}
        readModules={readModules}
        isPremium={isPremium}
        isDarkMode={isDarkMode}
        paperTheme={paperTheme}
        circumference={circumference}
        progressOffset={progressOffset}
        progressPercentage={progressPercentage}
        timeRemaining={timeRemaining}
        bodyTextSize={bodyTextSize}
        readingBackground={readingBackground}
        readingFontClass={readingFontClass}
        markdownComponents={markdownComponents}
        onPageChange={handlePageChange}
        onMarkRead={markCurrentModuleRead}
        onRetryFetch={() => fetchNotes()}
        onOpenUpgrade={() => setIsUpgradeModalOpen(true)}
        onOpenTOC={() => setIsTOCModalOpen(true)}
        onTextSelection={handleTextSelection}
        showAskAI={showAskAI}
        onCloseAskAI={() => setShowAskAI(false)}
        selectedText={selectedText}
        aiQuestion={aiQuestion}
        setAiQuestion={setAiQuestion}
        aiAnswer={aiAnswer}
        aiLoading={aiLoading}
        copied={copied}
        onAsk={handleAskAI}
        onCopyAnswer={handleCopyAnswer}
      />

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
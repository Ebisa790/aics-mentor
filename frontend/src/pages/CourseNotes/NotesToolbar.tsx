// NotesToolbar.tsx — top chrome for CourseNotesPage.
// Completion toast + floating arrows + top nav bar + search panel.
// Verbatim extraction. All state passed via props.

import type { Dispatch, SetStateAction } from 'react'
import {
  ArrowLeft,
  Crown,
  Target,
  Clock3,
  Keyboard,
  Maximize2,
  Sun,
  Moon,
  Type,
  Palette,
  LayoutGrid,
  Search,
  Minus,
  Plus,
  Printer,
  Lock,
  Bookmark,
  BookmarkCheck,
  Check,
  Copy,
  BookOpen,
  FileText,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'

interface NotesToolbarProps {
  // Toast
  showCompletionToast: boolean

  // Floating arrows
  loading: boolean
  error: string | null
  pages: string[]
  currentPage: number
  onPageChange: (n: number) => void

  // Top nav
  onBack: () => void
  isPremium: boolean
  isAdmin: boolean
  readModules: Set<number>
  timeRemaining: number
  onGoToFlashcards: () => void
  onGoToReview: () => void

  // Toolbar buttons
  onToggleFullscreen: () => void
  isDarkMode: boolean
  setIsDarkMode: Dispatch<SetStateAction<boolean>>
  setReadingFont: Dispatch<SetStateAction<'sans' | 'serif' | 'mono'>>
  paperTheme: 'white' | 'warm'
  setPaperTheme: Dispatch<SetStateAction<'white' | 'warm'>>
  onOpenTOC: () => void
  onToggleSearch: () => void
  onDecreaseFontSize: () => void
  onIncreaseFontSize: () => void
  onPrint: () => void
  notes: any
  bookmarkedModules: Set<number>
  onToggleBookmark: (i: number) => void
  onCopy: () => void
  copied: boolean

  // Search
  showSearch: boolean
  searchQuery: string
  onSearch: (q: string) => void
  searchResults: number[]
  tableOfContents: Array<{ index: number; title: string }>
  onCloseSearch: () => void
  setSearchQuery: (q: string) => void
}

export function NotesToolbar({
  showCompletionToast,
  loading,
  error,
  pages,
  currentPage,
  onPageChange,
  onBack,
  isPremium,
  isAdmin,
  readModules,
  timeRemaining,
  onGoToFlashcards,
  onGoToReview,
  onToggleFullscreen,
  isDarkMode,
  setIsDarkMode,
  setReadingFont,
  paperTheme,
  setPaperTheme,
  onOpenTOC,
  onToggleSearch,
  onDecreaseFontSize,
  onIncreaseFontSize,
  onPrint,
  notes,
  bookmarkedModules,
  onToggleBookmark,
  onCopy,
  copied,
  showSearch,
  searchQuery,
  onSearch,
  searchResults,
  tableOfContents,
  onCloseSearch,
  setSearchQuery,
}: NotesToolbarProps) {
  return (
    <>
      {/* Completion Toast */}
      {showCompletionToast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl bg-emerald-500 text-white text-sm font-bold shadow-xl animate-bounce">
          ✨ Upgrade to Premium to use AI Study Assistant
        </div>
      )}

      {/* Floating Navigation Arrows */}
      {!loading && !error && pages.length > 1 && (
        <>
          <button onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 0} className="fixed left-4 top-1/2 -translate-y-1/2 z-40 hidden lg:flex w-12 h-12 rounded-full bg-white dark:bg-slate-800 shadow-xl border border-slate-200 dark:border-slate-700 items-center justify-center disabled:opacity-20 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:border-indigo-300 transition-all">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === pages.length - 1} className="fixed right-4 top-1/2 -translate-y-1/2 z-40 hidden lg:flex w-12 h-12 rounded-full bg-white dark:bg-slate-800 shadow-xl border border-slate-200 dark:border-slate-700 items-center justify-center disabled:opacity-20 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:border-indigo-300 transition-all">
            <ChevronRight className="w-6 h-6" />
          </button>
        </>
      )}

      {/* Top Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5 print:hidden">
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="group inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:border-indigo-300 hover:text-indigo-600 transition-all shadow-sm">
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
            <button onClick={onToggleFullscreen} className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 transition-colors" title="Focus mode">
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
            <button onClick={onOpenTOC} disabled={!pages.length} className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-40 transition-colors" title="Course index">
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button onClick={onToggleSearch} disabled={!pages.length} className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-40 transition-colors" title="Search notes">
              <Search className="w-4 h-4" />
            </button>
            <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-0.5" />
            <button onClick={onDecreaseFontSize} className="hidden sm:flex w-9 h-9 rounded-lg items-center justify-center text-slate-500 hover:bg-slate-100 transition-colors" title="Decrease text size">
              <Minus className="w-4 h-4" />
            </button>
            <button onClick={onIncreaseFontSize} className="hidden sm:flex w-9 h-9 rounded-lg items-center justify-center text-slate-500 hover:bg-slate-100 transition-colors" title="Increase text size">
              <Plus className="w-4 h-4" />
            </button>
            <button onClick={onPrint} disabled={!notes} className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-40 transition-colors relative" title={isPremium ? 'Print' : 'Premium feature'}>
              <Printer className="w-4 h-4" />
              {!isPremium && <Lock className="absolute -right-0.5 -bottom-0.5 w-2.5 h-2.5 text-amber-500" />}
            </button>
            <button onClick={() => onToggleBookmark(currentPage)} disabled={!pages.length} className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${bookmarkedModules.has(currentPage) ? 'bg-amber-50 text-amber-600' : 'text-slate-500 hover:bg-amber-50 hover:text-amber-600'}`} title="Bookmark">
              {bookmarkedModules.has(currentPage) ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
            </button>
            <button onClick={onCopy} disabled={!notes} className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-40 transition-colors" title="Copy notes">
              {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>

          {/* Flashcards Button */}
          <button
            onClick={onGoToFlashcards}
            className="group inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 text-white text-xs font-bold shadow-md shadow-teal-600/20 hover:shadow-lg hover:from-teal-500 hover:to-emerald-500 transition-all active:scale-[0.98]"
          >
            <BookOpen className="w-4 h-4 group-hover:-rotate-3 transition-transform" />
            <span>Flashcards</span>
            <span className="hidden lg:inline-flex px-1.5 py-0.5 rounded-md bg-white/15 text-[9px]">Active Recall</span>
          </button>

          {isAdmin && (
            <button onClick={onGoToReview} className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-500 transition-colors">
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
            <input type="text" autoFocus value={searchQuery} onChange={(event) => onSearch(event.target.value)} placeholder="Search across your study notes..." className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400" />
          </div>
          {searchQuery && (
            <div className="mt-2">
              {searchResults.length > 0 ? (
                <div className="max-h-52 overflow-y-auto space-y-1">
                  {searchResults.map((index) => (
                    <button key={index} onClick={() => { onPageChange(index); onCloseSearch(); setSearchQuery('') }} className="w-full text-left p-3 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors">
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
    </>
  )
}

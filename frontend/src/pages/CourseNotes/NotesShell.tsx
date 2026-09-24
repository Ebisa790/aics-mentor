// NotesShell — fullscreen ("Focus Reading") view for CourseNotesPage.
// Verbatim extraction of the page's fullscreen branch.

import type { RefObject } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import { BookOpen, Minus, Plus } from 'lucide-react'

interface FullscreenViewProps {
  containerRef: RefObject<HTMLDivElement>
  isDarkMode: boolean
  paperTheme: 'white' | 'warm'
  scrollProgress: number
  currentPage: number
  pages: string[]
  tableOfContents: Array<{ index: number; title: string }>
  bodyTextSize: string
  readingFontClass: string
  markdownComponents: Record<string, any>
  onDecreaseFontSize: () => void
  onIncreaseFontSize: () => void
  onToggleFullscreen: () => void
  onPageChange: (n: number) => void
  onTextSelection: () => void
}

export function FullscreenView({
  containerRef,
  isDarkMode,
  paperTheme,
  scrollProgress,
  currentPage,
  pages,
  tableOfContents,
  bodyTextSize,
  readingFontClass,
  markdownComponents,
  onDecreaseFontSize,
  onIncreaseFontSize,
  onToggleFullscreen,
  onPageChange,
  onTextSelection,
}: FullscreenViewProps) {
  return (
    <div ref={containerRef} className={`fixed inset-0 z-[100] overflow-y-auto transition-colors ${isDarkMode ? 'bg-slate-950 text-slate-100' : paperTheme === 'warm' ? 'bg-[#FBF8F1] text-slate-900' : 'bg-white text-slate-900'}`}>
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
              <button onClick={onDecreaseFontSize} className={`hidden sm:flex w-9 h-9 items-center justify-center rounded-xl transition-colors ${isDarkMode ? 'text-slate-300 hover:bg-white/10' : 'text-slate-600 hover:bg-slate-100'}`}>
                <Minus className="w-4 h-4" />
              </button>
              <button onClick={onIncreaseFontSize} className={`hidden sm:flex w-9 h-9 items-center justify-center rounded-xl transition-colors ${isDarkMode ? 'text-slate-300 hover:bg-white/10' : 'text-slate-600 hover:bg-slate-100'}`}>
                <Plus className="w-4 h-4" />
              </button>
              <button onClick={onToggleFullscreen} className="ml-1 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold transition-colors shadow-lg shadow-indigo-600/20 text-white">
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
        <article onMouseUp={onTextSelection} className={`prose max-w-none ${bodyTextSize} leading-[1.85] ${isDarkMode ? 'prose-invert' : 'prose-slate'} ${readingFontClass}`}>
          <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]} components={markdownComponents}>
            {pages[currentPage] || ''}
          </ReactMarkdown>
        </article>
      </main>
      <footer className={`sticky bottom-0 z-[105] border-t backdrop-blur-xl ${isDarkMode ? 'border-slate-700 bg-slate-900/95' : 'border-slate-200 bg-white/95'}`}>
        <div className="max-w-4xl mx-auto px-5 sm:px-10 py-3 flex items-center justify-between">
          <button onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 0} className={`px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-30 ${isDarkMode ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-700 hover:bg-slate-50'}`}>
            ← Previous
          </button>
          <span className={`text-xs font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{currentPage + 1} / {pages.length}</span>
          <button onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === pages.length - 1} className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-500 disabled:opacity-30">
            Next →
          </button>
        </div>
      </footer>
    </div>
  )
}

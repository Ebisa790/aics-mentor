// NotesBody.tsx — the main reading card for CourseNotesPage.
// Contains: hero, module toolbar, article, AskAIPanel, premium gate, bottom nav.
// Verbatim extraction. All state passed via props.

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import { Sparkles, Lock, Crown, AlertCircle, LayoutGrid } from 'lucide-react'
import { AskAIPanel } from './AskAIPanel'

interface NotesBodyProps {
  // Data
  notes: any
  pages: string[]
  tableOfContents: Array<{ index: number; title: string }>
  loading: boolean
  error: string | null
  pageTransition: boolean

  // Reading state
  currentPage: number
  readModules: Set<number>
  isPremium: boolean
  isDarkMode: boolean
  paperTheme: 'white' | 'warm'

  // Derived
  circumference: number
  progressOffset: number
  progressPercentage: number
  timeRemaining: number
  bodyTextSize: string
  readingBackground: string
  readingFontClass: string
  markdownComponents: Record<string, any>

  // Handlers
  onPageChange: (n: number) => void
  onMarkRead: () => void
  onRetryFetch: () => void
  onOpenUpgrade: () => void
  onOpenTOC: () => void
  onTextSelection: () => void

  // Ask AI panel
  showAskAI: boolean
  onCloseAskAI: () => void
  selectedText: string
  aiQuestion: string
  setAiQuestion: (q: string) => void
  aiAnswer: string
  aiLoading: boolean
  aiError: string | null
  copied: boolean
  onAsk: () => void
  onCopyAnswer: () => void
}

export function NotesBody({
  notes,
  pages,
  tableOfContents,
  loading,
  error,
  pageTransition,
  currentPage,
  readModules,
  isPremium,
  isDarkMode,
  paperTheme,
  circumference,
  progressOffset,
  progressPercentage,
  timeRemaining,
  bodyTextSize,
  readingBackground,
  readingFontClass,
  markdownComponents,
  onPageChange,
  onMarkRead,
  onRetryFetch,
  onOpenUpgrade,
  onOpenTOC,
  onTextSelection,
  showAskAI,
  onCloseAskAI,
  selectedText,
  aiQuestion,
  setAiQuestion,
  aiAnswer,
  aiLoading,
  aiError,
  copied,
  onAsk,
  onCopyAnswer,
}: NotesBodyProps) {
  return (
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
                  <button key={index} onClick={() => onPageChange(index)} className={`h-1.5 rounded-full shrink-0 transition-all ${index === currentPage ? 'w-7 bg-indigo-500' : readModules.has(index) ? 'w-2 bg-emerald-500' : 'w-2 bg-slate-700'}`} />
                ))}
              </div>
              <button onClick={onOpenTOC} className="text-xs font-semibold text-indigo-400">
                <LayoutGrid className="w-3.5 h-3.5 inline" /> <span className="hidden sm:inline">Index</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Body */}
      <div className={`px-5 sm:px-8 lg:px-12 py-8 sm:py-12 min-h-[520px] transition-opacity duration-150 ${pageTransition ? 'opacity-0' : 'opacity-100'} ${readingBackground} ${readingFontClass}`}>
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
              <button onClick={onRetryFetch} className="mt-4 px-5 py-2.5 bg-indigo-600 text-white rounded-xl">Retry</button>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-8 pb-6 border-b border-slate-200/70 dark:border-slate-800">
              <h2 className={`text-xl sm:text-2xl font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                {tableOfContents[currentPage]?.title || `Module ${currentPage + 1}`}
              </h2>
            </div>

            <article onMouseUp={onTextSelection} className={`prose prose-slate dark:prose-invert max-w-none ${bodyTextSize} leading-[1.8]`}>
              <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]} components={markdownComponents}>
                {pages[currentPage] || ''}
              </ReactMarkdown>
            </article>

            <AskAIPanel
              isOpen={showAskAI}
              onClose={onCloseAskAI}
              isDarkMode={isDarkMode}
              selectedText={selectedText}
              aiQuestion={aiQuestion}
              setAiQuestion={setAiQuestion}
              aiAnswer={aiAnswer}
              aiLoading={aiLoading}
              aiError={aiError}
              copied={copied}
              onAsk={onAsk}
              onCopyAnswer={onCopyAnswer}
              markdownComponents={markdownComponents}
            />

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
                      <svg className="w-3.5 h-3.5 text-emerald-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={onOpenUpgrade}
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

            <div className="mt-10 pt-7 border-t border-slate-200/70 dark:border-slate-800 flex justify-center">
              <button onClick={onMarkRead} className={`px-6 py-3 rounded-2xl text-sm font-bold transition-all ${readModules.has(currentPage) ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-lg shadow-indigo-600/20'}`}>
                {readModules.has(currentPage) ? '✓ Completed' : 'Mark as Complete'}
              </button>
            </div>

            {!isPremium && notes?.modules && currentPage === pages.length - 1 && (
              <div className="mt-8 flex justify-center">
                <button onClick={onOpenUpgrade} className="px-6 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-bold shadow-lg">
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
          <button onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 0} className="px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-30 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700">
            ← Previous
          </button>
          <span className="text-xs font-bold">{currentPage + 1} / {pages.length}</span>
          <button onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === pages.length - 1} className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-500 disabled:opacity-30">
            Next →
          </button>
        </div>
      )}
    </div>
  )
}

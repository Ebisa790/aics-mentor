// Ask AI sidebar for CourseNotesPage.
// Extracted verbatim from the page. All state is passed via props.
// Logic (handleAskAI, cleanAIAnswer) stays in the parent for now.

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Sparkles, X, Copy, Check, AlertCircle } from 'lucide-react'

interface AskAIPanelProps {
  isOpen: boolean
  onClose: () => void
  isDarkMode: boolean
  selectedText: string
  aiQuestion: string
  setAiQuestion: (q: string) => void
  aiAnswer: string
  aiLoading: boolean
  aiError: string | null
  copied: boolean
  onAsk: () => void
  onCopyAnswer: () => void
  markdownComponents: Record<string, any>
}

export function AskAIPanel({
  isOpen,
  onClose,
  isDarkMode,
  selectedText,
  aiQuestion,
  setAiQuestion,
  aiAnswer,
  aiLoading,
  aiError,
  copied,
  onAsk,
  onCopyAnswer,
  markdownComponents,
}: AskAIPanelProps) {
  if (!isOpen) return null

  return (
    <aside className="fixed right-0 top-0 bottom-0 z-[90] w-full sm:w-[420px] overflow-y-auto bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
      {/* Header */}
      <div className="px-5 py-4 bg-gradient-to-r from-purple-600 via-indigo-600 to-indigo-700 text-white shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-300" />
            <h3 className="font-bold text-sm">Study Assistant</h3>
          </div>
          <button
            onClick={onClose}
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
          onClick={onAsk}
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

        {/* Error state */}
        {aiError && !aiLoading && (
          <div className="rounded-xl p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60">
            <div className="flex items-center gap-2 mb-1">
              <AlertCircle className="w-4 h-4 text-rose-500" />
              <p className="text-xs font-bold text-rose-700 dark:text-rose-300">Couldn't get an answer</p>
            </div>
            <p className="text-xs text-rose-600 dark:text-rose-400 leading-relaxed">{aiError}</p>
          </div>
        )}

        {/* AI Answer */}
        {/* Loading (before any tokens arrive) */}
        {aiLoading && !aiAnswer && (
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

        {/* Streaming (tokens arriving) */}
        {aiLoading && aiAnswer && (
          <div className={`rounded-xl p-4 ${isDarkMode ? 'bg-indigo-950/40 border border-indigo-900/50' : 'bg-indigo-50 border border-indigo-100'}`}>
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-amber-500 animate-pulse" />
              <p className="text-xs font-bold text-indigo-700 dark:text-indigo-300">AI Answer (streaming...)</p>
            </div>
            <div className={`text-sm leading-relaxed whitespace-pre-wrap ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
              {aiAnswer}
              <span className="inline-block w-2 h-4 ml-0.5 align-middle bg-indigo-500 animate-pulse" />
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
              onClick={onCopyAnswer}
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
  )
}

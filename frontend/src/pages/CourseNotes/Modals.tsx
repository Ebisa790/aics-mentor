// Modals.tsx — overlays for CourseNotesPage.
// Extracted verbatim: command palette, table of contents, generating overlay.

import { Command, X, Check } from 'lucide-react'

interface ModalsProps {
  isDarkMode: boolean
  currentPage: number
  tableOfContents: Array<{ index: number; title: string }>
  readModules: Set<number>
  onPageChange: (n: number) => void

  showCommandPalette: boolean
  commandQuery: string
  setCommandQuery: (v: string) => void
  onCloseCommandPalette: () => void

  isTOCModalOpen: boolean
  onCloseTOC: () => void

  generating: boolean
}

export function Modals({
  isDarkMode,
  currentPage,
  tableOfContents,
  readModules,
  onPageChange,
  showCommandPalette,
  commandQuery,
  setCommandQuery,
  onCloseCommandPalette,
  isTOCModalOpen,
  onCloseTOC,
  generating,
}: ModalsProps) {
  return (
    <>
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
                <button key={item.index} onClick={() => { onPageChange(item.index); onCloseCommandPalette(); setCommandQuery(''); }} className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center gap-3 ${currentPage === item.index ? 'bg-indigo-50 dark:bg-indigo-950/50' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
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
              <button onClick={onCloseTOC} className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[65vh] space-y-1.5">
              {tableOfContents.map((item) => (
                <button key={item.index} onClick={() => onPageChange(item.index)} className={`w-full text-left p-3 rounded-2xl flex items-center gap-3 ${currentPage === item.index ? 'bg-indigo-50 dark:bg-indigo-950/50' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
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
    </>
  )
}

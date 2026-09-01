import { useState, useEffect, useCallback, useRef } from 'react'
import { drillsApi, CodeTraceResponse } from '../api'
import { useAuth } from '../context/AuthContext'
import UpgradeModal from './UpgradeModal'

interface CodeTraceDebuggerModalProps {
  isOpen: boolean
  onClose: () => void
}

interface ExtendedTraceStep {
  line_number: number
  variables?: Record<string, string>
  explanation: string
  stdout_so_far?: string
}

const SUBJECT_OPTIONS = [
  { slug: 'cpp-programming', label: 'C++ Programming (Output Questions)' },
  { slug: 'oop', label: 'OOP (Java - Constructors/Inheritance)' },
  { slug: 'dsa-trace', label: 'DSA (Pseudocode Tracing)' },
]

export function CodeTraceDebuggerModal({ isOpen, onClose }: CodeTraceDebuggerModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)
  const { isPremium, isAdmin } = useAuth()
  
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false)
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [subject, setSubject] = useState<string>('cpp-programming')
  const [data, setData] = useState<CodeTraceResponse | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [dailyDrillCount, setDailyDrillCount] = useState(0)
  const FREE_DAILY_LIMIT = 3

  // Session History
  const [drillHistory, setDrillHistory] = useState<CodeTraceResponse[]>([])
  const [historyIndex, setHistoryIndex] = useState<number>(-1)

  // Execution & Answer State
  const [currentStep, setCurrentStep] = useState<number>(0)
  const [selectedOption, setSelectedOption] = useState<number | null>(null)
  const [hasSubmitted, setHasSubmitted] = useState<boolean>(false)
  const [userStats, setUserStats] = useState<{ total: number; correct: number; accuracy: number } | null>(null)

  // Timer State
  const [timeLeft, setTimeLeft] = useState<number>(60)
  const [timerRunning, setTimerRunning] = useState<boolean>(false)

  const hasPremiumAccess = isPremium || isAdmin
  const isDark = theme === 'dark'

  const styles = {
    modalBg: isDark ? 'bg-slate-900' : 'bg-white',
    headerBg: isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200',
    headerTitle: isDark ? 'text-white' : 'text-slate-900',
    subText: isDark ? 'text-slate-400' : 'text-slate-600',
    badgeBg: isDark ? 'bg-slate-700 text-slate-300 border-slate-600' : 'bg-slate-100 text-slate-700 border-slate-300',
    selectBg: isDark ? 'bg-slate-800 text-slate-200' : 'bg-white text-slate-800',
    navGroupBg: isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-300',
    controlBar: isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-300',
    stepBadge: isDark ? 'bg-emerald-900/30 text-emerald-400 border-emerald-700' : 'bg-emerald-100 text-emerald-700 border-emerald-300',
    panelBg: isDark ? 'bg-slate-800' : 'bg-slate-50',
    panelHeader: isDark ? 'bg-slate-900 text-slate-400' : 'bg-slate-200 text-slate-600',
    codeActiveLine: isDark ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300' : 'bg-emerald-100 border-emerald-500 text-emerald-800',
    codeInactiveLine: isDark ? 'text-slate-300' : 'text-slate-700',
  }

  const resetInteractionState = useCallback(() => {
    setCurrentStep(0)
    setSelectedOption(null)
    setHasSubmitted(false)
    setUserStats(null)
    setTimeLeft(60)
    setTimerRunning(false)
  }, [])

  // Timer effect
  useEffect(() => {
    if (!timerRunning || !data || hasSubmitted) return
    
    if (timeLeft <= 0) {
      setTimerRunning(false)
      return
    }
    
    const timer = setTimeout(() => {
      setTimeLeft(prev => prev - 1)
    }, 1000)
    
    return () => clearTimeout(timer)
  }, [timeLeft, timerRunning, data, hasSubmitted])

  // Native Browser Fullscreen Toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      modalRef.current?.requestFullscreen?.().catch(() => {})
    } else {
      document.exitFullscreen?.().catch(() => {})
    }
  }

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  const fetchNewDrill = useCallback(async (selectedSubject: string) => {
    // Check if free user has reached daily limit
    if (!hasPremiumAccess && dailyDrillCount >= FREE_DAILY_LIMIT) {
      setShowUpgradeModal(true)
      return
    }
    
    setIsLoading(true)
    setError(null)

    try {
      const res = await drillsApi.getCodeTrace(selectedSubject)
      setData(res)
      resetInteractionState()
      setDailyDrillCount(prev => prev + 1)
      setTimerRunning(true)
      setTimeLeft(60)

      setDrillHistory((prev) => [...prev, res])
      setHistoryIndex((prev) => prev + 1)
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { detail?: string } } }
      const msg = errorObj?.response?.data?.detail || 'Failed to load code trace drill.'
      
      // If premium required error, show upgrade modal
      if (msg.includes('Premium') || msg.includes('upgrade')) {
        setShowUpgradeModal(true)
      } else {
        setError(msg)
      }
    } finally {
      setIsLoading(false)
    }
  }, [resetInteractionState, hasPremiumAccess, dailyDrillCount])

  useEffect(() => {
    if (!isOpen) return
    setDrillHistory([])
    setHistoryIndex(-1)
    fetchNewDrill(subject)
  }, [isOpen])

  const handlePrevDrill = () => {
    if (historyIndex <= 0 || isLoading) return
    const newIndex = historyIndex - 1
    setHistoryIndex(newIndex)
    setData(drillHistory[newIndex])
    resetInteractionState()
  }

  const handleNextDrill = () => {
    if (isLoading) return
    if (historyIndex < drillHistory.length - 1) {
      const newIndex = historyIndex + 1
      setHistoryIndex(newIndex)
      setData(drillHistory[newIndex])
      resetInteractionState()
    } else {
      fetchNewDrill(subject)
    }
  }

  // Keyboard navigation shortcuts
  useEffect(() => {
    if (!isOpen || !data) return
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement
      const isInputActive = activeEl && ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(activeEl.tagName)

      if (e.key === 'ArrowRight' && !isInputActive) {
        e.preventDefault()
        setCurrentStep((prev) => Math.min(data.trace_steps.length - 1, prev + 1))
      } else if (e.key === 'ArrowLeft' && !isInputActive) {
        e.preventDefault()
        setCurrentStep((prev) => Math.max(0, prev - 1))
      } else if (e.key === 'Escape' && !document.fullscreenElement) {
        e.preventDefault()
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, data, onClose])

  const handleSubmitAnswer = async () => {
    if (selectedOption === null || !data?.attempt_id) return
    
    setIsSubmitting(true)
    const isCorrect = selectedOption === data.correct_option_index

    try {
      if (data.attempt_id) {
        const res = await drillsApi.submitDrill({
          attempt_id: data.attempt_id,
          is_correct: isCorrect,
          selected_option: selectedOption
        })
        setUserStats({
          total: res.total_attempts,
          correct: res.correct_attempts,
          accuracy: res.accuracy_percentage
        })
      }
      setHasSubmitted(true)
      setTimerRunning(false)
    } catch {
      setHasSubmitted(true)
      setTimerRunning(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  const codeLines = data?.code_snippet?.split('\n') ?? []
  const activeStepObj = data?.trace_steps?.[currentStep] as ExtendedTraceStep | undefined
  const activeVariables = activeStepObj?.variables ?? {}

  if (!isOpen) return null

  return (
    <>
      <div 
        ref={modalRef}
        className={`fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm overflow-y-auto ${
          isFullscreen ? 'p-0' : 'p-4'
        }`}
      >
        <div 
          className={`${styles.modalBg} border w-full flex flex-col shadow-2xl overflow-hidden font-sans transition-all duration-200 ${
            isFullscreen 
              ? 'h-screen w-screen rounded-none border-none max-w-none max-h-none' 
              : 'max-w-4xl max-h-[92vh] rounded-xl'
          }`}
        >
          {/* Header */}
          <div className={`flex items-center justify-between border-b p-4 ${styles.headerBg}`}>
            <div className="flex items-center gap-3">
              <span className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 font-mono text-sm font-bold border border-emerald-500/20">
                &lt;/&gt;
              </span>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className={`font-semibold text-base ${styles.headerTitle}`}>
                    Code Trace Debugger
                  </h3>
                  {data && (
                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border whitespace-nowrap ${styles.badgeBg}`}>
                      {hasPremiumAccess
                        ? 'Premium'
                        : `Free (${data.drills_remaining_today ?? 0} left today)`}
                    </span>
                  )}
                  {data && !hasSubmitted && (
                    <span className={`text-xs font-bold px-2 py-1 rounded-lg ${
                      timeLeft <= 10 
                        ? 'bg-red-500 text-white animate-pulse' 
                        : 'bg-slate-700 text-white'
                    }`}>
                      {timeLeft}s
                    </span>
                  )}
                </div>
                <p className={`text-xs mt-0.5 ${styles.subText}`}>
                  {data?.topic || 'Step through execution line-by-line'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Subject Selector */}
              <select
                value={subject}
                onChange={(e) => {
                  setSubject(e.target.value)
                  fetchNewDrill(e.target.value)
                }}
                className={`${styles.selectBg} border rounded-lg text-xs font-semibold px-3 py-1.5 focus:outline-none focus:border-emerald-500 cursor-pointer`}
              >
                {SUBJECT_OPTIONS.map((s) => (
                  <option key={s.slug} value={s.slug}>
                    {s.label}
                  </option>
                ))}
              </select>

              {/* Theme Toggle */}
              <button
                onClick={() => setTheme(prev => prev === 'dark' ? 'light' : 'dark')}
                className={`p-1.5 rounded-lg border text-xs font-semibold transition-colors ${
                  isDark 
                    ? 'bg-slate-800 border-slate-700 text-amber-300 hover:bg-slate-700' 
                    : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                }`}
              >
                {isDark ? 'Light' : 'Dark'}
              </button>

              {/* Fullscreen Toggle */}
              <button
                onClick={toggleFullscreen}
                className={`px-2 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
                  isDark 
                    ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' 
                    : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                }`}
              >
                {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
              </button>

              {/* Drill Navigation */}
              <div className={`flex items-center rounded-lg p-0.5 border ${styles.navGroupBg}`}>
                <button
                  disabled={historyIndex <= 0 || isLoading}
                  onClick={handlePrevDrill}
                  className="px-2 py-1 text-xs hover:text-emerald-500 disabled:opacity-30 transition-colors"
                >
                  Prev
                </button>
                <span className="text-slate-500 text-xs">|</span>
                <button
                  disabled={isLoading}
                  onClick={handleNextDrill}
                  className="px-2 py-1 text-xs text-emerald-500 font-semibold hover:text-emerald-400 disabled:opacity-30 transition-colors"
                >
                  Next
                </button>
              </div>

              {/* Close */}
              <button
                onClick={onClose}
                className={`${styles.subText} hover:text-slate-900 p-1 rounded-lg hover:bg-slate-200/50 transition-colors ml-1`}
              >
                ✕
              </button>
            </div>
          </div>

          {/* Content Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {isLoading ? (
              <div className="py-20 text-center space-y-3">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-emerald-500 border-t-transparent"></div>
                <p className={`text-sm font-mono ${styles.subText}`}>
                  Generating drill...
                </p>
              </div>
            ) : error ? (
              <div className="py-12 px-6 text-center bg-red-950/30 border border-red-800/50 rounded-lg">
                <p className="text-red-400 font-medium text-sm">{error}</p>
              </div>
            ) : data ? (
              <div className="space-y-4">
                {/* Stepper Toolbar */}
                <div className={`flex items-center justify-between border rounded-lg p-3 ${styles.controlBar}`}>
                  <div className={`flex items-center gap-2 font-mono text-xs ${styles.subText}`}>
                    <span>Step:</span>
                    <span className={`px-2 py-0.5 rounded font-bold border ${styles.stepBadge}`}>
                      {currentStep + 1} / {data.total_steps || data.trace_steps.length}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      disabled={currentStep === 0}
                      onClick={() => setCurrentStep(prev => Math.max(0, prev - 1))}
                      className="px-3 py-1.5 text-xs font-semibold rounded transition-colors disabled:opacity-40 bg-slate-700 hover:bg-slate-600 text-white"
                    >
                      Back
                    </button>
                    <button
                      disabled={currentStep >= data.trace_steps.length - 1}
                      onClick={() => setCurrentStep(prev => Math.min(data.trace_steps.length - 1, prev + 1))}
                      className="px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-40 rounded transition-colors"
                    >
                      Forward
                    </button>
                    <button
                      onClick={() => setCurrentStep(0)}
                      className={`px-2 py-1.5 text-xs ${styles.subText} hover:text-emerald-500 transition-colors`}
                    >
                      Reset
                    </button>
                  </div>
                </div>

                {/* Debugger Workspace */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Code Viewer */}
                  <div className={`md:col-span-2 border rounded-lg overflow-hidden font-mono text-xs ${styles.panelBg}`}>
                    <div className={`border-b px-3 py-1.5 text-[11px] flex justify-between ${styles.panelHeader}`}>
                      <span>snippet.{data.language || 'cpp'}</span>
                      <span>Active Line: {activeStepObj?.line_number ?? '-'}</span>
                    </div>
                    <div className="p-3 overflow-x-auto space-y-1">
                      {codeLines.map((line: string, idx: number) => {
                        const lineNum = idx + 1
                        const isActive = activeStepObj?.line_number === lineNum
                        return (
                          <div
                            key={idx}
                            className={`flex items-start gap-2 px-2 py-0.5 rounded transition-colors ${
                              isActive ? styles.codeActiveLine : styles.codeInactiveLine
                            }`}
                          >
                            <span className="w-6 text-right text-slate-500">{lineNum}</span>
                            <span>{line}</span>
                            {isActive && <span className="ml-auto text-emerald-500">◀</span>}
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Memory Inspector */}
                  <div className={`border rounded-lg overflow-hidden ${styles.panelBg}`}>
                    <div className={`border-b px-3 py-1.5 text-[11px] ${styles.panelHeader}`}>
                      Memory Inspector
                    </div>
                    <div className="p-3">
                      {activeVariables && Object.keys(activeVariables).length > 0 ? (
                        <div className="space-y-2">
                          {Object.entries(activeVariables).map(([key, value]) => (
                            <div key={key} className="flex items-center justify-between bg-slate-800/50 px-3 py-2 rounded-lg">
                              <span className="font-mono text-sm text-emerald-400">{key}</span>
                              <span className="font-mono text-sm text-white">{String(value)}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500">No variables in current scope.</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Terminal + Explanation */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className={`border rounded-lg overflow-hidden font-mono text-xs ${styles.panelBg}`}>
                    <div className={`border-b px-3 py-1.5 text-[11px] ${styles.panelHeader}`}>
                      Terminal Output
                    </div>
                    <div className="p-3">
                      <pre className="text-emerald-400 whitespace-pre-wrap">
                        {activeStepObj?.stdout_so_far || '[ No output yet ]'}
                      </pre>
                    </div>
                  </div>

                  <div className={`border rounded-lg overflow-hidden ${styles.panelBg}`}>
                    <div className={`border-b px-3 py-1.5 text-[11px] ${styles.panelHeader}`}>
                      Explanation
                    </div>
                    <div className="p-3">
                      <p className="text-sm text-slate-300 leading-relaxed">
                        {activeStepObj?.explanation || 'No explanation available.'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Quiz Assessment */}
                <div className={`border rounded-lg p-4 ${styles.panelBg}`}>
                  <p className={`text-sm font-bold mb-3 ${styles.headerTitle}`}>
                    Exam Question
                  </p>
                  {data.exit_exam_question && (
                    <p className="text-sm text-slate-300 mb-3">{data.exit_exam_question}</p>
                  )}
                  
                  <div className="space-y-2">
                    {data.options?.map((opt: string, idx: number) => (
                      <button
                        key={idx}
                        disabled={hasSubmitted}
                        onClick={() => setSelectedOption(idx)}
                        className={`w-full text-left px-4 py-3 rounded-lg border transition-all ${
                          selectedOption === idx
                            ? 'bg-emerald-500/20 border-emerald-500 text-white'
                            : 'bg-slate-800/50 border-slate-700 text-slate-300 hover:border-slate-500'
                        }`}
                      >
                        <span className="font-bold mr-2">{String.fromCharCode(65 + idx)}.</span>
                        {opt}
                      </button>
                    ))}
                  </div>

                  {!hasSubmitted && (
                    <button
                      onClick={handleSubmitAnswer}
                      disabled={selectedOption === null || isSubmitting}
                      className="mt-4 w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded-lg disabled:opacity-50 transition-colors"
                    >
                      {isSubmitting ? 'Submitting...' : 'Submit Answer'}
                    </button>
                  )}

                  {hasSubmitted && (
                    <div className={`mt-4 p-4 rounded-lg ${
                      selectedOption === data.correct_option_index 
                        ? 'bg-emerald-500/10 border border-emerald-500/30' 
                        : 'bg-red-500/10 border border-red-500/30'
                    }`}>
                      <p className={`text-sm font-bold ${
                        selectedOption === data.correct_option_index ? 'text-emerald-400' : 'text-red-400'
                      }`}>
                        {selectedOption === data.correct_option_index ? 'Correct' : 'Incorrect'}
                      </p>
                      {data.distractor_explanation && (
                        <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                          {data.distractor_explanation}
                        </p>
                      )}
                      
                      {userStats && (
                        <div className="mt-3 pt-3 border-t border-slate-700 flex gap-4 text-xs text-slate-400">
                          <span>Total: {userStats.total}</span>
                          <span>Correct: {userStats.correct}</span>
                          <span>Accuracy: {userStats.accuracy}%</span>
                        </div>
                      )}

                      <button
                        onClick={handleNextDrill}
                        className="mt-3 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition-colors"
                      >
                        Next Drill
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Upgrade Modal */}
      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        customMessage="Code Trace Drills let you practice debugging real code. Upgrade to Premium for unlimited access."
      />
    </>
  )
}
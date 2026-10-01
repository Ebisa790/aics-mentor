import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { courseApi, tutorApi } from '../api'
import { useAuth } from '../context/AuthContext'
import {
  Crown,
  Plus,
  Trash2,
  PanelLeft,
  PanelRight,
  MessageCircle,
  GraduationCap,
  Copy,
  Check,
  Send,
  Loader2,
  BookOpen,
  Sparkles,
  AlertTriangle,
  ArrowDown,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import type {
  ChatMessage,
  Course,
  TutorMode,
  Conversation,
} from '../api/types'

function truncateTitle(title: string, max = 40): string {
  if (!title) return 'Untitled Session'
  const clean = title.replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean
  return clean.slice(0, max).trimEnd() + '...'
}

const MODES: { value: TutorMode; label: string }[] = [
  { value: 'explanation', label: 'Explain' },
  { value: 'beginner', label: 'Beginner' },
  { value: 'advanced', label: 'Advanced' },
]

function cleanAIResponse(content: string): string {
  if (!content) return ''
  let cleaned = content
  cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, '')
  cleaned = cleaned.replace(/<\/?think>/gi, '')
  return cleaned.trim()
}

function FormattedMessageContent({ content }: { content: string }) {
  if (!content) return null

  return (
    <div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-2 prose-p:text-slate-700 dark:prose-p:text-slate-300 prose-headings:mt-3 prose-headings:mb-1.5 prose-headings:text-slate-900 dark:prose-headings:text-white prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5 prose-li:text-slate-700 dark:prose-li:text-slate-300 prose-code:rounded prose-code:bg-slate-100 dark:prose-code:bg-slate-800 prose-code:px-1.5 prose-code:py-0.5 prose-code:text-[0.85em] prose-code:font-mono prose-code:text-rose-600 dark:prose-code:text-rose-400 prose-code:before:content-none prose-code:after:content-none prose-pre:rounded-xl prose-pre:bg-slate-950 prose-pre:p-3 prose-pre:my-3 prose-blockquote:border-l-4 prose-blockquote:border-indigo-400 prose-blockquote:pl-3 prose-blockquote:italic prose-table:text-xs prose-table:my-3 prose-th:bg-slate-100 dark:prose-th:bg-slate-800 prose-th:px-2 prose-th:py-1.5 prose-th:text-left prose-td:px-2 prose-td:py-1.5 prose-td:border-t prose-td:border-slate-200 dark:prose-td:border-slate-700">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

function ChatMessageCard({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user'
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* ignore */
    }
  }

  return (
    <div
      className={`flex gap-3 w-full max-w-3xl ${
        isUser ? 'ml-auto justify-end' : 'mr-auto justify-start'
      }`}
    >
      {!isUser && (
        <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 shadow-sm border border-indigo-200 dark:border-indigo-800 mt-0.5">
          <GraduationCap className="w-4 h-4" />
        </div>
      )}

      <div
        className={`relative px-4 py-3 rounded-2xl max-w-[85%] sm:max-w-[78%] shadow-sm transition-all group ${
          isUser
            ? 'bg-indigo-600 text-white rounded-br-md'
            : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-bl-md'
        }`}
      >
        {isUser ? (
          <p className="text-sm leading-relaxed whitespace-pre-wrap">
            {message.content}
          </p>
        ) : (
          <FormattedMessageContent content={cleanAIResponse(message.content)} />
        )}

        <div
          className={`mt-1.5 flex items-center justify-end gap-2 ${
            isUser ? '' : 'opacity-60 group-hover:opacity-100 transition-opacity'
          }`}
        >
          {!isUser && (
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
              title="Copy answer"
            >
              {copied ? (
                <>
                  <Check className="w-3 h-3" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>Copy</span>
                </>
              )}
            </button>
          )}

          <span
            className={`text-[10px] ${
              isUser ? 'text-white/80' : 'text-slate-400 dark:text-slate-500'
            }`}
          >
            {new Date(message.created_at || Date.now()).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </div>
      </div>

      {isUser && (
        <div className="w-8 h-8 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center justify-center font-semibold text-xs shrink-0 mt-0.5">
          You
        </div>
      )}
    </div>
  )
}

export function TutorPage() {
  const { isPremium, isAdmin } = useAuth()
  const navigate = useNavigate()

  const [courses, setCourses] = useState<Course[]>([])
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [courseId, setCourseId] = useState<string>('')
  const [mode, setMode] = useState<TutorMode>('explanation')
  const [conversationId, setConversationId] = useState<string | undefined>(
    undefined,
  )
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [streamingText, setStreamingText] = useState<string>('')

  // FIX 3 — loading state for conversations
  const [isLoadingConversations, setIsLoadingConversations] = useState(true)

  // FIX 1 — sidebar starts collapsed on mobile, open on desktop
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true
    return window.matchMedia('(min-width: 1024px)').matches
  })

  // FIX 4 & 5 — custom delete confirmation + error handling
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // FIX 8 — scroll-to-bottom button
  const [showScrollButton, setShowScrollButton] = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    courseApi
      .list()
      .then((data) => setCourses(data))
      .catch(() => {})

    fetchConversations()
  }, [])

  const fetchConversations = () => {
    setIsLoadingConversations(true)
    tutorApi
      .conversations()
      .then((data) => setConversations(data))
      .catch(() => {})
      .finally(() => setIsLoadingConversations(false))
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isSending, streamingText])

  // Auto-grow the input textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    const maxHeight = 160
    el.style.height = Math.min(el.scrollHeight, maxHeight) + 'px'
  }, [input])

  // FIX 8 — track scroll position to show/hide the scroll button
  const handleScroll = () => {
    const el = messagesContainerRef.current
    if (!el) return
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    setShowScrollButton(distanceFromBottom > 120)
  }

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const loadConversation = async (id: string) => {
    try {
      const data = await tutorApi.conversation(id)
      setConversationId(data.id)
      setMessages(data.messages || [])
      if (data.course_id) setCourseId(data.course_id)
    } catch {
      /* ignore */
    }
  }

  const startNewChat = () => {
    setConversationId(undefined)
    setMessages([])
    setCourseId('')
  }

  // FIX 4 & 5 — delete via modal, with error preservation
  const handleConfirmDelete = async () => {
    if (!confirmDeleteId) return
    setDeleting(true)
    setDeleteError(null)
    try {
      await tutorApi.deleteConversation(confirmDeleteId)
      setConversations((prev) => prev.filter((c) => c.id !== confirmDeleteId))
      if (conversationId === confirmDeleteId) {
        startNewChat()
      }
      setConfirmDeleteId(null)
    } catch (err: any) {
      setDeleteError(
        err?.response?.data?.detail ||
          "Couldn't delete this session. Please try again.",
      )
    } finally {
      setDeleting(false)
    }
  }

  const sendMessage = async (textToSend: string) => {
    const text = textToSend.trim()
    if (!text || isSending) return

    const optimisticUserMessage: ChatMessage = {
      id: `local-${Date.now()}`,
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, optimisticUserMessage])
    setInput('')
    setIsSending(true)
    setStreamingText('')

    try {
      const response = await tutorApi.chatStream({
        conversation_id: conversationId,
        course_id: courseId || undefined,
        mode,
        message: text,
        onMeta: (meta) => {
          if (!conversationId) setConversationId(meta.conversation_id)
        },
        onDelta: (chunk) => {
          setStreamingText((prev) => prev + chunk)
        },
      })

      setMessages((prev) => [...prev, response.reply])
      setStreamingText('')
      fetchConversations()
    } catch (streamErr) {
      setStreamingText('')
      try {
        const response = await tutorApi.chat({
          conversation_id: conversationId,
          course_id: courseId || undefined,
          mode,
          message: text,
        })
        setMessages((prev) => [...prev, response.reply])
        if (!conversationId && response.conversation_id) {
          setConversationId(response.conversation_id)
        }
        fetchConversations()
      } catch (fallbackErr) {
        // FIX 6 — different error messages for different statuses
        let errorContent =
          'Sorry, the tutor is unavailable right now. Please try again in a moment.'
        if (axios.isAxiosError(fallbackErr)) {
          const status = fallbackErr.response?.status
          const detail = fallbackErr.response?.data?.detail
          if (status === 429) {
            errorContent =
              detail ||
              "You've reached your daily AI limit. Please try again tomorrow, or upgrade for unlimited access."
          } else if (status === 401) {
            errorContent = 'Your session expired. Please log in again.'
          } else if (status && status >= 500) {
            errorContent =
              'The tutor is temporarily unavailable. Please try again in a moment.'
          } else if (!fallbackErr.response) {
            errorContent =
              "Couldn't reach the tutor. Check your internet connection and try again."
          } else if (typeof detail === 'string') {
            errorContent = detail
          }
        }

        const errorMessage: ChatMessage = {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: errorContent,
          created_at: new Date().toISOString(),
        }
        setMessages((prev) => [...prev, errorMessage])
      }
    } finally {
      setIsSending(false)
      setStreamingText('')
    }
  }

  const handleSend = (e: FormEvent) => {
    e.preventDefault()
    sendMessage(input)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (!isSending && input.trim()) {
        sendMessage(input)
      }
    }
    if (e.key === 'Escape') setInput('')
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] max-w-7xl mx-auto py-3 px-3 sm:px-4 gap-3.5 antialiased">
      {/* Sidebar - Chat History */}
      <aside
        className={`flex flex-col transition-all duration-300 ease-in-out bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl ${
          isSidebarOpen
            ? 'w-72 p-3.5 shadow-sm'
            : 'w-0 p-0 opacity-0 overflow-hidden border-0'
        }`}
      >
        <div className="flex items-center justify-between mb-3 px-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Study History
          </span>

          <button
            onClick={startNewChat}
            className="text-xs bg-indigo-600 text-white hover:bg-indigo-700 font-medium px-3 py-1.5 rounded-xl transition-all flex items-center gap-1 active:scale-95"
          >
            <Plus className="w-3 h-3" /> New Chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-1 pr-1">
          {/* FIX 3 — loading skeleton instead of false empty state */}
          {isLoadingConversations ? (
            <div className="space-y-2 py-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-9 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse"
                />
              ))}
            </div>
          ) : conversations.length === 0 ? (
            <div className="text-center py-10 px-2">
              <MessageCircle className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
              <p className="text-xs text-slate-400 font-medium">
                No previous study sessions.
              </p>
            </div>
          ) : (
            conversations.map((conv) => (
              <div
                key={conv.id}
                className={`group flex items-center justify-between w-full text-xs p-2.5 rounded-xl transition-all ${
                  conversationId === conv.id
                    ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-400 font-semibold border border-indigo-200 dark:border-indigo-800'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white border border-transparent'
                }`}
              >
                <button
                  onClick={() => loadConversation(conv.id)}
                  className="flex-1 text-left truncate pr-2"
                  title={conv.title || 'Untitled Session'}
                >
                  {truncateTitle(conv.title || 'Untitled Session', 40)}
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setConfirmDeleteId(conv.id)
                    setDeleteError(null)
                  }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg hover:bg-red-500/10 text-slate-400 hover:text-red-500"
                  title="Delete Session"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* Premium Gate for Free Users */}
      {!isPremium && !isAdmin ? (
        <main className="flex-1 flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 items-center justify-center">
          <div className="text-center max-w-md px-6">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto mb-4 border border-amber-500/30">
              <Crown className="w-8 h-8 fill-amber-500" />
            </div>

            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
              Study Assistant is a Premium Feature
            </h2>

            <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
              Get unlimited tutoring, exam-focused explanations, and
              personalized study guidance across all 16 CS courses.
            </p>

            <div className="space-y-2.5 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 text-left text-xs mb-6">
              {/* FIX 7 — proper lucide check icons */}
              <div className="flex items-center gap-2.5 text-slate-700 dark:text-slate-300">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/10">
                  <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" strokeWidth={3} />
                </span>
                <span>Unlimited study assistant conversations</span>
              </div>

              <div className="flex items-center gap-2.5 text-slate-700 dark:text-slate-300">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/10">
                  <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" strokeWidth={3} />
                </span>
                <span>Exam-focused explanations and walkthroughs</span>
              </div>

              <div className="flex items-center gap-2.5 text-slate-700 dark:text-slate-300">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/10">
                  <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" strokeWidth={3} />
                </span>
                <span>Personalized study recommendations</span>
              </div>
            </div>

            <button
              onClick={() => navigate('/pricing')}
              className="w-full bg-indigo-600 text-white font-bold py-3 px-6 rounded-xl text-sm hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2"
            >
              <Crown className="w-4 h-4 fill-amber-400 text-amber-400" />
              Upgrade
            </button>
          </div>
        </main>
      ) : (
        /* Main Container */
        <main className="flex-1 flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 sm:p-5 overflow-hidden">
          {/* Top Navigation & Controls */}
          <header className="flex flex-wrap items-end justify-between gap-3 mb-3 border-b border-slate-200 dark:border-slate-700 pb-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all flex items-center gap-1.5"
                title="Toggle History Sidebar"
              >
                {isSidebarOpen ? (
                  <PanelLeft className="w-3 h-3" />
                ) : (
                  <PanelRight className="w-3 h-3" />
                )}
                {isSidebarOpen ? 'Hide' : 'Show'} History
              </button>

              <div>
                <h1 className="text-base sm:text-lg font-bold leading-tight text-slate-900 dark:text-white flex items-center gap-2">
                  Study Assistant
                </h1>

                <p className="text-[11px] text-slate-400">
                  CS Exit Exam Preparation
                </p>
              </div>
            </div>

            {/* FIX 9 — labeled selectors */}
            <div className="flex items-end gap-2">
              <div className="flex flex-col">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 pl-1">
                  Course
                </label>
                <div className="relative">
                  <BookOpen className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />

                  <select
                    className="appearance-none py-1.5 pl-8 pr-7 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-indigo-300 dark:hover:border-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-colors cursor-pointer"
                    value={courseId}
                    onChange={(e) => {
                      setCourseId(e.target.value)
                      setConversationId(undefined)
                      setMessages([])
                    }}
                  >
                    <option value="">All Courses</option>

                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-col">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 pl-1">
                  Mode
                </label>
                <div className="relative">
                  <Sparkles className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />

                  <select
                    className="appearance-none py-1.5 pl-8 pr-7 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-indigo-300 dark:hover:border-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-colors cursor-pointer"
                    value={mode}
                    onChange={(e) => setMode(e.target.value as TutorMode)}
                  >
                    {MODES.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </header>

          {/* Message Workspace */}
          <div className="relative flex-1 min-h-0">
            <div
              ref={messagesContainerRef}
              onScroll={handleScroll}
              className="absolute inset-0 overflow-y-auto space-y-5 pr-2 sm:pr-3"
            >
              {messages.length === 0 && !isSending && (
                <div className="flex h-full items-center justify-center px-4">
                  <div className="text-center max-w-sm">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60">
                      <Sparkles className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                    </div>

                    <h2 className="text-base font-bold text-slate-900 dark:text-white mb-1">
                      Ask anything
                    </h2>

                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      Pick a course above for focused answers, or ask a general
                      CS question to get started.
                    </p>
                  </div>
                </div>
              )}

              {messages.map((m) => (
                <ChatMessageCard key={m.id} message={m} />
              ))}

              {/* FIX 2 — streaming text now renders as markdown */}
              {isSending && streamingText && (
                <div className="flex justify-start items-start gap-2">
                  <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                    <GraduationCap className="w-4 h-4" />
                  </div>

                  <div className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3 max-w-[80%]">
                    <FormattedMessageContent
                      content={cleanAIResponse(streamingText)}
                    />
                    <span className="inline-block w-2 h-3.5 ml-0.5 align-middle bg-indigo-500 animate-pulse" />
                  </div>
                </div>
              )}

              {isSending && !streamingText && (
                <div className="flex justify-start items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                    <GraduationCap className="w-4 h-4" />
                  </div>

                  <div className="text-xs text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3 flex items-center gap-2.5">
                    <span className="w-2 h-2 rounded-full bg-indigo-600 animate-ping" />
                    Thinking...
                  </div>
                </div>
              )}

              <div ref={bottomRef} />
            </div>

            {/* FIX 8 — scroll-to-bottom button */}
            {showScrollButton && (
              <button
                type="button"
                onClick={scrollToBottom}
                className="absolute bottom-4 right-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-lg transition hover:scale-105 active:scale-95"
                aria-label="Scroll to latest message"
                title="Scroll to latest"
              >
                <ArrowDown className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Input Form */}
          <form
            onSubmit={handleSend}
            className="flex items-end gap-2 mt-3 pt-3 border-t border-slate-200 dark:border-slate-700"
          >
            {/* FIX 10 — textarea disabled during sending */}
            <textarea
              ref={textareaRef}
              rows={1}
              disabled={isSending}
              className="flex-1 resize-none text-xs sm:text-sm py-3 px-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all leading-relaxed disabled:opacity-60 disabled:cursor-not-allowed"
              placeholder="Ask a question... (Enter to send, Shift+Enter for new line)"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
            />

            <button
              type="submit"
              disabled={isSending || !input.trim()}
              className="shrink-0 inline-flex items-center justify-center gap-2 text-xs sm:text-sm px-5 py-3 rounded-2xl font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Send message"
            >
              {isSending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="hidden sm:inline">Sending</span>
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  <span className="hidden sm:inline">Send</span>
                </>
              )}
            </button>
          </form>
        </main>
      )}

      {/* FIX 4 & 5 — Custom delete confirmation modal */}
      {confirmDeleteId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !deleting) {
              setConfirmDeleteId(null)
            }
          }}
        >
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400">
                <AlertTriangle className="h-5 w-5" />
              </div>

              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Delete this session?
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                  The conversation and all its messages will be permanently
                  removed. This can't be undone.
                </p>
              </div>
            </div>

            {deleteError && (
              <div className="mt-3 rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 px-3 py-2 text-xs text-rose-700 dark:text-rose-400">
                {deleteError}
              </div>
            )}

            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmDeleteId(null)}
                disabled={deleting}
                className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 hover:bg-rose-700 px-4 py-2.5 text-sm font-bold text-white transition active:scale-95 disabled:opacity-50"
              >
                {deleting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    <span>Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
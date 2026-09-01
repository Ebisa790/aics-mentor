import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { courseApi, tutorApi } from '../api'
import { useAuth } from '../context/AuthContext'
import { Crown, Plus, Trash2, PanelLeft, PanelRight, BookOpen, MessageCircle, GraduationCap } from 'lucide-react'
import type {
  ChatMessage,
  Course,
  TutorMode,
  Conversation,
} from '../api/types'

const MODES: { value: TutorMode; label: string }[] = [
  { value: 'explanation', label: 'Explain' },
  { value: 'beginner', label: 'Beginner' },
  { value: 'advanced', label: 'Advanced' },
]

const QUICK_PROMPTS = [
  {
    title: 'Database Normalization',
    prompt: 'Explain Database Normalization (1NF, 2NF, 3NF)',
  },
  {
    title: 'TCP vs UDP Protocols',
    prompt: 'What is the key difference between TCP and UDP?',
  },
  {
    title: "Dijkstra's Algorithm",
    prompt: "Give me an example of Dijkstra's Shortest Path Algorithm",
  },
  {
    title: 'Virtual Memory',
    prompt: 'How do virtual memory and page tables work in OS?',
  },
]

function cleanAIResponse(content: string): string {
  if (!content) return ''

  let cleaned = content

  // Remove <think> blocks
  cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, '')
  cleaned = cleaned.replace(/<\/?think>/gi, '')

  // Remove markdown bold
  cleaned = cleaned.replace(/\*\*(.*?)\*\*/g, '$1')

  // Remove markdown italic
  cleaned = cleaned.replace(/\*(.*?)\*/g, '$1')

  // Remove markdown headers
  cleaned = cleaned.replace(/^#{1,6}\s+/gm, '')

  // Remove markdown table separators
  cleaned = cleaned.replace(/\|/g, ' ')

  cleaned = cleaned.replace(/^[-\s]+$/gm, '')

  return cleaned.trim()
}

function FormattedMessageContent({ content }: { content: string }) {
  if (!content) return null

  const lines = content.split('\n')

  return (
    <div className="space-y-2 text-sm leading-relaxed select-text">
      {lines.map((line, idx) => {
        const trimmed = line.trim()

        if (!trimmed) {
          return <div key={idx} className="h-1" />
        }

        if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
          const cleanText = trimmed.replace(/^[*\-]\s+/, '')

          return (
            <li
              key={idx}
              className="ml-4 list-disc marker:text-slate-400 pl-1"
            >
              {renderBoldText(cleanText)}
            </li>
          )
        }

        if (trimmed.startsWith('#')) {
          const headerText = trimmed.replace(/^#+\s+/, '')

          return (
            <h4
              key={idx}
              className="font-semibold text-base mt-3 mb-1 text-slate-900 dark:text-white"
            >
              {renderBoldText(headerText)}
            </h4>
          )
        }

        return (
          <p key={idx} className="text-slate-700 dark:text-slate-300">
            {renderBoldText(trimmed)}
          </p>
        )
      })}
    </div>
  )
}

function renderBoldText(text: string) {
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*)/g)

  return parts.map((part, index) => {
    if (
      (part.startsWith('**') && part.endsWith('**')) ||
      (part.startsWith('*') && part.endsWith('*'))
    ) {
      const inner = part.replace(/^\*+|\*+$/g, '')

      return (
        <strong key={index} className="font-semibold text-slate-900 dark:text-white">
          {inner}
        </strong>
      )
    }

    return part
  })
}

function ChatMessageCard({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user'

  return (
    <div
      className={`flex gap-3 w-full max-w-3xl ${
        isUser
          ? 'ml-auto justify-end'
          : 'mr-auto justify-start'
      }`}
    >
      {!isUser && (
        <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 shadow-sm border border-indigo-200 dark:border-indigo-800 mt-0.5">
          <GraduationCap className="w-4 h-4" />
        </div>
      )}

      <div
        className={`relative px-4 py-3 rounded-2xl max-w-[85%] sm:max-w-[78%] shadow-sm transition-all ${
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
          <FormattedMessageContent
            content={cleanAIResponse(message.content)}
          />
        )}

        <div
          className={`text-[10px] mt-1.5 opacity-60 text-right ${
            isUser ? 'text-white/80' : 'text-slate-400 dark:text-slate-500'
          }`}
        >
          {new Date(
            message.created_at || Date.now(),
          ).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
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
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)

  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    courseApi
      .list()
      .then((data) => setCourses(data))
      .catch(() => {})

    fetchConversations()
  }, [])

  const fetchConversations = () => {
    tutorApi
      .conversations()
      .then((data) => setConversations(data))
      .catch(() => {})
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isSending])

  const loadConversation = async (id: string) => {
    try {
      const data = await tutorApi.conversation(id)

      setConversationId(data.id)
      setMessages(data.messages || [])

      if (data.course_id) {
        setCourseId(data.course_id)
      }
    } catch {
      // Handle error silently
    }
  }

  const startNewChat = () => {
    setConversationId(undefined)
    setMessages([])
    setCourseId('')
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

    try {
      const response = await tutorApi.chat({
        conversation_id: conversationId,
        course_id: courseId || undefined,
        mode,
        message: text,
      })

      setConversationId(response.conversation_id)
      setMessages((prev) => [...prev, response.reply])

      fetchConversations()
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content:
            "I couldn't connect to the study assistant. Please check your connection and try again.",
          created_at: new Date().toISOString(),
        },
      ])
    } finally {
      setIsSending(false)
    }
  }

  const handleSend = (e: FormEvent) => {
    e.preventDefault()
    sendMessage(input)
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
          {conversations.length === 0 ? (
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
                >
                  {conv.title || 'Untitled Session'}
                </button>

                <button
                  onClick={async (e) => {
                    e.stopPropagation()

                    if (
                      !confirm(
                        'Delete this session?',
                      )
                    ) {
                      return
                    }

                    try {
                      await tutorApi.deleteConversation(conv.id)

                      setConversations((prev) =>
                        prev.filter((c) => c.id !== conv.id),
                      )

                      if (conversationId === conv.id) {
                        startNewChat()
                      }
                    } catch {
                      // Handle error
                    }
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
              <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                <span className="text-emerald-500">✓</span>
                <span>Unlimited study assistant conversations</span>
              </div>

              <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                <span className="text-emerald-500">✓</span>
                <span>Exam-focused explanations and walkthroughs</span>
              </div>

              <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                <span className="text-emerald-500">✓</span>
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
          <header className="flex flex-wrap items-center justify-between gap-3 mb-3 border-b border-slate-200 dark:border-slate-700 pb-3">
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

            <div className="flex items-center gap-2">
              <select
                className="py-1.5 px-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300"
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

              <select
                className="py-1.5 px-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                value={mode}
                onChange={(e) =>
                  setMode(e.target.value as TutorMode)
                }
              >
                {MODES.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          </header>

          {/* Message Workspace */}
          <div className="flex-1 overflow-y-auto space-y-4 pr-1 sm:pr-2 my-1">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center min-h-[80%] text-center px-4 my-auto">
                <div className="w-16 h-16 rounded-3xl bg-indigo-600 text-white flex items-center justify-center mb-5 shadow-lg shadow-indigo-500/20">
                  <GraduationCap className="w-8 h-8" />
                </div>

                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                  Study Assistant
                </h2>

                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mb-8 leading-relaxed">
                  Ask any question or pick a topic below to get started.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-xl mb-6">
                  {QUICK_PROMPTS.map((item, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => sendMessage(item.prompt)}
                      className="text-left p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/30 transition-all group"
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <BookOpen className="w-4 h-4 text-indigo-500" />
                        <span className="font-semibold text-xs text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                          {item.title}
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                        {item.prompt}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m) => (
                <ChatMessageCard key={m.id} message={m} />
              ))
            )}

            {isSending && (
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

          {/* Input Form */}
          <form
            onSubmit={handleSend}
            className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-200 dark:border-slate-700"
          >
            <input
              className="flex-1 text-xs sm:text-sm py-3 px-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              placeholder="Ask a question..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />

            <button
              type="submit"
              disabled={isSending || !input.trim()}
              className="shrink-0 text-xs sm:text-sm px-6 py-3 rounded-2xl font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20 active:scale-95 disabled:opacity-50"
            >
              {isSending ? 'Sending...' : 'Send'}
            </button>
          </form>
        </main>
      )}
    </div>
  )
}
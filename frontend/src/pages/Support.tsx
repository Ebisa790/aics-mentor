import { useState, type FormEvent, useEffect } from 'react'
import { useNavigate} from 'react-router-dom'
import {
  ArrowLeft,
  Mail,
  MessageSquare,
  Send,
  CheckCircle2,
  AlertCircle,
  Loader2,
  HelpCircle,
  ShieldCheck,
  Clock,
  Tag,
  Inbox,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { supportApi } from '../api'
import { useAuth } from '../context/AuthContext'

// Response SLA per issue type
const RESPONSE_SLA: Record<string, string> = {
  account_reactivation: '1-2 business days',
  account_issues: '1-2 business days',
  payment: '24 hours',
  refund: '24 hours',
  technical: '1-2 business days',
  content: '1-2 business days',
  feedback: '3-5 business days',
  other: '1-2 business days',
}

const MIN_MESSAGE_LENGTH = 20

interface MyTicket {
  id: string
  subject: string
  message: string
  issue_type: string
  status: 'open' | 'in_progress' | 'resolved' | 'closed'
  admin_response: string | null
  created_at: string
  updated_at: string | null
}

// Issue type labels
const ISSUE_LABELS: Record<string, string> = {
  account_reactivation: 'Account Reactivation',
  account_issues: 'Account Issues',
  payment: 'Payment',
  refund: 'Refund Request',
  technical: 'Technical Issue',
  content: 'Course/Content Issue',
  feedback: 'Feedback',
  other: 'Other',
}

// Status style helper
function statusStyle(status: string): { badge: string; label: string } {
  switch (status) {
    case 'open':
      return { badge: 'bg-amber-100 text-amber-800 dark:bg-amber-500/10 dark:text-amber-400', label: 'Open' }
    case 'in_progress':
      return { badge: 'bg-blue-100 text-blue-800 dark:bg-blue-500/10 dark:text-blue-400', label: 'In Progress' }
    case 'resolved':
      return { badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-400', label: 'Resolved' }
    case 'closed':
      return { badge: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400', label: 'Closed' }
    default:
      return { badge: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400', label: status }
  }
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

export function SupportPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [activeTab, setActiveTab] = useState<'new' | 'mine'>('new')

  const [email, setEmail] = useState('')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [issueType, setIssueType] = useState('payment')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [myTickets, setMyTickets] = useState<MyTicket[]>([])
  const [loadingMyTickets, setLoadingMyTickets] = useState(false)
  const [ticketsError, setTicketsError] = useState<string | null>(null)
  const [expandedTicket, setExpandedTicket] = useState<string | null>(null)

  const userData = user as any

  useEffect(() => {
    if (userData?.email) {
      setEmail(userData.email)
    }
  }, [userData])

  // Load tickets when switching to My Tickets tab
  useEffect(() => {
    if (activeTab === 'mine' && user) {
      loadMyTickets()
    }
  }, [activeTab, user])

  const loadMyTickets = async () => {
    setLoadingMyTickets(true)
    setTicketsError(null)
    try {
      const res = await supportApi.myTickets()
      setMyTickets(res.tickets || [])
    } catch (err) {
      console.error('Failed to load tickets', err)
      setTicketsError('Could not load your tickets. Please try again.')
    } finally {
      setLoadingMyTickets(false)
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!subject.trim() || !message.trim()) {
      setError('Please fill in all fields.')
      return
    }

    if (message.trim().length < MIN_MESSAGE_LENGTH) {
      setError(
        `Please describe your issue in at least ${MIN_MESSAGE_LENGTH} characters so we can help effectively.`
      )
      return
    }

    if (!email.trim()) {
      setError('Please provide your email address so we can respond.')
      return
    }

    setIsSubmitting(true)

    try {
      await supportApi.sendTicket({
        subject: subject.trim(),
        message: message.trim(),
        issue_type: issueType,
        email: email.trim(),
      })
      setSuccess(true)
      setSubject('')
      setMessage('')

      // Auto-switch to My Tickets after 1.5s
      if (user) {
        setTimeout(() => {
          setActiveTab('mine')
          setSuccess(false)
        }, 1500)
      }
    } catch (err: any) {
      if (err?.response?.status === 401) {
        setError('Please log in to submit a support ticket.')
      } else {
        setError(
          err?.response?.data?.detail ||
            "Couldn't send your ticket. Please check your connection and try again."
        )
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const currentSla = RESPONSE_SLA[issueType] || '1-2 business days'
  const openTicketCount = myTickets.filter(
    (t) => t.status === 'open' || t.status === 'in_progress'
  ).length

  // Logged-out users only see the "New Ticket" tab
  const showMyTicketsTab = !!user

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-8 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate(user ? '/dashboard' : '/login')}
            className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Support Center</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              How can we help you today?
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 gap-6 mb-6">
          <button
            type="button"
            onClick={() => setActiveTab('new')}
            className={`pb-3 text-sm font-semibold transition-colors ${
              activeTab === 'new'
                ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            New Ticket
          </button>
          {showMyTicketsTab && (
            <button
              type="button"
              onClick={() => setActiveTab('mine')}
              className={`pb-3 text-sm font-semibold transition-colors flex items-center gap-2 ${
                activeTab === 'mine'
                  ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              My Tickets
              {openTicketCount > 0 && (
                <span className="inline-flex items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-500/10 px-2 py-0.5 text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                  {openTicketCount}
                </span>
              )}
            </button>
          )}
        </div>

        {/* Success Message (only on New Ticket tab) */}
        {activeTab === 'new' && success && (
          <div className="mb-6 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                  Ticket Submitted Successfully
                </p>
                <p className="text-sm text-emerald-700 dark:text-emerald-400 mt-0.5">
                  Our team will respond within {currentSla}. We'll send updates to{' '}
                  <strong className="text-emerald-800 dark:text-emerald-300">{email}</strong>.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('mine')
                      setSuccess(false)
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white transition"
                  >
                    View My Tickets
                  </button>
                  <button
                    type="button"
                    onClick={() => setSuccess(false)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 dark:border-emerald-700 px-3 py-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-950/40 transition"
                  >
                    Send Another
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Error Message (only on New Ticket tab) */}
        {activeTab === 'new' && error && (
          <div className="mb-6 p-4 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-800 dark:text-red-300">Error</p>
                <p className="text-sm text-red-700 dark:text-red-400 mt-0.5">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* ============ TAB 1: NEW TICKET ============ */}
        {activeTab === 'new' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Form */}
            <div className="lg:col-span-2">
              <form
                onSubmit={handleSubmit}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-5"
              >
                <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-indigo-500" />
                  Submit a Ticket
                </h2>

                {/* Email */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="email"
                      required
                      placeholder="your@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full h-11 pl-10 pr-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                    />
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    We'll use this to respond to your ticket
                  </p>
                </div>

                {/* Issue Type */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Issue Type
                  </label>
                  <select
                    value={issueType}
                    onChange={(e) => setIssueType(e.target.value)}
                    className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                  >
                    <option value="payment">Payment (bank transfer or online)</option>
                    <option value="refund">Refund Request</option>
                    <option value="account_reactivation">Account Reactivation Request</option>
                    <option value="account_issues">Account Issues</option>
                    <option value="technical">Technical Issue</option>
                    <option value="content">Course/Content Issue</option>
                    <option value="feedback">Feedback</option>
                    <option value="other">Other</option>
                  </select>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Typical response: {currentSla}
                  </p>
                </div>

                {/* Subject */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Subject
                  </label>
                  <div className="relative">
                    <Tag className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      required
                      placeholder="Brief summary of your issue"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className="w-full h-11 pl-10 pr-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                    />
                  </div>
                </div>

                {/* Message */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Message
                  </label>
                  <div className="relative">
                    <MessageSquare className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                    <textarea
                      required
                      rows={6}
                      placeholder="Describe your issue in detail. Include any relevant information..."
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      className="w-full pl-10 pr-3 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all resize-none"
                    />
                  </div>
                  <p
                    className={`text-[11px] mt-1.5 ${
                      message.trim().length > 0 && message.trim().length < MIN_MESSAGE_LENGTH
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-slate-400'
                    }`}
                  >
                    {message.length} / {MIN_MESSAGE_LENGTH} characters minimum
                  </p>
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-12 inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold shadow-lg shadow-indigo-600/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Submit Ticket
                    </>
                  )}
                </button>

                <p className="text-[11px] text-slate-400 dark:text-slate-500 text-center">
                  Payment issues are handled within 24 hours. Everything else takes 1-2 business days.
                </p>
              </form>
            </div>

            {/* Sidebar */}
            <div className="space-y-4">
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-3">
                  <HelpCircle className="w-4 h-4 text-indigo-500" />
                  Quick Help
                </h3>
                <div className="space-y-3">
                  <div className="flex items-start gap-2.5">
                    <Clock className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        Response Time
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Payment: 24 hours · Other: 1-2 business days
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <ShieldCheck className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        Security
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Your data is encrypted and secure
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <Mail className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        Email Updates
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        You'll receive updates via email
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                  Quick Links
                </h4>
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIssueType('payment')
                      setSubject('Payment verification issue')
                    }}
                    className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors block text-left"
                  >
                    Payment or verification issue
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIssueType('refund')
                      setSubject('Refund request')
                    }}
                    className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors block text-left"
                  >
                    Request a refund
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIssueType('account_reactivation')
                      setSubject('Reactivate my account')
                    }}
                    className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors block text-left"
                  >
                    Request account reactivation
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIssueType('technical')
                      setSubject('Technical issue report')
                    }}
                    className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors block text-left"
                  >
                    Report a bug
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============ TAB 2: MY TICKETS ============ */}
        {activeTab === 'mine' && (
          <div className="space-y-3">
            {loadingMyTickets ? (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center">
                <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
                <p className="text-sm text-slate-500 mt-4">Loading your tickets...</p>
              </div>
            ) : ticketsError ? (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-rose-200 dark:border-rose-800 p-8 text-center">
                <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
                <p className="text-sm text-rose-600 dark:text-rose-400 mb-4">{ticketsError}</p>
                <button
                  onClick={loadMyTickets}
                  className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-500"
                >
                  Retry
                </button>
              </div>
            ) : myTickets.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center">
                <Inbox className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                <h2 className="text-lg font-semibold text-slate-800 dark:text-white mb-1">
                  No tickets yet
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                  You haven't submitted any support tickets.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('new')}
                  className="inline-flex items-center justify-center px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-500 transition"
                >
                  Submit a Ticket
                </button>
              </div>
            ) : (
              <>
                {myTickets.map((ticket) => {
                  const status = statusStyle(ticket.status)
                  const isExpanded = expandedTicket === ticket.id

                  return (
                    <div
                      key={ticket.id}
                      className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden"
                    >
                      <button
                        type="button"
                        onClick={() => setExpandedTicket(isExpanded ? null : ticket.id)}
                        className="w-full text-left px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                              <span className="inline-flex items-center rounded-full bg-indigo-50 dark:bg-indigo-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                                {ISSUE_LABELS[ticket.issue_type] || ticket.issue_type}
                              </span>
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${status.badge}`}>
                                {status.label}
                              </span>
                            </div>
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                              {ticket.subject}
                            </h3>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                              Submitted {formatDate(ticket.created_at)}
                            </p>
                          </div>
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-slate-400 shrink-0 mt-1" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-slate-400 shrink-0 mt-1" />
                          )}
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="px-5 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-3">
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                              Your message
                            </p>
                            <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                              {ticket.message}
                            </p>
                          </div>

                          {ticket.admin_response ? (
                            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 p-3.5">
                              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 mb-1">
                                Admin Response
                              </p>
                              <p className="text-sm text-emerald-900 dark:text-emerald-200 whitespace-pre-wrap">
                                {ticket.admin_response}
                              </p>
                            </div>
                          ) : (
                            <div className="rounded-xl bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-3.5 text-xs text-slate-500 dark:text-slate-400 italic">
                              No admin response yet. You'll receive an email when we respond.
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}

                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => setActiveTab('new')}
                    className="inline-flex items-center justify-center px-5 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-sm font-semibold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                  >
                    Submit Another Ticket
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default SupportPage
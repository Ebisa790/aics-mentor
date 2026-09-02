import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 

  ArrowLeft, 
  RefreshCw, 
  CheckCircle, 
  Clock, 
  XCircle, 
  AlertCircle,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Filter
} from 'lucide-react'

const API_BASE_URL = import.meta.env.VITE_API_URL || ''

interface SupportTicket {
  id: string
  user_id: string
  user_email: string
  subject: string
  message: string
  issue_type: string
  status: 'open' | 'in_progress' | 'resolved' | 'closed'
  created_at: string
  updated_at: string | null
  admin_response?: string
}

export function AdminSupportDashboard() {
  const navigate = useNavigate()
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [issueFilter, setIssueFilter] = useState<string>('all')
  const [expandedTicket, setExpandedTicket] = useState<string | null>(null)
  const [stats, setStats] = useState({
    total: 0,
    open: 0,
    in_progress: 0,
    resolved: 0,
    closed: 0
  })

  const fetchTickets = async () => {
    setLoading(true)
    setError(null)
    try {
      const token = localStorage.getItem('access_token')
      let url = `${API_BASE_URL}/api/support/admin/tickets`
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.append('status', statusFilter)
      if (issueFilter !== 'all') params.append('issue_type', issueFilter)
      if (params.toString()) url += '?' + params.toString()

      const response = await fetch(url, {
        headers: { 'Authorization': 'Bearer ' + token }
      })
      if (!response.ok) throw new Error('Failed to load tickets')
      const data = await response.json()
      setTickets(data.tickets || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tickets')
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('access_token')
      const response = await fetch(`${API_BASE_URL}/api/support/admin/tickets/stats`, {
        headers: { 'Authorization': 'Bearer ' + token }
      })
      if (response.ok) {
        const data = await response.json()
        setStats(data)
      }
    } catch (err) {
      console.error('Failed to load stats', err)
    }
  }

  const updateTicketStatus = async (ticketId: string, status: string, response?: string) => {
    try {
      const token = localStorage.getItem('access_token')
      const payload: any = { status }
      if (response) payload.response = response

      const res = await fetch(`${API_BASE_URL}/api/support/admin/tickets/${ticketId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify(payload)
      })

      if (!res.ok) throw new Error('Failed to update ticket')
      
      await fetchTickets()
      await fetchStats()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update ticket')
    }
  }

  useEffect(() => {
    fetchTickets()
    fetchStats()
  }, [statusFilter, issueFilter])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20'
      case 'in_progress': return 'bg-blue-500/10 text-blue-600 border-blue-500/20'
      case 'resolved': return 'bg-green-500/10 text-green-600 border-green-500/20'
      case 'closed': return 'bg-slate-500/10 text-slate-600 border-slate-500/20'
      default: return 'bg-slate-500/10 text-slate-600'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open': return <AlertCircle className="w-4 h-4" />
      case 'in_progress': return <Clock className="w-4 h-4" />
      case 'resolved': return <CheckCircle className="w-4 h-4" />
      case 'closed': return <XCircle className="w-4 h-4" />
      default: return <MessageSquare className="w-4 h-4" />
    }
  }

  const getIssueTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      account_reactivation: 'Account Reactivation',
      account_issues: 'Account Issues',
      payment: 'Payment/Billing',
      technical: 'Technical Issue',
      content: 'Course/Content Issue',
      feedback: 'Feedback',
      other: 'Other'
    }
    return labels[type] || type
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-8 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => navigate('/admin')}
              className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Support Tickets</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">Manage user support requests and account reactivations</p>
            </div>
          </div>
          <button
            onClick={() => { fetchTickets(); fetchStats(); }}
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-500 flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 text-center">
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.total}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Total</p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 text-center">
            <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{stats.open}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Open</p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 text-center">
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.in_progress}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">In Progress</p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 text-center">
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.resolved}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Resolved</p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 text-center">
            <p className="text-2xl font-bold text-slate-600 dark:text-slate-400">{stats.closed}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Closed</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 mb-6 flex flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Filters:</span>
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
          >
            <option value="all">All Status</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
          <select
            value={issueFilter}
            onChange={(e) => setIssueFilter(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
          >
            <option value="all">All Types</option>
            <option value="account_reactivation">Account Reactivation</option>
            <option value="account_issues">Account Issues</option>
            <option value="payment">Payment/Billing</option>
            <option value="technical">Technical</option>
            <option value="content">Course/Content</option>
            <option value="feedback">Feedback</option>
            <option value="other">Other</option>
          </select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-10 h-10 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin"></div>
          </div>
        ) : error ? (
          <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-2xl p-6 text-center">
            <p className="text-red-700 dark:text-red-300">{error}</p>
            <button onClick={fetchTickets} className="mt-3 px-4 py-2 bg-red-600 text-white rounded-xl text-sm">Retry</button>
          </div>
        ) : tickets.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center">
            <div className="w-16 h-16 mx-auto bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
              <MessageSquare className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">No tickets found</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">All support tickets will appear here.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {tickets.map((ticket) => (
              <div key={ticket.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div 
                  className="px-5 py-4 flex items-center justify-between gap-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  onClick={() => setExpandedTicket(expandedTicket === ticket.id ? null : ticket.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                        {ticket.subject}
                      </span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${getStatusColor(ticket.status)}`}>
                        {getStatusIcon(ticket.status)}
                        {ticket.status.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 dark:text-slate-400">
                      <span>{ticket.user_email}</span>
                      <span>•</span>
                      <span>{getIssueTypeLabel(ticket.issue_type)}</span>
                      <span>•</span>
                      <span>{new Date(ticket.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <select
                      value={ticket.status}
                      onChange={(e) => updateTicketStatus(ticket.id, e.target.value)}
                      className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <option value="open">Open</option>
                      <option value="in_progress">In Progress</option>
                      <option value="resolved">Resolved</option>
                      <option value="closed">Closed</option>
                    </select>
                    {expandedTicket === ticket.id ? (
                      <ChevronUp className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                </div>

                {expandedTicket === ticket.id && (
                  <div className="px-5 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Message:</p>
                        <p className="text-sm text-slate-700 dark:text-slate-300 mt-1 whitespace-pre-wrap">{ticket.message}</p>
                      </div>
                      {ticket.admin_response && (
                        <div>
                          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Admin Response:</p>
                          <p className="text-sm text-slate-700 dark:text-slate-300 mt-1 whitespace-pre-wrap">{ticket.admin_response}</p>
                        </div>
                      )}
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            const response = prompt('Enter admin response:')
                            if (response) updateTicketStatus(ticket.id, ticket.status, response)
                          }}
                          className="px-4 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-500"
                        >
                          Add Response
                        </button>
                        {ticket.status !== 'resolved' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              updateTicketStatus(ticket.id, 'resolved')
                            }}
                            className="px-4 py-1.5 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-500"
                          >
                            Mark Resolved
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default AdminSupportDashboard
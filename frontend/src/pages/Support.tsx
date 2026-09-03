import { useState, type FormEvent, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Mail, MessageSquare, Send, CheckCircle2, AlertCircle, Loader2, HelpCircle, ShieldCheck, Clock } from 'lucide-react'
import { supportApi } from '../api'
import { useAuth } from '../context/AuthContext'



export function SupportPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [issueType, setIssueType] = useState('account_reactivation')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Get user data safely
  const userData = user as any
  
  // Determine if user is deactivated - check multiple possible field names
  const isDeactivated = userData && (
    userData.is_active === false || 
    userData.isActive === false ||
    userData.status === 'inactive' ||
    userData.status === 'deactivated'
  )

  // Determine if user is active - check multiple possible field names
  const isActive = userData && (
    userData.is_active === true || 
    userData.isActive === true ||
    userData.status === 'active' ||
    userData.status === 'Active'
  )

  // Set email from user data when available
  useEffect(() => {
    if (userData?.email) {
      setEmail(userData.email)
    } else {
      // Try localStorage
      const savedEmail = localStorage.getItem('user_email') || localStorage.getItem('email')
      if (savedEmail) {
        setEmail(savedEmail)
      }
    }
  }, [userData])

  // Save email to localStorage
  useEffect(() => {
    if (email) {
      localStorage.setItem('user_email', email)
    }
  }, [email])

  // Log user data for debugging
  useEffect(() => {
    console.log('SupportPage - user data:', userData)
    console.log('SupportPage - isDeactivated:', isDeactivated)
    console.log('SupportPage - isActive:', isActive)
  }, [userData])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    // Validate
    if (!subject.trim() || !message.trim()) {
      setError('Please fill in all fields.')
      setIsSubmitting(false)
      return
    }

    if (!email.trim()) {
      setError('Please provide your email address so we can respond to your ticket.')
      setIsSubmitting(false)
      return
    }

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
      setIssueType('account_reactivation')
    } catch (err: any) {
      if (err?.response?.status === 401) {
        setError('Please log in to submit a support ticket.')
      } else {
        setError(err?.response?.data?.detail || 'Couldn\'t send your ticket. Please check your connection and try again.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  // Determine account status for display
  const getAccountStatus = () => {
    if (!userData) return 'Not logged in'
    if (isDeactivated) return 'Deactivated'
    if (isActive) return 'Active'
    // If email exists but no status field, assume active
    if (userData.email) return 'Active'
    return 'Unknown'
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-8 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate(userData ? '/dashboard' : '/login')}
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

        {/* Deactivation Banner - Only show if definitely deactivated */}
        {isDeactivated && (
          <div className="mb-6 p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                  Account Deactivated
                </p>
                <p className="text-sm text-amber-700 dark:text-amber-400 mt-0.5">
                  Your account has been deactivated. Submit a ticket below to request reactivation.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="mb-6 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                  Ticket Submitted Successfully!
                </p>
                <p className="text-sm text-emerald-700 dark:text-emerald-400 mt-0.5">
                  Our support team will get back to you shortly. We'll send updates to your email.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Form */}
          <div className="lg:col-span-2">
            <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-5">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-indigo-500" />
                Submit a Ticket
              </h2>

              {/* Email Field */}
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
                  <option value="account_reactivation">Account Reactivation Request</option>
                  <option value="account_issues">Account Issues</option>
                  <option value="payment">Payment/Billing</option>
                  <option value="technical">Technical Issue</option>
                  <option value="content">Course/Content Issue</option>
                  <option value="feedback">Feedback</option>
                  <option value="other">Other</option>
                </select>
              </div>

              {/* Subject */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Subject
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
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
                <p className="text-[11px] text-slate-400 mt-1.5">
                  {message.length} characters (minimum 20 recommended)
                </p>
              </div>

              {/* Submit Button */}
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

              {/* Info note */}
              <p className="text-[11px] text-slate-400 dark:text-slate-500 text-center">
                Our support team typically responds within 1-2 business days.
              </p>
            </form>
          </div>

          {/* Sidebar - Help Info */}
          <div className="space-y-4">
            {/* Quick Help */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-3">
                <HelpCircle className="w-4 h-4 text-indigo-500" />
                Quick Help
              </h3>
              <div className="space-y-3">
                <div className="flex items-start gap-2.5">
                  <Clock className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">Response Time</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">1-2 business days</p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">Security</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">Your data is encrypted and secure</p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <Mail className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">Email Updates</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">You'll receive updates via email</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Links */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">Quick Links</h4>
              <div className="space-y-1.5">
                <button
                  onClick={() => {
                    setIssueType('account_reactivation')
                    setSubject('Reactivate my account')
                  }}
                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors block"
                >
                  Request Account Reactivation
                </button>
                <button
                  onClick={() => {
                    setIssueType('feedback')
                    setSubject('Platform Feedback')
                  }}
                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors block"
                >
                  Share Feedback
                </button>
                <button
                  onClick={() => {
                    setIssueType('technical')
                    setSubject('Technical Issue Report')
                  }}
                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors block"
                >
                  Report a Bug
                </button>
              </div>
            </div>

            {/* Account Status */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">Account Status</h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 break-all">
                {email || 'No email provided'}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-500 mt-1">
                Status: {getAccountStatus()}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SupportPage
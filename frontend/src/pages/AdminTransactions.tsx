import { useState, useEffect, useMemo } from 'react'
import { apiClient } from '../api/client'
import { Spinner } from '../components/Spinner'
import {
  Download,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  RefreshCw,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Copy,
  Check,
  Trash2,
  Loader2,
} from 'lucide-react'

interface PaymentTransaction {
  id: string
  tx_ref: string
  chapa_transaction_id: string | null
  student_name: string
  student_email: string
  amount: number
  currency: string
  status: string
  payment_method: string | null
  created_at: string
  verified_at: string | null
}

const ITEMS_PER_PAGE = 20

export function AdminTransactionsPage() {
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [copiedRef, setCopiedRef] = useState<string | null>(null)

  // Delete-payment state
  const [deleteTarget, setDeleteTarget] = useState<PaymentTransaction | null>(null)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleteReason, setDeleteReason] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [totalRevenue, setTotalRevenue] = useState(0)
  const [successCount, setSuccessCount] = useState(0)
  const [pendingCount, setPendingCount] = useState(0)
  const [failedCount, setFailedCount] = useState(0)

  const fetchTransactions = async () => {
    try {
      setLoading(true)
      const res = await apiClient.get('/api/payments/admin/transactions', {
        params: { limit: 500 }
      })
      const data = res.data || []
      setTransactions(data)

      let revenue = 0
      let success = 0
      let pending = 0
      let failed = 0

      data.forEach((tx: PaymentTransaction) => {
        if (tx.status === 'success') {
          revenue += tx.amount
          success++
        } else if (tx.status === 'pending') {
          pending++
        } else if (tx.status === 'failed') {
          failed++
        }
      })

      setTotalRevenue(revenue)
      setSuccessCount(success)
      setPendingCount(pending)
      setFailedCount(failed)
    } catch (error) {
      console.error('Failed to fetch transactions:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTransactions()
  }, [])

  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      // Status filter
      if (filter !== 'all' && tx.status !== filter) return false

      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase()
        const matchesName = tx.student_name.toLowerCase().includes(query)
        const matchesEmail = tx.student_email.toLowerCase().includes(query)
        const matchesRef = tx.tx_ref.toLowerCase().includes(query)
        const matchesChapaId = tx.chapa_transaction_id?.toLowerCase().includes(query) || false
        if (!matchesName && !matchesEmail && !matchesRef && !matchesChapaId) return false
      }

      return true
    })
  }, [transactions, filter, searchQuery])

  const totalPages = Math.ceil(filteredTransactions.length / ITEMS_PER_PAGE)
  const paginatedTransactions = filteredTransactions.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  )

  // Reset to page 1 when filter or search changes
  useEffect(() => {
    setCurrentPage(1)
  }, [filter, searchQuery])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
            <CheckCircle2 className="w-3 h-3" />
            Success
          </span>
        )
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
            <XCircle className="w-3 h-3" />
            Failed
          </span>
        )
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
            <Clock className="w-3 h-3" />
            Pending
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
            <AlertCircle className="w-3 h-3" />
            {status}
          </span>
        )
    }
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleString('en-ET', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const openDeleteModal = (tx: PaymentTransaction) => {
    setDeleteTarget(tx)
    setDeleteConfirmText('')
    setDeleteReason('')
    setDeleteError(null)
  }

  const closeDeleteModal = () => {
    if (deleting) return
    setDeleteTarget(null)
    setDeleteConfirmText('')
    setDeleteReason('')
    setDeleteError(null)
  }

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return
    if (deleteConfirmText.trim().toUpperCase() !== 'DELETE') {
      setDeleteError('Type DELETE (in capitals) to confirm.')
      return
    }

    setDeleting(true)
    setDeleteError(null)

    try {
      await apiClient.delete(`/api/payments/admin/${deleteTarget.id}`, {
        data: { reason: deleteReason.trim() || undefined },
      })

      // Remove the row from local state
      setTransactions((prev) => prev.filter((t) => t.id !== deleteTarget.id))

      // Close modal
      setDeleteTarget(null)
      setDeleteConfirmText('')
      setDeleteReason('')
    } catch (err: any) {
      console.error('Delete payment failed:', err)
      const status = err?.response?.status
      const detail = err?.response?.data?.detail
      const errMessage = err?.response?.data?.error

      if (status === 404) {
        setDeleteError('Payment not found. It may have been deleted already.')
      } else if (typeof detail === 'string') {
        setDeleteError(detail)
      } else if (typeof errMessage === 'string') {
        setDeleteError(errMessage)
      } else {
        setDeleteError('Could not delete this payment. Please try again.')
      }
    } finally {
      setDeleting(false)
    }
  }

  const handleCopyRef = (ref: string) => {
    navigator.clipboard.writeText(ref)
    setCopiedRef(ref)
    setTimeout(() => setCopiedRef(null), 2000)
  }

  const handleExportCSV = () => {
    const headers = ['Date', 'Student', 'Email', 'Tx Ref', 'Chapa ID', 'Amount', 'Status', 'Method', 'Verified At']
    const rows = filteredTransactions.map((tx) => [
      formatDate(tx.created_at),
      tx.student_name,
      tx.student_email,
      tx.tx_ref,
      tx.chapa_transaction_id || '—',
      `${tx.amount} ${tx.currency}`,
      tx.status,
      tx.payment_method || '—',
      formatDate(tx.verified_at),
    ])

    const escapeCsv = (val: string) => {
      if (val.includes(',') || val.includes('"') || val.includes('\n')) {
        return `"${val.replace(/"/g, '""')}"`
      }
      return val
    }

    const csvContent = [headers, ...rows]
      .map((row) => row.map(escapeCsv).join(','))
      .join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'payment_transactions.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Payment Transactions
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Review all Chapa payment activities
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchTransactions}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
          <p className="text-xs text-slate-400 font-semibold uppercase">Total Revenue</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-2">
            ETB {totalRevenue.toFixed(0)}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
          <p className="text-xs text-slate-400 font-semibold uppercase">Success</p>
          <p className="text-2xl font-bold text-emerald-600 mt-2">{successCount}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
          <p className="text-xs text-slate-400 font-semibold uppercase">Pending</p>
          <p className="text-2xl font-bold text-amber-600 mt-2">{pendingCount}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
          <p className="text-xs text-slate-400 font-semibold uppercase">Failed</p>
          <p className="text-2xl font-bold text-rose-600 mt-2">{failedCount}</p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by student name, email, or transaction ref..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>
        <div className="flex items-center gap-2">
          {['all', 'success', 'pending', 'failed'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                filter === f
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Results count */}
      <p className="text-xs text-slate-400">
        Showing {paginatedTransactions.length} of {filteredTransactions.length} transactions
      </p>

      {/* Transactions Table */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Spinner size="lg" label="Loading transactions..." />
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-left">
                  <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase w-10"></th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase">Date</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase">Student</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase">Tx Ref</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase">Amount</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase">Status</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase">Method</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase w-14 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                      No transactions found
                    </td>
                  </tr>
                ) : (
                  paginatedTransactions.map((tx) => {
                    const isExpanded = expandedId === tx.id
                    return (
                      <>
                        <tr
                          key={tx.id}
                          onClick={() => setExpandedId(isExpanded ? null : tx.id)}
                          className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                        >
                          <td className="px-4 py-3">
                            <ChevronDown
                              className={`w-4 h-4 text-slate-400 transition-transform ${
                                isExpanded ? 'rotate-180' : ''
                              }`}
                            />
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400">
                            {formatDate(tx.created_at)}
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-xs font-semibold text-slate-900 dark:text-white">
                              {tx.student_name}
                            </div>
                            <div className="text-[10px] text-slate-400">{tx.student_email}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-mono text-slate-600 dark:text-slate-400">
                                {tx.tx_ref.length > 20
                                  ? `${tx.tx_ref.substring(0, 20)}...`
                                  : tx.tx_ref}
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleCopyRef(tx.tx_ref)
                                }}
                                className="text-slate-400 hover:text-indigo-600"
                                title="Copy full ref"
                              >
                                {copiedRef === tx.tx_ref ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs font-bold text-slate-900 dark:text-white">
                            {tx.amount.toFixed(2)} {tx.currency}
                          </td>
                          <td className="px-4 py-3">{getStatusBadge(tx.status)}</td>
                          <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400">
                            {tx.payment_method || '—'}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                openDeleteModal(tx)
                              }}
                              className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition"
                              title="Delete this payment"
                              aria-label="Delete this payment"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr key={`${tx.id}-expanded`} className="bg-slate-50 dark:bg-slate-800/30">
                            <td colSpan={8} className="px-6 py-4">
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div>
                                  <p className="text-[10px] font-bold text-slate-400 uppercase">Full Tx Ref</p>
                                  <p className="text-xs font-mono text-slate-700 dark:text-slate-300 mt-1 break-all">
                                    {tx.tx_ref}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-[10px] font-bold text-slate-400 uppercase">Chapa Transaction ID</p>
                                  <p className="text-xs font-mono text-slate-700 dark:text-slate-300 mt-1">
                                    {tx.chapa_transaction_id || '—'}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-[10px] font-bold text-slate-400 uppercase">Verified At</p>
                                  <p className="text-xs text-slate-700 dark:text-slate-300 mt-1">
                                    {formatDate(tx.verified_at)}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-[10px] font-bold text-slate-400 uppercase">Student Email</p>
                                  <p className="text-xs text-slate-700 dark:text-slate-300 mt-1">
                                    {tx.student_email}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-[10px] font-bold text-slate-400 uppercase">Payment Method</p>
                                  <p className="text-xs text-slate-700 dark:text-slate-300 mt-1">
                                    {tx.payment_method || 'Not specified'}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-[10px] font-bold text-slate-400 uppercase">Amount</p>
                                  <p className="text-xs font-bold text-slate-900 dark:text-white mt-1">
                                    {tx.amount.toFixed(2)} {tx.currency}
                                  </p>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 disabled:opacity-30 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Previous
              </button>
              <span className="text-xs text-slate-400">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 disabled:opacity-30 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Next
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeDeleteModal()
          }}
        >
          <div className="w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4 my-auto">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-100 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Delete this payment permanently?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  This cannot be undone. The record will be archived first,
                  but removed from the platform.
                </p>
              </div>
            </div>

            {/* Payment details */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 p-4 space-y-2 text-xs">
              <div className="flex justify-between gap-4">
                <span className="text-slate-500 dark:text-slate-400">Student</span>
                <span className="font-semibold text-slate-900 dark:text-white text-right truncate">
                  {deleteTarget.student_name}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-500 dark:text-slate-400">Tx Ref</span>
                <span className="font-mono text-slate-700 dark:text-slate-300 text-right truncate">
                  {deleteTarget.tx_ref}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-500 dark:text-slate-400">Amount</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {deleteTarget.amount.toFixed(2)} {deleteTarget.currency}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-500 dark:text-slate-400">Status</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {deleteTarget.status}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-500 dark:text-slate-400">Method</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {deleteTarget.payment_method || 'chapa'}
                </span>
              </div>
            </div>

            {/* Warning list */}
            <div className="rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-3.5 text-xs text-amber-800 dark:text-amber-300">
              <p className="font-bold mb-1">What will happen:</p>
              <ul className="space-y-0.5 ml-3 list-disc">
                <li>The payment record is deleted</li>
                <li>Its subscription (if any) is removed</li>
                <li>Its manual details (if any) are removed</li>
                <li>If the student has no other active Premium, they are downgraded to FREE</li>
                <li>The full record is archived in deleted_payments_log for recovery</li>
              </ul>
            </div>

            {/* Optional reason */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Reason (optional)
              </label>
              <input
                type="text"
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                disabled={deleting}
                placeholder="e.g. test data cleanup"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
              />
            </div>

            {/* Confirm text input */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Type <span className="font-mono text-rose-600">DELETE</span> to confirm:
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                disabled={deleting}
                autoComplete="off"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm font-mono uppercase tracking-wider text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500 disabled:opacity-50"
                placeholder="DELETE"
              />
            </div>

            {deleteError && (
              <div className="rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 px-3 py-2.5 text-xs text-rose-700 dark:text-rose-400">
                {deleteError}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={closeDeleteModal}
                disabled={deleting}
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={
                  deleting ||
                  deleteConfirmText.trim().toUpperCase() !== 'DELETE'
                }
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {deleting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                {deleting ? 'Deleting...' : 'Delete permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminTransactionsPage
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ClipboardList,
  TrendingUp,
  TrendingDown,
  Minus,
  Trash2,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { apiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';

interface HistoryItem {
  id: string;
  quiz_id: string;
  title: string;
  submitted_at: string | null;
  score_percent: number;
  total_questions: number;
  correct_count: number;
  passed: boolean;
  duration_seconds: number | null;
  weak_areas: string[];
}

interface HistoryStats {
  total_attempts: number;
  average_score: number;
  best_score: number;
  last_score: number;
  has_more: boolean;
}

interface HistoryResponse {
  items: HistoryItem[];
  stats: HistoryStats;
  offset: number;
  limit: number;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds <= 0) return '—';
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function presetBadge(title: string): string {
  const m = title.match(/(\d+)[- ]?Question/i);
  if (m) return `${m[1]}Q`;
  return 'Exam';
}

function isAbandoned(item: HistoryItem): boolean {
  return item.score_percent === 0 && (item.duration_seconds ?? 9999) < 60;
}

export function MockExamHistory() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();

  const [data, setData] = useState<HistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAbandoned, setShowAbandoned] = useState(false);

  // Delete flow state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteSuccess, setDeleteSuccess] = useState<string | null>(null);

  const loadHistory = () => {
    setLoading(true);
    setError(null);
    apiClient
      .get<HistoryResponse>('/api/exams/history?limit=50')
      .then((res) => setData(res.data))
      .catch((err) => {
        console.error('Failed to load exam history:', err);
        setError(
          err?.response?.data?.detail ||
            'Could not load your exam history. Please try again.'
        );
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    apiClient
      .get<HistoryResponse>('/api/exams/history?limit=50')
      .then((res) => {
        if (!cancelled) setData(res.data);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Failed to load exam history:', err);
        setError(
          err?.response?.data?.detail ||
            'Could not load your exam history. Please try again.'
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const trendByAttemptId = useMemo(() => {
    const map: Record<string, number | null> = {};
    if (!data) return map;
    const items = data.items;
    for (let i = 0; i < items.length; i++) {
      const newer = items[i];
      const older = items[i + 1];
      if (!older) {
        map[newer.id] = null;
        continue;
      }
      map[newer.id] = newer.score_percent - older.score_percent;
    }
    return map;
  }, [data]);

  const abandonedCount = useMemo(() => {
    if (!data) return 0;
    return data.items.filter(isAbandoned).length;
  }, [data]);

  const visibleItems = useMemo(() => {
    if (!data) return [];
    if (showAbandoned) return data.items;
    return data.items.filter((i) => !isAbandoned(i));
  }, [data, showAbandoned]);

  const handleConfirmDelete = async () => {
    setDeleting(true);
    setDeleteError(null);

    try {
      const res = await apiClient.post('/api/exams/history/reset');
      const deleted = res.data?.deleted_attempts ?? 0;

      setDeleteSuccess(
        deleted === 0
          ? 'No attempts to delete.'
          : `Deleted ${deleted} attempt${deleted === 1 ? '' : 's'}.`
      );
      setShowDeleteModal(false);

      // Reload history
      loadHistory();

      // Auto-dismiss success message
      window.setTimeout(() => setDeleteSuccess(null), 4000);
    } catch (err: any) {
      console.error('Reset failed:', err);
      setDeleteError(
        err?.response?.data?.detail ||
          'Could not reset your history. Please try again.'
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      {/* Back */}
      <Link
        to="/mock-exams"
        className="inline-flex items-center text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition"
      >
        <ArrowLeft className="w-4 h-4 mr-1.5" />
        Back to Mock Exams
      </Link>

      {/* Title + toggles */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            Exam History
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            All your past mock exam attempts, newest first.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {!loading && !error && abandonedCount > 0 && (
            <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-400 cursor-pointer select-none bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 hover:border-slate-300 dark:hover:border-slate-600 transition">
              <input
                type="checkbox"
                checked={showAbandoned}
                onChange={(e) => setShowAbandoned(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-500"
              />
              Show abandoned ({abandonedCount})
            </label>
          )}

          {/* Admin-only reset button */}
          {isAdmin && !loading && !error && data && data.items.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setDeleteError(null);
                setShowDeleteModal(true);
              }}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/40 hover:bg-rose-100 dark:hover:bg-rose-500/20 rounded-lg px-3 py-2 transition"
              title="Admin: permanently delete all your mock attempts"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Reset history
            </button>
          )}
        </div>
      </div>

      {/* Success toast */}
      {deleteSuccess && (
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-300 flex items-center justify-between gap-3">
          <span>{deleteSuccess}</span>
          <button
            type="button"
            onClick={() => setDeleteSuccess(null)}
            className="text-emerald-700 dark:text-emerald-400 hover:text-emerald-900 dark:hover:text-emerald-200 text-xs font-bold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-12 text-center">
          <div className="h-6 w-6 mx-auto animate-spin rounded-full border-2 border-slate-200 border-t-indigo-600 dark:border-slate-700 dark:border-t-indigo-400" />
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-3">
            Loading history…
          </p>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="rounded-2xl border border-rose-200 dark:border-rose-900/40 bg-rose-50 dark:bg-rose-950/20 p-6 text-center">
          <p className="text-sm text-rose-700 dark:text-rose-400">{error}</p>
          <button
            onClick={loadHistory}
            className="mt-3 text-xs font-bold text-rose-700 dark:text-rose-400 hover:underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && data && data.items.length === 0 && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-12 text-center">
          <ClipboardList className="h-10 w-10 text-slate-300 dark:text-slate-600 mx-auto" />
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 mt-4">
            No mock exams yet
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
            Take your first mock exam to start tracking your progress here.
          </p>
          <Link
            to="/mock-exams"
            className="inline-flex items-center mt-5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition"
          >
            Begin Mock Exam
          </Link>
        </div>
      )}

      {/* Content */}
      {!loading && !error && data && data.items.length > 0 && (
        <>
          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Attempts
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1 tabular-nums">
                {data.stats.total_attempts}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Average
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1 tabular-nums">
                {Math.round(data.stats.average_score)}%
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Best
              </div>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1 tabular-nums">
                {Math.round(data.stats.best_score)}%
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Most recent
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1 tabular-nums">
                {Math.round(data.stats.last_score)}%
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                    <th className="text-left font-semibold text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 px-4 py-3">
                      Date
                    </th>
                    <th className="text-left font-semibold text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 px-3 py-3 w-16">
                      Type
                    </th>
                    <th className="text-right font-semibold text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 px-3 py-3 w-32">
                      Score
                    </th>
                    <th className="text-right font-semibold text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 px-3 py-3 w-24">
                      Correct
                    </th>
                    <th className="text-left font-semibold text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 px-4 py-3">
                      Weak areas
                    </th>
                    <th className="text-right font-semibold text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 px-4 py-3 w-20">
                      Time
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visibleItems.map((item, idx) => {
                    const trend = trendByAttemptId[item.id];
                    const trendIsUp = trend !== null && trend > 0.5;
                    const trendIsDown = trend !== null && trend < -0.5;
                    const abandoned = isAbandoned(item);

                    return (
                      <tr
                        key={item.id}
                        onClick={() =>
                          navigate(`/mock-exams/history/${item.id}`)
                        }
                        className={`border-b border-slate-100 dark:border-slate-800 last:border-0 cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40 ${
                          abandoned
                            ? 'opacity-60'
                            : idx % 2 === 0
                              ? 'bg-white dark:bg-slate-900'
                              : 'bg-slate-50/50 dark:bg-slate-900/50'
                        }`}
                      >
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                          {formatDate(item.submitted_at)}
                        </td>

                        <td className="px-3 py-3">
                          <div className="flex items-center gap-1.5">
                            <span className="inline-flex items-center justify-center text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                              {presetBadge(item.title)}
                            </span>
                            {abandoned && (
                              <span className="inline-flex items-center text-[9px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                                Abandoned
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="px-3 py-3 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5 justify-end">
                            <span
                              className={`font-mono text-sm font-bold tabular-nums ${
                                item.passed
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-rose-600 dark:text-rose-400'
                              }`}
                            >
                              {Math.round(item.score_percent)}%
                            </span>
                            {trend === null ? (
                              <span className="inline-flex items-center text-slate-300 dark:text-slate-600">
                                <Minus className="h-3 w-3" />
                              </span>
                            ) : trendIsUp ? (
                              <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                                <TrendingUp className="h-3 w-3" />
                                +{Math.round(trend)}
                              </span>
                            ) : trendIsDown ? (
                              <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-rose-600 dark:text-rose-400">
                                <TrendingDown className="h-3 w-3" />
                                {Math.round(trend)}
                              </span>
                            ) : (
                              <span className="inline-flex items-center text-slate-300 dark:text-slate-600">
                                <Minus className="h-3 w-3" />
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="px-3 py-3 text-right">
                          <span className="font-mono text-sm text-slate-700 dark:text-slate-300 tabular-nums">
                            {item.correct_count}
                            <span className="text-slate-400 dark:text-slate-500">
                              /{item.total_questions}
                            </span>
                          </span>
                        </td>

                        <td className="px-4 py-3">
                          {item.weak_areas && item.weak_areas.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {item.weak_areas.map((area, i) => (
                                <span
                                  key={i}
                                  className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30 max-w-[160px] truncate"
                                  title={area}
                                >
                                  {area}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-300 dark:text-slate-600 text-xs">
                              —
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-400 font-mono text-sm tabular-nums">
                          {formatDuration(item.duration_seconds)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination note */}
          {data.stats.has_more && (
            <p className="text-center text-xs text-slate-500 dark:text-slate-400">
              Showing {visibleItems.length} of {data.stats.total_attempts} attempts
            </p>
          )}
        </>
      )}

      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => !deleting && setShowDeleteModal(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl border border-slate-200 dark:border-slate-700"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Reset exam history?
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 mt-1.5 leading-relaxed">
                  Permanently deletes <strong>all your mock exam attempts</strong>.
                  This cannot be undone.
                </p>
              </div>
            </div>

            {deleteError && (
              <div className="rounded-xl border border-rose-200 dark:border-rose-500/40 bg-rose-50 dark:bg-rose-500/10 px-3 py-2.5 text-xs text-rose-700 dark:text-rose-400">
                {deleteError}
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
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
                    <span>Deleting…</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    <span>Yes, delete all</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
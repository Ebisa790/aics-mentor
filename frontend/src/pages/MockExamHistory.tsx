import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ClipboardList } from 'lucide-react';
import { apiClient } from '../api/client';

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
}

interface HistoryStats {
  total_attempts: number;
  average_score: number;
  best_score: number;
  last_score: number;
}

interface HistoryResponse {
  items: HistoryItem[];
  stats: HistoryStats;
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

export function MockExamHistory() {
  const navigate = useNavigate();
  const [data, setData] = useState<HistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
          Exam History
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          All your past mock exam attempts, newest first.
        </p>
      </div>

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
            onClick={() => window.location.reload()}
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
                    <th className="text-left font-semibold text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 px-4 py-3">
                      Exam
                    </th>
                    <th className="text-right font-semibold text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 px-4 py-3 w-24">
                      Score
                    </th>
                    <th className="text-right font-semibold text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 px-4 py-3 w-24 hidden sm:table-cell">
                      Correct
                    </th>
                    <th className="text-right font-semibold text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 px-4 py-3 w-24 hidden md:table-cell">
                      Time
                    </th>
                    <th className="text-right font-semibold text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 px-4 py-3 w-24">
                      Result
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((item, idx) => (
                    <tr
                      key={item.id}
                      onClick={() => navigate(`/mock-exams/history/${item.id}`)}
                      className={`border-b border-slate-100 dark:border-slate-800 last:border-0 cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40 ${
                        idx % 2 === 0
                          ? 'bg-white dark:bg-slate-900'
                          : 'bg-slate-50/50 dark:bg-slate-900/50'
                      }`}
                    >
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {formatDate(item.submitted_at)}
                      </td>
                      <td className="px-4 py-3 text-slate-900 dark:text-slate-100 font-medium truncate max-w-[240px]">
                        {item.title}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={`font-mono text-sm font-bold tabular-nums ${
                            item.passed
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {Math.round(item.score_percent)}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right hidden sm:table-cell">
                        <span className="font-mono text-sm text-slate-700 dark:text-slate-300 tabular-nums">
                          {item.correct_count}
                          <span className="text-slate-400 dark:text-slate-500">
                            /{item.total_questions}
                          </span>
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right hidden md:table-cell text-slate-600 dark:text-slate-400 font-mono text-sm tabular-nums">
                        {formatDuration(item.duration_seconds)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={`inline-flex items-center text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded border ${
                            item.passed
                              ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30'
                              : 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-500/30'
                          }`}
                        >
                          {item.passed ? 'Pass' : 'Fail'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
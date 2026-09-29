import React from 'react';
import {
  ShieldAlert,
  CheckCircle2,
  RotateCcw,
  Award,
  Sparkles,
  HelpCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { ExamResultSummary, ExamResultItem, cleanOptionText } from './MockExamTypes';
import { FormattedQuestionText } from '../components/FormattedQuestionText';

interface MockExamResultsProps {
  resultSummary: ExamResultSummary;
  loading: boolean;
  aiExpl: Record<string, { loading: boolean; content?: string; error?: string }>;
  incorrectItems: ExamResultItem[];
  onTargetedRetake: () => void;
  onNewExam: () => void;
  onGoDashboard: () => void;
  onGetAiExplanation: (item: ExamResultItem) => void;
}

export function MockExamResults({
  resultSummary,
  loading,
  aiExpl,
  incorrectItems,
  onTargetedRetake,
  onNewExam,
  onGoDashboard,
  onGetAiExplanation,
}: MockExamResultsProps) {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      {/* Score Header Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700 rounded-2xl p-8 md:p-10 text-center shadow-sm space-y-6">
        <div className="inline-flex items-center gap-1.5 bg-[#f0f3ff] dark:bg-indigo-500/10 text-[#5252cc] dark:text-indigo-300 text-[11px] font-extrabold uppercase tracking-widest px-5 py-1.5 rounded-full">
          <Award className="h-3.5 w-3.5 shrink-0" />
          <span>Official Assessment Report</span>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl md:text-3xl font-extrabold text-[#0f172a] dark:text-slate-100 flex items-center justify-center gap-3 tracking-tight">
            {resultSummary.passed ? (
              <>
                <CheckCircle2 className="h-7 w-7 text-emerald-500 shrink-0" />
                <span>Examination Passed</span>
              </>
            ) : (
              <>
                <ShieldAlert className="h-7 w-7 text-rose-500 shrink-0" />
                <span>Needs Improvement</span>
              </>
            )}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm max-w-lg mx-auto">
            Review your performance breakdown below. Detailed explanations are available for each question.
          </p>
        </div>

        <div className="py-2 flex flex-col items-center justify-center">
          <div
            className={`text-5xl md:text-6xl font-black tracking-tight ${
              resultSummary.passed ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {Math.round(resultSummary.percentage)}%
          </div>
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mt-2">
            Final Score
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl mx-auto pt-2">
          <div className="bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-4 text-center">
            <span className="block text-2xl font-bold text-slate-800 dark:text-slate-100">{resultSummary.score}</span>
            <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Correct</span>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-4 text-center">
            <span className="block text-2xl font-bold text-slate-800 dark:text-slate-100">
              {resultSummary.total - resultSummary.score}
            </span>
            <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Incorrect</span>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-4 text-center">
            <span className="block text-2xl font-bold text-slate-800 dark:text-slate-100">{resultSummary.total}</span>
            <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Total</span>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-4 text-center">
            <span className="block text-2xl font-bold text-slate-800 dark:text-slate-100">50%</span>
            <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center justify-center gap-1">
              <span>Pass Mark</span>
              <HelpCircle className="h-3 w-3 text-slate-400 shrink-0" />
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
          {incorrectItems.length > 0 && (
            <button
              type="button"
              onClick={onTargetedRetake}
              disabled={loading}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-5 py-3 rounded-xl transition active:scale-95 shadow-sm flex items-center gap-2 disabled:opacity-50"
            >
              <RotateCcw className="h-4 w-4 shrink-0" />
              <span>
                {loading ? 'Starting...' : `Review Missed Questions (${incorrectItems.length})`}
              </span>
            </button>
          )}
          <button
            type="button"
            onClick={onNewExam}
            className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold px-5 py-3 rounded-xl transition active:scale-95 flex items-center gap-2"
          >
            <span>New Exam</span>
          </button>
          <button
            type="button"
            onClick={onGoDashboard}
            className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold px-5 py-3 rounded-xl transition"
          >
            Dashboard
          </button>
        </div>
      </div>

                {/* Domain Breakdown — table with per-question dot rows */}
      {(() => {
        const domainStats: Record<
          string,
          { total: number; correct: number; results: boolean[] }
        > = {};

        resultSummary.breakdown.forEach((item: any) => {
          const course = item.course_name || 'Other Topics';
          if (!domainStats[course]) {
            domainStats[course] = { total: 0, correct: 0, results: [] };
          }
          domainStats[course].total += 1;
          domainStats[course].results.push(Boolean(item.is_correct));
          if (item.is_correct) domainStats[course].correct += 1;
        });

        const domains = Object.entries(domainStats)
          .filter(([, stats]) => stats.total >= 1)
          .sort(
            (a, b) =>
              b[1].correct / b[1].total - a[1].correct / a[1].total
          );

        if (domains.length === 0) return null;

        const strongAreas = domains.filter(
          ([, s]) => s.correct / s.total >= 0.7
        );
        const mediumAreas = domains.filter(([, s]) => {
          const pct = s.correct / s.total;
          return pct >= 0.4 && pct < 0.7;
        });
        const weakAreas = domains.filter(
          ([, s]) => s.correct / s.total < 0.4
        );

        const [showAllCourses, setShowAllCourses] = React.useState(false);
        const [isCollapsed, setIsCollapsed] = React.useState<boolean>(() => {
          try {
            return (
              localStorage.getItem('exam_subject_perf_collapsed') === '1'
            );
          } catch {
            return false;
          }
        });

        const toggleCollapsed = () => {
          const next = !isCollapsed;
          setIsCollapsed(next);
          try {
            localStorage.setItem(
              'exam_subject_perf_collapsed',
              next ? '1' : '0'
            );
          } catch {
            /* ignore */
          }
        };

        const displayDomains = showAllCourses
          ? domains
          : domains.slice(0, 8);

        return (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm overflow-hidden">
            {/* Header — clickable to toggle */}
            <button
              type="button"
              onClick={toggleCollapsed}
              aria-expanded={!isCollapsed}
              aria-controls="subject-performance-body"
              className="w-full px-5 sm:px-6 py-4 flex items-center justify-between gap-3 flex-wrap text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/40"
            >
              <div className="min-w-0 flex items-center gap-2.5">
                <ChevronDown
                  className={`h-4 w-4 text-slate-400 shrink-0 transition-transform duration-200 ${
                    isCollapsed ? '-rotate-90' : 'rotate-0'
                  }`}
                />
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                    Subject-wise Performance
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {domains.length}{' '}
                    {domains.length === 1 ? 'subject' : 'subjects'} reviewed
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {strongAreas.length > 0 && (
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 px-2.5 py-1 rounded-full">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    {strongAreas.length} strong
                  </span>
                )}
                {mediumAreas.length > 0 && (
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 px-2.5 py-1 rounded-full">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                    {mediumAreas.length} moderate
                  </span>
                )}
                {weakAreas.length > 0 && (
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 px-2.5 py-1 rounded-full">
                    <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                    {weakAreas.length} weak
                  </span>
                )}
              </div>
            </button>

            {/* Collapsible body */}
            {!isCollapsed && (
              <div id="subject-performance-body">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                        <th className="text-left font-semibold text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 px-5 sm:px-6 py-3 w-[200px]">
                          Course
                        </th>
                        <th className="text-left font-semibold text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 px-3 py-3 hidden sm:table-cell">
                          Questions
                        </th>
                        <th className="text-center font-semibold text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 px-3 py-3 w-24">
                          Score
                        </th>
                        <th className="text-right font-semibold text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 px-5 sm:px-6 py-3 w-28">
                          Rating
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayDomains.map(([course, stats], idx) => {
                        const pct = Math.round(
                          (stats.correct / stats.total) * 100
                        );

                        const rating =
                          pct >= 70
                            ? { label: 'Strong', tone: 'emerald' as const }
                            : pct >= 40
                              ? { label: 'Moderate', tone: 'amber' as const }
                              : { label: 'Weak', tone: 'rose' as const };

                        const pillClass =
                          rating.tone === 'emerald'
                            ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30'
                            : rating.tone === 'amber'
                              ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/30'
                              : 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-500/30';

                        return (
                          <tr
                            key={course}
                            className={`group border-b border-slate-100 dark:border-slate-800 last:border-0 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40 ${
                              idx % 2 === 0
                                ? 'bg-white dark:bg-slate-900'
                                : 'bg-slate-50/50 dark:bg-slate-900/50'
                            }`}
                          >
                            {/* Course name */}
                            <td className="px-5 sm:px-6 py-3.5">
                              <div className="font-medium text-slate-900 dark:text-slate-100 truncate max-w-[180px] sm:max-w-none">
                                {course}
                              </div>
                            </td>

                            {/* Per-question dot row */}
                            <td className="px-3 py-3.5 hidden sm:table-cell">
                              <div className="flex flex-wrap items-center gap-1 max-w-[420px]">
                                {stats.results.map((wasCorrect, i) => (
                                  <span
                                    key={i}
                                    title={`Q${i + 1}: ${
                                      wasCorrect ? 'Correct' : 'Wrong'
                                    }`}
                                    className={`h-3 w-3 rounded-[3px] transition-transform group-hover:scale-110 ${
                                      wasCorrect
                                        ? 'bg-emerald-500 dark:bg-emerald-400'
                                        : 'bg-rose-400 dark:bg-rose-500/70'
                                    }`}
                                  />
                                ))}
                              </div>
                            </td>

                            {/* Score */}
                            <td className="px-3 py-3.5 text-center">
                              <span className="font-mono text-sm font-bold text-slate-700 dark:text-slate-200 tabular-nums">
                                {stats.correct}
                                <span className="text-slate-400 dark:text-slate-500 font-normal">
                                  /{stats.total}
                                </span>
                              </span>
                            </td>

                            {/* Rating pill */}
                            <td className="px-5 sm:px-6 py-3.5 text-right">
                              <span
                                className={`inline-flex items-center justify-center text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-md border ${pillClass}`}
                              >
                                {rating.label}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Footer with show all toggle */}
                {domains.length > 8 && (
                  <div className="px-5 sm:px-6 py-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/30 flex justify-center">
                    <button
                      onClick={() => setShowAllCourses(!showAllCourses)}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition"
                    >
                      {showAllCourses ? (
                        <>
                          <ChevronUp className="h-3.5 w-3.5" />
                          Show Less
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-3.5 w-3.5" />
                          Show All {domains.length} Courses
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })()}

           {/* Question Breakdown with filter chips */}
      {(() => {
        const totalCount = resultSummary.breakdown.length;
        const incorrectCount = resultSummary.breakdown.filter(
          (i) => !i.is_correct
        ).length;
        const correctCount = totalCount - incorrectCount;

        const [reviewFilter, setReviewFilter] = React.useState<
          'all' | 'incorrect' | 'correct'
        >('all');

        const filtered = resultSummary.breakdown
          .map((item, originalIdx) => ({ item, originalIdx }))
          .filter(({ item }) => {
            if (reviewFilter === 'all') return true;
            if (reviewFilter === 'incorrect') return !item.is_correct;
            return item.is_correct;
          });

        const chips: Array<{
          id: 'all' | 'incorrect' | 'correct';
          label: string;
          count: number;
          tone: 'slate' | 'rose' | 'emerald';
        }> = [
          { id: 'all', label: 'All', count: totalCount, tone: 'slate' },
          {
            id: 'incorrect',
            label: 'Incorrect',
            count: incorrectCount,
            tone: 'rose',
          },
          {
            id: 'correct',
            label: 'Correct',
            count: correctCount,
            tone: 'emerald',
          },
        ];

        return (
          <div className="space-y-4">
            {/* Sticky filter bar */}
            <div className="sticky top-2 z-10 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm px-4 sm:px-5 py-3.5">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2.5 min-w-0">
                  <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                    Question Review
                  </h2>
                  <span className="text-xs text-slate-400 dark:text-slate-500 font-mono">
                    {filtered.length}/{totalCount}
                  </span>
                </div>

                {/* Filter chips */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {chips.map((chip) => {
                    const isActive = reviewFilter === chip.id;
                    const isDisabled = chip.count === 0;

                    const activeClass =
                      chip.tone === 'slate'
                        ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-900 dark:border-slate-100'
                        : chip.tone === 'rose'
                          ? 'bg-rose-600 text-white border-rose-600'
                          : 'bg-emerald-600 text-white border-emerald-600';

                    return (
                      <button
                        key={chip.id}
                        type="button"
                        onClick={() => setReviewFilter(chip.id)}
                        disabled={isDisabled}
                        className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${
                          isActive
                            ? activeClass
                            : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                        }`}
                      >
                        <span>{chip.label}</span>
                        <span
                          className={`inline-flex items-center justify-center min-w-[20px] h-[18px] px-1.5 rounded text-[10px] font-black tabular-nums ${
                            isActive
                              ? 'bg-white/20 text-white'
                              : chip.tone === 'rose'
                                ? 'bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-400'
                                : chip.tone === 'emerald'
                                  ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          {chip.count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Empty state when filter yields nothing (shouldn't happen, but safe) */}
            {filtered.length === 0 && (
              <div className="text-center py-12 text-sm text-slate-500 dark:text-slate-400">
                No questions match this filter.
              </div>
            )}

            {/* Filtered questions */}
            <div className="space-y-4">
              {filtered.map(({ item, originalIdx }) => {
                const explState = aiExpl[item.id] || {};

                return (
                  <div
                    key={item.id ?? originalIdx}
                    className={`bg-white dark:bg-slate-900 rounded-2xl border p-6 space-y-4 transition-all shadow-sm ${
                      item.is_correct
                        ? 'border-slate-200 dark:border-slate-700'
                        : 'border-rose-200 dark:border-rose-500/40 bg-rose-50/10 dark:bg-rose-500/5'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                          Q{originalIdx + 1}
                        </span>
                        <span
                          className={`text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                            item.is_correct
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300'
                              : 'bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-300'
                          }`}
                        >
                          {item.is_correct ? 'Correct' : 'Incorrect'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => onGetAiExplanation(item)}
                        disabled={explState.loading}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-300 hover:text-indigo-800 dark:hover:text-indigo-200 bg-indigo-50 dark:bg-indigo-500/15 hover:bg-indigo-100 dark:hover:bg-indigo-500/25 px-3 py-1.5 rounded-lg transition active:scale-95 disabled:opacity-50"
                      >
                        <Sparkles className="h-3.5 w-3.5 fill-amber-300 text-amber-500 shrink-0" />
                        <span>{explState.loading ? 'Analyzing…' : 'Explain'}</span>
                      </button>
                    </div>

                    <FormattedQuestionText text={item.question_text} />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1">
                      {(['A', 'B', 'C', 'D'] as const).map((opt) => {
                        const rawText =
                          (item as any)[`option_${opt.toLowerCase()}`] || '';
                        const optionText = cleanOptionText(String(rawText || ''));
                        const isUserPick = item.selected_option === opt;
                        const isCorrectOpt = item.correct_option === opt;

                        let style =
                          'border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300';
                        if (isCorrectOpt) {
                          style =
                            'border-emerald-300 dark:border-emerald-500/60 bg-emerald-50/80 dark:bg-emerald-500/10 text-emerald-950 dark:text-emerald-200 font-medium ring-1 ring-emerald-400 dark:ring-emerald-500/50';
                        } else if (isUserPick && !item.is_correct) {
                          style =
                            'border-rose-300 dark:border-rose-500/60 bg-rose-50/80 dark:bg-rose-500/10 text-rose-950 dark:text-rose-200 font-medium ring-1 ring-rose-400 dark:ring-rose-500/50';
                        }

                        return (
                          <div
                            key={opt}
                            className={`p-3 rounded-xl border text-xs flex items-center gap-3 transition-all ${style}`}
                          >
                            <span
                              className={`w-6 h-6 rounded-md flex items-center justify-center font-bold shrink-0 ${
                                isCorrectOpt
                                  ? 'bg-emerald-600 text-white'
                                  : isUserPick && !item.is_correct
                                    ? 'bg-rose-600 text-white'
                                    : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                              }`}
                            >
                              {opt}
                            </span>
                            <span className="flex-1 leading-snug">
                              {optionText}
                            </span>
                            {isCorrectOpt && (
                              <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider shrink-0">
                                Correct
                              </span>
                            )}
                            {isUserPick && !isCorrectOpt && (
                              <span className="text-[10px] font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wider shrink-0">
                                Your Answer
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {item.explanation && (
                      <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 space-y-1">
                        <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-slate-100">
                          <HelpCircle className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span>Explanation:</span>
                        </div>
                        <p className="leading-relaxed">{item.explanation}</p>
                      </div>
                    )}

                    {explState.loading && !explState.content && (
                      <div className="rounded-2xl border border-indigo-200 dark:border-indigo-500/40 bg-indigo-50/40 dark:bg-indigo-500/5 p-5 space-y-3 animate-pulse">
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4 fill-amber-300 text-amber-500 shrink-0" />
                          <span className="text-xs font-bold text-indigo-900 dark:text-indigo-300">
                            Analyzing this question…
                          </span>
                        </div>
                        <div className="h-3 w-11/12 bg-indigo-200/60 dark:bg-indigo-500/20 rounded" />
                        <div className="h-3 w-full bg-indigo-200/50 dark:bg-indigo-500/15 rounded" />
                        <div className="h-3 w-4/5 bg-indigo-200/50 dark:bg-indigo-500/15 rounded" />
                      </div>
                    )}

                    {explState.content && (
                      <div className="relative rounded-2xl overflow-hidden border border-emerald-200 dark:border-emerald-500/40 bg-white dark:bg-slate-900 shadow-sm">
                        <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500" />
                        <div className="flex items-center gap-3 px-5 py-3 bg-gradient-to-r from-emerald-50 to-teal-50/50 dark:from-emerald-500/10 dark:to-teal-500/5 border-b border-emerald-100 dark:border-emerald-500/30">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 shadow-sm">
                            <Sparkles className="h-5 w-5 text-white" />
                          </div>
                          <h3 className="text-sm font-bold text-emerald-950 dark:text-emerald-100 tracking-tight">
                            AI Explanation
                          </h3>
                        </div>
                        <div className="px-5 sm:px-6 py-5 bg-gradient-to-b from-white to-emerald-50/30 dark:from-slate-900 dark:to-emerald-500/5">
                          <div className="text-sm leading-7 text-slate-800 dark:text-slate-200">
                            <FormattedQuestionText text={explState.content} />
                          </div>
                        </div>
                      </div>
                    )}

                    {explState.error && (
                      <div className="p-3 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/40 rounded-xl text-xs text-rose-800 dark:text-rose-300">
                        {explState.error}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
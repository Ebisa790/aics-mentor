import { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ShieldAlert,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  GraduationCap,
  Clock,
  Send,
  Flag,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';
import { FormattedQuestionText } from '../components/FormattedQuestionText';
import { Question, cleanOptionText } from './MockExamTypes';

interface MockExamTakingProps {
  questions: Question[];
  currentIndex: number;
  userAnswers: Record<string, string>;
  flaggedQuestions: Record<string, boolean>;
  sessionId: string | null;
  timeLeft: number;
  enableProctoring: boolean;
  loading: boolean;
  securityWarning: string | null;
  showSubmitModal: boolean;
  userFullName: string | null;
  onSelectOption: (questionId: string, option: string) => void;
  onToggleFlag: (questionId: string) => void;
  onNavigate: (index: number) => void;
  onNext: () => void;
  onPrevious: () => void;
  onShowSubmit: () => void;
  onCloseSubmit: () => void;
  onSubmit: () => void;
  onDismissWarning: () => void;
  examContainerRef?: React.RefObject<HTMLDivElement>;
  startedAt?: number;
  timeLimitMinutes?: number;
}

// ─── Private helpers (do not touch the exported formatTime) ───

function formatTimerHHMMSS(seconds: number): string {
  const safe = Math.max(0, seconds);
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatClockTime(epochMs: number | null): string {
  if (!epochMs) return '—';
  try {
    return new Date(epochMs).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

function initials(name: string | null): string {
  if (!name) return 'ST';
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase() || 'ST';
}

// ─── Component ───

export function MockExamTaking({
  questions,
  currentIndex,
  userAnswers,
  flaggedQuestions,
  timeLeft,
  enableProctoring,
  loading,
  securityWarning,
  showSubmitModal,
  userFullName,
  onSelectOption,
  onToggleFlag,
  onNavigate,
  onNext,
  onPrevious,
  onShowSubmit,
  onCloseSubmit,
  onSubmit,
  onDismissWarning,
  examContainerRef,
  startedAt,
  timeLimitMinutes,
}: MockExamTakingProps) {
  const [showRemaining, setShowRemaining] = useState(false);

  const currentQ = questions[currentIndex];

  if (!currentQ) {
    return (
      <div className="p-8 text-center font-mono text-slate-700 dark:text-slate-300">
        Loading Secure Test Environment...
      </div>
    );
  }

  const answeredCount = Object.keys(userAnswers).length;
  const flaggedCount = Object.values(flaggedQuestions).filter(Boolean).length;
  const unansweredCount = questions.length - answeredCount;
  const progressPct = Math.round(((currentIndex + 1) / questions.length) * 100);
  const timeIsLow = timeLeft > 0 && timeLeft < 300;

  const startTimeText = formatClockTime(startedAt ?? null);
  const endTimeText =
    startedAt && timeLimitMinutes
      ? formatClockTime(startedAt + timeLimitMinutes * 60 * 1000)
      : '—';
  const durationText = timeLimitMinutes ? `${timeLimitMinutes} minutes` : '—';
  const allottedText = timeLimitMinutes
    ? `${Math.round(timeLimitMinutes / 60)} Hours`
    : '—';

  const paletteItems = showRemaining ? questions : questions.slice(0, 50);

  return createPortal(
    <div
      ref={examContainerRef}
      onContextMenu={(e) => e.preventDefault()}
      className="fixed inset-0 z-[100] overflow-y-auto bg-[#f5f7fa] dark:bg-slate-950 select-none"
    >
      {/* ─────────── NAVY TOP BAR ─────────── */}
      <header className="sticky top-0 z-30 bg-[#0b1f3f] text-white shadow-lg">
        <div className="mx-auto flex max-w-[1700px] items-center justify-between gap-4 px-4 py-3 sm:px-6">
          {/* Left: brand + title */}
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex items-center gap-2.5 shrink-0">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
                <GraduationCap className="h-5 w-5" />
              </div>
              <div className="hidden sm:block">
                <div className="text-sm font-bold tracking-tight">ExitAI</div>
                <div className="text-[9px] uppercase tracking-[0.15em] text-white/50">
                  Ethiopia
                </div>
              </div>
            </div>

            <div className="hidden h-9 w-px bg-white/10 sm:block" />

            <div className="min-w-0">
              <h1 className="truncate text-sm font-bold tracking-tight sm:text-base">
                Computer Science Exit Exam Simulation
              </h1>
              <p className="mt-0.5 truncate text-[10px] text-white/60 sm:text-[11px]">
                Computer Science · {questions.length} Questions · Allotted Time: {allottedText}
              </p>
            </div>
          </div>

          {/* Right: user */}
          <div className="flex shrink-0 items-center gap-3">
            <div className="hidden flex-col items-end sm:flex">
              <span className="max-w-[140px] truncate text-xs font-semibold">
                {userFullName || 'Student'}
              </span>
              {enableProctoring ? (
                <span className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-amber-400/15 px-2 py-0.5 text-[9px] font-bold text-amber-300">
                  <CheckCircle2 className="h-2.5 w-2.5" />
                  Secured
                </span>
              ) : (
                <span className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-slate-400/15 px-2 py-0.5 text-[9px] font-bold text-slate-300">
                  Standard Mode
                </span>
              )}
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-[11px] font-bold ring-1 ring-white/20">
              {initials(userFullName)}
            </div>
          </div>
        </div>
      </header>

      {/* ─────────── SECURITY WARNING (kept above everything else) ─────────── */}
      {securityWarning && (
        <div className="mx-auto mt-4 max-w-[1700px] px-4 sm:px-6">
          <div className="flex items-center justify-between gap-3 rounded-xl bg-amber-500 px-4 py-3 text-xs font-semibold text-slate-950 shadow-md">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 shrink-0" />
              <span>{securityWarning}</span>
            </div>
            <button
              type="button"
              onClick={onDismissWarning}
              className="rounded-lg bg-slate-950 px-2.5 py-1 text-[10px] font-bold uppercase text-white"
            >
              Acknowledge
            </button>
          </div>
        </div>
      )}

      {/* ─────────── MAIN 3-COLUMN BODY ─────────── */}
      <main className="mx-auto max-w-[1700px] px-4 py-5 sm:px-6">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[260px_minmax(0,1fr)_280px]">
          {/* ─── LEFT: PALETTE ─── */}
          <aside className="order-2 lg:order-1 lg:sticky lg:top-[80px] lg:self-start">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                Questions
              </h3>

              {/* Legend */}
              <div className="mb-4 space-y-2 border-b border-slate-100 pb-4 text-[11px] text-slate-600 dark:border-slate-800 dark:text-slate-300">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-blue-400" />
                  <span>Not answered</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  <span>Answered</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                  <span>Marked for review</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                  <span>Current question</span>
                </div>
              </div>

              {/* Grid */}
              <div className="grid grid-cols-5 gap-1.5">
                {paletteItems.map((q, idx) => {
                  const isAnswered = !!userAnswers[q.id];
                  const isFlagged = !!flaggedQuestions[q.id];
                  const isCurrent = currentIndex === idx;

                  let cls =
                    'bg-blue-50 text-blue-700 border-blue-100 hover:bg-blue-100 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-700';
                  if (isAnswered)
                    cls =
                      'bg-emerald-500 text-white border-emerald-500 hover:bg-emerald-600';
                  if (isFlagged)
                    cls =
                      'bg-amber-400 text-slate-900 border-amber-400 hover:bg-amber-500';
                  if (isCurrent)
                    cls =
                      'bg-rose-500 text-white border-rose-500 hover:bg-rose-600 font-bold ring-2 ring-rose-300 ring-offset-1 dark:ring-offset-slate-900';

                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => onNavigate(idx)}
                      className={`flex h-8 items-center justify-center rounded-md border text-[11px] font-semibold transition active:scale-95 ${cls}`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>

              {/* Show remaining toggle */}
              {questions.length > 50 && (
                <button
                  type="button"
                  onClick={() => setShowRemaining((v) => !v)}
                  className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 py-2 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  {showRemaining ? (
                    <>
                      <ChevronUp className="h-3.5 w-3.5" />
                      Show 1 – 50
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-3.5 w-3.5" />
                      Show 51 – {questions.length}
                    </>
                  )}
                </button>
              )}
            </div>
          </aside>

          {/* ─── CENTER: QUESTION ─── */}
          <section className="order-1 lg:order-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7 dark:border-slate-800 dark:bg-slate-900">
              {/* Question header row */}
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center rounded-lg bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700 ring-1 ring-blue-100 dark:bg-blue-500/10 dark:text-blue-300 dark:ring-blue-500/20">
                    Question {currentIndex + 1} of {questions.length}
                  </span>
                  <span className="inline-flex items-center rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    CS Exit Exam
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => onToggleFlag(currentQ.id)}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] font-semibold transition active:scale-95 ${
                    flaggedQuestions[currentQ.id]
                      ? 'border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-500/60 dark:bg-amber-500/20 dark:text-amber-200'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
                  }`}
                >
                  <Flag className="h-3.5 w-3.5" />
                  {flaggedQuestions[currentQ.id] ? 'Marked for review' : 'Mark for review'}
                </button>
              </div>

                         {/* Question text */}
              <div className="pt-6 text-slate-800 dark:text-slate-100 [&_*]:text-inherit">
                <FormattedQuestionText text={currentQ.question_text} />
              </div>

              {/* Options */}
              <div className="space-y-2.5 pt-6">
                {(['A', 'B', 'C', 'D'] as const).map((opt) => {
                  const rawText =
                    currentQ[`option_${opt.toLowerCase()}` as keyof Question] || '';
                  const optionText = cleanOptionText(rawText);
                  const isSelected = userAnswers[currentQ.id] === opt;

                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => onSelectOption(currentQ.id, opt)}
                      className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left transition active:scale-[0.99] ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500 dark:border-blue-500 dark:bg-blue-500/10 dark:ring-blue-500'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600 dark:hover:bg-slate-800'
                      }`}
                    >
                      <span
                        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition ${
                          isSelected
                            ? 'border-blue-600 bg-blue-600'
                            : 'border-slate-300 dark:border-slate-600'
                        }`}
                      >
                        {isSelected && (
                          <span className="h-1.5 w-1.5 rounded-full bg-white" />
                        )}
                      </span>
                      <span className="shrink-0 pt-0.5 text-sm font-bold text-slate-700 dark:text-slate-300">
                        {opt}
                      </span>
                      <span className="flex-1 text-sm leading-6 text-slate-800 dark:text-slate-200">
                        {optionText}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Bottom navigation */}
              <div className="mt-7 flex items-center justify-between gap-3 border-t border-slate-100 pt-5 dark:border-slate-800">
                <button
                  type="button"
                  disabled={currentIndex === 0}
                  onClick={onPrevious}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-30 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Previous
                </button>

                {currentIndex < questions.length - 1 ? (
                  <button
                    type="button"
                    onClick={onNext}
                    className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-blue-700 active:scale-95"
                  >
                    Next
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onShowSubmit}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700"
                  >
                    Review & Submit
                  </button>
                )}
              </div>
            </div>
          </section>

          {/* ─── RIGHT: SIDEBAR ─── */}
          <aside className="order-3 space-y-4 lg:sticky lg:top-[80px] lg:self-start">
            {/* Timer */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <Clock className="h-3.5 w-3.5" />
                Time Remaining
              </div>
              <div
                className={`font-mono text-2xl font-black tabular-nums ${
                  timeIsLow
                    ? 'animate-pulse text-rose-600 dark:text-rose-400'
                    : 'text-slate-900 dark:text-white'
                }`}
              >
                {formatTimerHHMMSS(timeLeft)}
              </div>
              {/* Progress bar */}
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  className="h-full rounded-full bg-blue-600 transition-all"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <div className="mt-2 flex items-center justify-between text-[11px] font-medium text-slate-500 dark:text-slate-400">
                <span>
                  Question {currentIndex + 1} of {questions.length}
                </span>
                <span className="font-bold text-slate-700 dark:text-slate-300">
                  {progressPct}%
                </span>
              </div>
            </div>

            {/* Question summary */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h3 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Question Summary
              </h3>
              <div className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-300">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                    Answered
                  </span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {answeredCount}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-300">
                    <span className="h-2.5 w-2.5 rounded-full bg-blue-400" />
                    Not answered
                  </span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {unansweredCount}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-300">
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                    Marked for review
                  </span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {flaggedCount}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-300">
                    <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                    Current question
                  </span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {currentIndex + 1}
                  </span>
                </div>
              </div>
            </div>

            {/* Submit */}
            <button
              type="button"
              onClick={onShowSubmit}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 active:scale-[0.98]"
            >
              <Send className="h-4 w-4" />
              Submit Exam
            </button>

            {/* Warning */}
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] leading-relaxed text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
              <div className="flex items-start gap-2">
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-amber-400 text-[10px] font-bold text-amber-950">
                  !
                </span>
                <span>
                  You can submit once. Make sure you have reviewed your answers before submitting.
                </span>
              </div>
            </div>

            {/* Exam details */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h3 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Exam Details
              </h3>
              <div className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300">
                <div className="flex items-center justify-between">
                  <span>Total Questions</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {questions.length}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Duration</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {durationText}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Start Time</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {startTimeText}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>End Time</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {endTimeText}
                  </span>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </main>

      {/* ─────────── FOOTER ─────────── */}
      <footer className="border-t border-slate-200 bg-white py-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-[1700px] flex-wrap items-center justify-between gap-2 px-4 text-[11px] text-slate-400 sm:px-6">
          <span className="font-semibold text-slate-500 dark:text-slate-400">
            ExitAI Ethiopia
          </span>
          <span>Learn · Practice · Succeed</span>
          <span className="hidden sm:inline">Computer Science Exit Exam</span>
        </div>
      </footer>

      {/* ─────────── SUBMIT MODAL (logic unchanged) ─────────── */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm dark:bg-slate-950/80">
          <div className="w-full max-w-md space-y-5 rounded-2xl border border-slate-100 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Confirm Exam Submission
            </h3>
            <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              Are you sure you want to finish your exam now? You have{' '}
              <span className="font-bold text-slate-900 dark:text-slate-100">
                {answeredCount}
              </span>{' '}
              out of{' '}
              <span className="font-bold text-slate-900 dark:text-slate-100">
                {questions.length}
              </span>{' '}
              questions.
            </p>
            {unansweredCount > 0 && (
              <p className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300">
                <ShieldAlert className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <span>
                  Warning: You have {unansweredCount} unanswered questions remaining.
                </span>
              </p>
            )}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onCloseSubmit}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Return to Test
              </button>
              <button
                type="button"
                onClick={onSubmit}
                disabled={loading}
                className="rounded-xl bg-red-600 px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-red-700 active:scale-95 disabled:opacity-50"
              >
                {loading ? 'Submitting...' : 'Yes, Submit Now'}
              </button>
            </div>
          </div>
        </div>
      )}
     </div>,
    document.body,
  );
}
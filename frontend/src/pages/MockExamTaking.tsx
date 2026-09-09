import { ShieldAlert, Clock, CheckCircle2, ChevronRight } from 'lucide-react';
import { FormattedQuestionText } from '../components/FormattedQuestionText';
import { Question, cleanOptionText, formatTime } from './MockExamTypes';

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
}

export function MockExamTaking({
  questions,
  currentIndex,
  userAnswers,
  flaggedQuestions,
  sessionId,
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
}: MockExamTakingProps) {
  const currentQ = questions[currentIndex];

  const answeredCount = Object.keys(userAnswers).length;
  const flaggedCount = Object.values(flaggedQuestions).filter(Boolean).length;

  if (!currentQ) {
    return (
      <div className="p-8 text-center font-mono">
        Loading Secure Test Environment...
      </div>
    );
  }

  return (
    <div
      ref={examContainerRef}
      onContextMenu={(e) => e.preventDefault()}
      className="min-h-screen bg-slate-50 select-none px-4 py-6 space-y-6 max-w-6xl mx-auto relative"
    >
      {/* Security Warning */}
      {securityWarning && (
        <div className="bg-amber-500 text-slate-950 px-4 py-3 rounded-xl text-xs font-semibold flex items-center justify-between shadow-md animate-bounce">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-slate-950" />
            <span>{securityWarning}</span>
          </div>
          <button
            onClick={onDismissWarning}
            className="bg-slate-950 text-white px-2.5 py-1 rounded-lg text-[10px] uppercase font-bold"
          >
            Acknowledge
          </button>
        </div>
      )}

      {/* Header */}
      <div className="bg-white sticky top-2 z-20 shadow-md border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded uppercase tracking-wider">
                Session #{sessionId?.slice(0, 8) || 'CBT-01'}
              </span>
              {enableProctoring && (
                <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded uppercase tracking-wider flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-emerald-700" />
                  Secured
                </span>
              )}
            </div>
            <h2 className="text-base font-semibold text-slate-900 mt-0.5">
              Question {currentIndex + 1} of {questions.length}
            </h2>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div
            className={`px-4 py-2 rounded-xl font-mono font-bold text-sm flex items-center gap-1.5 ${
              timeLeft < 300 ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-100 text-slate-800'
            }`}
          >
            <Clock className="h-4 w-4" />
            <span>{formatTime(timeLeft)}</span>
          </div>
          <button
            type="button"
            onClick={onShowSubmit}
            className="bg-red-600 text-white text-xs font-semibold px-4 py-2.5 rounded-xl hover:bg-red-700 transition active:scale-95 shadow-sm"
          >
            Finish & Submit
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Question Area */}
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 sm:p-8 space-y-6">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Select the best single answer
              </span>
              <button
                type="button"
                onClick={() => onToggleFlag(currentQ.id)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all active:scale-95 flex items-center gap-1.5 ${
                  flaggedQuestions[currentQ.id]
                    ? 'bg-amber-100 border-amber-300 text-amber-900 font-bold'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {flaggedQuestions[currentQ.id] ? 'Flagged for Review' : 'Flag Question'}
              </button>
            </div>

            <FormattedQuestionText text={currentQ.question_text} />

            <div className="space-y-3 pt-2">
              {(['A', 'B', 'C', 'D'] as const).map((opt) => {
                const rawText = currentQ[`option_${opt.toLowerCase()}` as keyof Question] || '';
                const optionText = cleanOptionText(rawText);
                const isSelected = userAnswers[currentQ.id] === opt;

                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => onSelectOption(currentQ.id, opt)}
                    className={`w-full text-left p-4 rounded-xl border transition-all active:scale-95 flex items-center gap-4 ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/60 font-medium text-indigo-950 shadow-sm ring-1 ring-indigo-600'
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-800'
                    }`}
                  >
                    <span
                      className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                        isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}
                    >
                      {opt}
                    </span>
                    <span className="text-sm leading-snug flex-1">{optionText}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between pt-6 border-t border-slate-100">
              <button
                type="button"
                disabled={currentIndex === 0}
                onClick={onPrevious}
                className="border border-slate-200 px-5 py-2.5 rounded-xl text-xs font-semibold hover:bg-slate-50 disabled:opacity-30"
              >
                ← Previous
              </button>
              <div className="text-xs font-medium text-slate-400">
                {currentIndex + 1} of {questions.length}
              </div>
              {currentIndex < questions.length - 1 ? (
                <button
                  type="button"
                  onClick={onNext}
                  className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl text-xs font-semibold hover:bg-indigo-700 transition active:scale-95 flex items-center gap-1"
                >
                  <span>Next</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onShowSubmit}
                  className="bg-emerald-600 text-white px-6 py-2.5 rounded-xl text-xs font-semibold hover:bg-emerald-700 transition"
                >
                  Review & Submit
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Question Palette */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 space-y-4">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Question Palette
            </h3>

            {userFullName && (
              <div className="text-xs font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                {userFullName}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 text-[11px] border-b border-slate-100 pb-3 text-slate-600">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block" />
                <span>Answered ({answeredCount})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-amber-400 inline-block" />
                <span>Flagged ({flaggedCount})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-slate-200 inline-block" />
                <span>Unanswered ({questions.length - answeredCount})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-indigo-600 inline-block" />
                <span>Active</span>
              </div>
            </div>

            <div className="grid grid-cols-6 sm:grid-cols-8 lg:grid-cols-5 gap-2 max-h-80 overflow-y-auto pr-1">
              {questions.map((q, idx) => {
                const isAns = !!userAnswers[q.id];
                const isFlag = !!flaggedQuestions[q.id];
                const isCurr = currentIndex === idx;

                let statusClasses = 'bg-slate-100 text-slate-600 hover:bg-slate-200 border-slate-200';
                if (isAns) statusClasses = 'bg-emerald-500 text-white font-bold';
                if (isFlag) statusClasses = 'bg-amber-400 text-slate-950 font-bold';
                if (isCurr) statusClasses += ' ring-2 ring-indigo-600 ring-offset-2 font-bold';

                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => onNavigate(idx)}
                    className={`h-9 w-full rounded-lg text-xs border transition-all active:scale-95 flex items-center justify-center ${statusClasses}`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Submit Confirmation Modal */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl border border-slate-100">
            <h3 className="text-lg font-bold text-slate-900">Confirm Exam Submission</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Are you sure you want to finish your exam now? You have{' '}
              <span className="font-bold text-slate-900">{answeredCount}</span> out of{' '}
              <span className="font-bold text-slate-900">{questions.length}</span> questions.
            </p>
            {questions.length - answeredCount > 0 && (
              <p className="text-xs font-semibold text-amber-700 bg-amber-50 p-3 rounded-xl border border-amber-200 flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 shrink-0 text-amber-600" />
                <span>
                  Warning: You have {questions.length - answeredCount} unanswered questions remaining.
                </span>
              </p>
            )}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onCloseSubmit}
                className="px-4 py-2.5 border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-50 transition"
              >
                Return to Test
              </button>
              <button
                type="button"
                onClick={onSubmit}
                disabled={loading}
                className="px-5 py-2.5 bg-red-600 text-white text-xs font-semibold rounded-xl hover:bg-red-700 transition active:scale-95 disabled:opacity-50"
              >
                {loading ? 'Submitting...' : 'Yes, Submit Now'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { FormattedQuestionText } from '../components/FormattedQuestionText';
import ReactMarkdown from 'react-markdown';
import UpgradeModal from '../components/UpgradeModal';

import {
  ShieldAlert,
  Clock,
  CheckCircle2,
  BookOpen,
  ChevronRight,
  Zap,
  Lock,
  Crown,
  Sparkles,
  HelpCircle,
  RotateCcw,
  Award,
} from 'lucide-react';

interface Question {
  id: string;
  course_id?: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
}

interface ExamResultItem extends Question {
  selected_option: string;
  correct_option: string;
  is_correct: boolean;
  explanation?: string;
}

interface ExamResultSummary {
  score: number;
  total: number;
  percentage: number;
  passed: boolean;
  breakdown: ExamResultItem[];
}

const MAX_SECURITY_VIOLATIONS = 3;

// ============================================================
// EXAM PRESETS (Fixed time based on question count)
// ============================================================

const EXAM_PRESETS = [
  {
    id: 'quick',
    label: 'Quick Practice',
    questions: 20,
    timeLimit: 24,
    description: 'Quick assessment of your current level',
  },
  {
    id: 'half',
    label: 'Half Exam',
    questions: 50,
    timeLimit: 60,
    description: 'Standard sectional test with balanced coverage',
  },
  {
    id: 'full',
    label: 'Full Exam',
    questions: 100,
    timeLimit: 120,
    description: 'Official MoE exit exam simulation',
  },
];

const cleanOptionText = (text: string) => {
  if (!text) return '';

  return text
    .replace(/^[a-dA-D][\s.)\-:*]+/, '')
    .trim();
};

export function MockExamPage() {
  const navigate = useNavigate();

  const examContainerRef = useRef<HTMLDivElement>(null);

  // Prevent duplicate exam submissions.
  const isSubmittingRef = useRef(false);

  // Prevent multiple browser events from counting
  // as separate violations for the same action.
  const lastViolationTimeRef = useRef(0);

  // Use Auth Context
  const { isPremium, isLoading: isAuthLoading } = useAuth();

  const [showUpgradeModal, setShowUpgradeModal] =
    useState<boolean>(false);

  // Flow State
  const [step, setStep] = useState<
    'config' | 'taking' | 'results'
  >('config');

  const [selectedPreset, setSelectedPreset] =
    useState<string>('full');

  const [questionCount, setQuestionCount] =
    useState<number>(100);

  const [timeLimitMinutes, setTimeLimitMinutes] =
    useState<number>(120);

  const [enableProctoring, setEnableProctoring] =
    useState<boolean>(true);

  // Exam session states
  const [loading, setLoading] = useState<boolean>(false);

  const [sessionId, setSessionId] =
    useState<string | null>(null);

  const [questions, setQuestions] =
    useState<Question[]>([]);

  const [currentIndex, setCurrentIndex] =
    useState<number>(0);

  const [userAnswers, setUserAnswers] =
    useState<Record<string, string>>({});

  const [flaggedQuestions, setFlaggedQuestions] =
    useState<Record<string, boolean>>({});

  // Security & Violation States
  const violationsRef = useRef<number>(0);

  const [securityWarning, setSecurityWarning] =
    useState<string | null>(null);

  // Modals & Timer
  const [showSubmitModal, setShowSubmitModal] =
    useState<boolean>(false);

  const [timeLeft, setTimeLeft] =
    useState<number>(0);

  // Results state
  const [resultSummary, setResultSummary] =
    useState<ExamResultSummary | null>(null);

  // Detailed Analysis Explanations State
  const [aiExpl, setAiExpl] = useState<
    Record<
      string,
      {
        loading: boolean;
        content?: string;
        error?: string;
      }
    >
  >({});

  // ============================================================
  // HELPERS
  // ============================================================

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;

    return `${mins.toString().padStart(2, '0')}:${secs
      .toString()
      .padStart(2, '0')}`;
  };

  // ============================================================
  // SELECT EXAM PRESET
  // ============================================================

  const handlePresetSelect = (presetId: string) => {
    const preset = EXAM_PRESETS.find(
      (p) => p.id === presetId
    );

    if (preset) {
      setSelectedPreset(presetId);
      setQuestionCount(preset.questions);
      setTimeLimitMinutes(preset.timeLimit);
    }
  };

  // ============================================================
  // SELECT OPTION
  // ============================================================

  const handleSelectOption = (
    questionId: string,
    option: string
  ) => {
    setUserAnswers((prev) => {
      const updated = {
        ...prev,
        [questionId]: option,
      };

      if (sessionId) {
        localStorage.setItem(
          `exit_exam_draft_${sessionId}`,
          JSON.stringify(updated)
        );
      }

      return updated;
    });
  };

  // ============================================================
  // FLAG QUESTION
  // ============================================================

  const toggleFlagQuestion = (questionId: string) => {
    setFlaggedQuestions((prev) => ({
      ...prev,
      [questionId]: !prev[questionId],
    }));
  };

  // ============================================================
  // PAYMENT / UPGRADE
  // ============================================================

  // ============================================================
  // SUBMIT EXAM
  // ============================================================

  const handleSubmitExam = useCallback(async () => {
    if (!sessionId || isSubmittingRef.current) {
      return;
    }

    isSubmittingRef.current = true;

    setLoading(true);
    setShowSubmitModal(false);

    try {
      const res = await apiClient.post(
        `/api/exams/${sessionId}/submit`,
        {
          answers: userAnswers,
        }
      );

      const data = res.data;

      const total =
        data.total_questions ?? questions.length;

      const score =
        data.correct_count ??
        data.score ??
        0;

      const percentage =
        data.score_percent ??
        data.percentage ??
        0;

      const rawResults =
        data.results ||
        data.detailed_results ||
        [];

      const breakdown: ExamResultItem[] =
        rawResults.map((item: any) => {
          const originalQ = questions.find(
            (q) => q.id === item.question_id
          );

          return {
            ...(originalQ || {
              id: item.question_id,
              question_text:
                item.prompt ||
                'Question details unavailable',
              option_a: '',
              option_b: '',
              option_c: '',
              option_d: '',
            }),

            id: item.question_id,

            question_text:
              originalQ?.question_text ||
              item.prompt ||
              'Question details unavailable',

            selected_option:
              item.user_answer || '',

            correct_option:
              item.correct_answer || '',

            is_correct:
              Boolean(item.is_correct),

            explanation:
              item.explanation,
          };
        });

      setResultSummary({
        score,
        total,
        percentage,
        passed: percentage >= 50,
        breakdown,
      });

      // Remove saved draft after successful submission.
      localStorage.removeItem(
        `exit_exam_draft_${sessionId}`
      );

      // Exit fullscreen safely.
      if (document.fullscreenElement) {
        try {
          await document.exitFullscreen();
        } catch (fullscreenError) {
          console.warn(
            'Unable to exit fullscreen:',
            fullscreenError
          );
        }
      }

      setStep('results');
    } catch (err: any) {
      // Allow retry if submission failed.
      isSubmittingRef.current = false;

      alert(
        err.response?.data?.detail ||
          'Failed to submit exam. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  }, [
    sessionId,
    userAnswers,
    questions,
  ]);

  // ============================================================
  // TIMER COUNTDOWN
  // ============================================================

  useEffect(() => {
    if (
      step !== 'taking' ||
      timeLeft <= 0
    ) {
      return;
    }

    const timer = window.setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer);

          // Submit after state update.
          setTimeout(() => {
            handleSubmitExam();
          }, 0);

          return 0;
        }

        return prev - 1;
      });
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [step, handleSubmitExam]);

  // ============================================================
  // RESTORE LOCAL DRAFT
  // ============================================================

  useEffect(() => {
    if (
      step !== 'taking' ||
      !sessionId
    ) {
      return;
    }

    const draftKey =
      `exit_exam_draft_${sessionId}`;

    const savedDraft =
      localStorage.getItem(draftKey);

    if (!savedDraft) {
      return;
    }

    try {
      const parsed = JSON.parse(savedDraft);

      if (
        parsed &&
        typeof parsed === 'object' &&
        !Array.isArray(parsed)
      ) {
        setUserAnswers(parsed);
      }
    } catch (error) {
      console.warn(
        'Failed to restore exam draft:',
        error
      );

      localStorage.removeItem(draftKey);
    }
  }, [step, sessionId]);

  // ============================================================
  // SECURITY VIOLATION
  // ============================================================

  const triggerSecurityViolation =
    useCallback(
      (reason: string) => {
        if (
          !enableProctoring ||
          step !== 'taking'
        ) {
          return;
        }

        const now = Date.now();

        if (
          now -
            lastViolationTimeRef.current <
          1000
        ) {
          return;
        }

        lastViolationTimeRef.current = now;

        violationsRef.current += 1;

        const currentCount =
          violationsRef.current;

        if (
          currentCount >=
          MAX_SECURITY_VIOLATIONS
        ) {
          alert(
            `SECURITY VIOLATION LIMIT EXCEEDED (${currentCount}/${MAX_SECURITY_VIOLATIONS}). Your exam is being forcibly submitted.`
          );

          handleSubmitExam();
        } else {
          setSecurityWarning(
            `Security Warning (${currentCount}/${MAX_SECURITY_VIOLATIONS}): ${reason}. Please stay in fullscreen focus mode.`
          );
        }
      },
      [
        enableProctoring,
        step,
        handleSubmitExam,
      ]
    );

  // ============================================================
  // PROCTORING EVENT LISTENERS
  // ============================================================

  useEffect(() => {
    if (
      step !== 'taking' ||
      !enableProctoring
    ) {
      return;
    }

    const handleVisibilityChange = () => {
      if (document.hidden) {
        triggerSecurityViolation(
          'Tab switch or window minimization detected'
        );
      }
    };

    const handleWindowBlur = () => {
      triggerSecurityViolation(
        'Focus lost from exam environment'
      );
    };

    const handleBeforeUnload = (
      e: BeforeUnloadEvent
    ) => {
      e.preventDefault();

      e.returnValue =
        'Warning: Leaving or refreshing will interrupt your active exam!';
    };

    const handleKeyDown = (
      e: KeyboardEvent
    ) => {
      const key =
        e.key.toLowerCase();

      const prohibitedShortcut =
        e.key === 'F12' ||
        (
          e.ctrlKey &&
          e.shiftKey &&
          ['i', 'j', 'c'].includes(key)
        ) ||
        (
          e.ctrlKey &&
          ['u', 'c', 'v'].includes(key)
        );

      if (prohibitedShortcut) {
        e.preventDefault();

        triggerSecurityViolation(
          'Prohibited keyboard shortcut attempt'
        );
      }
    };

    const handleFullscreenChange = () => {
      if (
        !document.fullscreenElement
      ) {
        triggerSecurityViolation(
          'Exited fullscreen mode'
        );
      }
    };

    document.addEventListener(
      'visibilitychange',
      handleVisibilityChange
    );

    window.addEventListener(
      'blur',
      handleWindowBlur
    );

    window.addEventListener(
      'beforeunload',
      handleBeforeUnload
    );

    window.addEventListener(
      'keydown',
      handleKeyDown
    );

    document.addEventListener(
      'fullscreenchange',
      handleFullscreenChange
    );

    return () => {
      document.removeEventListener(
        'visibilitychange',
        handleVisibilityChange
      );

      window.removeEventListener(
        'blur',
        handleWindowBlur
      );

      window.removeEventListener(
        'beforeunload',
        handleBeforeUnload
      );

      window.removeEventListener(
        'keydown',
        handleKeyDown
      );

      document.removeEventListener(
        'fullscreenchange',
        handleFullscreenChange
      );
    };
  }, [
    step,
    enableProctoring,
    triggerSecurityViolation,
  ]);

  // ============================================================
  // START MOCK EXAM
  // ============================================================

  const handleStartExam = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    if (isAuthLoading) {
      return;
    }

    if (!isPremium) {
      setShowUpgradeModal(true);
      return;
    }

    isSubmittingRef.current = false;

    setLoading(true);

    try {
      const res = await apiClient.post(
        '/api/exams/start',
        {
          mode: 'mock',
          num_questions:
            questionCount,
          secure_flag:
            enableProctoring,
        }
      );

      const rawQuestions =
        res.data.quiz_questions || [];

      const qList: Question[] =
        rawQuestions.map(
          (item: any) => {
            const q =
              item.question ||
              item;

            const choices =
              q.choices || {};

            return {
              id: q.id,

              course_id:
                q.course_id,

              question_text:
                q.prompt ||
                q.question_text ||
                '',

              option_a:
                q.option_a ||
                choices.A ||
                '',

              option_b:
                q.option_b ||
                choices.B ||
                '',

              option_c:
                q.option_c ||
                choices.C ||
                '',

              option_d:
                q.option_d ||
                choices.D ||
                '',
            };
          }
        );

      setSessionId(res.data.id);

      setQuestions(qList);

      setTimeLeft(
        timeLimitMinutes * 60
      );

      setUserAnswers({});

      setFlaggedQuestions({});

      setAiExpl({});

      violationsRef.current = 0;

      lastViolationTimeRef.current = 0;

      setSecurityWarning(null);

      setCurrentIndex(0);

      setResultSummary(null);

      setShowSubmitModal(false);

      setStep('taking');

      if (enableProctoring) {
        try {
          if (
            document.documentElement
              .requestFullscreen
          ) {
            await document.documentElement.requestFullscreen();
          }
        } catch (fsErr) {
          console.warn(
            'Fullscreen request bypassed or blocked by browser settings.',
            fsErr
          );
        }
      }
    } catch (err: any) {
      if (
        err.response?.status === 403
      ) {
        setShowUpgradeModal(true);
      } else {
        alert(
          err.response?.data?.detail ||
            'Failed to start mock exam session.'
        );
      }
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // AI EXPLANATION
  // ============================================================

  const handleGetAiExplanation =
    async (
      item: ExamResultItem
    ) => {
      if (!isPremium) {
        setShowUpgradeModal(true);
        return;
      }

      setAiExpl((prev) => ({
        ...prev,
        [item.id]: {
          loading: true,
        },
      }));

      try {
        const res =
          await apiClient.post(
            '/api/ai/explain-question',
            {
              question_id:
                item.id,

              question_text:
                item.question_text,

              options: {
                A: cleanOptionText(
                  item.option_a
                ),

                B: cleanOptionText(
                  item.option_b
                ),

                C: cleanOptionText(
                  item.option_c
                ),

                D: cleanOptionText(
                  item.option_d
                ),
              },

              selected_option:
                item.selected_option,

              correct_option:
                item.correct_option,
            }
          );

        setAiExpl((prev) => ({
          ...prev,

          [item.id]: {
            loading: false,
            content:
              res.data.explanation,
          },
        }));
      } catch (err: any) {
        setAiExpl((prev) => ({
          ...prev,

          [item.id]: {
            loading: false,

            error:
              err.response?.data
                ?.detail ||
              'Failed to generate AI deep dive explanation.',
          },
        }));
      }
    };

  // ============================================================
  // INCORRECT ITEMS
  // ============================================================

  const incorrectItems =
    resultSummary
      ? resultSummary.breakdown.filter(
          (item) =>
            !item.is_correct
        )
      : [];

  // ============================================================
  // TARGETED RETAKE
  // ============================================================

  const handleStartTargetedRetake =
    async () => {
      if (
        incorrectItems.length === 0
      ) {
        return;
      }

      if (isAuthLoading) {
        return;
      }

      if (!isPremium) {
        setShowUpgradeModal(true);
        return;
      }

      isSubmittingRef.current = false;

      setLoading(true);

      try {
        const questionIds =
          incorrectItems.map(
            (item) => item.id
          );

        const res =
          await apiClient.post(
            '/api/exams/start-targeted',
            {
              question_ids:
                questionIds,

              title:
                `Targeted Review: ${incorrectItems.length} Missed Concepts`,
            }
          );

        const rawQuestions =
          res.data.quiz_questions ||
          [];

        const qList: Question[] =
          rawQuestions.map(
            (item: any) => {
              const q =
                item.question ||
                item;

              const choices =
                q.choices || {};

              return {
                id: q.id,

                course_id:
                  q.course_id,

                question_text:
                  q.prompt ||
                  q.question_text ||
                  '',

                option_a:
                  q.option_a ||
                  choices.A ||
                  '',

                option_b:
                  q.option_b ||
                  choices.B ||
                  '',

                option_c:
                  q.option_c ||
                  choices.C ||
                  '',

                option_d:
                  q.option_d ||
                  choices.D ||
                  '',
              };
            }
          );

        setSessionId(res.data.id);

        setQuestions(qList);

        setTimeLeft(
          incorrectItems.length * 120
        );

        setUserAnswers({});

        setFlaggedQuestions({});

        setAiExpl({});

        violationsRef.current = 0;

        lastViolationTimeRef.current = 0;

        setSecurityWarning(null);

        setCurrentIndex(0);

        setResultSummary(null);

        setShowSubmitModal(false);

        setStep('taking');

        if (enableProctoring) {
          try {
            if (
              document.documentElement
                .requestFullscreen
            ) {
              await document.documentElement.requestFullscreen();
            }
          } catch (fsErr) {
            console.warn(
              'Fullscreen request bypassed or blocked by browser settings.',
              fsErr
            );
          }
        }
      } catch (err: any) {
        alert(
          err.response?.data
            ?.detail ||
            'Failed to start targeted review session.'
        );
      } finally {
        setLoading(false);
      }
    };

  // ============================================================
  // STEP 1: CONFIGURATION SCREEN
  // ============================================================

  if (step === 'config') {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">

        {/* Header Card */}
        <div className="relative w-full overflow-hidden rounded-2xl bg-[#1b1b3a] text-white shadow-xl border border-slate-800">

          <div className="pointer-events-none absolute right-4 bottom-8 opacity-10 md:right-8 md:bottom-2 text-indigo-300">
            <BookOpen className="h-64 w-64 stroke-[1.2]" />
          </div>

          <div className="relative z-10 p-6 md:p-8">

            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-indigo-400/30 bg-indigo-500/10 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-indigo-200">

              <Zap className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />

              <span>
                National Standard Simulation
              </span>

            </div>

            <h1 className="mb-3 text-2xl md:text-4xl font-extrabold tracking-tight text-white">
              Computer Science Exit Exam Simulator
            </h1>

            <p className="max-w-2xl text-sm md:text-base leading-relaxed text-indigo-100/80">
              Complete Computer-Based Testing (CBT) environment modeling official MoE exit examination standards.
            </p>

          </div>
        </div>

        {/* Premium Status Banner */}
        {!isPremium && (
          <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/30 rounded-2xl p-4 flex items-center justify-between gap-4">

            <div className="flex items-center gap-3">

              <div className="bg-amber-500/20 p-2.5 rounded-xl text-amber-600">
                <Lock className="h-5 w-5" />
              </div>

              <div>
                <h4 className="text-sm font-bold text-slate-900">
                  Premium CBT Feature
                </h4>

                <p className="text-xs text-slate-600">
                  Full Exit Exam Simulations and AI Deep-Dive Explanations require Premium access.
                </p>
              </div>

            </div>

            <button
              onClick={() =>
                setShowUpgradeModal(true)
              }
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs px-4 py-2.5 rounded-xl transition shrink-0 flex items-center gap-1.5 shadow-sm"
            >
              <Crown className="h-3.5 w-3.5 fill-slate-950" />
              <span>Upgrade</span>
            </button>

          </div>
        )}

        {/* Exam Configuration Form */}
        <div className="bg-white shadow-sm rounded-2xl border border-slate-200 p-8 space-y-6">

          <form
            onSubmit={handleStartExam}
            className="space-y-6"
          >

            {/* Exam Preset Selection */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Exam Format
              </label>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {EXAM_PRESETS.map((preset) => {
                  const isSelected =
                    selectedPreset === preset.id;

                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() =>
                        handlePresetSelect(
                          preset.id
                        )
                      }
                      className={`p-4 rounded-xl border-2 text-left transition-all ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-600/20'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="mb-2">
                        <span className="font-bold text-slate-900 text-sm">
                          {preset.label}
                        </span>
                      </div>

                      <div className="space-y-1 text-xs text-slate-600">
                        <p className="font-semibold">
                          {preset.questions} questions
                        </p>
                        <p>
                          {preset.timeLimit} minutes
                        </p>
                        <p className="text-slate-400 text-[11px]">
                          {preset.description}
                        </p>
                      </div>

                      <div className="mt-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        {(
                          preset.timeLimit /
                          preset.questions
                        ).toFixed(1)}{' '}
                        min per question
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Time Display */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Time Limit
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Fixed based on exam format
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-slate-900">
                    {timeLimitMinutes} min
                  </p>
                  <p className="text-xs text-slate-400">
                    {questionCount} questions
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-start gap-3">

              <input
                type="checkbox"
                id="proctorToggle"
                checked={enableProctoring}
                onChange={(e) =>
                  setEnableProctoring(
                    e.target.checked
                  )
                }
                className="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />

              <label
                htmlFor="proctorToggle"
                className="text-xs text-slate-700 cursor-pointer"
              >
                <span className="font-bold block text-slate-900 mb-0.5">
                  Enable Strict Proctoring (secure_flag)
                </span>

                Enforces full-screen, disables copy-pasting, monitors window blur/tab switches, and auto-submits on repeated security violations.
              </label>

            </div>

            <div className="bg-indigo-50/70 border border-indigo-100 p-4 rounded-xl text-xs text-indigo-950 space-y-2">

              <p className="font-bold text-indigo-900 flex items-center gap-1">
                <span></span>
                <span>Official CBT Instructions:</span>
              </p>

              <ul className="space-y-1 text-indigo-900/90 pl-1">
                <li>
                  • Questions are sampled dynamically across all core computer science domains.
                </li>

                <li>
                  • Use the Question Palette to track answered, flagged, and pending items.
                </li>

                <li>
                  • Ensure a stable internet connection; answers are auto-saved locally in real time.
                </li>
              </ul>

            </div>

            <div className="flex gap-3 pt-2">

              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-indigo-600 text-white py-3.5 rounded-xl font-semibold hover:bg-indigo-700 transition shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {!isPremium && (
                  <Lock className="h-4 w-4 text-indigo-200" />
                )}

                <span>
                  {loading
                    ? 'Initializing Secure Engine...'
                    : 'Begin Mock Exam'}
                </span>

                {!loading && (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>

              <button
                type="button"
                onClick={() =>
                  navigate('/dashboard')
                }
                className="border border-slate-300 px-6 py-3.5 rounded-xl text-sm font-semibold hover:bg-slate-50 text-slate-700"
              >
                Cancel
              </button>

            </div>

          </form>

        </div>

        {/* Upgrade Modal */}
        <UpgradeModal
          isOpen={showUpgradeModal}
          onClose={() => setShowUpgradeModal(false)}
          customMessage="Get the full Mock Exam Engine with unlimited simulations, AI deep-dive explanations, and proctored testing."
        />

      </div>
    );
  }

  // ============================================================
  // STEP 2: ACTIVE EXAM ENVIRONMENT
  // ============================================================

  if (step === 'taking') {
    const currentQ =
      questions[currentIndex];

    const answeredCount =
      Object.keys(userAnswers).length;

    const flaggedCount =
      Object.values(
        flaggedQuestions
      ).filter(Boolean).length;

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
        onContextMenu={(e) =>
          e.preventDefault()
        }
        className="min-h-screen bg-slate-50 select-none px-4 py-6 space-y-6 max-w-6xl mx-auto relative"
      >

        {securityWarning && (
          <div className="bg-amber-500 text-slate-950 px-4 py-3 rounded-xl text-xs font-semibold flex items-center justify-between shadow-md animate-bounce">

            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-slate-950" />
              <span>
                {securityWarning}
              </span>
            </div>

            <button
              onClick={() =>
                setSecurityWarning(null)
              }
              className="bg-slate-950 text-white px-2.5 py-1 rounded-lg text-[10px] uppercase font-bold"
            >
              Acknowledge
            </button>

          </div>
        )}

        <div className="bg-white sticky top-2 z-20 shadow-md border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">

          <div className="flex items-center gap-4">

            <div>

              <div className="flex items-center gap-2">

                <span className="text-[10px] font-bold bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded uppercase tracking-wider">
                  Session #
                  {sessionId?.slice(0, 8) ||
                    'CBT-01'}
                </span>

                {enableProctoring && (
                  <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded uppercase tracking-wider flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3 text-emerald-700" />
                    Secured
                  </span>
                )}

              </div>

              <h2 className="text-base font-semibold text-slate-900 mt-0.5">
                Question {currentIndex + 1} of{' '}
                {questions.length}
              </h2>

            </div>

          </div>

          <div className="flex items-center gap-4">

            <div
              className={`px-4 py-2 rounded-xl font-mono font-bold text-sm flex items-center gap-1.5 ${
                timeLeft < 300
                  ? 'bg-red-500 text-white animate-pulse'
                  : 'bg-slate-100 text-slate-800'
              }`}
            >
              <Clock className="h-4 w-4" />

              <span>
                {formatTime(timeLeft)}
              </span>
            </div>

            <button
              type="button"
              onClick={() =>
                setShowSubmitModal(true)
              }
              className="bg-red-600 text-white text-xs font-semibold px-4 py-2.5 rounded-xl hover:bg-red-700 transition shadow-sm"
            >
              Finish & Submit
            </button>

          </div>

        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

          <div className="lg:col-span-3 space-y-4">

            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 sm:p-8 space-y-6">

              <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">

                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Select the best single answer
                </span>

                <button
                  type="button"
                  onClick={() =>
                    toggleFlagQuestion(
                      currentQ.id
                    )
                  }
                  className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 ${
                    flaggedQuestions[
                      currentQ.id
                    ]
                      ? 'bg-amber-100 border-amber-300 text-amber-900 font-bold'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {' '}
                  {flaggedQuestions[
                    currentQ.id
                  ]
                    ? 'Flagged for Review'
                    : 'Flag Question'}
                </button>

              </div>

              <FormattedQuestionText
                text={
                  currentQ.question_text
                }
              />

              <div className="space-y-3 pt-2">

                {(
                  [
                    'A',
                    'B',
                    'C',
                    'D',
                  ] as const
                ).map((opt) => {

                  const rawText =
                    currentQ[
                      `option_${opt.toLowerCase()}` as keyof Question
                    ] || '';

                  const optionText =
                    cleanOptionText(
                      rawText
                    );

                  const isSelected =
                    userAnswers[
                      currentQ.id
                    ] === opt;

                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() =>
                        handleSelectOption(
                          currentQ.id,
                          opt
                        )
                      }
                      className={`w-full text-left p-4 rounded-xl border transition-all flex items-center gap-4 ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-50/60 font-medium text-indigo-950 shadow-sm ring-1 ring-indigo-600'
                          : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-800'
                      }`}
                    >

                      <span
                        className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                          isSelected
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}
                      >
                        {opt}
                      </span>

                      <span className="text-sm leading-snug flex-1">
                        {optionText}
                      </span>

                    </button>
                  );
                })}

              </div>

              <div className="flex items-center justify-between pt-6 border-t border-slate-100">

                <button
                  type="button"
                  disabled={
                    currentIndex === 0
                  }
                  onClick={() =>
                    setCurrentIndex(
                      (prev) =>
                        Math.max(
                          0,
                          prev - 1
                        )
                    )
                  }
                  className="border border-slate-200 px-5 py-2.5 rounded-xl text-xs font-semibold hover:bg-slate-50 disabled:opacity-30"
                >
                  ← Previous
                </button>

                <div className="text-xs font-medium text-slate-400">
                  {currentIndex + 1} of{' '}
                  {questions.length}
                </div>

                {currentIndex <
                questions.length - 1 ? (
                  <button
                    type="button"
                    onClick={() =>
                      setCurrentIndex(
                        (prev) =>
                          Math.min(
                            questions.length -
                              1,
                            prev + 1
                          )
                      )
                    }
                    className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl text-xs font-semibold hover:bg-indigo-700 transition flex items-center gap-1"
                  >
                    <span>Next</span>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      setShowSubmitModal(
                        true
                      )
                    }
                    className="bg-emerald-600 text-white px-6 py-2.5 rounded-xl text-xs font-semibold hover:bg-emerald-700 transition"
                  >
                    Review & Submit
                  </button>
                )}

              </div>

            </div>

          </div>

          <div className="lg:col-span-1 space-y-4">

            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 space-y-4">

              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Question Palette
              </h3>

              <div className="grid grid-cols-2 gap-2 text-[11px] border-b border-slate-100 pb-3 text-slate-600">

                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block" />
                  <span>
                    Answered ({answeredCount})
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-amber-400 inline-block" />
                  <span>
                    Flagged ({flaggedCount})
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-slate-200 inline-block" />
                  <span>
                    Unanswered (
                    {questions.length -
                      answeredCount}
                    )
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-indigo-600 inline-block" />
                  <span>Active</span>
                </div>

              </div>

              <div className="grid grid-cols-6 sm:grid-cols-8 lg:grid-cols-5 gap-2 max-h-80 overflow-y-auto pr-1">

                {questions.map(
                  (q, idx) => {
                    const isAns =
                      !!userAnswers[
                        q.id
                      ];

                    const isFlag =
                      !!flaggedQuestions[
                        q.id
                      ];

                    const isCurr =
                      currentIndex ===
                      idx;

                    let statusClasses =
                      'bg-slate-100 text-slate-600 hover:bg-slate-200 border-slate-200';

                    if (isAns) {
                      statusClasses =
                        'bg-emerald-500 text-white font-bold';
                    }

                    if (isFlag) {
                      statusClasses =
                        'bg-amber-400 text-slate-950 font-bold';
                    }

                    if (isCurr) {
                      statusClasses +=
                        ' ring-2 ring-indigo-600 ring-offset-2 font-bold';
                    }

                    return (
                      <button
                        key={q.id}
                        type="button"
                        onClick={() =>
                          setCurrentIndex(
                            idx
                          )
                        }
                        className={`h-9 w-full rounded-lg text-xs border transition-all flex items-center justify-center ${statusClasses}`}
                      >
                        {idx + 1}
                      </button>
                    );
                  }
                )}

              </div>

            </div>

          </div>

        </div>

        {/* Submit Confirmation Modal */}
        {showSubmitModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">

            <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl border border-slate-100">

              <h3 className="text-lg font-bold text-slate-900">
                Confirm Exam Submission
              </h3>

              <p className="text-sm text-slate-600 leading-relaxed">
                Are you sure you want to finish your exam now? You have{' '}
                <span className="font-bold text-slate-900">
                  {answeredCount}
                </span>{' '}
                out of{' '}
                <span className="font-bold text-slate-900">
                  {questions.length}
                </span>{' '}
                questions.
              </p>

              {questions.length -
                answeredCount >
                0 && (
                <p className="text-xs font-semibold text-amber-700 bg-amber-50 p-3 rounded-xl border border-amber-200 flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 shrink-0 text-amber-600" />

                  <span>
                    Warning: You have{' '}
                    {questions.length -
                      answeredCount}{' '}
                    unanswered questions remaining.
                  </span>
                </p>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">

                <button
                  type="button"
                  onClick={() =>
                    setShowSubmitModal(
                      false
                    )
                  }
                  className="px-4 py-2.5 border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-50 transition"
                >
                  Return to Test
                </button>

                <button
                  type="button"
                  onClick={
                    handleSubmitExam
                  }
                  disabled={loading}
                  className="px-5 py-2.5 bg-red-600 text-white text-xs font-semibold rounded-xl hover:bg-red-700 transition disabled:opacity-50"
                >
                  {loading
                    ? 'Submitting...'
                    : 'Yes, Submit Now'}
                </button>

              </div>

            </div>

          </div>
        )}

      </div>
    );
  }

  // ============================================================
  // STEP 3: RESULTS & BREAKDOWN VIEW
  // ============================================================

  if (
    step === 'results' &&
    resultSummary
  ) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">

        {/* Score Header Card */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-8 md:p-10 text-center shadow-sm space-y-6">

          <div className="inline-flex items-center gap-1.5 bg-[#f0f3ff] text-[#5252cc] text-[11px] font-extrabold uppercase tracking-widest px-5 py-1.5 rounded-full">
            <Award className="h-3.5 w-3.5 shrink-0" />
            <span>
              Official Assessment Report
            </span>
          </div>

          <div className="space-y-2">

            <h1 className="text-2xl md:text-3xl font-extrabold text-[#0f172a] flex items-center justify-center gap-3 tracking-tight">

              {resultSummary.passed ? (
                <>
                  <CheckCircle2 className="h-7 w-7 text-emerald-500 shrink-0" />
                  <span>
                    Examination Passed
                  </span>
                </>
              ) : (
                <>
                  <ShieldAlert className="h-7 w-7 text-rose-500 shrink-0" />
                  <span>
                    Needs Improvement
                  </span>
                </>
              )}

            </h1>

            <p className="text-slate-500 text-sm max-w-lg mx-auto">
              Review your performance breakdown below. Detailed explanations are available for each question.
            </p>

          </div>

          <div className="py-2 flex flex-col items-center justify-center">

            <div
              className={`text-5xl md:text-6xl font-black tracking-tight ${
                resultSummary.passed
                  ? 'text-emerald-600'
                  : 'text-rose-600'
              }`}
            >
              {Math.round(
                resultSummary.percentage
              )}
              %
            </div>

            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mt-2">
              Final Score
            </div>

          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl mx-auto pt-2">

            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 text-center">
              <span className="block text-2xl font-bold text-slate-800">
                {resultSummary.score}
              </span>
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Correct
              </span>
            </div>

            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 text-center">
              <span className="block text-2xl font-bold text-slate-800">
                {resultSummary.total -
                  resultSummary.score}
              </span>
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Incorrect
              </span>
            </div>

            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 text-center">
              <span className="block text-2xl font-bold text-slate-800">
                {resultSummary.total}
              </span>
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Total
              </span>
            </div>

            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 text-center">
              <span className="block text-2xl font-bold text-slate-800">
                50%
              </span>

              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-center gap-1">
                <span>
                  Pass Mark
                </span>

                <HelpCircle className="h-3 w-3 text-slate-400 shrink-0" />
              </span>
            </div>

          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-4">

            {incorrectItems.length >
              0 && (
              <button
                type="button"
                onClick={
                  handleStartTargetedRetake
                }
                disabled={loading}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-5 py-3 rounded-xl transition shadow-sm flex items-center gap-2 disabled:opacity-50"
              >
                <RotateCcw className="h-4 w-4 shrink-0" />

                <span>
                  {loading
                    ? 'Starting...'
                    : `Review Missed Questions (${incorrectItems.length})`}
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={() =>
                setStep('config')
              }
              className="border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold px-5 py-3 rounded-xl transition flex items-center gap-2"
            >
              <span>
                New Exam
              </span>
            </button>

            <button
              type="button"
              onClick={() =>
                navigate('/dashboard')
              }
              className="border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold px-5 py-3 rounded-xl transition"
            >
              Dashboard
            </button>

          </div>

        </div>

        {/* Question Breakdown Section */}
        <div className="space-y-6">

          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Question Review
          </h2>

          <div className="space-y-4">

            {resultSummary.breakdown.map(
              (item, idx) => {
                const explState =
                  aiExpl[item.id] || {};

                return (
                  <div
                    key={
                      item.id ?? idx
                    }
                    className={`bg-white rounded-2xl border p-6 space-y-4 transition-all shadow-sm ${
                      item.is_correct
                        ? 'border-slate-200'
                        : 'border-rose-200 bg-rose-50/10'
                    }`}
                  >

                    <div className="flex items-start justify-between gap-4">

                      <div className="flex items-center gap-2">

                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                          Question {idx + 1}
                        </span>

                        <span
                          className={`text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                            item.is_correct
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {item.is_correct
                            ? 'Correct'
                            : 'Incorrect'}
                        </span>

                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          handleGetAiExplanation(
                            item
                          )
                        }
                        disabled={
                          explState.loading
                        }
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition disabled:opacity-50"
                      >
                        <Sparkles className="h-3.5 w-3.5 fill-amber-300 text-amber-500 shrink-0" />

                        <span>
                          {explState.loading
                            ? 'Getting explanation...'
                            : 'Explain'}
                        </span>
                      </button>

                    </div>

                    <p className="text-base font-medium text-slate-900 leading-relaxed">
                      {item.question_text}
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1">

                      {(
                        [
                          'A',
                          'B',
                          'C',
                          'D',
                        ] as const
                      ).map((opt) => {

                        const rawText =
                          item[
                            `option_${opt.toLowerCase()}` as keyof Question
                          ] || '';

                        const optionText =
                          cleanOptionText(
                            rawText
                          );

                        const isUserPick =
                          item.selected_option ===
                          opt;

                        const isCorrectOpt =
                          item.correct_option ===
                          opt;

                        let style =
                          'border-slate-200 bg-slate-50/50 text-slate-700';

                        if (
                          isCorrectOpt
                        ) {
                          style =
                            'border-emerald-300 bg-emerald-50/80 text-emerald-950 font-medium ring-1 ring-emerald-400';
                        } else if (
                          isUserPick &&
                          !item.is_correct
                        ) {
                          style =
                            'border-rose-300 bg-rose-50/80 text-rose-950 font-medium ring-1 ring-rose-400';
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
                                  : isUserPick &&
                                    !item.is_correct
                                  ? 'bg-rose-600 text-white'
                                  : 'bg-slate-200 text-slate-600'
                              }`}
                            >
                              {opt}
                            </span>

                            <span className="flex-1 leading-snug">
                              {optionText}
                            </span>

                            {isCorrectOpt && (
                              <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider shrink-0">
                                Correct
                              </span>
                            )}

                            {isUserPick &&
                              !isCorrectOpt && (
                                <span className="text-[10px] font-bold text-rose-700 uppercase tracking-wider shrink-0">
                                  Your Answer
                                </span>
                              )}

                          </div>
                        );
                      })}

                    </div>

                    {item.explanation && (
                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 text-xs text-slate-700 space-y-1">

                        <div className="flex items-center gap-1.5 font-bold text-slate-900">
                          <HelpCircle className="h-3.5 w-3.5 text-slate-400 shrink-0" />

                          <span>
                            Explanation:
                          </span>
                        </div>

                        <p className="leading-relaxed">
                          {item.explanation}
                        </p>

                      </div>
                    )}

                    {explState.content && (
                      <div className="p-4 bg-indigo-50/70 border border-indigo-200/80 rounded-xl text-xs text-indigo-950 space-y-2">

                        <div className="flex items-center gap-1.5 font-bold text-indigo-900">

                          <Sparkles className="h-4 w-4 fill-amber-300 text-amber-500 shrink-0" />

                          <span>
                            Detailed Analysis:
                          </span>

                        </div>

                        <div className="prose prose-xs text-indigo-950 max-w-none leading-relaxed">
                          <ReactMarkdown>
                            {explState.content}
                          </ReactMarkdown>
                        </div>

                      </div>
                    )}

                    {explState.error && (
                      <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">
                        {explState.error}
                      </div>
                    )}

                  </div>
                );
              }
            )}

          </div>

        </div>

      </div>
    );
  }

  return null;
}
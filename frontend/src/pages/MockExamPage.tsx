import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  Question,
  ExamResultItem,
  ExamResultSummary,
  cleanOptionText,
} from './MockExamTypes';
import { MockExamConfig } from './MockExamConfig';
import { MockExamTaking } from './MockExamTaking';
import { MockExamResults } from './MockExamResults';

export function MockExamPage() {
  const navigate = useNavigate();
  const examContainerRef = useRef<HTMLDivElement>(null);
  const isSubmittingRef = useRef(false);
  const lastViolationTimeRef = useRef(0);

  const { user, isPremium, isLoading: isAuthLoading } = useAuth();

  const [showUpgradeModal, setShowUpgradeModal] = useState<boolean>(false);
  const [step, setStep] = useState<'config' | 'taking' | 'results'>('config');
  const [selectedPreset, setSelectedPreset] = useState<string>('full');
  const [questionCount, setQuestionCount] = useState<number>(100);
  const [timeLimitMinutes, setTimeLimitMinutes] = useState<number>(120);
  const [enableProctoring, setEnableProctoring] = useState<boolean>(true);
  const [rulesAcknowledged, setRulesAcknowledged] = useState<boolean>(false);

  const [loading, setLoading] = useState<boolean>(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [flaggedQuestions, setFlaggedQuestions] = useState<Record<string, boolean>>({});

  const violationsRef = useRef<number>(0);
  const [securityWarning, setSecurityWarning] = useState<string | null>(null);
  const [showSubmitModal, setShowSubmitModal] = useState<boolean>(false);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [resultSummary, setResultSummary] = useState<ExamResultSummary | null>(null);
  const [aiExpl, setAiExpl] = useState<Record<string, { loading: boolean; content?: string; error?: string }>>({});

  // ============================================================
  // SELECT EXAM PRESET
  // ============================================================

  const handlePresetSelect = (presetId: string) => {
    const preset = [
      { id: 'quick', questions: 20, timeLimit: 24 },
      { id: 'half', questions: 50, timeLimit: 60 },
      { id: 'full', questions: 100, timeLimit: 120 },
    ].find((p) => p.id === presetId);

    if (preset) {
      setSelectedPreset(presetId);
      setQuestionCount(preset.questions);
      setTimeLimitMinutes(preset.timeLimit);
    }
  };

  // ============================================================
  // SELECT OPTION
  // ============================================================

  const handleSelectOption = (questionId: string, option: string) => {
    setUserAnswers((prev) => {
      const updated = { ...prev, [questionId]: option };
      if (sessionId) {
        localStorage.setItem(`exit_exam_draft_${sessionId}`, JSON.stringify(updated));
      }
      return updated;
    });
  };

  // ============================================================
  // FLAG QUESTION
  // ============================================================

  const toggleFlagQuestion = (questionId: string) => {
    setFlaggedQuestions((prev) => ({ ...prev, [questionId]: !prev[questionId] }));
  };

  // ============================================================
  // SUBMIT EXAM
  // ============================================================

  const handleSubmitExam = useCallback(async () => {
    if (!sessionId || isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setLoading(true);
    setShowSubmitModal(false);

    try {
      const res = await apiClient.post(`/api/exams/${sessionId}/submit`, {
        answers: userAnswers,
      });

      const data = res.data;
      const total = data.total_questions ?? questions.length;
      const score = data.correct_count ?? data.score ?? 0;
      const percentage = data.score_percent ?? data.percentage ?? 0;
      const rawResults = data.results || data.detailed_results || [];

      const breakdown: ExamResultItem[] = rawResults.map((item: any) => {
        const originalQ = questions.find((q) => q.id === item.question_id);
        return {
          ...(originalQ || {
            id: item.question_id,
            question_text: item.prompt || 'Question details unavailable',
            option_a: '',
            option_b: '',
            option_c: '',
            option_d: '',
          }),
          id: item.question_id,
          question_text: originalQ?.question_text || item.prompt || 'Question details unavailable',
          selected_option: item.user_answer || '',
          correct_option: item.correct_answer || '',
          is_correct: Boolean(item.is_correct),
          explanation: item.explanation,
        };
      });

      setResultSummary({
        score,
        total,
        percentage,
        passed: percentage >= 50,
        breakdown,
      });

      localStorage.removeItem(`exit_exam_draft_${sessionId}`);

      if (document.fullscreenElement) {
        try {
          await document.exitFullscreen();
        } catch (fullscreenError) {
          console.warn('Unable to exit fullscreen:', fullscreenError);
        }
      }

      setStep('results');
    } catch (err: any) {
      isSubmittingRef.current = false;
      alert(
        err.response?.data?.detail ||
          "We couldn't submit your exam. Your answers are saved - please try again."
      );
    } finally {
      setLoading(false);
    }
  }, [sessionId, userAnswers, questions]);

  // ============================================================
  // TIMER COUNTDOWN
  // ============================================================

  useEffect(() => {
    if (step !== 'taking' || timeLeft <= 0) return;

    const timer = window.setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer);
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
    if (step !== 'taking' || !sessionId) return;

    const draftKey = `exit_exam_draft_${sessionId}`;
    const savedDraft = localStorage.getItem(draftKey);
    if (!savedDraft) return;

    try {
      const parsed = JSON.parse(savedDraft);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        setUserAnswers(parsed);
      }
    } catch (error) {
      console.warn('Failed to restore exam draft:', error);
      localStorage.removeItem(draftKey);
    }
  }, [step, sessionId]);

  // ============================================================
  // SECURITY VIOLATION
  // ============================================================

  const triggerSecurityViolation = useCallback(
    (reason: string) => {
      if (!enableProctoring || step !== 'taking') return;

      const now = Date.now();
      if (now - lastViolationTimeRef.current < 1000) return;
      lastViolationTimeRef.current = now;

      violationsRef.current += 1;
      const currentCount = violationsRef.current;

      if (currentCount >= 3) {
        alert(
          `SECURITY VIOLATION LIMIT EXCEEDED (${currentCount}/3). Your exam is being forcibly submitted.`
        );
        handleSubmitExam();
      } else {
        setSecurityWarning(
          `Security Warning (${currentCount}/3): ${reason}. Please stay in fullscreen focus mode.`
        );
      }
    },
    [enableProctoring, step, handleSubmitExam]
  );

  // ============================================================
  // PROCTORING EVENT LISTENERS
  // ============================================================

  useEffect(() => {
    if (step !== 'taking' || !enableProctoring) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        triggerSecurityViolation('Tab switch or window minimization detected');
      }
    };

    const handleWindowBlur = () => {
      triggerSecurityViolation('Focus lost from exam environment');
    };

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = 'Warning: Leaving or refreshing will interrupt your active exam!';
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const prohibitedShortcut =
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && ['i', 'j', 'c'].includes(key)) ||
        (e.ctrlKey && ['u', 'c', 'v'].includes(key));

      if (prohibitedShortcut) {
        e.preventDefault();
        triggerSecurityViolation('Prohibited keyboard shortcut attempt');
      }
    };

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        triggerSecurityViolation('Exited fullscreen mode');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [step, enableProctoring, triggerSecurityViolation]);

  // ============================================================
  // START MOCK EXAM
  // ============================================================

  const handleStartExam = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isAuthLoading) return;

    if (!isPremium) {
      setShowUpgradeModal(true);
      return;
    }

    isSubmittingRef.current = false;
    setLoading(true);

    try {
      const res = await apiClient.post('/api/exams/start', {
        mode: 'mock',
        num_questions: questionCount,
        secure_flag: enableProctoring,
      });

      const rawQuestions = res.data.quiz_questions || [];
      const qList: Question[] = rawQuestions.map((item: any) => {
        const q = item.question || item;
        const choices = q.choices || {};
        return {
          id: q.id,
          course_id: q.course_id,
          question_text: q.prompt || q.question_text || '',
          option_a: q.option_a || choices.A || '',
          option_b: q.option_b || choices.B || '',
          option_c: q.option_c || choices.C || '',
          option_d: q.option_d || choices.D || '',
        };
      });

      setSessionId(res.data.id);
      setQuestions(qList);
      setTimeLeft(timeLimitMinutes * 60);
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
          if (document.documentElement.requestFullscreen) {
            await document.documentElement.requestFullscreen();
          }
        } catch (fsErr) {
          console.warn('Fullscreen request bypassed or blocked by browser settings.', fsErr);
        }
      }
    } catch (err: any) {
      if (err.response?.status === 403) {
        setShowUpgradeModal(true);
      } else {
        alert(
          err.response?.data?.detail || "Couldn't start your exam. Check your connection and try again."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // AI EXPLANATION
  // ============================================================

  const handleGetAiExplanation = async (item: ExamResultItem) => {
    if (!isPremium) {
      setShowUpgradeModal(true);
      return;
    }

    setAiExpl((prev) => ({
      ...prev,
      [item.id]: { loading: true },
    }));

    try {
      const res = await apiClient.post('/api/ai/explain-question', {
        question_id: item.id,
        question_text: item.question_text,
        options: {
          A: cleanOptionText(item.option_a),
          B: cleanOptionText(item.option_b),
          C: cleanOptionText(item.option_c),
          D: cleanOptionText(item.option_d),
        },
        selected_option: item.selected_option,
        correct_option: item.correct_option,
      });

      setAiExpl((prev) => ({
        ...prev,
        [item.id]: { loading: false, content: res.data.explanation },
      }));
    } catch (err: any) {
      setAiExpl((prev) => ({
        ...prev,
        [item.id]: {
          loading: false,
          error: err.response?.data?.detail || 'Failed to generate AI deep dive explanation.',
        },
      }));
    }
  };

  // ============================================================
  // TARGETED RETAKE
  // ============================================================

  const handleStartTargetedRetake = async () => {
    const incorrectItems = resultSummary
      ? resultSummary.breakdown.filter((item) => !item.is_correct)
      : [];

    if (incorrectItems.length === 0) return;

    if (isAuthLoading) return;

    if (!isPremium) {
      setShowUpgradeModal(true);
      return;
    }

    isSubmittingRef.current = false;
    setLoading(true);

    try {
      const questionIds = incorrectItems.map((item) => item.id);
      const res = await apiClient.post('/api/exams/start-targeted', {
        question_ids: questionIds,
        title: `Targeted Review: ${incorrectItems.length} Missed Concepts`,
      });

      const rawQuestions = res.data.quiz_questions || [];
      const qList: Question[] = rawQuestions.map((item: any) => {
        const q = item.question || item;
        const choices = q.choices || {};
        return {
          id: q.id,
          course_id: q.course_id,
          question_text: q.prompt || q.question_text || '',
          option_a: q.option_a || choices.A || '',
          option_b: q.option_b || choices.B || '',
          option_c: q.option_c || choices.C || '',
          option_d: q.option_d || choices.D || '',
        };
      });

      setSessionId(res.data.id);
      setQuestions(qList);
      setTimeLeft(incorrectItems.length * 120);
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
          if (document.documentElement.requestFullscreen) {
            await document.documentElement.requestFullscreen();
          }
        } catch (fsErr) {
          console.warn('Fullscreen request bypassed or blocked by browser settings.', fsErr);
        }
      }
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to start targeted review session.');
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // KEYBOARD NAVIGATION
  // ============================================================

  useEffect(() => {
    if (step !== 'taking') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const currentQ = questions[currentIndex];

      if (['a', 'b', 'c', 'd'].includes(key) && currentQ) {
        e.preventDefault();
        handleSelectOption(currentQ.id, key.toUpperCase());
        return;
      }

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1));
        return;
      }

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setCurrentIndex((prev) => Math.max(0, prev - 1));
        return;
      }

      if (key === 'f' && currentQ) {
        e.preventDefault();
        toggleFlagQuestion(currentQ.id);
        return;
      }

      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setShowSubmitModal(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [step, currentIndex, questions, userAnswers, handleSelectOption, toggleFlagQuestion]);

  // ============================================================
  // RENDER
  // ============================================================

  if (step === 'config') {
    return (
      <MockExamConfig
        selectedPreset={selectedPreset}
        questionCount={questionCount}
        timeLimitMinutes={timeLimitMinutes}
        enableProctoring={enableProctoring}
        rulesAcknowledged={rulesAcknowledged}
        loading={loading}
        isPremium={isPremium}
        showUpgradeModal={showUpgradeModal}
        onPresetSelect={handlePresetSelect}
        onProctoringChange={setEnableProctoring}
        onRulesAcknowledgedChange={setRulesAcknowledged}
        onStartExam={handleStartExam}
        onCancel={() => navigate('/dashboard')}
        onUpgrade={() => setShowUpgradeModal(true)}
        onCloseUpgrade={() => setShowUpgradeModal(false)}
      />
    );
  }

  if (step === 'taking') {
    return (
      <MockExamTaking
        questions={questions}
        currentIndex={currentIndex}
        userAnswers={userAnswers}
        flaggedQuestions={flaggedQuestions}
        sessionId={sessionId}
        timeLeft={timeLeft}
        enableProctoring={enableProctoring}
        loading={loading}
        securityWarning={securityWarning}
        showSubmitModal={showSubmitModal}
        userFullName={user?.full_name || null}
        onSelectOption={handleSelectOption}
        onToggleFlag={toggleFlagQuestion}
        onNavigate={setCurrentIndex}
        onNext={() => setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1))}
        onPrevious={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
        onShowSubmit={() => setShowSubmitModal(true)}
        onCloseSubmit={() => setShowSubmitModal(false)}
        onSubmit={handleSubmitExam}
        onDismissWarning={() => setSecurityWarning(null)}
        examContainerRef={examContainerRef}
      />
    );
  }

  if (step === 'results' && resultSummary) {
    const incorrectItems = resultSummary.breakdown.filter((item) => !item.is_correct);
    return (
      <MockExamResults
        resultSummary={resultSummary}
        loading={loading}
        aiExpl={aiExpl}
        incorrectItems={incorrectItems}
        onTargetedRetake={handleStartTargetedRetake}
        onNewExam={() => setStep('config')}
        onGoDashboard={() => navigate('/dashboard')}
        onGetAiExplanation={handleGetAiExplanation}
      />
    );
  }

  return null;
}
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { apiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  ExamResultItem,
  ExamResultSummary,
  cleanOptionText,
} from './MockExamTypes';
import { MockExamResults } from './MockExamResults';

interface RawResultItem {
  question_id: string;
  prompt: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  user_answer: string;
  correct_answer: string;
  is_correct: boolean;
  explanation?: string | null;
  course_id?: string | null;
  course_name?: string | null;
}

interface RawAttemptDetail {
  id: string;
  quiz_id: string;
  title: string;
  submitted_at: string | null;
  score_percent: number;
  total_questions: number;
  correct_count: number;
  passed: boolean;
  results: RawResultItem[];
}

export function MockExamPastResult() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();
  const { isPremium } = useAuth();

  const [summary, setSummary] = useState<ExamResultSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aiExpl, setAiExpl] = useState<
    Record<string, { loading: boolean; content?: string; error?: string }>
  >({});

  useEffect(() => {
    if (!attemptId) return;
    let cancelled = false;

    setLoading(true);
    setError(null);

    apiClient
      .get<RawAttemptDetail>(`/api/exams/history/${attemptId}`)
      .then((res) => {
        if (cancelled) return;
        const d = res.data;
        const breakdown: ExamResultItem[] = d.results.map((r) => ({
          id: r.question_id,
          question_text: r.prompt,
          option_a: r.option_a,
          option_b: r.option_b,
          option_c: r.option_c,
          option_d: r.option_d,
          selected_option: r.user_answer || '',
          correct_option: r.correct_answer || '',
          is_correct: r.is_correct,
          explanation: r.explanation || undefined,
          course_name: r.course_name || null,
        }));

        setSummary({
          score: d.correct_count,
          total: d.total_questions,
          percentage: d.score_percent,
          passed: d.passed,
          breakdown,
        });
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Failed to load past attempt:', err);
        setError(
          err?.response?.data?.detail ||
            'Could not load this exam attempt.'
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [attemptId]);

  const handleGetAiExplanation = async (item: ExamResultItem) => {
    if (!isPremium) return;

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
          error:
            err?.response?.data?.detail ||
            'Failed to generate AI explanation.',
        },
      }));
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-12 text-center">
          <div className="h-6 w-6 mx-auto animate-spin rounded-full border-2 border-slate-200 border-t-indigo-600 dark:border-slate-700 dark:border-t-indigo-400" />
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-3">
            Loading attempt…
          </p>
        </div>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-4">
        <Link
          to="/mock-exams/history"
          className="inline-flex items-center text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Back to History
        </Link>
        <div className="rounded-2xl border border-rose-200 dark:border-rose-900/40 bg-rose-50 dark:bg-rose-950/20 p-8 text-center">
          <p className="text-sm text-rose-700 dark:text-rose-400">
            {error || 'Attempt not found.'}
          </p>
        </div>
      </div>
    );
  }

  const incorrectItems = summary.breakdown.filter((i) => !i.is_correct);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <Link
        to="/mock-exams/history"
        className="inline-flex items-center text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition mb-4"
      >
        <ArrowLeft className="w-4 h-4 mr-1.5" />
        Back to History
      </Link>

      <MockExamResults
        resultSummary={summary}
        loading={false}
        aiExpl={aiExpl}
        incorrectItems={incorrectItems}
        onTargetedRetake={() => navigate('/mock-exams')}
        onNewExam={() => navigate('/mock-exams')}
        onGoDashboard={() => navigate('/dashboard')}
        onGetAiExplanation={handleGetAiExplanation}
        readOnly
      />
    </div>
  );
}
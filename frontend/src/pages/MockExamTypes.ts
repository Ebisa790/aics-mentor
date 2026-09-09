// ============================================================
// TYPES & CONSTANTS FOR MOCK EXAM
// ============================================================

export interface Question {
  id: string;
  course_id?: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
}

export interface ExamResultItem extends Question {
  selected_option: string;
  correct_option: string;
  is_correct: boolean;
  explanation?: string;
}

export interface ExamResultSummary {
  score: number;
  total: number;
  percentage: number;
  passed: boolean;
  breakdown: ExamResultItem[];
}

export const MAX_SECURITY_VIOLATIONS = 3;

// ============================================================
// EXAM PRESETS (Fixed time based on question count)
// ============================================================

export const EXAM_PRESETS = [
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

export const cleanOptionText = (text: string): string => {
  if (!text) return '';

  return text
    .replace(/^[a-dA-D][\s.)\-:*]+/, '')
    .trim();
};

export const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;

  return `${mins.toString().padStart(2, '0')}:${secs
    .toString()
    .padStart(2, '0')}`;
};
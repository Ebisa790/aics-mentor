// --- Enum & Scalar Types ---
export type UserRole = 'student' | 'admin'
export type SubscriptionTier = 'free' | 'premium'
export type MaterialContentType = 'note' | 'summary' | 'slide_deck'
export type ExamDifficulty = 'easy' | 'medium' | 'hard'
export type MCQOption = 'A' | 'B' | 'C' | 'D'
export type AnnouncementType = 'moe_update' | 'exam_notice' | 'platform_news'
export type ReviewStatus = 'generated' | 'under_review' | 'approved' | 'rejected' | 'archived'
export type QuestionType = 'multiple_choice' | 'short_answer'
export type QuizType = 'daily_quiz' | 'chapter_test' | 'weekly_exam' | 'full_simulation'
export type ExamMode = 'practice' | 'mock'
export type TutorMode = 'beginner' | 'advanced' | 'explanation'
export type PlanDurationType = 'lifetime' | 'monthly' | 'semester' | 'annual' | 'custom'
export type PaymentStatus = 'pending' | 'success' | 'failed' | 'cancelled' | 'expired'

// --- User & Admin Interfaces ---
export interface User {
  id: string
  email: string
  full_name: string
  avatar_url?: string
  role: UserRole
  university: string | null
  year_of_study: number | null
  exam_date: string | null
  available_weekly_hours: number | null
  learning_speed: string | null
  strengths_summary: string | null
  weaknesses_summary: string | null
  subscription_tier: SubscriptionTier
  is_2fa_enabled?: boolean
  subscription_expires_at?: string | null
  is_premium?: boolean
  ai_usage_count?: number
  created_at: string
  
  is_active: boolean;
 
}

export interface AdminUser {
  id: string
  email: string
  full_name: string
  role: UserRole
  subscription_tier: SubscriptionTier
  is_2fa_enabled?: boolean
  is_active: boolean
  created_at: string
}

// --- Premium Status Interface ---
export interface PremiumStatus {
  is_premium: boolean
  subscription_tier: SubscriptionTier
  is_2fa_enabled?: boolean
  is_admin: boolean
  is_lifetime?: boolean
  expires_at?: string | null
}

// --- Pricing Plan Interfaces ---
export interface PricingPlan {
  id: string
  name: string
  description?: string | null
  amount: number
  currency: string
  duration_type: PlanDurationType
  duration_value?: number | null
  features: string[]
  is_active: boolean
  is_archived?: boolean
  created_at?: string
  updated_at?: string
}

export interface PaymentInitializeRequest {
  plan_id: string
}

export interface PaymentInitializeResponse {
  checkout_url: string
  tx_ref: string
  amount?: number
  currency?: string
}

export interface PaymentVerifyResponse {
  tx_ref: string
  status: PaymentStatus
  message: string
}

// --- Department & Course Structure ---
export interface Department {
  id: string
  name: string
  short_name: string | null
  description: string | null
  is_active: boolean
}

export interface Course {
  id: string
  department_id: string
  name: string
  code: string | null
  category: string
  description: string | null
  ects_credits: number | null
  order_index: number
}

export interface Topic {
  id: string
  course_id?: string
  title: string
  description: string | null
  order_index?: number
  order?: number
}

export interface CourseDetail extends Course {
  topics: Topic[]
}

// --- Course Notes Interfaces ---
export interface CourseModule {
  title: string
  content: string
  is_preview?: boolean
  preview_percentage?: number
}

export interface CourseNotes {
  id: string
  course_id: string
  modules: CourseModule[]
  source_type: string
  created_at: string
  is_premium_user?: boolean
  total_modules?: number
}

// --- Course Materials ---
export interface CourseMaterial {
  id: string
  course_id: string
  title: string
  content: string
  material_type: MaterialContentType
  is_ai_generated: boolean
  is_preview?: boolean
  preview_percentage?: number
  created_at: string
  updated_at: string
}

export interface Material {
  id: string
  course_id: string | null
  topic_id: string | null
  title: string
  file_type: string
  source: 'admin_official' | 'student_personal'
  status: string
  is_public: boolean
  is_preview?: boolean
  preview_percentage?: number
  extracted_text_preview?: string | null
  created_at: string
}

// --- Announcements ---
export interface Announcement {
  id: string
  title: string
  content: string
  announcement_type: AnnouncementType
  is_pinned: boolean
  created_at: string
  updated_at: string
}

// --- Exam & Question Bank ---
export interface ExamQuestion {
  id: string
  course_id: string
  question_text: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  correct_option: MCQOption
  explanation: string
  difficulty: ExamDifficulty
  is_ai_generated: boolean
  review_status: ReviewStatus
  ai_model: string | null
  ai_topic: string | null
  reviewed_by_id: string | null
  reviewed_at: string | null
  rejection_reason: string | null
  promoted_question_id: string | null
  created_at: string
  updated_at: string
}

// --- AI Generation Interfaces ---
export interface AIGenerateRequest {
  course_id: string
  type: 'question' | 'note'
  topic: string
  difficulty?: ExamDifficulty
  material_type?: MaterialContentType
}

export interface AINoteDraft {
  title: string
  content: string
}

export interface AIQuestionDraft {
  question_text: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  correct_option: MCQOption
  explanation: string
}

export interface AIGenerateResponse {
  type: 'question' | 'note'
  note: AINoteDraft | null
  question: AIQuestionDraft | null
}

// --- Quiz & Exam Engine ---
export interface Question {
  id: string
  question_type: QuestionType
  course_id?: string
  difficulty: string
  prompt: string
  choices: Record<string, string> | null
}

export interface QuestionWithAnswer extends Question {
  correct_answer: string
  explanation: string | null
}

export interface Quiz {
  id: string
  course_id?: string | null
  title: string
  description?: string | null
  quiz_type: QuizType
  time_limit_minutes: number | null
  question_count: number
  generated_mode?: 'practice' | 'mock' | null
}

export interface QuizAnswerItem {
  question_id: string
  student_answer?: string
  selected_answer?: string
  answer?: string
}

export interface QuizDetail {
  id: string
  course_id?: string | null
  title: string
  description?: string | null
  quiz_type: QuizType
  time_limit_minutes: number | null
  generated_mode?: 'practice' | 'mock' | null
  questions: Question[]
}

export interface GradedAnswer {
  question: QuestionWithAnswer
  student_answer: string
  is_correct: boolean
  ai_feedback: string | null
}

export interface AttemptResult {
  id: string
  status: string
  score_percent: number
  submitted_at: string | null
  late_submission: boolean
  graded_answers: GradedAnswer[]
  weak_topics: string[]
}

export interface GenerateExamRequest {
  mode: ExamMode
  course_id?: string | null
  num_questions?: number
  question_count?: number
}

export interface GenerateExamResponse {
  quiz_id: string
  mode: ExamMode
  question_count: number
  time_limit_minutes: number | null
}

// --- Cooldown Interface ---
export interface CooldownInfo {
  error: string
  message: string
  next_available_at: string
  retry_after_seconds: number
}

// --- AI Tutor Interfaces ---
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

export interface Conversation {
  id: string
  title: string
  course_id: string | null
  updated_at: string
}

// --- Admin Dashboard Interfaces ---
export interface PaymentStats {
  total_payments: number
  successful_payments: number
  total_revenue: number
  premium_users: number
  conversion_rate: number
}

export interface PricingPlanCreate {
  name: string
  description?: string
  amount: number
  currency: string
  duration_type: PlanDurationType
  duration_value?: number
  features: string[]
  is_active: boolean
}

export interface PricingPlanUpdate {
  name?: string
  description?: string
  amount?: number
  currency?: string
  duration_type?: PlanDurationType
  duration_value?: number
  features?: string[]
  is_active?: boolean
}

// Support Ticket Types
export interface SupportTicket {
  id: string
  subject: string
  message: string
  issue_type: 'account_reactivation' | 'account_issues' | 'payment' | 'technical' | 'content' | 'feedback' | 'other'
  status: 'open' | 'in_progress' | 'resolved' | 'closed'
  admin_response?: string
  created_at: string
  updated_at?: string
}

export interface CreateSupportTicketRequest {
  subject: string
  message: string
  issue_type?: string
}
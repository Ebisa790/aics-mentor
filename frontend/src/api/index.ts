import { apiClient } from './client'
import type {
  AIGenerateRequest,
  AIGenerateResponse,
  Announcement,
  AnnouncementType,
  AdminUser, 
  AttemptResult,
  ChatMessage,
  Conversation,
  Course,
  CourseDetail,
  CourseMaterial,
  Department,
  ExamQuestion,
  QuizAnswerItem,
  GenerateExamRequest,
  GenerateExamResponse,
  Material,
  Quiz,
  QuizDetail,
  ReviewStatus,
  TutorMode,
  User,
} from './types'

// --- Device Interfaces ---
export interface Device {
  id: string
  device_name: string
  device_type: 'desktop' | 'mobile' | 'tablet' | 'unknown'
  browser: string
  ip_address: string
  last_active: string
  session_jti?: string         
  is_current_device: boolean
}

export interface RevokeDeviceResponse {
  message: string
  revoked_device_id: string
}

export interface RevokeOthersResponse {
  message: string
  revoked_count: number
}

// --- Drill Interfaces ---
export interface TraceStep {
  line_number: number
  variables: Record<string, string>
  explanation: string
  stdout_so_far?: string
}

export interface CodeTraceResponse {
  attempt_id?: string
  topic: string
  language: string
  code_snippet: string
  total_steps: number
  trace_steps: TraceStep[]
  exit_exam_question: string
  options: string[]
  correct_option_index: number
  distractor_explanation: string
  subscription_tier?: 'FREE' | 'PREMIUM'
  drills_remaining_today?: number
  verified_by_compiler?: boolean
  compiler_stdout?: string
}

export interface DrillSubmitResponse {
  success: boolean
  total_attempts: number
  correct_attempts: number
  accuracy_percentage: number
}

// --- Admin & Ingestion Interfaces ---
export interface DuplicateGroup {
  normalized_text: string
  count: number
  questions: ExamQuestion[]
}

export interface BulkDeleteResponse {
  message: string
  deleted_count: number
}

export interface Topic {
  id: string
  course_id: string
  title: string
  description?: string
  order?: number
}

export interface HybridIngestionResponse {
  message: string
  extracted_count: number
  ai_generated_count: number
  total_staged: number
}

export interface MasterIngestionResponse {
  task_id?: string
  message: string
  courses_detected_count: number
  total_staged: number
}

export interface IngestionTaskStatus {
  task_id: string
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
  meta?: {
    step?: string
    processed?: number
    total?: number
    error?: string
  }
}

export interface PendingReviewQueueItem {
  id: string
  course_id: string
  course_name?: string
  question_text: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  correct_option: string
  explanation: string
  status: ReviewStatus
  is_ai_generated: boolean
  ai_topic?: string
  created_at: string
}

export interface NotesMaterialUploadResponse {
  message: string
  course_id: string
  file_name: string
  extracted_length: number
}

export interface NotesContentResponse {
  course_id: string
  course_name: string
  content: string
  cached: boolean
  updated_at: string
}

// --- Payment Interfaces ---
export interface PricingPlan {
  id?: string
  name?: string
  title?: string
  amount: number
  currency: string
  period?: string
  is_active?: boolean
  features?: string[]
}

export interface PaymentInitializeRequest {
  plan_id?: string
  return_url?: string
}

export interface PaymentInitializeResponse {
  checkout_url: string
  tx_ref: string
}

export interface PaymentVerifyResponse {
  status: 'success' | 'failed' | 'completed' | string
  message?: string
  success?: boolean
  data?: unknown
}

// ==========================================
// API Endpoints
// ==========================================

export const paymentApi = {
  getPricing: () =>
    apiClient.get<PricingPlan[] | PricingPlan>('/api/payments/pricing').then((res) => res.data),

  initializePayment: (payload?: PaymentInitializeRequest) =>
    apiClient.post<PaymentInitializeResponse>('/api/payments/initialize', payload).then((res) => res.data),

  verifyPayment: (txRef: string) =>
    apiClient.get<PaymentVerifyResponse>(`/api/payments/verify/${txRef}`).then((res) => res.data),
}

export const drillsApi = {
  getCodeTrace: (subject_slug: string) =>
    apiClient
      .post<CodeTraceResponse>('/api/drills/code-trace', { subject_slug })
      .then((res) => res.data),

  submitDrill: (payload: {
    attempt_id: string
    selected_option: number
    is_correct: boolean
  }) =>
    apiClient
      .post<DrillSubmitResponse>('/api/drills/submit', payload)
      .then((res) => res.data),
}

export const authApi = {
  register: (payload: { email: string; password: string; full_name: string }) =>
    apiClient.post<User>('/api/auth/register', payload).then((res) => res.data),

  login: (email: string, password: string) => {
    const form = new URLSearchParams()
    form.set('username', email)
    form.set('password', password)
    return apiClient
      .post<any>('/api/auth/login', form, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      })
      .then((res) => {
        console.log('authApi.login response:', res.data)
        return res.data
      })
  },

  me: () => apiClient.get<User>('/api/auth/me').then((res) => res.data),

  forgotPassword: (email: string) =>
    apiClient
      .post<{ message: string; dev_reset_token: string | null }>('/api/auth/forgot-password', { email })
      .then((res) => res.data),

  resetPassword: (token: string, newPassword: string) =>
    apiClient
      .post<User>('/api/auth/reset-password', { token, new_password: newPassword })
      .then((res) => res.data),
}

export const userApi = {
  updateProfile: (payload: Partial<User>) =>
    apiClient.patch<User>('/api/users/me', payload).then((res) => res.data),

  changePassword: (payload: { current_password: string; new_password: string }) =>
    apiClient.post<{ message: string }>('/api/users/change-password', payload).then((res) => res.data),

  deleteAccount: () => apiClient.post('/auth/delete-account'),
}

export const deviceApi = {
  listDevices: () =>
    apiClient.get<Device[]>('/api/users/me/devices').then((res) => res.data),

  revokeDevice: (deviceId: string) =>
    apiClient
      .delete<RevokeDeviceResponse>(`/api/users/me/devices/${deviceId}`)
      .then((res) => res.data),

  revokeOtherDevices: () =>
    apiClient
      .post<RevokeOthersResponse>('/api/users/me/devices/revoke-others')
      .then((res) => res.data),
}

export const supportApi = {
  sendTicket: (payload: { subject: string; message: string; issue_type?: string; email?: string }) =>
    apiClient.post<{ message: string; ticket_id: string; status: string }>('/api/support/tickets', payload).then((res) => res.data),
  
  listTickets: () =>
    apiClient.get<{ tickets: any[] }>('/api/support/tickets').then((res) => res.data),
  
  getTicket: (ticketId: string) =>
    apiClient.get<{ ticket: any }>(`/api/support/tickets/${ticketId}`).then((res) => res.data),
}
export const departmentApi = {
  list: () => apiClient.get<Department[]>('/api/departments').then((res) => res.data),

  create: (data: { name: string; short_name?: string }) =>
    apiClient.post<Department>('/api/admin/departments', data).then((res) => res.data),
}

export const courseApi = {
  list: (departmentId?: string) =>
    apiClient.get<Course[]>('/api/courses', { params: { department_id: departmentId } }).then((res) => res.data),

  get: (id: string) =>
    apiClient.get<CourseDetail>(`/api/courses/${id}`).then((res) => res.data),

  create: (data: {
    department_id: string
    name: string
    code?: string
    ects_credits?: number
    category: string
    description?: string
  }) => apiClient.post<Course>('/api/admin/courses', data).then((res) => res.data),

  getNotes: (courseId: string) =>
    apiClient.get<NotesContentResponse>(`/api/courses/${courseId}/notes`).then((res) => res.data),
}

export const topicApi = {
  create: (data: { course_id: string; title: string; description?: string }) =>
    apiClient.post<Topic>(`/api/admin/courses/${data.course_id}/topics`, data).then((res) => res.data),

  listByCourse: (courseId: string) =>
    apiClient.get<Topic[]>(`/api/courses/${courseId}/topics`).then((res) => res.data),
}

export const quizApi = {
  list: (courseId?: string) =>
    apiClient.get<Quiz[]>('/api/quizzes', { params: { course_id: courseId } }).then((res) => res.data),

  get: (id: string) =>
    apiClient.get<QuizDetail>(`/api/quizzes/${id}`).then((res) => res.data),

  start: (quizId: string) =>
    apiClient.post<{ attempt_id: string; started_at: string }>('/api/attempts/start', { quiz_id: quizId }).then((res) => res.data),

  submit: (quizId: string, answers: QuizAnswerItem[]) =>
    apiClient
      .post<AttemptResult>(`/api/quizzes/${quizId}/submit`, { answers })
      .then((res) => res.data),

  generate: (courseId: string, numQuestions = 10) =>
    apiClient
      .post<QuizDetail>('/api/quizzes/generate', {
        course_id: courseId,
        num_questions: numQuestions,
      })
      .then((res) => res.data),
}

export const examApi = {
  generate: (payload: GenerateExamRequest) =>
    apiClient.post<GenerateExamResponse>('/api/exams/generate', payload).then((res) => res.data),
}

export const adminUserApi = {
  list: (params?: { search?: string; is_active?: boolean; subscription_tier?: string; role?: string }) =>
    apiClient.get<AdminUser[]>('/api/admin/users', { params }).then((res) => res.data),

  update: (userId: string, data: Partial<Pick<AdminUser, 'role' | 'subscription_tier' | 'is_active'>>) =>
    apiClient.patch<AdminUser>(`/api/admin/users/${userId}`, data).then((res) => res.data),
}

export const announcementApi = {
  list: () => apiClient.get<Announcement[]>('/api/announcements').then((res) => res.data),

  create: (data: { title: string; content: string; announcement_type: AnnouncementType; is_pinned?: boolean }) =>
    apiClient.post<Announcement>('/api/admin/announcements', data).then((res) => res.data),

  update: (id: string, data: Partial<Announcement>) =>
    apiClient.put<Announcement>(`/api/admin/announcements/${id}`, data).then((res) => res.data),

  delete: (id: string) =>
    apiClient.delete(`/api/admin/announcements/${id}`).then((res) => res.data),
}

export const tutorApi = {
  chat: (payload: { conversation_id?: string; course_id?: string; mode: TutorMode; message: string }) =>
    apiClient.post<{ conversation_id: string; reply: ChatMessage }>('/api/tutor/chat', payload).then((res) => res.data),

  conversations: () =>
    apiClient.get<Conversation[]>('/api/tutor/conversations').then((res) => res.data),

  conversation: (id: string) =>
    apiClient.get<Conversation & { messages: ChatMessage[] }>(`/api/tutor/conversations/${id}`).then((res) => res.data),

  deleteConversation: (id: string) =>
    apiClient.delete(`/api/tutor/conversations/${id}`).then((res) => res.data),
}

export const materialApi = {
  list: () => apiClient.get<Material[]>('/api/materials').then((res) => res.data),

  upload: (formData: FormData) =>
    apiClient.post<Material>('/api/materials', formData).then((res) => res.data),

  delete: (id: string) =>
    apiClient.delete(`/api/materials/${id}`).then((res) => res.data),
}

export const adminApi = {
  getRevenueStats: () =>
    apiClient.get<any>('/api/admin/revenue-stats').then((res) => res.data),

  listMaterials: (courseId: string) =>
    apiClient.get<CourseMaterial[]>(`/api/admin/courses/${courseId}/materials`).then((res) => res.data),

  createMaterial: (
    courseId: string,
    data: { title: string; content: string; material_type: string; is_ai_generated?: boolean }
  ) => apiClient.post<CourseMaterial>(`/api/admin/courses/${courseId}/materials`, data).then((res) => res.data),

  updateMaterial: (materialId: string, data: Partial<{ title: string; content: string; material_type: string }>) =>
    apiClient.put<CourseMaterial>(`/api/admin/materials/${materialId}`, data).then((res) => res.data),

  deleteMaterial: (materialId: string) =>
    apiClient.delete(`/api/admin/materials/${materialId}`).then((res) => res.data),

  listQuestions: (courseId: string, status?: ReviewStatus) =>
    apiClient.get<ExamQuestion[]>(`/api/admin/courses/${courseId}/questions`, { params: { status } }).then((res) => res.data),

  createQuestion: (
    courseId: string,
    data: {
      question_text: string
      option_a: string
      option_b: string
      option_c: string
      option_d: string
      correct_option: string
      explanation: string
      difficulty: string
      is_ai_generated?: boolean
      ai_topic?: string
    }
  ) => apiClient.post<ExamQuestion>(`/api/admin/courses/${courseId}/questions`, data).then((res) => res.data),

  updateQuestion: (questionId: string, data: Partial<ExamQuestion>) =>
    apiClient.put<ExamQuestion>(`/api/admin/questions/${questionId}`, data).then((res) => res.data),

  deleteQuestion: (questionId: string) =>
    apiClient.delete(`/api/admin/questions/${questionId}`).then((res) => res.data),

  reviewQuestion: (questionId: string, action: 'approve' | 'reject' | 'archive', rejectionReason?: string) =>
    apiClient.patch<ExamQuestion>(`/api/admin/questions/${questionId}/review`, {
      action,
      rejection_reason: rejectionReason,
    }).then((res) => res.data),

  listPendingReviewQueue: () =>
    apiClient.get<PendingReviewQueueItem[]>('/api/admin/questions/pending').then((res) => res.data),

  listDuplicates: (courseId: string) =>
    apiClient.get<DuplicateGroup[]>(`/api/admin/courses/${courseId}/duplicates`).then((res) => res.data),

  bulkDeleteQuestions: (ids: string[]) =>
    apiClient.post<BulkDeleteResponse>('/api/admin/questions/bulk-delete', { ids }).then((res) => res.data),

  generateAICourseContent: (payload: AIGenerateRequest) =>
    apiClient.post<AIGenerateResponse>('/api/admin/ai/generate', payload).then((res) => res.data),

  uploadNotesMaterial: (courseId: string, file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return apiClient
      .post<NotesMaterialUploadResponse>(`/api/admin/courses/${courseId}/notes-material`, formData)
      .then((res) => res.data)
  },

  hybridIngestSpecificCourse: (courseId: string, file: File, targetCount: number) => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('target_count', String(targetCount))
    return apiClient
      .post<HybridIngestionResponse>(`/api/admin/courses/${courseId}/hybrid-ingest`, formData)
      .then((res) => res.data)
  },

  masterHybridIngest: (file: File, targetCount: number) => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('target_count', String(targetCount))
    return apiClient
      .post<MasterIngestionResponse>('/api/admin/master-hybrid-ingest', formData)
      .then((res) => res.data)
  },

  getTaskStatus: (taskId: string) =>
    apiClient.get<IngestionTaskStatus>(`/api/admin/tasks/${taskId}`).then((res) => res.data),

  bulkImportQuestionsCsv: (courseId: string, file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return apiClient
      .post<{ created: number; errors: string[] }>(
        `/api/admin/courses/${courseId}/questions/bulk-csv`,
        formData
      )
      .then((res) => res.data)
  },

  bulkImportQuestionsJson: (courseId: string, questionsPayload: unknown[]) =>
    apiClient
      .post<{ created: number; errors: string[] }>(
        `/api/admin/courses/${courseId}/questions/bulk-json`,
        questionsPayload
      )
      .then((res) => res.data),
}
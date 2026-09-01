import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AdminRoute } from './components/AdminRoute'
import { AdminLayout } from './components/AdminLayout'
import { AppLayout } from './components/AppLayout'
import { PaymentCallbackPage } from './pages/PaymentCallback'
import { LandingPage } from './pages/Landing'
import { SupportPage } from './pages/Support'
import { LoginPage } from './pages/Login'
import { RegisterPage } from './pages/Register'
import { ForgotPasswordPage } from './pages/ForgotPassword'
import { ResetPasswordPage } from './pages/ResetPassword'
import { PricingPage } from './pages/Pricing'
import { DashboardPage } from './pages/Dashboard'
import { CoursesPage } from './pages/Courses'
import { CourseDetailPage } from './pages/CourseDetail'
import { CourseNotesPage } from './pages/CourseNotesPage'
import { NotesIndexPage } from './pages/NotesIndexPage'
import { PrivacyPolicyPage } from './pages/PrivacyPolicy'
import { TermsOfServicePage } from './pages/TermsOfService'
import { Quiz } from './pages/Quiz'
import { MockExamPage } from './pages/MockExamPage'
import { TutorPage } from './pages/Tutor'
import { MaterialsPage } from './pages/Materials'
import { ProfilePage } from './pages/Profile'
import { AdminPage } from './pages/Admin'
import { AdminUsersPage } from './pages/AdminUsers'  
import { CourseContentManagerPage } from './pages/CourseContentManager'
import { AdminPricingPage } from './pages/AdminPricing'
import { AdminCoursesPage } from './pages/AdminCourses'
import { AdminAnnouncementsPage } from './pages/AdminAnnouncements'
import { AdminReviewQueuePage } from './pages/AdminReviewQueue'
import { AdminNoteReview } from './pages/AdminNoteReview'
import { AdminAnalytics } from './pages/AdminAnalytics'
import { AdminDrillManagement } from './pages/AdminDrillManagement'
import { AdminQuestionCoverage } from './pages/AdminQuestionCoverage'
import { FlashcardPage } from './pages/FlashcardPage'
import { AdminFlashcardReview } from './pages/AdminFlashcardReview'
import { AdminSupportDashboard } from './pages/AdminSupportDashboard'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/support" element={<SupportPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/payment/callback" element={<PaymentCallbackPage />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/privacy" element={<PrivacyPolicyPage />} />
          <Route path="/terms" element={<TermsOfServicePage />} />

          {/* Protected Routes (Require Authentication) */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/courses" element={<CoursesPage />} />
              <Route path="/courses/:courseId" element={<CourseDetailPage />} />
              <Route path="/courses/:courseId/notes" element={<CourseNotesPage />} />
              <Route path="/notes" element={<NotesIndexPage />} />
              <Route path="/courses/:courseId/flashcards" element={<FlashcardPage />} />
              <Route path="/admin/courses/:courseId/flashcards" element={<AdminFlashcardReview />} />
              <Route path="/quizzes/:quizId" element={<Quiz />} />
              <Route path="/mock-exam" element={<MockExamPage />} />
              <Route path="/mock-exams" element={<MockExamPage />} />
              <Route path="/tutor" element={<TutorPage />} />
              <Route path="/materials" element={<MaterialsPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              
              {/* Admin Routes (Require Admin Role) */}
              <Route element={<AdminRoute />}>
                <Route element={<AdminLayout />}>
                  <Route path="/admin" element={<AdminPage />} />
                  <Route path="/admin/analytics" element={<AdminAnalytics />} />
                  <Route path="/admin/drills" element={<AdminDrillManagement />} />
                  <Route path="/admin/question-coverage" element={<AdminQuestionCoverage />} />
                  <Route path="/admin/support" element={<AdminSupportDashboard />} />
                  <Route path="/admin/users" element={<AdminUsersPage />} />
                  <Route path="/admin/pricing" element={<AdminPricingPage />} />
                  <Route path="/admin/courses" element={<AdminCoursesPage />} />
                  <Route path="/admin/courses/:id" element={<CourseContentManagerPage />} />
                  <Route path="/admin/announcements" element={<AdminAnnouncementsPage />} />
                  <Route path="/admin/review" element={<AdminReviewQueuePage />} />
                  <Route path="/admin/courses/:courseId/notes/review" element={<AdminNoteReview />} />
                </Route>
              </Route>
            </Route>
          </Route>

          {/* 404 Page */}
          <Route path="*" element={
            <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
              <div className="text-center">
                <h1 className="text-4xl font-bold text-slate-900 dark:text-white">404</h1>
                <p className="text-slate-600 dark:text-slate-400 mt-2">Page not found</p>
                <a href="/" className="text-indigo-600 hover:underline mt-4 inline-block">Go Home</a>
              </div>
            </div>
          } />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
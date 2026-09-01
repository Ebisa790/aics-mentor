import { Link } from 'react-router-dom'
import { ArrowLeft, FileText, CheckCircle2, AlertTriangle, Crown, ShieldCheck } from 'lucide-react'

export function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-8 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto space-y-8">
        
        {/* Header */}
        <div>
          <Link
            to="/"
            className="inline-flex items-center text-sm text-slate-600 dark:text-slate-400 hover:text-indigo-600 mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Home
          </Link>
          
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-indigo-100 dark:bg-indigo-950/50 rounded-xl">
              <FileText className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">
                Terms of Service
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Last updated: August 2026
              </p>
            </div>
          </div>
        </div>

        {/* Acceptance */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            Acceptance of Terms
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            By accessing or using ExitAI Ethiopia, you agree to be bound by these Terms of Service. If you do not agree, please do not use the platform.
          </p>
        </section>

        {/* Platform Description */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            About the Platform
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            ExitAI Ethiopia is an online exam preparation platform for BSc Computer Science students preparing for the Ethiopian Exit Exam. We provide practice questions, mock exams, study notes, and AI-powered study assistance.
          </p>
        </section>

        {/* Free vs Premium */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Crown className="w-5 h-5 text-amber-500" />
            Free and Premium Accounts
          </h2>
          <div className="space-y-3 text-sm text-slate-600 dark:text-slate-400">
            <p className="font-semibold text-slate-800 dark:text-slate-200">Free Account:</p>
            <ul className="space-y-1 pl-5">
              <li>• 1 practice quiz every 3 hours</li>
              <li>• 20% preview of course notes</li>
              <li>• 3 Code Trace Drills per day</li>
            </ul>
            <p className="font-semibold text-slate-800 dark:text-slate-200 pt-2">Premium Account (One-time payment):</p>
            <ul className="space-y-1 pl-5">
              <li>• Unlimited quizzes</li>
              <li>• Full access to all course notes</li>
              <li>• 100-question Mock Exam Simulator</li>
              <li>• Unlimited Code Trace Drills</li>
              <li>• Study Assistant (AI Tutor)</li>
            </ul>
          </div>
        </section>

        {/* Account Security */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-indigo-500" />
            Account Security
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            You are responsible for maintaining the security of your account:
          </p>
          <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400 pl-5">
            <li>• Do not share your password with others</li>
            <li>• Maximum of 2 devices per account (different types)</li>
            <li>• Premium accounts cannot be shared between students</li>
            <li>• Account sharing may result in account suspension</li>
          </ul>
        </section>

        {/* Device Policy */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            Device Policy
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            Each account is limited to 2 active devices of different types:
          </p>
          <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400 pl-5">
            <li>• 1 Desktop/Laptop + 1 Phone/Tablet = Allowed</li>
            <li>• 2 Desktops/Laptops = Not Allowed (one will be logged out)</li>
            <li>• 2 Phones = Not Allowed (one will be logged out)</li>
          </ul>
        </section>

        {/* Prohibited Activities */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            Prohibited Activities
          </h2>
          <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400 pl-5">
            <li>• Sharing your account credentials with others</li>
            <li>• Attempting to bypass device limits</li>
            <li>• Copying or redistributing study materials</li>
            <li>• Using automated scripts or bots</li>
            <li>• Attempting to hack or disrupt the platform</li>
          </ul>
        </section>

        {/* Termination */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            Account Termination
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            We reserve the right to suspend or terminate accounts that violate these Terms of Service. Premium payments are non-refundable if the account is terminated for violations.
          </p>
        </section>

        {/* Contact */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            Contact Us
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Questions about these Terms? Contact us at support@exitai-ethiopia.com
          </p>
        </section>

        {/* Footer */}
        <p className="text-xs text-slate-400 dark:text-slate-500 text-center pt-4">
          ExitAI Ethiopia - Helping CS Students Pass Their Exit Exam
        </p>
      </div>
    </div>
  )
}

export default TermsOfServicePage

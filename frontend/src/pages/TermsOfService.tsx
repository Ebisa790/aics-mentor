import { Link } from 'react-router-dom'
import { ArrowLeft, FileText, CheckCircle2, AlertTriangle, Crown, ShieldCheck, Banknote, RefreshCw, Bot } from 'lucide-react'

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
                Last updated: September 2026
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
            By accessing or using ExitAI Ethiopia, you agree to be bound by these Terms
            of Service. If you do not agree, please do not use the platform.
          </p>
        </section>

        {/* About the Platform */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            About the Platform
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            ExitAI Ethiopia is an online exam preparation platform for BSc Computer
            Science students preparing for the Ethiopian Exit Exam. We provide practice
            questions, mock exams, study notes, flashcards, and AI-powered study
            assistance.
          </p>
        </section>

        {/* Free and Premium */}
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
            <p className="font-semibold text-slate-800 dark:text-slate-200 pt-2">
              Premium Account (One-time payment):
            </p>
            <ul className="space-y-1 pl-5">
              <li>• Unlimited quizzes</li>
              <li>• Full access to all course notes</li>
              <li>• 100-question Mock Exam Simulator</li>
              <li>• Unlimited Code Trace Drills</li>
              <li>• Study Assistant (AI Tutor)</li>
            </ul>
          </div>
        </section>

        {/* Payment Terms */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Banknote className="w-5 h-5 text-emerald-500" />
            Payment Terms
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            Premium is a one-time payment for lifetime access. You may pay via:
          </p>
          <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400 pl-5">
            <li>• <strong className="text-slate-800 dark:text-slate-200">Manual bank transfer</strong> — to our published CBE, Telebirr, or Awash accounts</li>
            <li>• <strong className="text-slate-800 dark:text-slate-200">Online payment via Chapa</strong> — when available</li>
          </ul>

          <div className="rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 p-4 space-y-2">
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
              Manual Payment Rules
            </p>
            <ul className="space-y-2 text-sm text-amber-900 dark:text-amber-200 pl-5">
              <li>• You must submit the <strong>exact reference number</strong> shown on your bank receipt</li>
              <li>• Each reference number can only be used for one payment</li>
              <li>• You must confirm the amount you sent, matching the plan price</li>
              <li>• An administrator verifies every payment against our bank statement before activating Premium</li>
              <li>• Verification typically completes within 24 hours</li>
            </ul>
          </div>

          <div className="rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 p-4 space-y-2">
            <p className="text-sm font-semibold text-rose-900 dark:text-rose-200 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Fraud and Fake References
            </p>
            <p className="text-sm text-rose-900 dark:text-rose-200">
              Submitting a fake, altered, reused, or misleading transaction reference is
              a violation of these Terms. Accounts found to be submitting fraudulent
              references will be <strong>permanently banned</strong> without refund.
            </p>
          </div>
        </section>

        {/* Refund Policy */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-indigo-500" />
            Refund Policy
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            Because Premium is a one-time lifetime purchase and every payment is manually
            verified before activation, refunds are handled case by case:
          </p>
          <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400 pl-5">
            <li>• If your payment was made and could not be verified, contact support for a full refund</li>
            <li>• If Premium was activated and you believe a duplicate charge occurred, contact support</li>
            <li>• Refunds are issued to the same bank account from which the original payment was sent</li>
            <li>• Refund requests should be made within 30 days of the original payment</li>
          </ul>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed pt-2">
            Contact <strong className="text-slate-800 dark:text-slate-200">exitai.ethiopia@gmail.com</strong> to request a refund.
          </p>
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
            <li>• Account sharing may result in account suspension without refund</li>
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
            <li>• 2 Desktops/Laptops = Not allowed (one will be logged out)</li>
            <li>• 2 Phones = Not allowed (one will be logged out)</li>
          </ul>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed pt-2">
            Logging in from a new device automatically signs out the oldest session of
            the same device type. You will receive an email notification whenever this
            happens.
          </p>
        </section>

        {/* AI Content */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Bot className="w-5 h-5 text-purple-500" />
            AI-Powered Features
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            ExitAI Ethiopia uses artificial intelligence to generate explanations,
            practice questions, and Study Assistant responses. AI-generated content is
            provided for study support and may occasionally contain errors. Always
            verify critical information against your official course materials.
          </p>
        </section>

        {/* Intellectual Property */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            Intellectual Property
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            All content on ExitAI Ethiopia — including exam questions, course notes,
            flashcards, AI-generated explanations, and platform code — is our
            intellectual property or used with permission. You may not copy,
            redistribute, or resell any of it without written permission. Personal
            study use is always allowed.
          </p>
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
            <li>• Submitting fake or reused bank references</li>
            <li>• Copying or redistributing study materials</li>
            <li>• Using automated scripts, bots, or scrapers</li>
            <li>• Attempting to hack, disrupt, or overload the platform</li>
            <li>• Impersonating another student or staff member</li>
          </ul>
        </section>

        {/* Termination */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            Account Termination
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            We reserve the right to suspend or terminate accounts that violate these
            Terms. Premium payments are non-refundable if the account is terminated for
            violations such as fraud, abuse, or account sharing.
          </p>
        </section>

        {/* Changes to Terms */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            Changes to These Terms
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            We may update these Terms from time to time. When we make material changes,
            we will notify you by email or via a notice on the platform. Continued use
            of the service after changes means you accept the updated Terms.
          </p>
        </section>

        {/* Governing Law */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            Governing Law
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            These Terms are governed by the laws of the Federal Democratic Republic of
            Ethiopia. Any disputes will be resolved in good faith, in accordance with
            Ethiopian law.
          </p>
        </section>

        {/* Contact */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            Contact Us
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Questions about these Terms? Contact us at{' '}
            <strong className="text-slate-800 dark:text-slate-200">
              exitai.ethiopia@gmail.com
            </strong>
          </p>
        </section>

        {/* Footer */}
        <p className="text-xs text-slate-400 dark:text-slate-500 text-center pt-4">
          ExitAI Ethiopia — Helping CS Students Pass Their Exit Exam
        </p>
      </div>
    </div>
  )
}

export default TermsOfServicePage
import { Link } from 'react-router-dom'
import { ArrowLeft, Shield, Lock, Eye, Database, Mail, Globe, Users, Clock } from 'lucide-react'

export function PrivacyPolicyPage() {
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
              <Shield className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">
                Privacy Policy
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Last updated: September 2026
              </p>
            </div>
          </div>
        </div>

        {/* Introduction */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            ExitAI Ethiopia is a free-to-use exam preparation platform for Ethiopian
            Computer Science students. This Privacy Policy explains what information
            we collect, why we collect it, and how we protect it. We only collect
            information that is necessary to provide the service.
          </p>
        </section>

        {/* Information We Collect */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Database className="w-5 h-5 text-indigo-500" />
            Information We Collect
          </h2>
          <ul className="space-y-3 text-sm text-slate-600 dark:text-slate-400">
            <li className="flex items-start gap-2">
              <span className="text-indigo-500 mt-1">•</span>
              <span>
                <strong className="text-slate-800 dark:text-slate-200">Account information:</strong>{' '}
                Your name, email address, and university details when you register.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-indigo-500 mt-1">•</span>
              <span>
                <strong className="text-slate-800 dark:text-slate-200">Study data:</strong>{' '}
                Quiz scores, exam attempts, and progress tracking to personalize your learning.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-indigo-500 mt-1">•</span>
              <span>
                <strong className="text-slate-800 dark:text-slate-200">Payment information:</strong>{' '}
                If you upgrade to Premium via manual bank transfer, we collect the bank
                reference number, sender name, and sender phone number you submit. We do
                not store bank account credentials or card details.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-indigo-500 mt-1">•</span>
              <span>
                <strong className="text-slate-800 dark:text-slate-200">Security logs:</strong>{' '}
                Session timestamps, device type, browser, and IP address. We use this to
                protect your account and detect unauthorized access.
              </span>
            </li>
          </ul>
        </section>

        {/* How We Use */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Eye className="w-5 h-5 text-indigo-500" />
            How We Use Your Information
          </h2>
          <ul className="space-y-3 text-sm text-slate-600 dark:text-slate-400">
            <li className="flex items-start gap-2">
              <span className="text-emerald-500 mt-1">✓</span>
              <span>To provide and improve our exam preparation services</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-500 mt-1">✓</span>
              <span>To track your progress and suggest areas for improvement</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-500 mt-1">✓</span>
              <span>To send important updates about your account and the exit exam</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-500 mt-1">✓</span>
              <span>To verify your payment and activate your Premium subscription</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-500 mt-1">✓</span>
              <span>To detect fraud, abuse, or attempts to bypass platform limits</span>
            </li>
          </ul>
        </section>

        {/* Manual Payments */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Lock className="w-5 h-5 text-indigo-500" />
            Manual Bank Payments
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            When you upgrade to Premium, you may pay via manual bank transfer to our
            published CBE, Telebirr, or Awash accounts. You then submit the transaction
            reference number through the platform. An administrator verifies the payment
            against our bank statement before activating your Premium access.
          </p>
          <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400 pl-5">
            <li>• We only use your payment submission to verify and activate Premium</li>
            <li>• Payment records are retained for accounting and audit purposes</li>
            <li>• We never share your payment details with other students or third parties</li>
          </ul>
        </section>

        {/* Data Security */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Lock className="w-5 h-5 text-indigo-500" />
            Data Security
          </h2>
          <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400 pl-5">
            <li>• Passwords are hashed using bcrypt and never stored in plain text</li>
            <li>• Session tokens expire automatically and are tied to your device</li>
            <li>• Up to 2 trusted devices per account prevent unauthorized sharing</li>
            <li>• Every payment action is logged for audit and dispute resolution</li>
            <li>• Database hosting is provided by Supabase, with data stored in Frankfurt, EU</li>
          </ul>
        </section>

        {/* Third-Party Services */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Globe className="w-5 h-5 text-indigo-500" />
            Third-Party Services
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            We use a small number of trusted providers to operate the platform:
          </p>
          <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400 pl-5">
            <li>• Supabase — database (Frankfurt, EU)</li>
            <li>• Brevo — transactional email delivery</li>
            <li>• Vercel — frontend hosting</li>
            <li>• Render — backend hosting</li>
            <li>• Telegram — admin security notifications (no student data shared with other students)</li>
          </ul>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed pt-2">
            We will add Chapa (Ethiopian payment processor) when our integration is
            approved and enabled.
          </p>
        </section>

        {/* Retention */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-indigo-500" />
            Data Retention
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            Account and study data is kept while your account is active. Payment records
            are retained for a minimum of 24 months for accounting and audit purposes,
            even if your account is closed. You may request deletion of your account at
            any time (see Your Rights below).
          </p>
        </section>

        {/* Your Rights */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-500" />
            Your Rights
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            You may contact us at any time to:
          </p>
          <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400 pl-5">
            <li>• Request a copy of the personal data we hold about you</li>
            <li>• Correct inaccurate information</li>
            <li>• Request deletion of your account and associated data</li>
            <li>• Withdraw consent for non-essential communications</li>
          </ul>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed pt-2">
            We will respond to all requests within 30 days.
          </p>
        </section>

        {/* Age */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            Age Requirement
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            ExitAI Ethiopia is designed for university-level students. You must be at
            least 13 years old to create an account. Users under 16 should have parent
            or guardian consent. We do not knowingly collect data from children under 13.
          </p>
        </section>

        {/* What We Never Do */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Shield className="w-5 h-5 text-emerald-500" />
            What We Never Do
          </h2>
          <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
            <li className="flex items-start gap-2">
              <span className="text-red-500 mt-1">✗</span>
              <span>We never sell your personal information to third parties</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-500 mt-1">✗</span>
              <span>We never share your study data with advertisers</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-500 mt-1">✗</span>
              <span>We never store your bank account credentials</span>
            </li>
          </ul>
        </section>

        {/* Changes to this Policy */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            Changes to This Policy
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            We may update this Privacy Policy from time to time. When we make material
            changes, we will notify you by email or via a notice on the platform. The
            "Last updated" date at the top will always reflect the most recent version.
          </p>
        </section>

        {/* Contact */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Mail className="w-5 h-5 text-indigo-500" />
            Questions About Privacy?
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            If you have any questions about this Privacy Policy, contact us:
          </p>
          <div className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
            <p className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-indigo-500" />
              exitai.ethiopia@gmail.com
            </p>
            <p className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-indigo-500" />
              aics-mentor.vercel.app
            </p>
          </div>
        </section>

        {/* Footer Note */}
        <p className="text-xs text-slate-400 dark:text-slate-500 text-center pt-4">
          ExitAI Ethiopia — CS Exit Exam Preparation Platform
        </p>
      </div>
    </div>
  )
}

export default PrivacyPolicyPage
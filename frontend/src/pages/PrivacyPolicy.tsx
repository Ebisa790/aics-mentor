import { Link } from 'react-router-dom'
import { ArrowLeft, Shield, Lock, Eye, Database, Mail, Globe } from 'lucide-react'

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
                Last updated: August 2026
              </p>
            </div>
          </div>
        </div>

        {/* Introduction */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Database className="w-5 h-5 text-indigo-500" />
            Information We Collect
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            ExitAI Ethiopia collects information to provide you with the best possible exam preparation experience. We only collect what is necessary.
          </p>
          <ul className="space-y-3 text-sm text-slate-600 dark:text-slate-400">
            <li className="flex items-start gap-2">
              <span className="text-indigo-500 mt-1">•</span>
              <span><strong className="text-slate-800 dark:text-slate-200">Account Information:</strong> Your name, email address, and university when you register.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-indigo-500 mt-1">•</span>
              <span><strong className="text-slate-800 dark:text-slate-200">Study Data:</strong> Quiz scores, exam attempts, and progress tracking to personalize your learning.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-indigo-500 mt-1">•</span>
              <span><strong className="text-slate-800 dark:text-slate-200">Payment Information:</strong> Processed securely through Chapa. We never store your full payment details.</span>
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
              <span>To send important updates about your account and exam information</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-500 mt-1">✓</span>
              <span>To process payments and manage your Premium subscription</span>
            </li>
          </ul>
        </section>

        {/* Data Security */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Lock className="w-5 h-5 text-indigo-500" />
            Data Security
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            We take your data security seriously:
          </p>
          <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
            <li>✓ Passwords are encrypted using bcrypt</li>
            <li>✓ Payments processed through Chapa (PCI-compliant)</li>
            <li>✓ Session tokens expire automatically</li>
            <li>✓ Device tracking to prevent unauthorized access</li>
          </ul>
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
              <span>We never store your full payment card details</span>
            </li>
          </ul>
        </section>

        {/* Contact */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Mail className="w-5 h-5 text-indigo-500" />
            Questions About Privacy?
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            If you have any questions about this Privacy Policy, please contact us:
          </p>
          <div className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
            <p className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-indigo-500" />
              support@exitai-ethiopia.com
            </p>
            <p className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-indigo-500" />
              www.exitai-ethiopia.com
            </p>
          </div>
        </section>

        {/* Footer Note */}
        <p className="text-xs text-slate-400 dark:text-slate-500 text-center pt-4">
          ExitAI Ethiopia - CS Exit Exam Preparation Platform
        </p>
      </div>
    </div>
  )
}

export default PrivacyPolicyPage

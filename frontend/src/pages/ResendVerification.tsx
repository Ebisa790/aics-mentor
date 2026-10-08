import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Mail, CheckCircle2 } from 'lucide-react';
import { apiClient } from '../api/client';

export function ResendVerificationPage() {
  // If the student arrived from the Register success screen, the URL
  // carries ?email=… — prefill it so they don't retype it.
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState(() => searchParams.get('email') ?? '');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await apiClient.post('/api/auth/resend-verification', { email });
    } catch {
      // Silent — always show success (anti-enumeration)
    } finally {
      setLoading(false);
      setSent(true);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-8 shadow-sm">
        <Link
          to="/login"
          className="inline-flex items-center text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 mb-4"
        >
          <ArrowLeft className="h-3.5 w-3.5 mr-1" />
          Back to login
        </Link>

        {sent ? (
          <div className="text-center">
            <CheckCircle2 className="h-12 w-12 mx-auto text-emerald-500" />
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-4">
              Check your inbox
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">
              If an unverified account exists for <strong>{email}</strong>, a
              new verification link has been sent. Check your spam folder if
              you don't see it.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                <Mail className="h-5 w-5" />
              </div>
              <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Resend verification email
              </h1>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Email address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="you@example.com"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 px-4 py-3 text-sm font-bold text-white transition disabled:opacity-50"
              >
                {loading ? 'Sending…' : 'Send verification link'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
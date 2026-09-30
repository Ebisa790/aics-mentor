import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, XCircle, Loader2, Mail } from 'lucide-react';
import { apiClient } from '../api/client';

type Status = 'verifying' | 'success' | 'error';

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [status, setStatus] = useState<Status>('verifying');
  const [message, setMessage] = useState<string>('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('No verification token found in the link.');
      return;
    }

    let cancelled = false;

    apiClient
      .post('/api/auth/verify-email', { token })
      .then((res) => {
        if (cancelled) return;
        setStatus('success');
        setMessage(res.data?.message || 'Email verified successfully.');
      })
      .catch((err) => {
        if (cancelled) return;
        setStatus('error');
        setMessage(
          err?.response?.data?.detail ||
            'Could not verify your email. The link may have expired.'
        );
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-8 shadow-sm text-center">
        {status === 'verifying' && (
          <>
            <Loader2 className="h-10 w-10 mx-auto text-indigo-600 dark:text-indigo-400 animate-spin" />
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-4">
              Verifying your email…
            </h1>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle2 className="h-12 w-12 mx-auto text-emerald-500" />
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-4">
              Email verified
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">{message}</p>
            <Link
              to="/login"
              className="inline-flex items-center justify-center w-full mt-6 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl transition"
            >
              Continue to login
            </Link>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle className="h-12 w-12 mx-auto text-rose-500" />
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-4">
              Verification failed
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">{message}</p>
            <div className="mt-6 space-y-2">
              <Link
                to="/login"
                className="inline-flex items-center justify-center w-full px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl transition"
              >
                Back to login
              </Link>
              <Link
                to="/resend-verification"
                className="inline-flex items-center justify-center w-full px-4 py-3 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-sm font-bold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition"
              >
                <Mail className="h-4 w-4 mr-1.5" />
                Request a new link
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
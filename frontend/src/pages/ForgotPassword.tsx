import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { authApi } from '../api'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [devToken, setDevToken] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const res: any = await authApi.forgotPassword(email)
      const data = res?.data !== undefined ? res.data : res
      setMessage(data?.message || 'If an account exists with that email, a reset link has been sent.')
      setDevToken(data?.dev_reset_token ?? null)
    } catch {
      // Backend always returns 200 for this endpoint by design (no user enumeration),
      // so a caught error here means something else went wrong (network, etc).
      setMessage('Couldn\'t send the reset link. Please check your email and try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas px-4 sm:px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="font-display font-semibold text-2xl text-primary">AI-CS Mentor</div>
          <div className="text-sm text-ink/50 mt-1">Reset your password</div>
        </div>

        {message ? (
          <div className="card p-4 sm:p-6 space-y-4">
            <p className="text-sm text-ink/70">{message}</p>
            {devToken && (
              <div className="text-xs bg-canvas rounded-lg p-3 space-y-2">
                <div className="text-ink/50">
                  Dev mode — no email provider is configured, so here's the reset link directly:
                </div>
                <Link to={`/reset-password?token=${devToken}`} className="text-accent-dark font-medium break-all">
                  Click here to reset your password
                </Link>
              </div>
            )}
            <Link to="/login" className="text-accent-dark text-sm font-medium block text-center">
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="card p-4 sm:p-6 space-y-4">
            <p className="text-sm text-ink/60">
              Enter your email and we'll send you a link to reset your password.
            </p>
            <div>
              <label className="label">Email</label>
              <input
                type="email"
                required
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
            <button type="submit" disabled={isSubmitting} className="btn-primary w-full">
              {isSubmitting ? 'Sending…' : 'Send reset link'}
            </button>
            <Link to="/login" className="text-accent-dark text-sm font-medium block text-center">
              Back to sign in
            </Link>
          </form>
        )}
      </div>
    </div>
  )
}
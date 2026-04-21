import { useState, type FormEvent } from 'react';
import PageBlock from '../components/PageBlock';
import { api, ApiError } from '../lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sent' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus('idle');
    setError(null);
    try {
      await api('/auth/request-reset', { method: 'POST', body: { email } });
      setStatus('sent');
    } catch (err) {
      setStatus('error');
      setError(err instanceof ApiError ? err.message : 'Request failed');
    }
  }

  return (
    <PageBlock title="Forgot password" subtitle="We'll email you a reset link valid for 1 hour.">
      {status === 'sent' ? (
        <p>If an account with that email exists, a reset link has been sent.</p>
      ) : (
        <form onSubmit={onSubmit} className="form" style={{ maxWidth: 360 }}>
          <input
            className="input"
            type="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button type="submit" className="btn primary">
            Send reset link
          </button>
          {error && <p className="err">{error}</p>}
        </form>
      )}
    </PageBlock>
  );
}

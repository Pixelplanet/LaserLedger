import { useState, type FormEvent } from 'react';
import { useParams, Link } from 'react-router-dom';
import PageBlock from '../components/PageBlock';
import { api, ApiError } from '../lib/api';

export default function ResetPasswordPage() {
  const { token } = useParams<{ token: string }>();
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'done' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api('/auth/reset-password', { method: 'POST', body: { token, password } });
      setStatus('done');
    } catch (err) {
      setStatus('error');
      setError(err instanceof ApiError ? err.message : 'Reset failed');
    }
  }

  return (
    <PageBlock title="Reset password" subtitle="Choose a new password for your account.">
      {status === 'done' ? (
        <p>
          Password updated. <Link to="/login">Sign in →</Link>
        </p>
      ) : (
        <form onSubmit={onSubmit} className="form" style={{ maxWidth: 360 }}>
          <input
            className="input"
            type="password"
            required
            minLength={8}
            placeholder="New password (8+ chars)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button type="submit" className="btn primary">
            Update password
          </button>
          {error && <p className="err">{error}</p>}
        </form>
      )}
    </PageBlock>
  );
}

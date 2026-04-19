import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import PageBlock from '../components/PageBlock';
import { api, ApiError } from '../lib/api';

export default function VerifyEmailPage() {
  const { token } = useParams<{ token: string }>();
  const [status, setStatus] = useState<'pending' | 'ok' | 'error'>('pending');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setError('Missing token');
      return;
    }
    let cancelled = false;
    api('/auth/verify-email', { method: 'POST', body: { token } })
      .then(() => !cancelled && setStatus('ok'))
      .catch((err) => {
        if (cancelled) return;
        setStatus('error');
        setError(err instanceof ApiError ? err.message : 'Verification failed');
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <PageBlock title="Verify email" subtitle="">
      {status === 'pending' && <p>Verifying…</p>}
      {status === 'ok' && (
        <p>
          Email verified. <Link to="/login">Sign in →</Link>
        </p>
      )}
      {status === 'error' && <p style={{ color: '#f87171' }}>{error}</p>}
    </PageBlock>
  );
}

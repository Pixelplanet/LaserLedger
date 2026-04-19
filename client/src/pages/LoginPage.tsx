import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PageBlock from '../components/PageBlock';
import { api, ApiError } from '../lib/api';
import { useAuthStore, type AuthUser } from '../lib/auth-store';

export default function LoginPage() {
  const nav = useNavigate();
  const setUser = useAuthStore((s) => s.setUser);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const user = await api<AuthUser>('/auth/login', {
        method: 'POST',
        body: { email, password },
      });
      setUser(user);
      nav('/');
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageBlock title="Sign in" subtitle="Access your submissions, votes, and bookmarks.">
      <form className="form" onSubmit={onSubmit}>
        <label>
          Email
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label>
          Password
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {err && <p className="err">{err}</p>}
        <div className="toolbar">
          <button className="btn primary" disabled={busy} type="submit">
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
          <Link className="btn sm" to="/forgot-password">Forgot password?</Link>
          <Link className="btn sm" to="/register">Create account</Link>
        </div>
      </form>
    </PageBlock>
  );
}

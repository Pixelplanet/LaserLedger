import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PageBlock from '../components/PageBlock';
import { api, ApiError } from '../lib/api';
import { useAuthStore, type AuthUser } from '../lib/auth-store';

export default function RegisterPage() {
  const nav = useNavigate();
  const setUser = useAuthStore((s) => s.setUser);
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    if (password.length < 8) {
      setErr('Password must be at least 8 characters.');
      return;
    }
    setBusy(true);
    try {
      const user = await api<AuthUser>('/auth/register', {
        method: 'POST',
        body: { email, display_name: displayName, password },
      });
      setUser(user);
      nav('/');
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Registration failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageBlock title="Create account" subtitle="We'll send a verification link after signup.">
      <form className="form" onSubmit={onSubmit}>
        <label>
          Display name
          <input
            required
            minLength={1}
            maxLength={100}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </label>
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
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <span className="hint">8+ characters. Mix letters, numbers, symbols.</span>
        </label>
        {err && <p className="err">{err}</p>}
        <div className="toolbar">
          <button className="btn primary" disabled={busy} type="submit">
            {busy ? 'Creating…' : 'Create account'}
          </button>
          <Link to="/login" className="btn sm">Already have an account?</Link>
        </div>
      </form>
    </PageBlock>
  );
}

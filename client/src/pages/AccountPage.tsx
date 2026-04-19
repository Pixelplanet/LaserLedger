import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import PageBlock from '../components/PageBlock';
import { Button } from '../components/Button';
import { ErrorBlock } from '../components/States';
import { api, ApiError } from '../lib/api';
import { useAuthStore } from '../lib/auth-store';

export default function AccountPage() {
  const nav = useNavigate();
  const { user, refresh, logout } = useAuthStore();
  const [form, setForm] = useState({ display_name: '', bio: '', timezone: '', avatar_url: '' });
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setForm({
        display_name: user.display_name ?? '',
        bio: user.bio ?? '',
        timezone: '',
        avatar_url: user.avatar_url ?? '',
      });
    }
  }, [user]);

  const update = useMutation({
    mutationFn: (body: Record<string, unknown>) => api('/auth/profile', { method: 'PATCH', body }),
    onSuccess: async () => {
      setMsg('Profile updated.');
      setErr(null);
      await refresh();
    },
    onError: (e) => setErr(e instanceof ApiError ? e.message : 'Update failed'),
  });

  const remove = useMutation({
    mutationFn: () => api('/auth/account', { method: 'DELETE' }),
    onSuccess: async () => {
      await logout();
      nav('/');
    },
    onError: (e) => setErr(e instanceof ApiError ? e.message : 'Deletion failed'),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    update.mutate({
      display_name: form.display_name.trim() || undefined,
      bio: form.bio.trim() || null,
      timezone: form.timezone.trim() || null,
      avatar_url: form.avatar_url.trim() || null,
    });
  }

  function exportData() {
    window.open('/api/auth/export-data', '_blank');
  }

  if (!user) return <PageBlock title="Account" subtitle="Sign in to manage your profile." />;

  return (
    <PageBlock title="Account settings" subtitle={`Signed in as ${user.email}`}>
      <form className="form" onSubmit={onSubmit}>
        <label>
          Display name
          <input value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} maxLength={100} />
        </label>
        <label>
          Bio
          <textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} maxLength={2000} />
        </label>
        <label>
          Timezone (IANA)
          <input value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} placeholder="Europe/Berlin" maxLength={64} />
        </label>
        <label>
          Avatar URL
          <input value={form.avatar_url} onChange={(e) => setForm({ ...form, avatar_url: e.target.value })} type="url" maxLength={512} />
        </label>
        {err && <ErrorBlock>{err}</ErrorBlock>}
        {msg && <p className="hint">{msg}</p>}
        <Button type="submit" variant="primary" size="sm" disabled={update.isPending}>
          {update.isPending ? 'Saving…' : 'Save profile'}
        </Button>
      </form>

      <h2 style={{ marginTop: '1.5rem' }}>Privacy & data</h2>
      <div className="toolbar">
        <Button size="sm" onClick={exportData}>Export my data (GDPR)</Button>
        <Button
          size="sm"
          variant="danger"
          disabled={remove.isPending}
          onClick={() => {
            if (confirm('This will permanently delete your account. Continue?')) {
              remove.mutate();
            }
          }}
        >
          Delete account
        </Button>
      </div>
    </PageBlock>
  );
}

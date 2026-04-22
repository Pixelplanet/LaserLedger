import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import PageBlock from '../components/PageBlock';
import { api } from '../lib/api';
import { useAuthStore } from '../lib/auth-store';

interface Profile {
  id: string;
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
  submission_count: number;
  reputation: number;
  created_at: string;
  recent_submissions: { uuid: string; title: string; vote_score: number; view_count: number; created_at: string }[];
}

export default function ProfilePage() {
  const { id } = useParams<{ id: string }>();
  const me = useAuthStore((s) => s.user);
  const isOwn = me?.id === id;

  const profile = useQuery({
    queryKey: ['profile', id],
    queryFn: () => api<Profile>(`/users/${id}/profile`),
    enabled: !!id,
  });

  if (profile.isLoading) return <PageBlock title="Loading…" />;
  if (profile.isError || !profile.data) return <PageBlock title="Profile not found" />;
  const p = profile.data;

  return (
    <PageBlock
      title={p.display_name}
      subtitle={`${p.submission_count} submissions · ${p.reputation} rep · joined ${new Date(p.created_at).toLocaleDateString()}`}
    >
      {p.bio && <p>{p.bio}</p>}
      {isOwn && (
        <div className="toolbar">
          <Link to="/submit" className="btn primary sm">New submission</Link>
          <Link to="/account" className="btn sm">Profile settings</Link>
          {me?.role === 'admin' && <Link to="/admin" className="btn sm">Admin dashboard</Link>}
          <Link to="/forgot-password" className="btn sm">Change password</Link>
        </div>
      )}
      <h2 style={{ marginTop: '1rem' }}>Recent submissions</h2>
      {p.recent_submissions.length === 0 ? (
        <div className="empty">No approved submissions yet.</div>
      ) : (
        <div className="results-grid">
          {p.recent_submissions.map((s) => (
            <Link key={s.uuid} to={`/settings/${s.uuid}`} className="card">
              <h3>{s.title}</h3>
              <div className="meta">
                ▲ {s.vote_score} · 👁 {s.view_count} · {new Date(s.created_at).toLocaleDateString()}
              </div>
            </Link>
          ))}
        </div>
      )}
    </PageBlock>
  );
}

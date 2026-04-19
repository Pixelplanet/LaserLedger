import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import PageBlock from '../components/PageBlock';
import { api } from '../lib/api';

interface Stats {
  users: { total: number; new_7d: number };
  settings: { total: number; approved: number; pending: number; rejected: number };
  images_pending: number;
  reports_pending: number;
  comments: number;
}

interface LogRow {
  id: number;
  moderator_name: string | null;
  target_type: string;
  target_id: number;
  action: string;
  reason: string | null;
  created_at: string;
}

export default function AdminPage() {
  const stats = useQuery({ queryKey: ['admin-stats'], queryFn: () => api<Stats>('/admin/stats') });
  const log = useQuery({ queryKey: ['admin-log'], queryFn: () => api<LogRow[]>('/admin/moderation-log') });

  return (
    <PageBlock title="Admin dashboard" subtitle="Operational health and recent moderator activity.">
      <div className="toolbar">
        <Link className="btn sm" to="/admin/materials">Materials</Link>
        <Link className="btn sm" to="/admin/devices">Devices</Link>
        <Link className="btn sm" to="/admin/tags">Tags</Link>
        <Link className="btn sm" to="/admin/users">Users</Link>
        <Link className="btn sm" to="/admin/system">System settings</Link>
      </div>
      {stats.isLoading && <p className="hint">Loading…</p>}
      {stats.data && (
        <div className="results-grid">
          <div className="card">
            <h3>Users</h3>
            <div className="meta">{stats.data.users.total} total · {stats.data.users.new_7d} new this week</div>
          </div>
          <div className="card">
            <h3>Settings</h3>
            <div className="meta">
              {stats.data.settings.approved} approved · {stats.data.settings.pending} pending · {stats.data.settings.rejected} rejected
            </div>
          </div>
          <div className="card">
            <h3>Moderation</h3>
            <div className="meta">{stats.data.images_pending} images · {stats.data.reports_pending} reports</div>
          </div>
          <div className="card">
            <h3>Comments</h3>
            <div className="meta">{stats.data.comments} live</div>
          </div>
        </div>
      )}

      <h2 style={{ marginTop: '1.5rem' }}>Recent moderation activity</h2>
      {log.data?.length === 0 && <div className="empty">No actions yet.</div>}
      <div className="form wide" style={{ gap: '0.4rem' }}>
        {log.data?.slice(0, 30).map((row) => (
          <div key={row.id} className="comment" style={{ padding: '0.6rem 0' }}>
            <div className="head">
              <span>
                <strong>{row.moderator_name ?? 'unknown'}</strong> · {row.action} · {row.target_type}#{row.target_id}
              </span>
              <span>{new Date(row.created_at).toLocaleString()}</span>
            </div>
            {row.reason && <p className="hint" style={{ margin: '0.3rem 0 0' }}>{row.reason}</p>}
          </div>
        ))}
      </div>
    </PageBlock>
  );
}

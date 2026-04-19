import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import PageBlock from '../components/PageBlock';
import { api, ApiError } from '../lib/api';

interface QueueCounts { settings: number; images: number; reports: number }
interface PendingSetting {
  uuid: string;
  title: string;
  description: string | null;
  author_name: string | null;
  device_name: string | null;
  material_name: string | null;
  created_at: string;
}

export default function ModPage() {
  const qc = useQueryClient();
  const counts = useQuery({ queryKey: ['mod-queue'], queryFn: () => api<QueueCounts>('/mod/queue') });
  const pending = useQuery({
    queryKey: ['mod-pending'],
    queryFn: () => api<PendingSetting[]>('/mod/settings/pending'),
  });

  const [reasonFor, setReasonFor] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [err, setErr] = useState<string | null>(null);

  function refresh() {
    qc.invalidateQueries({ queryKey: ['mod-queue'] });
    qc.invalidateQueries({ queryKey: ['mod-pending'] });
  }

  const approve = useMutation({
    mutationFn: (uuid: string) => api(`/mod/settings/${uuid}/approve`, { method: 'POST' }),
    onSuccess: refresh,
    onError: (e) => setErr(e instanceof ApiError ? e.message : 'Action failed'),
  });
  const reject = useMutation({
    mutationFn: ({ uuid, reason }: { uuid: string; reason: string }) =>
      api(`/mod/settings/${uuid}/reject`, { method: 'POST', body: { reason } }),
    onSuccess: () => {
      setReasonFor(null);
      setReason('');
      refresh();
    },
    onError: (e) => setErr(e instanceof ApiError ? e.message : 'Action failed'),
  });
  const archive = useMutation({
    mutationFn: (uuid: string) => api(`/mod/settings/${uuid}/archive`, { method: 'POST' }),
    onSuccess: refresh,
  });

  function submitReject(e: FormEvent) {
    e.preventDefault();
    if (!reasonFor || reason.trim().length < 3) return;
    reject.mutate({ uuid: reasonFor, reason: reason.trim() });
  }

  return (
    <PageBlock title="Moderation queue" subtitle="Approve, reject, archive — write to the audit log.">
      {counts.data && (
        <div className="toolbar">
          <Link className="btn sm" to="/mod">Settings <span className="tag">{counts.data.settings}</span></Link>
          <Link className="btn sm" to="/mod/images">Images <span className="tag warn">{counts.data.images}</span></Link>
          <Link className="btn sm" to="/mod/reports">Reports <span className="tag muted">{counts.data.reports}</span></Link>
        </div>
      )}
      {err && <p className="err">{err}</p>}

      {pending.isLoading && <p className="hint">Loading…</p>}
      {pending.data?.length === 0 && <div className="empty">Queue is clear. 🎉</div>}

      <div className="results-grid">
        {pending.data?.map((s) => (
          <div key={s.uuid} className="card">
            <Link to={`/settings/${s.uuid}`}><h3>{s.title}</h3></Link>
            <div className="meta">
              by {s.author_name ?? 'unknown'} · {new Date(s.created_at).toLocaleString()}
            </div>
            <div className="meta">
              {s.device_name && <span className="tag muted">{s.device_name}</span>}
              {s.material_name && <span className="tag muted">{s.material_name}</span>}
            </div>
            {s.description && <p className="hint" style={{ margin: 0 }}>{s.description.slice(0, 140)}{s.description.length > 140 ? '…' : ''}</p>}
            <div className="toolbar" style={{ margin: 0 }}>
              <button className="btn primary sm" disabled={approve.isPending} onClick={() => approve.mutate(s.uuid)}>Approve</button>
              <button className="btn sm danger" onClick={() => { setReasonFor(s.uuid); setReason(''); }}>Reject…</button>
              <button className="btn sm" onClick={() => archive.mutate(s.uuid)}>Archive</button>
            </div>
            {reasonFor === s.uuid && (
              <form className="form" onSubmit={submitReject}>
                <textarea
                  required
                  minLength={3}
                  maxLength={2000}
                  placeholder="Reason sent to the submitter…"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
                <div className="toolbar">
                  <button type="submit" className="btn danger sm" disabled={reject.isPending}>Confirm reject</button>
                  <button type="button" className="btn sm" onClick={() => setReasonFor(null)}>Cancel</button>
                </div>
              </form>
            )}
          </div>
        ))}
      </div>
    </PageBlock>
  );
}

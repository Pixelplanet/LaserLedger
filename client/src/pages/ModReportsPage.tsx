import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import PageBlock from '../components/PageBlock';
import { api, ApiError } from '../lib/api';
import { Button } from '../components/Button';
import { EmptyState, ErrorBlock, LoadingBlock } from '../components/States';

interface Report {
  id: number;
  reporter_name: string | null;
  target_type: 'setting' | 'comment' | 'image';
  target_id: number;
  reason: string;
  description: string | null;
  created_at: string;
}

const ACTIONS = [
  { value: 'dismiss', label: 'Dismiss' },
  { value: 'remove_content', label: 'Remove content' },
  { value: 'warn_user', label: 'Warn user' },
] as const;

export default function ModReportsPage() {
  const qc = useQueryClient();
  const [err, setErr] = useState<string | null>(null);
  const list = useQuery({
    queryKey: ['mod-reports'],
    queryFn: () => api<Report[]>('/mod/reports/pending'),
  });

  const resolve = useMutation({
    mutationFn: ({ id, action }: { id: number; action: string }) =>
      api(`/mod/reports/${id}/resolve`, { method: 'POST', body: { action } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mod-reports'] });
      qc.invalidateQueries({ queryKey: ['mod-queue'] });
    },
    onError: (e) => setErr(e instanceof ApiError ? e.message : 'Action failed'),
  });

  return (
    <PageBlock title="Pending reports" subtitle="User-submitted complaints awaiting moderator action.">
      {err && <ErrorBlock>{err}</ErrorBlock>}
      {list.isLoading && <LoadingBlock />}
      {list.data?.length === 0 && <EmptyState>No outstanding reports.</EmptyState>}
      <div className="form wide">
        {list.data?.map((r) => (
          <div key={r.id} className="comment" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '0.6rem' }}>
            <div className="head">
              <span><strong>{r.target_type}#{r.target_id}</strong> · reason: <em>{r.reason}</em></span>
              <span>{new Date(r.created_at).toLocaleString()}</span>
            </div>
            <div className="meta">reported by {r.reporter_name ?? 'unknown'}</div>
            {r.description && <p>{r.description}</p>}
            <div className="toolbar">
              {ACTIONS.map((a) => (
                <Button
                  key={a.value}
                  size="sm"
                  variant={a.value === 'dismiss' ? 'ghost' : a.value === 'warn_user' ? 'primary' : 'danger'}
                  disabled={resolve.isPending}
                  onClick={() => resolve.mutate({ id: r.id, action: a.value })}
                >
                  {a.label}
                </Button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </PageBlock>
  );
}

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import PageBlock from '../components/PageBlock';
import { api, ApiError } from '../lib/api';
import { Button } from '../components/Button';
import { EmptyState, ErrorBlock, LoadingBlock } from '../components/States';

interface PendingImage {
  uuid: string;
  setting_uuid: string;
  setting_title: string | null;
  uploader_name: string | null;
  card_path: string | null;
  thumbnail_path: string | null;
  original_filename: string;
  width: number | null;
  height: number | null;
  created_at: string;
}

export default function ModImagesPage() {
  const qc = useQueryClient();
  const [err, setErr] = useState<string | null>(null);
  const [reasonFor, setReasonFor] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  const list = useQuery({
    queryKey: ['mod-images'],
    queryFn: () => api<PendingImage[]>('/mod/images/pending'),
  });

  function refresh() {
    qc.invalidateQueries({ queryKey: ['mod-images'] });
    qc.invalidateQueries({ queryKey: ['mod-queue'] });
  }
  const approve = useMutation({
    mutationFn: (uuid: string) => api(`/mod/images/${uuid}/approve`, { method: 'POST' }),
    onSuccess: refresh,
    onError: (e) => setErr(e instanceof ApiError ? e.message : 'Action failed'),
  });
  const reject = useMutation({
    mutationFn: ({ uuid, reason }: { uuid: string; reason: string }) =>
      api(`/mod/images/${uuid}/reject`, { method: 'POST', body: { reason } }),
    onSuccess: () => {
      setReasonFor(null);
      setReason('');
      refresh();
    },
    onError: (e) => setErr(e instanceof ApiError ? e.message : 'Action failed'),
  });

  return (
    <PageBlock title="Pending images" subtitle="Review uploaded photos before they go live.">
      {err && <ErrorBlock>{err}</ErrorBlock>}
      {list.isLoading && <LoadingBlock />}
      {list.data?.length === 0 && <EmptyState>No images awaiting review.</EmptyState>}
      <div className="results-grid">
        {list.data?.map((img) => (
          <div key={img.uuid} className="card">
            <div className="thumb">
              {img.card_path && <img src={`/api/uploads/${img.card_path}`} alt={img.original_filename} loading="lazy" />}
            </div>
            <div className="meta">
              {img.width}×{img.height} · {img.original_filename}
            </div>
            <div className="meta">
              by {img.uploader_name ?? 'unknown'} · setting <a href={`/settings/${img.setting_uuid}`} target="_blank" rel="noopener noreferrer">{img.setting_title ?? img.setting_uuid}</a>
            </div>
            <div className="toolbar" style={{ margin: 0 }}>
              <Button variant="primary" size="sm" disabled={approve.isPending} onClick={() => approve.mutate(img.uuid)}>Approve</Button>
              <Button variant="danger" size="sm" onClick={() => { setReasonFor(img.uuid); setReason(''); }}>Reject…</Button>
            </div>
            {reasonFor === img.uuid && (
              <form
                className="form"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (reason.trim().length < 3) return;
                  reject.mutate({ uuid: img.uuid, reason: reason.trim() });
                }}
              >
                <textarea required minLength={3} maxLength={2000} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason…" />
                <div className="toolbar">
                  <Button type="submit" variant="danger" size="sm" disabled={reject.isPending}>Confirm</Button>
                  <Button type="button" size="sm" onClick={() => setReasonFor(null)}>Cancel</Button>
                </div>
              </form>
            )}
          </div>
        ))}
      </div>
    </PageBlock>
  );
}

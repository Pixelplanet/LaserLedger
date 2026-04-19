import { useState, type ChangeEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../lib/api';
import { Button } from './Button';
import { ErrorBlock, EmptyState } from './States';

interface ImageRow {
  uuid: string;
  card_path: string | null;
  thumbnail_path: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'archived';
  sort_order: number;
  alt_text: string | null;
}

interface Props {
  uuid: string;
  canEdit: boolean;
}

export function ImageUploader({ uuid, canEdit }: Props) {
  const qc = useQueryClient();
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const list = useQuery({
    queryKey: ['setting-images', uuid],
    queryFn: () => api<ImageRow[]>(`/settings/${uuid}/images`),
  });

  async function onFiles(e: ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setErr(null);
    setBusy(true);
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append('image', file);
        const res = await fetch(`/api/settings/${uuid}/images`, {
          method: 'POST',
          credentials: 'include',
          body: fd,
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error?.message ?? `Upload failed: ${file.name}`);
      }
      await qc.invalidateQueries({ queryKey: ['setting-images', uuid] });
      e.target.value = '';
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  }

  async function remove(imgUuid: string) {
    if (!confirm('Delete this image?')) return;
    try {
      await api(`/images/${imgUuid}`, { method: 'DELETE' });
      await qc.invalidateQueries({ queryKey: ['setting-images', uuid] });
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Delete failed');
    }
  }

  return (
    <div className="form">
      <h3>Images</h3>
      {canEdit && (
        <label>
          Upload (PNG / JPG, max 10 MB each)
          <input type="file" accept="image/*" multiple disabled={busy} onChange={onFiles} />
        </label>
      )}
      {err && <ErrorBlock>{err}</ErrorBlock>}
      {list.data?.length === 0 && <EmptyState>No images yet.</EmptyState>}
      <div className="results-grid">
        {list.data?.map((img) => (
          <div key={img.uuid} className="card">
            <div className="thumb">
              {img.card_path && <img src={`/api/uploads/${img.card_path}`} alt={img.alt_text ?? ''} loading="lazy" />}
            </div>
            <div className="meta">
              status: <span className={`tag ${img.status === 'pending' ? 'warn' : ''}`}>{img.status}</span>
            </div>
            {canEdit && (
              <div className="toolbar" style={{ margin: 0 }}>
                <Button size="sm" variant="danger" onClick={() => remove(img.uuid)}>Delete</Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

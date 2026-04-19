import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import PageBlock from '../components/PageBlock';
import { api, ApiError } from '../lib/api';
import { useAuthStore } from '../lib/auth-store';

interface SettingDetail {
  id: number;
  uuid: string;
  title: string;
  description: string | null;
  status: string;
  device_name: string | null;
  laser_type_name: string | null;
  material_name: string | null;
  operation_type_name: string | null;
  author_name: string | null;
  author_id: string | null;
  power: number | null;
  speed: number | null;
  passes: number | null;
  frequency: number | null;
  lpi: number | null;
  pulse_width: number | null;
  focus_offset: number | null;
  scan_mode: string | null;
  cross_hatch: boolean | null;
  result_description: string | null;
  quality_rating: number | null;
  vote_score: number;
  view_count: number;
  created_at: string;
  tags: { id: number; name: string; slug: string }[];
  images: ImageRow[];
}

interface ImageRow {
  uuid: string;
  stored_path: string;
  card_path: string;
  thumbnail_path: string;
  is_primary: boolean;
  sort_order: number;
}

interface CommentRow {
  id: number;
  body: string;
  created_at: string;
  user_id: string;
  display_name: string;
}

const url = (p?: string | null) => (p ? `/api/uploads/${p}` : '');

export default function SettingDetailPage() {
  const { uuid } = useParams<{ uuid: string }>();
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const [activeImg, setActiveImg] = useState(0);
  const [body, setBody] = useState('');

  const detail = useQuery({
    queryKey: ['setting', uuid],
    queryFn: () => api<SettingDetail>(`/settings/${uuid}`),
    enabled: !!uuid,
  });

  const comments = useQuery({
    queryKey: ['comments', uuid],
    queryFn: async () => {
      const res = await fetch(`/api/settings/${uuid}/comments`, { credentials: 'include' });
      const j = (await res.json()) as { data: CommentRow[] };
      return j.data;
    },
    enabled: !!uuid,
  });

  const vote = useMutation({
    mutationFn: () => api(`/settings/${uuid}/vote`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['setting', uuid] }),
  });
  const unvote = useMutation({
    mutationFn: () => api(`/settings/${uuid}/vote`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['setting', uuid] }),
  });
  const postComment = useMutation({
    mutationFn: (text: string) => api(`/settings/${uuid}/comments`, { method: 'POST', body: { body: text } }),
    onSuccess: () => {
      setBody('');
      qc.invalidateQueries({ queryKey: ['comments', uuid] });
    },
  });

  if (detail.isLoading) return <PageBlock title="Loading…" />;
  if (detail.isError) {
    const e = detail.error;
    return <PageBlock title="Not found" subtitle={e instanceof ApiError ? e.message : 'Setting not available.'} />;
  }
  const s = detail.data!;
  const img = s.images[activeImg];

  function onComment(e: FormEvent) {
    e.preventDefault();
    if (body.trim().length === 0) return;
    postComment.mutate(body.trim());
  }

  return (
    <PageBlock title={s.title} subtitle={s.description ?? undefined}>
      {(user?.id === s.author_id || user?.role === 'moderator' || user?.role === 'admin') && (
        <div className="toolbar">
          <Link className="btn sm" to={`/settings/${s.uuid}/edit`}>Edit</Link>
          <span className="tag muted">status: {s.status}</span>
        </div>
      )}
      <div className="split">
        <div>
          {img ? (
            <>
              <img className="thumb" style={{ aspectRatio: '4 / 3' }} src={url(img.card_path)} alt={s.title} />
              {s.images.length > 1 && (
                <div className="toolbar" style={{ marginTop: '0.5rem' }}>
                  {s.images.map((im, i) => (
                    <button
                      key={im.uuid}
                      className={`btn sm ${i === activeImg ? 'primary' : ''}`}
                      onClick={() => setActiveImg(i)}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="empty">No images yet.</div>
          )}

          <div className="vote" style={{ marginTop: '1rem' }}>
            <button
              className="active"
              disabled={!user || vote.isPending}
              onClick={() => vote.mutate()}
              title="Upvote"
            >▲</button>
            <span className="score">{s.vote_score}</span>
            <button
              disabled={!user || unvote.isPending}
              onClick={() => unvote.mutate()}
              title="Remove vote"
            >×</button>
            <span className="hint" style={{ marginLeft: '0.75rem' }}>👁 {s.view_count}</span>
          </div>
        </div>

        <div>
          <dl className="kv">
            <dt>Author</dt>
            <dd>{s.author_id ? <Link to={`/profile/${s.author_id}`}>{s.author_name}</Link> : '—'}</dd>
            <dt>Device</dt><dd>{s.device_name ?? '—'}</dd>
            <dt>Laser</dt><dd>{s.laser_type_name ?? '—'}</dd>
            <dt>Material</dt><dd>{s.material_name ?? '—'}</dd>
            <dt>Operation</dt><dd>{s.operation_type_name ?? '—'}</dd>
            {s.power != null && (<><dt>Power</dt><dd>{s.power}%</dd></>)}
            {s.speed != null && (<><dt>Speed</dt><dd>{s.speed} mm/s</dd></>)}
            {s.passes != null && (<><dt>Passes</dt><dd>{s.passes}</dd></>)}
            {s.frequency != null && (<><dt>Frequency</dt><dd>{s.frequency} kHz</dd></>)}
            {s.lpi != null && (<><dt>LPI</dt><dd>{s.lpi}</dd></>)}
            {s.pulse_width != null && (<><dt>Pulse width</dt><dd>{s.pulse_width} ns</dd></>)}
            {s.focus_offset != null && (<><dt>Focus offset</dt><dd>{s.focus_offset} mm</dd></>)}
            {s.scan_mode && (<><dt>Scan mode</dt><dd>{s.scan_mode}</dd></>)}
            {s.cross_hatch != null && (<><dt>Cross-hatch</dt><dd>{s.cross_hatch ? 'Yes' : 'No'}</dd></>)}
            {s.quality_rating != null && (<><dt>Quality</dt><dd>{'★'.repeat(s.quality_rating)}</dd></>)}
          </dl>

          {s.tags.length > 0 && (
            <div className="toolbar" style={{ marginTop: '0.75rem' }}>
              {s.tags.map((t) => <span key={t.id} className="tag">{t.name}</span>)}
            </div>
          )}

          {s.result_description && (
            <div className="panel" style={{ marginTop: '1rem' }}>
              <h2>Result notes</h2>
              <p style={{ whiteSpace: 'pre-wrap' }}>{s.result_description}</p>
            </div>
          )}
        </div>
      </div>

      <section style={{ marginTop: '1.5rem' }}>
        <h2>Discussion</h2>
        {user ? (
          <form className="form wide" onSubmit={onComment}>
            <textarea
              required
              maxLength={5000}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Share your experience or a tip…"
            />
            <button className="btn primary" type="submit" disabled={postComment.isPending}>
              {postComment.isPending ? 'Posting…' : 'Post comment'}
            </button>
          </form>
        ) : (
          <p className="hint">
            <Link to="/login">Sign in</Link> to comment.
          </p>
        )}
        {comments.data?.length === 0 && <p className="hint">Be the first to comment.</p>}
        {comments.data?.map((c) => (
          <div key={c.id} className="comment">
            <div className="head">
              <Link to={`/profile/${c.user_id}`}>{c.display_name}</Link>
              <span>{new Date(c.created_at).toLocaleString()}</span>
            </div>
            <p style={{ whiteSpace: 'pre-wrap', marginTop: '0.4rem' }}>{c.body}</p>
          </div>
        ))}
      </section>
    </PageBlock>
  );
}

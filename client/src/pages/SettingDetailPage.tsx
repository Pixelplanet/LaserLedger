import { useState, useEffect, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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

function initials(name?: string | null): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';
}

function timeAgo(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  const s = Math.max(1, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}

interface ParamRow { label: string; value: string }
function buildParamRows(s: SettingDetail): ParamRow[] {
  const out: ParamRow[] = [];
  const push = (label: string, value: number | string | null | undefined, suffix = '') => {
    if (value === null || value === undefined || value === '') return;
    out.push({ label, value: `${value}${suffix}` });
  };
  push('Power', s.power, '%');
  push('Speed', s.speed, ' mm/s');
  push('Passes', s.passes);
  push('Frequency', s.frequency, ' kHz');
  push('LPI', s.lpi);
  push('Pulse width', s.pulse_width, ' ns');
  push('Focus offset', s.focus_offset, ' mm');
  if (s.scan_mode) push('Scan mode', s.scan_mode);
  if (s.cross_hatch != null) push('Cross-hatch', s.cross_hatch ? 'Yes' : 'No');
  if (s.quality_rating != null) push('Quality', '★'.repeat(s.quality_rating));
  return out;
}

export default function SettingDetailPage() {
  const { uuid } = useParams<{ uuid: string }>();
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const [activeImg, setActiveImg] = useState(0);
  const [zoom, setZoom] = useState(false);
  const [body, setBody] = useState('');

  const detail = useQuery({
    queryKey: ['setting', uuid],
    queryFn: () => api<SettingDetail>(`/settings/${uuid}`),
    enabled: !!uuid,
    staleTime: 60_000,
  });

  const comments = useQuery({
    queryKey: ['comments', uuid],
    queryFn: () => api<CommentRow[]>(`/settings/${uuid}/comments`),
    enabled: !!uuid,
    staleTime: 30_000,
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

  // Lightbox controls
  useEffect(() => {
    if (!zoom) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setZoom(false);
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [zoom]);

  if (detail.isLoading) {
    return (
      <section className="panel detail-skeleton">
        <div className="detail-layout">
          <div className="skeleton skeleton-hero" />
          <div>
            <div className="skeleton skeleton-line lg" />
            <div className="skeleton skeleton-line" />
            <div className="skeleton skeleton-block" />
          </div>
        </div>
      </section>
    );
  }
  if (detail.isError) {
    const e = detail.error;
    return (
      <section className="panel">
        <h1>Not found</h1>
        <p className="hint">{e instanceof ApiError ? e.message : 'Setting not available.'}</p>
        <Link className="btn" to="/search">Browse settings</Link>
      </section>
    );
  }

  const s = detail.data!;
  const img = s.images[activeImg];
  const paramRows = buildParamRows(s);
  const canEdit = user?.id === s.author_id || user?.role === 'moderator' || user?.role === 'admin';

  function onComment(e: FormEvent) {
    e.preventDefault();
    if (body.trim().length === 0) return;
    postComment.mutate(body.trim());
  }

  function shareLink() {
    const link = window.location.href;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(link).catch(() => {
        window.prompt('Copy link:', link);
      });
    } else {
      window.prompt('Copy link:', link);
    }
  }

  return (
    <article className="detail-page">
      {/* ─── Hero ─────────────────────────────────────────────── */}
      <header className="detail-header">
        <div className="breadcrumb">
          <Link to="/search">Settings</Link>
          {s.material_name && <span> / {s.material_name}</span>}
          {s.operation_type_name && <span> / {s.operation_type_name}</span>}
        </div>
        <h1 className="detail-title">{s.title}</h1>
        <div className="detail-byline">
          {s.author_id ? (
            <Link to={`/profile/${s.author_id}`} className="author-chip">
              <span className="avatar">{initials(s.author_name)}</span>
              <span>{s.author_name ?? 'Unknown'}</span>
            </Link>
          ) : (
            <span className="author-chip">
              <span className="avatar">?</span>
              <span>Unknown</span>
            </span>
          )}
          <span className="dot">·</span>
          <span title={new Date(s.created_at).toLocaleString()}>{timeAgo(s.created_at)}</span>
          <span className="dot">·</span>
          <span>👁 {s.view_count}</span>
          {s.status !== 'approved' && (
            <>
              <span className="dot">·</span>
              <span className="tag warn">status: {s.status}</span>
            </>
          )}
        </div>
      </header>

      <div className="detail-layout">
        {/* ─── Gallery ──────────────────────────────────────── */}
        <div className="detail-gallery">
          {img ? (
            <>
              <button
                type="button"
                className="detail-hero"
                onClick={() => setZoom(true)}
                aria-label="Open full-size image"
              >
                <img
                  src={url(img.card_path)}
                  alt={s.title}
                  width={800}
                  height={600}
                  decoding="async"
                  fetchPriority="high"
                />
                <span className="zoom-hint">⤢ Click to zoom</span>
              </button>
              {s.images.length > 1 && (
                <div className="detail-thumbstrip" role="tablist">
                  {s.images.map((im, i) => (
                    <button
                      key={im.uuid}
                      role="tab"
                      aria-selected={i === activeImg}
                      className={`thumb-btn ${i === activeImg ? 'active' : ''}`}
                      onClick={() => setActiveImg(i)}
                    >
                      <img
                        src={url(im.thumbnail_path)}
                        alt=""
                        width={120}
                        height={90}
                        loading="lazy"
                        decoding="async"
                      />
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="detail-hero empty">No images yet.</div>
          )}

          {(s.description || s.result_description) && (
            <div className="detail-prose">
              {s.description && (
                <>
                  <h2>About</h2>
                  <p>{s.description}</p>
                </>
              )}
              {s.result_description && (
                <>
                  <h2>Result notes</h2>
                  <p>{s.result_description}</p>
                </>
              )}
            </div>
          )}
        </div>

        {/* ─── Sidebar ──────────────────────────────────────── */}
        <aside className="detail-side">
          <div className="side-card">
            <div className="vote-row">
              <div className="vote">
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
              </div>
              <div className="side-actions">
                <button className="btn sm" onClick={shareLink}>Share</button>
                {canEdit && (
                  <Link className="btn sm" to={`/settings/${s.uuid}/edit`}>Edit</Link>
                )}
              </div>
            </div>

            <dl className="kv">
              <dt>Device</dt><dd>{s.device_name ?? '—'}</dd>
              <dt>Laser</dt><dd>{s.laser_type_name ?? '—'}</dd>
              <dt>Material</dt><dd>{s.material_name ?? '—'}</dd>
              <dt>Operation</dt><dd>{s.operation_type_name ?? '—'}</dd>
            </dl>

            {s.tags.length > 0 && (
              <div className="tag-cloud">
                {s.tags.map((t) => <span key={t.id} className="tag">{t.name}</span>)}
              </div>
            )}
          </div>

          {paramRows.length > 0 && (
            <div className="side-card">
              <h3 className="side-head">Parameters</h3>
              <dl className="params-grid">
                {paramRows.map((r) => (
                  <div key={r.label} className="param-cell">
                    <dt>{r.label}</dt>
                    <dd>{r.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </aside>
      </div>

      {/* ─── Discussion ─────────────────────────────────────── */}
      <section className="discussion">
        <div className="section-head">
          <h2>Discussion {comments.data ? <span className="count">({comments.data.length})</span> : null}</h2>
        </div>

        {user ? (
          <form className="comment-composer" onSubmit={onComment}>
            <span className="avatar lg">{initials(user.display_name)}</span>
            <div className="composer-body">
              <textarea
                required
                maxLength={5000}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Share your experience, ask a question, or post a tip…"
                rows={3}
              />
              <div className="composer-actions">
                <button className="btn primary" type="submit" disabled={postComment.isPending}>
                  {postComment.isPending ? 'Posting…' : 'Post comment'}
                </button>
              </div>
            </div>
          </form>
        ) : (
          <p className="hint">
            <Link to="/login">Sign in</Link> to join the discussion.
          </p>
        )}

        {comments.isLoading && <p className="hint">Loading comments…</p>}
        {comments.data?.length === 0 && (
          <p className="hint empty-comments">No comments yet. Be the first to share what worked for you.</p>
        )}
        <ol className="comment-list">
          {comments.data?.map((c) => (
            <li key={c.id} className="comment-card">
              <Link to={`/profile/${c.user_id}`} className="avatar lg" aria-label={c.display_name}>
                {initials(c.display_name)}
              </Link>
              <div className="comment-body">
                <div className="comment-meta">
                  <Link to={`/profile/${c.user_id}`} className="comment-author">{c.display_name}</Link>
                  <span className="dot">·</span>
                  <span title={new Date(c.created_at).toLocaleString()}>{timeAgo(c.created_at)}</span>
                </div>
                <p className="comment-text">{c.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* ─── Lightbox ───────────────────────────────────────── */}
      {zoom && img && (
        <div className="lightbox" onClick={() => setZoom(false)} role="dialog" aria-modal="true">
          <button
            type="button"
            className="lightbox-close"
            onClick={(e) => { e.stopPropagation(); setZoom(false); }}
            aria-label="Close"
          >×</button>
          <img
            src={url(img.stored_path)}
            alt={s.title}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </article>
  );
}

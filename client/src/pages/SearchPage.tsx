import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import PageBlock from '../components/PageBlock';
import { api } from '../lib/api';

interface RefRow { id: number; name: string; slug: string }
interface SettingRow {
  uuid: string;
  title: string;
  device_name: string | null;
  laser_type_name: string | null;
  material_name: string | null;
  operation_type_name: string | null;
  power: number | null;
  speed: number | null;
  passes: number | null;
  vote_score: number;
  view_count: number;
  primary_image_card?: string | null;
  source_format?: 'xcs' | 'xs' | null;
}

interface SearchResponse {
  data: SettingRow[];
  meta: { page: number; pageSize: number; total: number };
}

const SORTS = [
  ['relevance', 'Relevance'],
  ['newest', 'Newest'],
  ['top_rated', 'Top rated'],
  ['most_viewed', 'Most viewed'],
  ['most_discussed', 'Most discussed'],
] as const;

function imgUrl(p?: string | null) {
  return p ? `/api/uploads/${p}` : null;
}

export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');

  useEffect(() => {
    setQ(params.get('q') ?? '');
  }, [params]);

  const refs = useQuery({
    queryKey: ['refs'],
    queryFn: async () => {
      const [devices, lasers, materials, ops] = await Promise.all([
        api<RefRow[]>('/devices'),
        api<RefRow[]>('/laser-types'),
        api<RefRow[]>('/materials'),
        api<RefRow[]>('/operation-types'),
      ]);
      return { devices, lasers, materials, ops };
    },
  });

  const queryString = params.toString();

  // api() helper strips `.data`, so for paginated responses we fetch raw to keep meta.
  const search = useQuery({
    queryKey: ['search', queryString],
    queryFn: async () => {
      const res = await fetch(`/api/settings?${queryString}`, { credentials: 'include' });
      return (await res.json()) as SearchResponse;
    },
  });

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete('page');
    setParams(next, { replace: true });
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setParam('q', q.trim());
  }

  const rows = search.data?.data ?? [];
  const meta = search.data?.meta;

  return (
    <PageBlock title="Browse settings" subtitle="Filter by device, laser, material, operation, and more.">
      <div className="browse-layout">
        <aside className="browse-sidebar">
          <form className="form" onSubmit={onSubmit} style={{ maxWidth: 'none' }}>
            <h2>Search</h2>
            <label>
              Keyword
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. anodized aluminum" />
            </label>

            <h2>Hardware</h2>
            <label>
              Device
              <select value={params.get('device') ?? ''} onChange={(e) => setParam('device', e.target.value)}>
                <option value="">Any device</option>
                {refs.data?.devices.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </label>
            <label>
              Laser type
              <select value={params.get('laser_type') ?? ''} onChange={(e) => setParam('laser_type', e.target.value)}>
                <option value="">Any laser</option>
                {refs.data?.lasers.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </label>

            <h2>Material &amp; operation</h2>
            <label>
              Material
              <select value={params.get('material') ?? ''} onChange={(e) => setParam('material', e.target.value)}>
                <option value="">Any material</option>
                {refs.data?.materials.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </label>
            <label>
              Operation
              <select value={params.get('operation') ?? ''} onChange={(e) => setParam('operation', e.target.value)}>
                <option value="">Any operation</option>
                {refs.data?.ops.map((o) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </label>

            <h2>Quick filters</h2>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={params.get('has_image') === '1'}
                onChange={(e) => setParam('has_image', e.target.checked ? '1' : '')}
              />
              Has image
            </label>

            <h2>Sort</h2>
            <label>
              <select value={params.get('sort') ?? 'relevance'} onChange={(e) => setParam('sort', e.target.value)}>
                {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
            <button className="btn primary block" type="submit">Apply filters</button>
          </form>
        </aside>

        <section>
          <div className="browse-toolbar">
            <span className="browse-results-count">
              {search.isLoading
                ? 'Loading…'
                : meta
                  ? `${meta.total.toLocaleString()} setting${meta.total === 1 ? '' : 's'}`
                  : ''}
            </span>
          </div>
          {search.isError && <p className="err">Failed to load results.</p>}
          {!search.isLoading && rows.length === 0 && (
            <div className="empty">No settings match these filters yet.</div>
          )}
          <div className="results-grid">
            {rows.map((s) => {
              const img = imgUrl(s.primary_image_card);
              return (
                <Link key={s.uuid} to={`/settings/${s.uuid}`} className="tile">
                  <div className="tile-media">
                    {img ? (
                      <img src={img} alt={s.title} loading="lazy" />
                    ) : null}
                    <div className="tile-badges">
                      {s.operation_type_name && (
                        <span className="tag solid">{s.operation_type_name}</span>
                      )}
                    </div>
                    <div className="tile-stats">
                      <span>▲ {s.vote_score}</span>
                      <span>👁 {s.view_count}</span>
                    </div>
                  </div>
                  <div className="tile-body">
                    <h3 className="tile-title">{s.title}</h3>
                    <div className="tile-meta">
                      {s.material_name && <span className="tag muted">{s.material_name}</span>}
                      {s.laser_type_name && <span className="tag muted">{s.laser_type_name}</span>}
                    </div>
                    <div className="tile-author">
                      {s.device_name ?? 'Unknown device'}
                      {s.power != null && ` · ${s.power}% pwr`}
                      {s.speed != null && ` · ${s.speed} mm/s`}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
          {meta && meta.total > meta.pageSize && (
            <div className="toolbar" style={{ marginTop: '1rem', justifyContent: 'space-between' }}>
              <span className="hint">{meta.total} results · page {meta.page}</span>
              <div className="toolbar" style={{ margin: 0 }}>
                <button
                  className="btn sm"
                  disabled={meta.page <= 1}
                  onClick={() => setParam('page', String(meta.page - 1))}
                >Prev</button>
                <button
                  className="btn sm"
                  disabled={meta.page * meta.pageSize >= meta.total}
                  onClick={() => setParam('page', String(meta.page + 1))}
                >Next</button>
              </div>
            </div>
          )}
        </section>
      </div>
    </PageBlock>
  );
}

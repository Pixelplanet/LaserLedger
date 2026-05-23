import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import PageBlock from '../components/PageBlock';

interface SettingRow {
  uuid: string;
  title: string;
  device_name: string | null;
  laser_type_name: string | null;
  material_name: string | null;
  operation_type_name: string | null;
  vote_score: number;
  view_count: number;
  primary_image_card?: string | null;
}

interface SearchResponse {
  data: SettingRow[];
  meta: { page: number; pageSize: number; total: number };
}

function imgUrl(p?: string | null) {
  return p ? `/api/uploads/${p}` : null;
}

function TileGrid({ rows }: { rows: SettingRow[] }) {
  return (
    <div className="results-grid">
      {rows.map((s) => {
        const img = imgUrl(s.primary_image_card);
        return (
          <Link key={s.uuid} to={`/settings/${s.uuid}`} className="tile">
            <div className="tile-media">
              {img ? <img src={img} alt={s.title} loading="lazy" /> : null}
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
              <div className="tile-author">{s.device_name ?? 'Unknown device'}</div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

export default function HomePage() {
  const top = useQuery({
    queryKey: ['home-featured'],
    queryFn: async () => {
      const res = await fetch('/api/settings?sort=top_rated&pageSize=8', { credentials: 'include' });
      return (await res.json()) as SearchResponse;
    },
  });
  const newest = useQuery({
    queryKey: ['home-newest'],
    queryFn: async () => {
      const res = await fetch('/api/settings?sort=newest&pageSize=12', { credentials: 'include' });
      return (await res.json()) as SearchResponse;
    },
  });

  return (
    <>
      <section className="hero">
        <h1>Community laser recipes, minus the guesswork</h1>
        <p>
          Find proven xTool settings, compare variants, and publish reproducible results with
          attached source data — material, device, laser type, and full parameter history.
        </p>
        <div className="hero-actions">
          <Link className="cta" to="/search">Browse settings</Link>
          <Link className="nav-link" to="/submit">Submit a setting</Link>
        </div>
      </section>

      <div className="section-head">
        <h2>Top rated</h2>
        <Link to="/search?sort=top_rated">View all →</Link>
      </div>
      {top.isLoading ? (
        <p className="hint">Loading…</p>
      ) : top.data && top.data.data.length > 0 ? (
        <TileGrid rows={top.data.data} />
      ) : (
        <div className="empty">No settings yet — be the first to publish one.</div>
      )}

      <div className="section-head">
        <h2>Latest submissions</h2>
        <Link to="/search?sort=newest">View all →</Link>
      </div>
      {newest.isLoading ? (
        <p className="hint">Loading…</p>
      ) : newest.data && newest.data.data.length > 0 ? (
        <TileGrid rows={newest.data.data} />
      ) : (
        <div className="empty">Nothing here yet.</div>
      )}

      <PageBlock title="Why LaserLedger" subtitle="Built for experimentation, moderation, and quality at scale.">
        <div className="grid">
          <div><h2>Strong metadata</h2><p>Device, laser type, material, operation, and parameter-level search.</p></div>
          <div><h2>Image variants</h2><p>Automatic original/card/thumb processing for clean browsing performance.</p></div>
          <div><h2>Moderation workflow</h2><p>Queue review, duplicate detection, and action logging.</p></div>
        </div>
      </PageBlock>
    </>
  );
}

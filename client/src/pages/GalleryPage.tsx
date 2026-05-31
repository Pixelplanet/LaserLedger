import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import PageBlock from '../components/PageBlock';
import { api } from '../lib/api';

interface GalleryImage {
  card_path: string | null;
  thumbnail_path: string | null;
  stored_path: string | null;
  caption: string | null;
}
interface GalleryItem {
  uuid: string;
  title: string;
  power: number | null;
  speed: number | null;
  vote_score: number;
  material_name: string | null;
  device_name: string | null;
  image: GalleryImage | null;
}
interface GalleryResponse {
  items: GalleryItem[];
  page: number;
  limit: number;
  total: number;
}

function imgUrl(p?: string | null) {
  return p ? `/api/uploads/${p}` : null;
}

export default function GalleryPage() {
  const gallery = useQuery({
    queryKey: ['gallery'],
    queryFn: () => api<GalleryResponse>('/gallery', { query: { limit: 36 } }),
  });

  return (
    <PageBlock title="Gallery" subtitle="Browse community results photo-first — every tile is a real engraving or cut.">
      {gallery.isLoading ? (
        <p className="hint">Loading…</p>
      ) : gallery.data && gallery.data.items.length > 0 ? (
        <div className="results-grid">
          {gallery.data.items.map((s) => {
            const img = imgUrl(s.image?.card_path ?? s.image?.thumbnail_path ?? s.image?.stored_path);
            return (
              <Link key={s.uuid} to={`/settings/${s.uuid}`} className="tile">
                <div className="tile-media">
                  {img ? <img src={img} alt={s.title} loading="lazy" /> : null}
                  <div className="tile-stats">
                    <span>▲ {s.vote_score}</span>
                  </div>
                </div>
                <div className="tile-body">
                  <h3 className="tile-title">{s.title}</h3>
                  <div className="tile-meta">
                    {s.material_name && <span className="tag muted">{s.material_name}</span>}
                    {s.device_name && <span className="tag muted">{s.device_name}</span>}
                  </div>
                  {(s.power != null || s.speed != null) && (
                    <div className="tile-author">
                      {s.power != null ? `${s.power}%` : '—'} · {s.speed != null ? `${s.speed} mm/s` : '—'}
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="empty">No result photos yet — attach one when you submit a setting.</div>
      )}
    </PageBlock>
  );
}

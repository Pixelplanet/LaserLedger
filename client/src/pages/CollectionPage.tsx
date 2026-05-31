import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import PageBlock from '../components/PageBlock';
import { api, ApiError } from '../lib/api';
import { useAuthStore } from '../lib/auth-store';
import { Button } from '../components/Button';

interface ItemImage {
  card_path: string | null;
  thumbnail_path: string | null;
  stored_path: string | null;
  caption: string | null;
}
interface CollectionItem {
  uuid: string;
  title: string;
  power: number | null;
  speed: number | null;
  vote_score: number;
  material_name: string | null;
  device_name: string | null;
  image: ItemImage | null;
}
interface CollectionDetail {
  uuid: string;
  name: string;
  description: string | null;
  is_public: boolean;
  created_at: string;
  updated_at: string;
  item_count: number;
  owner: { id: string; display_name: string } | null;
  is_owner: boolean;
  items: CollectionItem[];
}

function imgUrl(p?: string | null) {
  return p ? `/api/uploads/${p}` : null;
}

export default function CollectionPage() {
  const { uuid } = useParams<{ uuid: string }>();
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const isMod = user?.role === 'moderator' || user?.role === 'admin';

  const collection = useQuery({
    queryKey: ['collection', uuid],
    queryFn: () => api<CollectionDetail>(`/collections/${uuid}`),
    enabled: !!uuid,
    retry: false,
  });

  const removeItem = useMutation({
    mutationFn: (settingUuid: string) =>
      api(`/collections/${uuid}/items/${settingUuid}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['collection', uuid] }),
  });

  const unpublish = useMutation({
    mutationFn: () => api(`/mod/collections/${uuid}/unpublish`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['collection', uuid] }),
  });

  if (collection.isLoading) {
    return <PageBlock title="Collection" subtitle="Loading…" />;
  }
  if (collection.isError) {
    return (
      <PageBlock title="Collection not found" subtitle="This collection is private or doesn't exist.">
        <Link className="btn" to="/gallery">Browse the gallery</Link>
        <p className="hint" style={{ marginTop: '0.5rem' }}>
          {collection.error instanceof ApiError ? collection.error.message : ''}
        </p>
      </PageBlock>
    );
  }

  const c = collection.data!;

  return (
    <PageBlock
      title={c.name}
      subtitle={
        c.owner
          ? `Collection by ${c.owner.display_name} · ${c.item_count} ${c.item_count === 1 ? 'setting' : 'settings'}`
          : `${c.item_count} settings`
      }
    >
      {c.description && <p>{c.description}</p>}
      <div className="toolbar" style={{ marginBottom: '0.75rem' }}>
        <span className={`tag ${c.is_public ? 'solid' : 'muted'}`}>{c.is_public ? 'Public' : 'Private'}</span>
        {isMod && c.is_public && (
          <Button
            size="sm"
            variant="danger"
            disabled={unpublish.isPending}
            onClick={() => {
              if (confirm('Unpublish this collection? It will become private.')) unpublish.mutate();
            }}
          >
            Unpublish (mod)
          </Button>
        )}
      </div>

      {c.items.length === 0 ? (
        <div className="empty">This collection is empty.</div>
      ) : (
        <div className="results-grid">
          {c.items.map((s) => {
            const img = imgUrl(s.image?.card_path ?? s.image?.thumbnail_path ?? s.image?.stored_path);
            return (
              <div key={s.uuid} className="tile">
                <Link to={`/settings/${s.uuid}`} className="tile-media">
                  {img ? <img src={img} alt={s.title} loading="lazy" /> : null}
                  <div className="tile-stats">
                    <span>▲ {s.vote_score}</span>
                  </div>
                </Link>
                <div className="tile-body">
                  <Link to={`/settings/${s.uuid}`}>
                    <h3 className="tile-title">{s.title}</h3>
                  </Link>
                  <div className="tile-meta">
                    {s.material_name && <span className="tag muted">{s.material_name}</span>}
                    {s.device_name && <span className="tag muted">{s.device_name}</span>}
                  </div>
                  {c.is_owner && (
                    <button
                      type="button"
                      className="btn sm"
                      disabled={removeItem.isPending}
                      onClick={() => removeItem.mutate(s.uuid)}
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </PageBlock>
  );
}

import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../lib/api';
import { Button } from './Button';

interface CollectionSummary {
  uuid: string;
  name: string;
  description: string | null;
  is_public: boolean;
  item_count?: number;
}

export default function CollectionsManager() {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ['my-collections'],
    queryFn: () => api<CollectionSummary[]>('/collections'),
  });

  const create = useMutation({
    mutationFn: (body: { name: string; is_public: boolean }) =>
      api('/collections', { method: 'POST', body }),
    onSuccess: () => {
      setName('');
      setIsPublic(false);
      setErr(null);
      qc.invalidateQueries({ queryKey: ['my-collections'] });
    },
    onError: (e) => setErr(e instanceof ApiError ? e.message : 'Could not create collection.'),
  });

  const togglePublic = useMutation({
    mutationFn: (c: CollectionSummary) =>
      api(`/collections/${c.uuid}`, {
        method: 'PATCH',
        body: { name: c.name, description: c.description, is_public: !c.is_public },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-collections'] }),
  });

  const remove = useMutation({
    mutationFn: (uuid: string) => api(`/collections/${uuid}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-collections'] }),
  });

  function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    create.mutate({ name: name.trim(), is_public: isPublic });
  }

  return (
    <section style={{ marginTop: '1.5rem' }}>
      <h2>Collections</h2>
      <form className="toolbar" onSubmit={onCreate} style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New collection name"
          maxLength={120}
          aria-label="New collection name"
        />
        <label className="hint" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
          <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
          Public
        </label>
        <Button type="submit" size="sm" variant="primary" disabled={create.isPending}>
          {create.isPending ? 'Creating…' : 'Create'}
        </Button>
      </form>
      {err && <p className="hint" role="alert">{err}</p>}

      {list.isLoading && <p className="hint">Loading collections…</p>}
      {list.data && list.data.length === 0 && <p className="hint">You haven't created any collections yet.</p>}
      {list.data && list.data.length > 0 && (
        <ul className="collection-list">
          {list.data.map((c) => (
            <li key={c.uuid} className="collection-row">
              <Link to={`/collections/${c.uuid}`} className="collection-name">
                {c.name}
              </Link>
              <span className="tag muted">{c.item_count ?? 0} items</span>
              <span className={`tag ${c.is_public ? 'solid' : 'muted'}`}>
                {c.is_public ? 'Public' : 'Private'}
              </span>
              <span className="spacer" style={{ flex: 1 }} />
              <Button size="sm" disabled={togglePublic.isPending} onClick={() => togglePublic.mutate(c)}>
                {c.is_public ? 'Make private' : 'Make public'}
              </Button>
              <Button
                size="sm"
                variant="danger"
                disabled={remove.isPending}
                onClick={() => {
                  if (confirm(`Delete collection "${c.name}"?`)) remove.mutate(c.uuid);
                }}
              >
                Delete
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

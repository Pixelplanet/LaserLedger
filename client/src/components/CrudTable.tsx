import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../lib/api';
import { Button } from './Button';
import { ErrorBlock, LoadingBlock, EmptyState } from './States';

export interface CrudField {
  key: string;
  label: string;
  type?: 'text' | 'number' | 'boolean' | 'textarea';
  required?: boolean;
  placeholder?: string;
}

interface Props<T extends { id: number | string }> {
  endpoint: string;
  queryKey: string;
  fields: CrudField[];
  displayColumns: { key: keyof T & string; label: string }[];
  emptyLabel?: string;
}

export function CrudTable<T extends { id: number | string }>({
  endpoint,
  queryKey,
  fields,
  displayColumns,
  emptyLabel = 'No entries yet.',
}: Props<T>) {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: [queryKey], queryFn: () => api<T[]>(endpoint) });
  const [editing, setEditing] = useState<T | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function refresh() {
    qc.invalidateQueries({ queryKey: [queryKey] });
  }

  const create = useMutation({
    mutationFn: (body: Record<string, unknown>) => api<T>(endpoint, { method: 'POST', body }),
    onSuccess: () => {
      setShowForm(false);
      refresh();
    },
    onError: (e) => setErr(e instanceof ApiError ? e.message : 'Create failed'),
  });
  const update = useMutation({
    mutationFn: ({ id, body }: { id: T['id']; body: Record<string, unknown> }) =>
      api<T>(`${endpoint}/${id}`, { method: 'PATCH', body }),
    onSuccess: () => {
      setEditing(null);
      refresh();
    },
    onError: (e) => setErr(e instanceof ApiError ? e.message : 'Update failed'),
  });
  const remove = useMutation({
    mutationFn: (id: T['id']) => api(`${endpoint}/${id}`, { method: 'DELETE' }),
    onSuccess: refresh,
    onError: (e) => setErr(e instanceof ApiError ? e.message : 'Delete failed'),
  });

  function buildBody(formEl: HTMLFormElement): Record<string, unknown> {
    const fd = new FormData(formEl);
    const body: Record<string, unknown> = {};
    for (const f of fields) {
      const raw = fd.get(f.key);
      if (raw == null || raw === '') {
        if (f.required) continue;
        body[f.key] = null;
        continue;
      }
      if (f.type === 'number') body[f.key] = Number(raw);
      else if (f.type === 'boolean') body[f.key] = raw === 'on' || raw === 'true';
      else body[f.key] = String(raw);
    }
    return body;
  }

  function onCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    create.mutate(buildBody(e.currentTarget));
  }

  function onUpdate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    if (!editing) return;
    update.mutate({ id: editing.id, body: buildBody(e.currentTarget) });
  }

  return (
    <div className="form wide">
      <div className="toolbar">
        <Button variant="primary" size="sm" onClick={() => { setShowForm((v) => !v); setEditing(null); }}>
          {showForm ? 'Cancel' : '+ Add new'}
        </Button>
      </div>

      {err && <ErrorBlock>{err}</ErrorBlock>}

      {showForm && (
        <form className="form" onSubmit={onCreate}>
          {fields.map((f) => (
            <CrudFieldInput key={f.key} field={f} value={undefined} />
          ))}
          <Button type="submit" variant="primary" size="sm" disabled={create.isPending}>
            {create.isPending ? 'Saving…' : 'Create'}
          </Button>
        </form>
      )}

      {list.isLoading && <LoadingBlock />}
      {list.isError && <ErrorBlock>Failed to load.</ErrorBlock>}
      {list.data?.length === 0 && <EmptyState>{emptyLabel}</EmptyState>}

      {list.data && list.data.length > 0 && (
        <table className="table">
          <thead>
            <tr>
              {displayColumns.map((c) => <th key={c.key}>{c.label}</th>)}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {list.data.map((row) => (
              <tr key={String(row.id)}>
                {displayColumns.map((c) => (
                  <td key={c.key}>{String((row as Record<string, unknown>)[c.key] ?? '')}</td>
                ))}
                <td className="row-actions">
                  <Button size="sm" onClick={() => { setEditing(row); setShowForm(false); }}>Edit</Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => {
                      if (confirm('Delete this entry?')) remove.mutate(row.id);
                    }}
                  >
                    Delete
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {editing && (
        <form className="form" onSubmit={onUpdate}>
          <h3>Edit #{String(editing.id)}</h3>
          {fields.map((f) => (
            <CrudFieldInput
              key={f.key}
              field={f}
              value={(editing as Record<string, unknown>)[f.key]}
            />
          ))}
          <div className="toolbar">
            <Button type="submit" variant="primary" size="sm" disabled={update.isPending}>Save</Button>
            <Button type="button" size="sm" onClick={() => setEditing(null)}>Cancel</Button>
          </div>
        </form>
      )}
    </div>
  );
}

function CrudFieldInput({ field, value }: { field: CrudField; value: unknown }) {
  const v = value == null ? '' : String(value);
  if (field.type === 'textarea') {
    return (
      <label>
        {field.label}
        <textarea name={field.key} required={field.required} defaultValue={v} placeholder={field.placeholder} />
      </label>
    );
  }
  if (field.type === 'boolean') {
    return (
      <label className="row" style={{ alignItems: 'center', gap: '0.5rem' }}>
        <input type="checkbox" name={field.key} defaultChecked={!!value} />
        <span>{field.label}</span>
      </label>
    );
  }
  return (
    <label>
      {field.label}
      <input
        type={field.type === 'number' ? 'number' : 'text'}
        name={field.key}
        required={field.required}
        defaultValue={v}
        placeholder={field.placeholder}
      />
    </label>
  );
}

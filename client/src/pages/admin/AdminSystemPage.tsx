import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import PageBlock from '../../components/PageBlock';
import { api, ApiError } from '../../lib/api';
import { Button } from '../../components/Button';
import { ErrorBlock, LoadingBlock } from '../../components/States';

interface SystemSetting {
  key: string;
  value: string;
  description: string | null;
  category: string | null;
}

export default function AdminSystemPage() {
  const qc = useQueryClient();
  const [err, setErr] = useState<string | null>(null);
  const list = useQuery({ queryKey: ['admin-system'], queryFn: () => api<SystemSetting[]>('/admin/system-settings') });

  const update = useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) =>
      api(`/admin/system-settings/${key}`, { method: 'PATCH', body: { value } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-system'] }),
    onError: (e) => setErr(e instanceof ApiError ? e.message : 'Update failed'),
  });

  function onSave(key: string, e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    const fd = new FormData(e.currentTarget);
    update.mutate({ key, value: String(fd.get('value') ?? '') });
  }

  return (
    <PageBlock title="System settings" subtitle="Tunable runtime configuration.">
      {err && <ErrorBlock>{err}</ErrorBlock>}
      {list.isLoading && <LoadingBlock />}
      {list.data && (
        <div className="form wide">
          {list.data.map((s) => (
            <form key={s.key} className="form" onSubmit={(e) => onSave(s.key, e)} style={{ borderBottom: '1px solid var(--border)', paddingBottom: '0.6rem' }}>
              <label>
                <strong>{s.key}</strong>
                {s.description && <span className="hint"> — {s.description}</span>}
                <input name="value" defaultValue={s.value} />
              </label>
              <Button type="submit" size="sm" variant="primary" disabled={update.isPending}>Save</Button>
            </form>
          ))}
        </div>
      )}
    </PageBlock>
  );
}

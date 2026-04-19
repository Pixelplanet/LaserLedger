import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import PageBlock from '../../components/PageBlock';
import { api, ApiError } from '../../lib/api';
import { Button } from '../../components/Button';
import { ErrorBlock, LoadingBlock } from '../../components/States';
import { useState } from 'react';

interface UserRow {
  id: string;
  email: string;
  display_name: string;
  role: 'user' | 'moderator' | 'admin';
  email_verified: boolean;
  submission_count: number;
  reputation: number;
  created_at: string;
  last_login_at: string | null;
}

const ROLES = ['user', 'moderator', 'admin'] as const;

export default function AdminUsersPage() {
  const qc = useQueryClient();
  const [err, setErr] = useState<string | null>(null);
  const users = useQuery({ queryKey: ['admin-users'], queryFn: () => api<UserRow[]>('/admin/users') });

  const update = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) =>
      api(`/admin/users/${id}`, { method: 'PATCH', body: { role } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
    onError: (e) => setErr(e instanceof ApiError ? e.message : 'Update failed'),
  });

  return (
    <PageBlock title="Users" subtitle="Promote moderators, demote bad actors.">
      {err && <ErrorBlock>{err}</ErrorBlock>}
      {users.isLoading && <LoadingBlock />}
      {users.data && (
        <table className="table">
          <thead>
            <tr>
              <th>Display name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Subs</th>
              <th>Rep</th>
              <th>Joined</th>
              <th>Last login</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.data.map((u) => (
              <tr key={u.id}>
                <td>{u.display_name}</td>
                <td>{u.email}{!u.email_verified && <span className="tag warn">unverified</span>}</td>
                <td>
                  <select
                    defaultValue={u.role}
                    onChange={(e) => update.mutate({ id: u.id, role: e.target.value })}
                  >
                    {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </td>
                <td>{u.submission_count}</td>
                <td>{u.reputation}</td>
                <td>{new Date(u.created_at).toLocaleDateString()}</td>
                <td>{u.last_login_at ? new Date(u.last_login_at).toLocaleDateString() : '—'}</td>
                <td>
                  <Button size="sm" onClick={() => window.open(`/profile/${u.id}`, '_blank')}>View</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </PageBlock>
  );
}

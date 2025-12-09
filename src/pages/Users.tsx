import React from 'react';
import { Button, Dialog, DialogBody, DialogContent, DialogSurface, DialogTitle, DialogTrigger, Input, Label, Spinner, Switch, Textarea, tokens } from '@fluentui/react-components';
import { useApi, User } from '../apiClient';

type UserCreate = {
  entra_object_id: string;
  upn: string;
  display_name: string;
  email: string;
  time_zone?: string;
};

type UserUpdate = Partial<{
  display_name: string;
  email: string;
  time_zone: string;
  is_active: boolean;
}>;

export default function UsersPage() {
  const api = useApi();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [users, setUsers] = React.useState<User[]>([]);
  const [query, setQuery] = React.useState('');
  const [onlyActive, setOnlyActive] = React.useState(true);

  const [createOpen, setCreateOpen] = React.useState(false);
  const [editUser, setEditUser] = React.useState<User | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (onlyActive) params.set('is_active', 'true');
      if (query) params.set('q', query);
      const data = await api.get<User[]>(`/api/v1/users${params.toString() ? `?${params.toString()}` : ''}`);
      setUsers(data);
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [api, onlyActive, query]);

  React.useEffect(() => { load(); }, [load]);

  return (
    <div>
      <h2>Users</h2>
      <div style={{ display: 'flex', gap: 12, alignItems: 'end', marginBottom: 12 }}>
        <div>
          <Label htmlFor="search">Search</Label>
          <Input id="search" value={query} onChange={(_, d) => setQuery(d.value)} placeholder="name, upn, email" />
        </div>
        <div>
          <Label htmlFor="active">Active Only</Label>
          <div>
            <Switch id="active" checked={onlyActive} onChange={(_, d) => setOnlyActive(!!d.checked)} />
          </div>
        </div>
        <Button onClick={load}>Refresh</Button>
        <Dialog open={createOpen} onOpenChange={(_, data) => setCreateOpen(!!data.open)}>
          <DialogTrigger>
            <Button appearance="primary" onClick={() => setCreateOpen(true)}>New User</Button>
          </DialogTrigger>
          <UserCreateDialog onCreated={() => { setCreateOpen(false); load(); }} onCancel={() => setCreateOpen(false)} />
        </Dialog>
      </div>
      {loading && <Spinner label="Loading users..." />}
      {error && <div style={{ color: tokens.colorPaletteRedForeground3, marginBottom: 8 }}>{error}</div>}
      {!loading && (
        <div style={{ overflowX: 'auto', border: `1px solid ${tokens.colorNeutralStroke2}`, borderRadius: 8, padding: 12, background: 'transparent' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'transparent' }}>
            <thead>
              <tr>
                <th style={th}>Name</th>
                <th style={th}>UPN</th>
                <th style={th}>Email</th>
                <th style={th}>Time Zone</th>
                <th style={th}>Active</th>
                <th style={th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.user_id}>
                  <td style={td}>{u.display_name}</td>
                  <td style={td}>{u.upn}</td>
                  <td style={td}>{u.email}</td>
                  <td style={td}>{u.time_zone || ''}</td>
                  <td style={td}>{u.is_active ? 'Yes' : 'No'}</td>
                  <td style={td}>
                    <Button size="small" onClick={() => setEditUser(u)}>Edit</Button>{' '}
                    {u.is_active ? (
                      <Button size="small" appearance="secondary" onClick={async () => { await api.post<User>(`/api/v1/users/${u.user_id}/deactivate`); load(); }}>Deactivate</Button>
                    ) : (
                      <Button size="small" appearance="primary" onClick={async () => { await api.post<User>(`/api/v1/users/${u.user_id}/activate`); load(); }}>Activate</Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={!!editUser} onOpenChange={(_, d) => setEditUser(d.open ? editUser : null)}>
        {editUser && (
          <UserEditDialog user={editUser} onSaved={() => { setEditUser(null); load(); }} onCancel={() => setEditUser(null)} />
        )}
      </Dialog>
    </div>
  );
}

const th: React.CSSProperties = { textAlign: 'left', borderBottom: `1px solid ${tokens.colorNeutralStroke2}`, padding: 8, color: tokens.colorNeutralForeground2 } as any;
const td: React.CSSProperties = { borderBottom: `1px solid ${tokens.colorNeutralStroke1}`, padding: 8 } as any;

function UserCreateDialog({ onCreated, onCancel }: { onCreated: () => void; onCancel: () => void; }) {
  const api = useApi();
  const [model, setModel] = React.useState<UserCreate>({ entra_object_id: '', upn: '', display_name: '', email: '', time_zone: 'America/Chicago' });
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function submit() {
    setBusy(true); setError(null);
    try {
      // minimal validation
      if (!model.entra_object_id || !model.upn || !model.display_name || !model.email) throw new Error('All fields are required');
      await api.post<User>('/api/v1/users', model);
      onCreated();
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <DialogSurface style={{ maxWidth: 520 }}>
      <DialogBody>
        <DialogTitle>New User</DialogTitle>
        <DialogContent>
          {error && <div style={{ color: tokens.colorPaletteRedForeground3, marginBottom: 8 }}>{error}</div>}
          <div style={{ display: 'grid', gap: 10 }}>
            <div>
              <Label>Entra Object Id (GUID)</Label>
              <Input value={model.entra_object_id} onChange={(_, d) => setModel({ ...model, entra_object_id: d.value })} placeholder="00000000-0000-0000-0000-000000000000"/>
            </div>
            <div>
              <Label>UPN</Label>
              <Input value={model.upn} onChange={(_, d) => setModel({ ...model, upn: d.value })} placeholder="user@domain.com" />
            </div>
            <div>
              <Label>Display Name</Label>
              <Input value={model.display_name} onChange={(_, d) => setModel({ ...model, display_name: d.value })} placeholder="Full name"/>
            </div>
            <div>
              <Label>Email</Label>
              <Input value={model.email} onChange={(_, d) => setModel({ ...model, email: d.value })} placeholder="user@domain.com"/>
            </div>
            <div>
              <Label>Time Zone (IANA)</Label>
              <Input value={model.time_zone} onChange={(_, d) => setModel({ ...model, time_zone: d.value })} placeholder="e.g., America/Chicago"/>
            </div>
          </div>
        </DialogContent>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
          <Button appearance="secondary" onClick={onCancel} disabled={busy}>Cancel</Button>
          <Button appearance="primary" onClick={submit} disabled={busy}>{busy ? 'Saving...' : 'Create'}</Button>
        </div>
      </DialogBody>
    </DialogSurface>
  );
}

function UserEditDialog({ user, onSaved, onCancel }: { user: User; onSaved: () => void; onCancel: () => void; }) {
  const api = useApi();
  const [model, setModel] = React.useState<UserUpdate>({
    display_name: user.display_name,
    email: user.email,
    time_zone: user.time_zone || undefined,
    is_active: user.is_active,
  });
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function submit() {
    setBusy(true); setError(null);
    try {
      await api.patch<User>(`/api/v1/users/${user.user_id}`, model);
      onSaved();
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <DialogSurface>
      <DialogBody>
        <DialogTitle>Edit User</DialogTitle>
        <DialogContent>
          {error && <div style={{ color: tokens.colorPaletteRedForeground3, marginBottom: 8 }}>{error}</div>}
          <Label>Display Name</Label>
          <Input value={model.display_name || ''} onChange={(_, d) => setModel({ ...model, display_name: d.value })} />
          <Label>Email</Label>
          <Input value={model.email || ''} onChange={(_, d) => setModel({ ...model, email: d.value })} />
          <Label>Time Zone (IANA)</Label>
          <Input value={model.time_zone || ''} onChange={(_, d) => setModel({ ...model, time_zone: d.value })} />
          <Label>Active</Label>
          <div>
            <Switch checked={!!model.is_active} onChange={(_, d) => setModel({ ...model, is_active: !!d.checked })} />
          </div>
        </DialogContent>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
          <Button appearance="secondary" onClick={onCancel} disabled={busy}>Cancel</Button>
          <Button appearance="primary" onClick={submit} disabled={busy}>{busy ? 'Saving...' : 'Save'}</Button>
        </div>
      </DialogBody>
    </DialogSurface>
  );
}

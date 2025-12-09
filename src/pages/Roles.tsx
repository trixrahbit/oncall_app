import React from 'react';
import { Button, Checkbox, Input, Label, Spinner, tokens } from '@fluentui/react-components';
import { useApi, User } from '../apiClient';

export default function RolesPage() {
  const api = useApi();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [users, setUsers] = React.useState<User[]>([]);
  const [admins, setAdmins] = React.useState<Set<string>>(new Set());
  const [q, setQ] = React.useState('');

  const load = React.useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [us, adminIds] = await Promise.all([
        api.get<User[]>(`/api/v1/users?is_active=true`),
        api.get<string[]>(`/api/v1/roles/admins`),
      ]);
      setUsers(us);
      setAdmins(new Set(adminIds));
    } catch (e: any) {
      setError(e.message || String(e));
    } finally { setLoading(false); }
  }, [api]);

  React.useEffect(() => { load(); }, [load]);

  const toggleAdmin = async (userId: string, makeAdmin: boolean) => {
    setError(null);
    try {
      if (makeAdmin) {
        await api.post(`/api/v1/roles/admins/${userId}`);
        setAdmins(prev => new Set(prev).add(userId));
      } else {
        await api.delete(`/api/v1/roles/admins/${userId}`);
        setAdmins(prev => { const s = new Set(prev); s.delete(userId); return s; });
      }
    } catch (e: any) {
      setError(e.message || String(e));
    }
  };

  const filtered = React.useMemo(() => {
    if (!q) return users;
    const qq = q.toLowerCase();
    return users.filter(u =>
      (u.display_name && u.display_name.toLowerCase().includes(qq)) ||
      (u.upn && u.upn.toLowerCase().includes(qq)) ||
      (u.email && u.email.toLowerCase().includes(qq))
    );
  }, [users, q]);

  return (
    <div>
      <h2>Roles</h2>
      <div style={{ color: tokens.colorNeutralForeground3, marginBottom: 12 }}>
        Admin-only area. Assign the Admin role to users. All other users are "User" (view-only) but can resolve incidents.
      </div>
      {error && <div style={{ color: tokens.colorPaletteRedForeground3, marginBottom: 8 }}>{error}</div>}
      {loading && <Spinner label="Loading users..." />}
      {!loading && (
        <div style={{
          padding: 16,
          border: `1px solid ${tokens.colorNeutralStroke2}`,
          borderRadius: 8,
          background: 'transparent',
        }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'end', marginBottom: 12 }}>
            <div style={{ minWidth: 280 }}>
              <Label>Search users</Label>
              <Input value={q} onChange={(_, d) => setQ(d.value)} placeholder="Name, UPN, or email" />
            </div>
            <Button onClick={load}>Refresh</Button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>Display Name</th>
                  <th style={th}>UPN</th>
                  <th style={th}>Email</th>
                  <th style={th}>Admin</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(u => (
                  <tr key={u.user_id}>
                    <td style={td}>{u.display_name}</td>
                    <td style={td}>{u.upn}</td>
                    <td style={td}>{u.email}</td>
                    <td style={td}>
                      <Checkbox checked={admins.has(u.user_id)}
                                onChange={(_, d) => toggleAdmin(u.user_id, !!d.checked)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

const th: React.CSSProperties = { textAlign: 'left', borderBottom: `1px solid ${tokens.colorNeutralStroke2}`, padding: 8, color: tokens.colorNeutralForeground2 } as any;
const td: React.CSSProperties = { borderBottom: `1px solid ${tokens.colorNeutralStroke1}`, padding: 8 } as any;

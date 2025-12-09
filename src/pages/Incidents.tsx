import React from 'react';
import { Button, Input, Label, Select, Spinner, tokens } from '@fluentui/react-components';
import { EffectiveAssignment, Rotation, User, WhoAmI, Incident, IncidentCreate, useApi } from '../apiClient';

// Using backend Incident type

export default function IncidentsPage() {
  const api = useApi();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [users, setUsers] = React.useState<User[]>([]);
  const [rotations, setRotations] = React.useState<Rotation[]>([]);
  const [incidents, setIncidents] = React.useState<Incident[]>([]);
  const [isAdmin, setIsAdmin] = React.useState(false);

  const [title, setTitle] = React.useState('');
  const [rotationId, setRotationId] = React.useState('');
  const [creating, setCreating] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [us, ro, incs] = await Promise.all([
        api.get<User[]>(`/api/v1/users?is_active=true`),
        api.get<Rotation[]>(`/api/v1/rotations?is_active=true`),
        api.get<Incident[]>(`/api/v1/incidents`),
      ]);
      setUsers(us);
      setRotations(ro);
      setIncidents(incs);
      if (!rotationId && ro.length) setRotationId(ro[0].rotation_id);
    } catch (e: any) { setError(e.message || String(e)); } finally { setLoading(false); }
  }, [api, rotationId]);

  React.useEffect(() => { load(); }, [load]);
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await api.get<WhoAmI>('/whoami');
        if (!cancelled) setIsAdmin(!!me.is_admin);
      } catch {
        if (!cancelled) setIsAdmin(false);
      }
    })();
    return () => { cancelled = true; };
  }, [api]);

  async function createIncident() {
    if (!title || !rotationId) return;
    setCreating(true);
    try {
      const now = new Date();
      const params = new URLSearchParams();
      params.set('start_utc', new Date(now.getTime() - 1).toISOString());
      params.set('end_utc', new Date(now.getTime() + 1).toISOString());
      params.set('rotation_id', rotationId);
      const rows = await api.get<EffectiveAssignment[]>(`/api/v1/effective_schedule?${params.toString()}`);
      const row = rows.find(r => new Date(r.start_utc) <= now && new Date(r.end_utc) >= now);
      const assigned_user_id = row?.primary_user_id || null;
      const payload: IncidentCreate = { title, rotation_id: rotationId, assigned_user_id };
      const created = await api.post<Incident>(`/api/v1/incidents`, payload);
      setIncidents(prev => [created, ...prev]);
      setTitle('');
    } catch (e: any) {
      setError(e.message || String(e));
    } finally { setCreating(false); }
  }

  async function resolveIncident(id: string) {
    try {
      const updated = await api.post<Incident>(`/api/v1/incidents/${id}/resolve`);
      setIncidents(prev => prev.map(i => i.incident_id === id ? updated : i));
    } catch (e: any) {
      setError(e.message || String(e));
    }
  }

  return (
    <div>
      <h2>Incidents</h2>
      {error && <div style={{ color: tokens.colorPaletteRedForeground3, marginBottom: 8 }}>{error}</div>}
      {loading && <Spinner label="Loading..." />}
      {!loading && (
        <>
          {isAdmin && (
            <div style={{ display: 'flex', gap: 12, alignItems: 'end', marginBottom: 12 }}>
              <div style={{ minWidth: 260 }}>
                <Label>Title</Label>
                <Input value={title} onChange={(_, d) => setTitle(d.value)} placeholder="Short incident title" />
              </div>
              <div>
                <Label>Rotation</Label>
                <Select value={rotationId} onChange={(_, d) => setRotationId(d.value)}>
                  {rotations.map(r => <option key={r.rotation_id} value={r.rotation_id}>{r.name}</option>)}
                </Select>
              </div>
              <Button appearance="primary" onClick={createIncident} disabled={!title || !rotationId || creating}>{creating ? 'Creating...' : 'Create Incident'}</Button>
            </div>
          )}
          <div style={{ overflowX: 'auto', border: `1px solid ${tokens.colorNeutralStroke2}`, borderRadius: 8, padding: 12 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'transparent' }}>
              <thead>
                <tr>
                  <th style={th}>ID</th>
                  <th style={th}>Title</th>
                  <th style={th}>Created</th>
                  <th style={th}>Rotation</th>
                  <th style={th}>Assigned User</th>
                  <th style={th}>Status</th>
                  <th style={th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {incidents.map(i => {
                  const rot = rotations.find(r => r.rotation_id === i.rotation_id);
                  const user = users.find(u => u.user_id === i.assigned_user_id);
                  return (
                    <tr key={i.incident_id}>
                      <td style={td}>{i.incident_id}</td>
                      <td style={td}>{i.title}</td>
                      <td style={td}>{fmt(i.created_at)}</td>
                      <td style={td}>{rot?.name || i.rotation_id}</td>
                      <td style={td}>{user ? user.display_name : (i.assigned_user_id ? i.assigned_user_id : '(unassigned)')}</td>
                      <td style={td}>{i.resolved_at ? `Resolved ${fmt(i.resolved_at)}` : 'Open'}</td>
                      <td style={td}>
                        {!i.resolved_at && (
                          <Button size="small" onClick={() => resolveIncident(i.incident_id)}>Resolve</Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function fmt(iso: string) {
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

const th: React.CSSProperties = { textAlign: 'left', borderBottom: `1px solid ${tokens.colorNeutralStroke2}`, padding: 8, color: tokens.colorNeutralForeground2 } as any;
const td: React.CSSProperties = { borderBottom: `1px solid ${tokens.colorNeutralStroke1}`, padding: 8 } as any;

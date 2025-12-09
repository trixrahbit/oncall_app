import React from 'react';
import { Button, Input, Label, Select, Spinner, tokens } from '@fluentui/react-components';
import { EffectiveAssignment, Rotation, User, WhoAmI } from '../apiClient';
import { useApi } from '../apiClient';

export default function MySchedulePage() {
  const api = useApi();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [me, setMe] = React.useState<WhoAmI | null>(null);
  const [users, setUsers] = React.useState<User[]>([]);
  const [rotations, setRotations] = React.useState<Rotation[]>([]);
  const [schedule, setSchedule] = React.useState<EffectiveAssignment[]>([]);

  const [start, setStart] = React.useState<string>(() => toLocalInputValue(new Date()));
  const [end, setEnd] = React.useState<string>(() => toLocalInputValue(addDays(new Date(), 30)));
  const [rotationId, setRotationId] = React.useState<string>('');

  const load = React.useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [who, us, ro] = await Promise.all([
        api.get<WhoAmI>(`/whoami`),
        api.get<User[]>(`/api/v1/users?is_active=true`),
        api.get<Rotation[]>(`/api/v1/rotations?is_active=true`),
      ]);
      setMe(who);
      setUsers(us);
      setRotations(ro);
    } catch (e: any) {
      setError(e.message || String(e));
    } finally { setLoading(false); }
  }, [api]);

  const loadSchedule = React.useCallback(async () => {
    if (!start || !end) return;
    try {
      const params = new URLSearchParams();
      params.set('start_utc', new Date(start).toISOString());
      params.set('end_utc', new Date(end).toISOString());
      if (rotationId) params.set('rotation_id', rotationId);
      const rows = await api.get<EffectiveAssignment[]>(`/api/v1/effective_schedule?${params.toString()}`);
      setSchedule(rows);
    } catch (e) {
      console.error(e);
    }
  }, [api, start, end, rotationId]);

  React.useEffect(() => { load(); }, [load]);
  React.useEffect(() => { loadSchedule(); }, [loadSchedule]);

  const currentUser = React.useMemo(() => {
    if (!me?.upn) return null;
    return users.find(u => (u.upn || '').toLowerCase() === me.upn!.toLowerCase()) || null;
  }, [me, users]);

  const myRows = React.useMemo(() => {
    if (!currentUser) return [] as EffectiveAssignment[];
    return schedule.filter(r => r.primary_user_id === currentUser.user_id || r.secondary_user_id === currentUser.user_id);
  }, [schedule, currentUser]);

  return (
    <div>
      <h2>My Schedule</h2>
      {error && <div style={{ color: tokens.colorPaletteRedForeground3, marginBottom: 8 }}>{error}</div>}
      {loading && <Spinner label="Loading..." />}
      {!loading && (
        <>
          <div style={{ display: 'flex', gap: 12, alignItems: 'end', marginBottom: 12 }}>
            <div>
              <Label>Start</Label>
              <Input type="datetime-local" value={start} onChange={(_, d) => setStart(d.value)} />
            </div>
            <div>
              <Label>End</Label>
              <Input type="datetime-local" value={end} onChange={(_, d) => setEnd(d.value)} />
            </div>
            <div>
              <Label>Rotation</Label>
              <Select value={rotationId} onChange={(_, d) => setRotationId(d.value)}>
                <option value="">(all)</option>
                {rotations.map(r => <option key={r.rotation_id} value={r.rotation_id}>{r.name}</option>)}
              </Select>
            </div>
            <Button onClick={loadSchedule}>Refresh</Button>
          </div>
          <div style={{ overflowX: 'auto', border: `1px solid ${tokens.colorNeutralStroke2}`, borderRadius: 8, padding: 12 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'transparent' }}>
              <thead>
                <tr>
                  <th style={th}>Rotation</th>
                  <th style={th}>Start</th>
                  <th style={th}>End</th>
                  <th style={th}>Role</th>
                </tr>
              </thead>
              <tbody>
                {myRows.map((r, idx) => {
                  const rot = rotations.find(x => x.rotation_id === r.rotation_id);
                  const role = r.primary_user_id === currentUser?.user_id ? 'Primary' : 'Secondary';
                  return (
                    <tr key={`${r.period_id}-${idx}`}>
                      <td style={td}>{rot?.name || r.rotation_id}</td>
                      <td style={td}>{fmt(r.start_utc)}</td>
                      <td style={td}>{fmt(r.end_utc)}</td>
                      <td style={{ ...td, fontWeight: 600 }}>{role}</td>
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

function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function toLocalInputValue(dateOrIso: string | Date) {
  const d = typeof dateOrIso === 'string' ? new Date(dateOrIso) : dateOrIso;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fmt(iso: string) {
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

const th: React.CSSProperties = { textAlign: 'left', borderBottom: `1px solid ${tokens.colorNeutralStroke2}`, padding: 8, color: tokens.colorNeutralForeground2 } as any;
const td: React.CSSProperties = { borderBottom: `1px solid ${tokens.colorNeutralStroke1}`, padding: 8 } as any;

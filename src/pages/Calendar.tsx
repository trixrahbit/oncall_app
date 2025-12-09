import React from 'react';
import { Button, Dialog, DialogBody, DialogContent, DialogSurface, DialogTitle, DialogTrigger, Input, Label, Select, Spinner, Textarea, tokens } from '@fluentui/react-components';
import FullCalendar from '@fullcalendar/react';
import interactionPlugin from '@fullcalendar/interaction';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import luxonPlugin from '@fullcalendar/luxon3';
import { Assignment, Period, Rotation, RotationMember, User, PeriodTemplate, GlobalSettings } from '../apiClient';
import { useApi } from '../apiClient';

type RotationCreate = {
  name: string;
  description?: string | null;
  time_zone: string;
  period_length_days: number;
  start_date_utc: string; // ISO
};

export default function CalendarPage() {
  const api = useApi();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [users, setUsers] = React.useState<User[]>([]);
  const [rotations, setRotations] = React.useState<Rotation[]>([]);
  const [selectedRotationId, setSelectedRotationId] = React.useState<string>('');
  const [periods, setPeriods] = React.useState<Period[]>([]);
  const [assignments, setAssignments] = React.useState<Record<string, Assignment[]>>({}); // key: period_id
  const [templates, setTemplates] = React.useState<PeriodTemplate[]>([]);
  const [tplLoading, setTplLoading] = React.useState(false);
  const [tplError, setTplError] = React.useState<string | null>(null);
  const [gSettings, setGSettings] = React.useState<GlobalSettings | null>(null);

  const [createRotOpen, setCreateRotOpen] = React.useState(false);
  const [genStart, setGenStart] = React.useState<string>('');
  const [genEnd, setGenEnd] = React.useState<string>('');
  const [busy, setBusy] = React.useState(false);
  const [syncBusy, setSyncBusy] = React.useState(false);

  // Interactive calendar dialogs state
  const [qcState, setQcState] = React.useState<QuickCreateState>({ open: false, start: '', end: '', name: 'On-Call', primaryUserId: '', secondaryUserId: '' });
  const [editState, setEditState] = React.useState<EditState>({ open: false, period: null, name: '', is_locked: false });

  const load = React.useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [u, r, gs] = await Promise.all([
        api.get<User[]>(`/api/v1/users?is_active=true`),
        api.get<Rotation[]>(`/api/v1/rotations?is_active=true`),
        api.get<GlobalSettings>(`/api/v1/settings`).catch(() => null as any),
      ]);
      setUsers(u);
      setRotations(r);
      if (!selectedRotationId && r.length) setSelectedRotationId(r[0].rotation_id);
      if (gs) setGSettings(gs);
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [api, selectedRotationId]);

  const loadPeriods = React.useCallback(async (rotationId: string) => {
    if (!rotationId) { setPeriods([]); return; }
    try {
      const ps = await api.get<Period[]>(`/api/v1/periods?rotation_id=${rotationId}`);
      setPeriods(ps);
      // load assignments per period
      const map: Record<string, Assignment[]> = {};
      for (const p of ps) {
        try {
          map[p.period_id] = await api.get<Assignment[]>(`/api/v1/periods/${p.period_id}/assignments`);
        } catch {
          map[p.period_id] = [];
        }
      }
      setAssignments(map);
    } catch (e: any) {
      setError(e.message || String(e));
    }
  }, [api]);

  React.useEffect(() => { load(); }, [load]);
  React.useEffect(() => { if (selectedRotationId) loadPeriods(selectedRotationId); }, [selectedRotationId, loadPeriods]);
  React.useEffect(() => { if (selectedRotationId) loadTemplates(selectedRotationId); }, [selectedRotationId]);
  // periodic refresh to reflect background sync (every 5 minutes)
  React.useEffect(() => {
    const id = setInterval(() => {
      if (selectedRotationId) loadPeriods(selectedRotationId);
    }, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [selectedRotationId, loadPeriods]);

  async function generate() {
    if (!selectedRotationId || !genStart || !genEnd) return;
    setBusy(true); setError(null);
    try {
      await api.post<Period[]>(`/api/v1/rotations/${selectedRotationId}/generate_periods`, {
        start_utc: new Date(genStart).toISOString(),
        end_utc: new Date(genEnd).toISOString(),
        name_template: 'On-Call {start:%Y-%m-%d} – {end:%Y-%m-%d}',
      });
      await loadPeriods(selectedRotationId);
    } catch (e: any) {
      setError(e.message || String(e));
    } finally { setBusy(false); }
  }

  const loadTemplates = React.useCallback(async (rotationId: string) => {
    if (!rotationId) { setTemplates([]); return; }
    setTplLoading(true); setTplError(null);
    try {
      const res = await api.get<PeriodTemplate[]>(`/api/v1/rotations/${rotationId}/templates`);
      setTemplates(res);
    } catch (e: any) {
      setTplError(e.message || String(e));
    } finally { setTplLoading(false); }
  }, [api]);

  function userColor(uid?: string | null): string {
    if (!uid) return '#8A8886';
    // Simple stable hash to HSL color
    let h = 0; for (let i = 0; i < uid.length; i++) h = (h * 31 + uid.charCodeAt(i)) >>> 0;
    const hue = h % 360; return `hsl(${hue}, 60%, 55%)`;
  }

  const calendarEvents = React.useMemo(() => {
    // Map periods + assignments to FullCalendar events
    return periods.map(p => {
      const as = assignments[p.period_id] || [];
      const prim = as.find(a => a.role === 'primary');
      const sec = as.find(a => a.role === 'secondary');
      const titleText = [p.name, [prim && users.find(u => u.user_id === prim.user_id)?.display_name, sec && users.find(u => u.user_id === sec.user_id)?.display_name].filter(Boolean).join(' & ')].filter(Boolean).join(' — ');
      const title = `${p.is_locked ? '🔒 ' : ''}${titleText}`;
      return {
        id: p.period_id,
        title,
        start: p.start_utc,
        end: p.end_utc,
        backgroundColor: userColor(prim?.user_id),
        borderColor: userColor(prim?.user_id),
        editable: !p.is_locked,
        extendedProps: {
          is_locked: p.is_locked,
          rotation_id: p.rotation_id,
        },
      } as any;
    });
  }, [periods, assignments, users]);

  async function syncNow() {
    if (!selectedRotationId) return;
    setSyncBusy(true); setError(null);
    try {
      // determine window based on currently loaded periods, fallback to +/- 90d
      const starts = periods.map(p => new Date(p.start_utc).getTime());
      const ends = periods.map(p => new Date(p.end_utc).getTime());
      const minStart = starts.length ? new Date(Math.min(...starts)) : new Date(Date.now() - 30 * 24 * 3600 * 1000);
      const maxEnd = ends.length ? new Date(Math.max(...ends)) : new Date(Date.now() + 90 * 24 * 3600 * 1000);
      await api.post(`/api/v1/calendar/sync`, {
        rotation_id: selectedRotationId,
        start_utc: minStart.toISOString(),
        end_utc: maxEnd.toISOString(),
      });
      await loadPeriods(selectedRotationId);
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setSyncBusy(false);
    }
  }

  return (
    <div>
      <h2>Calendar</h2>
      {error && <div style={{ color: tokens.colorPaletteRedForeground3, marginBottom: 8 }}>{error}</div>}
      {loading && <Spinner label="Loading..." />}
      {!loading && (
        <>
          <div style={{ display: 'flex', gap: 12, alignItems: 'end', marginBottom: 12 }}>
            <div>
              <Label htmlFor="rot">Rotation</Label>
              <Select id="rot" value={selectedRotationId} onChange={(_, d) => setSelectedRotationId(d.value)}>
                {rotations.map(r => (
                  <option value={r.rotation_id} key={r.rotation_id}>{r.name}</option>
                ))}
              </Select>
            </div>
            <Dialog open={createRotOpen} onOpenChange={(_, d) => setCreateRotOpen(!!d.open)}>
              <DialogTrigger>
                <Button appearance="primary" onClick={() => setCreateRotOpen(true)}>New Rotation</Button>
              </DialogTrigger>
              <RotationCreateDialog
                users={users}
                defaultTimeZone={gSettings?.default_time_zone || 'America/Chicago'}
                onCreated={() => { setCreateRotOpen(false); load(); }}
                onCancel={() => setCreateRotOpen(false)}
              />
            </Dialog>
            <Dialog>
              <DialogTrigger>
                <Button onClick={() => { /* open handled internally */ }}>New Period(s)</Button>
              </DialogTrigger>
              <NewPeriodDialog
                rotationId={selectedRotationId}
                users={users}
                onCreated={() => loadPeriods(selectedRotationId)}
              />
            </Dialog>
            <div style={{ marginLeft: 'auto' }}>
              <Label>Generate schedule</Label>
              <div style={{ display: 'flex', gap: 8 }}>
                <Input type="datetime-local" value={genStart} onChange={(_, d) => setGenStart(d.value)} />
                <Input type="datetime-local" value={genEnd} onChange={(_, d) => setGenEnd(d.value)} />
                <Button onClick={generate} disabled={!selectedRotationId || !genStart || !genEnd || busy}>{busy ? 'Generating...' : 'Generate'}</Button>
              </div>
            </div>
            <div>
              <Label>&nbsp;</Label>
              <div>
                <Button appearance="primary" onClick={syncNow} disabled={!selectedRotationId || syncBusy}>{syncBusy ? 'Syncing…' : 'Sync with OnCallCalendar'}</Button>
              </div>
            </div>
          </div>
          {/* Calendar view */}
          <div style={{ border: `1px solid ${tokens.colorNeutralStroke2}`, borderRadius: 8, padding: 8, marginBottom: 12 }}>
            <FullCalendar
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, luxonPlugin]}
              initialView="dayGridMonth"
              headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay' }}
              events={calendarEvents}
              timeZone={gSettings?.default_time_zone || 'local'}
              firstDay={gSettings?.week_start ?? 0}
              slotLabelFormat={{ hour: '2-digit', minute: '2-digit', hour12: !(gSettings?.use_24h) }}
              eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: !(gSettings?.use_24h) }}
              selectable={true}
              selectMirror={true}
              editable={true}
              eventOverlap={true}
              select={async (selInfo: any) => {
                // Open quick create dialog with selection times
                setQcState({
                  open: true,
                  start: selInfo.startStr,
                  end: selInfo.endStr,
                  name: 'On-Call',
                  primaryUserId: '',
                  secondaryUserId: '',
                });
              }}
              eventAllow={(dropInfo: any, draggedEvent: any) => {
                // Prevent moving/resizing locked events
                return !draggedEvent.extendedProps?.is_locked;
              }}
              eventDrop={async (info: any) => {
                try {
                  await api.patch(`/api/v1/periods/${info.event.id}`, {
                    start_utc: info.event.start?.toISOString(),
                    end_utc: info.event.end?.toISOString(),
                  });
                  await loadPeriods(selectedRotationId);
                } catch (e: any) {
                  info.revert();
                  setError(e.message || String(e));
                }
              }}
              eventResize={async (info: any) => {
                try {
                  await api.patch(`/api/v1/periods/${info.event.id}`, {
                    start_utc: info.event.start?.toISOString(),
                    end_utc: info.event.end?.toISOString(),
                  });
                  await loadPeriods(selectedRotationId);
                } catch (e: any) {
                  info.revert();
                  setError(e.message || String(e));
                }
              }}
              eventClick={(info: any) => {
                const p = periods.find(pp => pp.period_id === info.event.id);
                if (!p) return;
                setEditState({
                  open: true,
                  period: p,
                  name: p.name,
                  is_locked: p.is_locked,
                });
              }}
              height="auto"
            />
          </div>

          {/* Templates Manager */}
          <TemplatesManager
            rotationId={selectedRotationId}
            templates={templates}
            loading={tplLoading}
            error={tplError}
            onChanged={async () => { await loadTemplates(selectedRotationId); await loadPeriods(selectedRotationId); }}
          />

          {qcState.open && (
            <QuickCreateDialog
              rotationId={selectedRotationId}
              users={users}
              state={qcState}
              onClose={() => setQcState(s => ({ ...s, open: false }))}
              onCreated={async () => { setQcState(s => ({ ...s, open: false })); await loadPeriods(selectedRotationId); }}
            />
          )}

          {editState.open && editState.period && (
            <EditPeriodDialog
              period={editState.period}
              name={editState.name}
              isLocked={editState.is_locked}
              onClose={() => setEditState(s => ({ ...s, open: false }))}
              onSaved={async () => { setEditState(s => ({ ...s, open: false })); await loadPeriods(selectedRotationId); }}
              onDeleted={async () => { setEditState(s => ({ ...s, open: false })); await loadPeriods(selectedRotationId); }}
            />
          )}

          {/* Rotations table (replaces periods table) */}
          <div style={{ overflowX: 'auto', border: `1px solid ${tokens.colorNeutralStroke2}`, borderRadius: 8, padding: 12 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'transparent' }}>
              <thead>
                <tr>
                  <th style={th}>Name</th>
                  <th style={th}>Time Zone</th>
                  <th style={th}>Period Length</th>
                  <th style={th}>Anchor Start</th>
                  <th style={th}>Active</th>
                  <th style={th}>Primary</th>
                  <th style={th}>Secondary</th>
                  <th style={th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rotations.map(r => (
                  <RotationRow key={r.rotation_id} rotation={r} users={users} onChanged={load} />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function RotationCreateDialog({ users, onCreated, onCancel, defaultTimeZone }: { users: User[]; onCreated: () => void; onCancel: () => void; defaultTimeZone: string; }) {
  const api = useApi();
  const [model, setModel] = React.useState<RotationCreate>({
    name: '', description: '', time_zone: defaultTimeZone || 'America/Chicago', period_length_days: 7, start_date_utc: new Date().toISOString(),
  });
  const [defaultPrimary, setDefaultPrimary] = React.useState<string>('');
  const [defaultSecondary, setDefaultSecondary] = React.useState<string>('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  async function submit() {
    setBusy(true); setError(null);
    try {
      const payload = {
        ...model,
        start_date_utc: new Date(model.start_date_utc).toISOString(),
        default_primary_user_id: defaultPrimary || null,
        default_secondary_user_id: defaultSecondary || null,
      };
      await api.post<Rotation>(`/api/v1/rotations`, payload);
      onCreated();
    } catch (e: any) { setError(e.message || String(e)); } finally { setBusy(false); }
  }
  return (
    <DialogSurface style={{ maxWidth: 560 }}>
      <DialogBody>
        <DialogTitle>New Rotation</DialogTitle>
        <DialogContent>
          {error && <div style={{ color: tokens.colorPaletteRedForeground3, marginBottom: 8 }}>{error}</div>}
          <div style={{ display: 'grid', gap: 10 }}>
            <div>
              <Label>Name</Label>
              <Input value={model.name} onChange={(_, d) => setModel({ ...model, name: d.value })} placeholder="Rotation name" />
            </div>
            <div>
              <Label>Description</Label>
              <Input value={model.description || ''} onChange={(_, d) => setModel({ ...model, description: d.value })} placeholder="Optional description" />
            </div>
            <div>
              <Label>Period Length (days)</Label>
              <Input type="number" min={1} value={String(model.period_length_days)} onChange={(_, d) => setModel({ ...model, period_length_days: parseInt(d.value || '7', 10) })} />
            </div>
            <div>
              <Label>Anchor Start (UTC)</Label>
              <Input type="datetime-local" value={toLocalInputValue(model.start_date_utc)} onChange={(_, d) => setModel({ ...model, start_date_utc: new Date(d.value).toISOString() })} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <Label>Default Primary (optional)</Label>
                <Select value={defaultPrimary} onChange={(_, d) => setDefaultPrimary(d.value)}>
                  <option value="">(none)</option>
                  {users.map(u => <option key={u.user_id} value={u.user_id}>{u.display_name}</option>)}
                </Select>
              </div>
              <div style={{ flex: 1 }}>
                <Label>Default Secondary (optional)</Label>
                <Select value={defaultSecondary} onChange={(_, d) => setDefaultSecondary(d.value)}>
                  <option value="">(none)</option>
                  {users.map(u => <option key={u.user_id} value={u.user_id}>{u.display_name}</option>)}
                </Select>
              </div>
            </div>
          </div>
        </DialogContent>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
          <Button appearance="secondary" onClick={onCancel} disabled={busy}>Cancel</Button>
          <Button appearance="primary" onClick={submit} disabled={busy || !model.name}>{busy ? 'Saving...' : 'Create'}</Button>
        </div>
      </DialogBody>
    </DialogSurface>
    );
  }

function RotationRow({ rotation, users, onChanged }: { rotation: Rotation; users: User[]; onChanged: () => void; }) {
  const [editOpen, setEditOpen] = React.useState(false);
  const prim = users.find(u => u.user_id === rotation.default_primary_user_id);
  const sec = users.find(u => u.user_id === rotation.default_secondary_user_id);
  return (
    <tr>
      <td style={td}>{rotation.name}</td>
      <td style={td}>{rotation.time_zone}</td>
      <td style={td}>{rotation.period_length_days} day(s)</td>
      <td style={td}>{fmt(rotation.start_date_utc)}</td>
      <td style={td}>{rotation.is_active ? 'Yes' : 'No'}</td>
      <td style={td}>{prim?.display_name || ''}</td>
      <td style={td}>{sec?.display_name || ''}</td>
      <td style={td}>
        <Dialog open={editOpen} onOpenChange={(_, d) => setEditOpen(!!d.open)}>
          <DialogTrigger>
            <Button size="small" onClick={() => setEditOpen(true)}>Edit</Button>
          </DialogTrigger>
          {editOpen && (
            <RotationEditDialog rotation={rotation} users={users} onSaved={() => { setEditOpen(false); onChanged(); }} onCancel={() => setEditOpen(false)} />
          )}
        </Dialog>
      </td>
    </tr>
  );
}

type PeriodWindow = {
  name: string;
  start: string; // local datetime
  end: string;   // local datetime
};

function NewPeriodDialog({ rotationId, users, onCreated }: { rotationId: string; users: User[]; onCreated: () => void; }) {
  const api = useApi();
  const [open, setOpen] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [windows, setWindows] = React.useState<PeriodWindow[]>([{
    name: '',
    start: '',
    end: '',
  }]);
  // Weekday mode state
  const [mode, setMode] = React.useState<'datetime' | 'weekday'>('weekday');
  const [wdName, setWdName] = React.useState<string>('On-Call');
  const [wdStartTime, setWdStartTime] = React.useState<string>('09:00');
  const [wdEndTime, setWdEndTime] = React.useState<string>('17:00');
  const [wdStartDate, setWdStartDate] = React.useState<string>('');
  const [wdEndDate, setWdEndDate] = React.useState<string>('');
  const [wdDays, setWdDays] = React.useState<Record<number, boolean>>({0:false,1:false,2:false,3:false,4:false,5:false,6:false});

  function setWin(i: number, patch: Partial<PeriodWindow>) {
    setWindows(ws => ws.map((w, idx) => idx === i ? { ...w, ...patch } : w));
  }
  function addWin() { setWindows(ws => [...ws, { name: '', start: '', end: '' }]); }
  function removeWin(i: number) { setWindows(ws => ws.filter((_, idx) => idx !== i)); }

  async function submit() {
    if (!rotationId) return;
    setError(null);
    setSaving(true);
    try {
      if (mode === 'weekday') {
        // Validate weekday inputs
        const selectedDays = Object.entries(wdDays).filter(([, v]) => v).map(([k]) => parseInt(k, 10));
        if (!wdStartDate || !wdEndDate) { setError('Please provide a date range.'); return; }
        if (new Date(wdStartDate) > new Date(wdEndDate)) { setError('Start date must be before end date.'); return; }
        if (!wdStartTime || !/^\d{2}:\d{2}$/.test(wdStartTime) || !wdEndTime || !/^\d{2}:\d{2}$/.test(wdEndTime)) { setError('Please provide start and end times in HH:mm.'); return; }
        if (selectedDays.length === 0) { setError('Select at least one weekday.'); return; }
        // Build inline templates for selected weekdays
        const inline_templates = selectedDays.map(d => ({ day_of_week: d, start_time: wdStartTime, end_time: wdEndTime, name: wdName || 'On-Call', is_active: true }));
        // Construct UTC range (inclusive end date -> add 1 day at 00:00)
        const start_utc = new Date(`${wdStartDate}T00:00`);
        const endUtcDate = new Date(`${wdEndDate}T00:00`);
        endUtcDate.setDate(endUtcDate.getDate() + 1);
        await api.post(`/api/v1/rotations/${rotationId}/generate_periods_from_templates`, {
          start_utc: start_utc.toISOString(),
          end_utc: endUtcDate.toISOString(),
          name_template: wdName ? `${wdName} {start:%Y-%m-%d}` : undefined,
          inline_templates,
        });
        setOpen(false);
        onCreated();
      } else {
        // DateTime mode: basic validation and create exact periods
        for (const w of windows) {
          if (!w.start || !w.end) { setError('Please provide start and end for all periods.'); return; }
          if (new Date(w.start) >= new Date(w.end)) { setError('Start must be before end for all periods.'); return; }
        }
        for (const w of windows) {
          await api.post<Period>(`/api/v1/periods`, {
            rotation_id: rotationId,
            name: w.name || 'On-Call',
            start_utc: new Date(w.start).toISOString(),
            end_utc: new Date(w.end).toISOString(),
            is_locked: false,
          });
        }
        setOpen(false);
        onCreated();
      }
    } catch (e: any) {
      setError(e.message || String(e));
    } finally { setSaving(false); }
  }

  // Render dialog surface directly so we can control open state
  return (
    <DialogSurface style={{ maxWidth: 640 }}>
      <DialogBody>
        <DialogTitle>Create Periods</DialogTitle>
        <DialogContent>
          {error && <div style={{ color: tokens.colorPaletteRedForeground3, marginBottom: 8 }}>{error}</div>}
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Label>Mode</Label>
              <Select value={mode} onChange={(_, d) => setMode(d.value as any)}>
                <option value="weekday">Weekday + Hours</option>
                <option value="datetime">Exact Date/Time</option>
              </Select>
            </div>

            {mode === 'weekday' ? (
              <div style={{ display: 'grid', gap: 8, border: `1px solid ${tokens.colorNeutralStroke2}`, borderRadius: 6, padding: 10 }}>
                <div>
                  <Label>Name</Label>
                  <Input value={wdName} onChange={(_, d) => setWdName(d.value)} placeholder="e.g., Daytime Coverage" />
                </div>
                <div>
                  <Label>Weekdays</Label>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((lbl, idx) => (
                      <label key={idx} style={{ display: 'flex', gap: 6, alignItems: 'center', border: `1px solid ${tokens.colorNeutralStroke2}`, borderRadius: 6, padding: '4px 8px' }}>
                        <input type="checkbox" checked={!!wdDays[idx]} onChange={e => setWdDays(d => ({ ...d, [idx]: e.currentTarget.checked }))} /> {lbl}
                      </label>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <Label>Start time</Label>
                    <Input type="time" value={wdStartTime} onChange={(_, d) => setWdStartTime(d.value)} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <Label>End time</Label>
                    <Input type="time" value={wdEndTime} onChange={(_, d) => setWdEndTime(d.value)} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <Label>Date range start</Label>
                    <Input type="date" value={wdStartDate} onChange={(_, d) => setWdStartDate(d.value)} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <Label>Date range end</Label>
                    <Input type="date" value={wdEndDate} onChange={(_, d) => setWdEndDate(d.value)} />
                  </div>
                </div>
              </div>
            ) : (
              <>
                {windows.map((w, i) => (
                  <div key={i} style={{ display: 'grid', gap: 8, border: `1px solid ${tokens.colorNeutralStroke2}`, borderRadius: 6, padding: 10 }}>
                    <div>
                      <Label>Name</Label>
                      <Input value={w.name} onChange={(_, d) => setWin(i, { name: d.value })} placeholder="e.g., Daytime Coverage" />
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <div style={{ flex: 1 }}>
                        <Label>Start</Label>
                        <Input type="datetime-local" value={w.start} onChange={(_, d) => setWin(i, { start: d.value })} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <Label>End</Label>
                        <Input type="datetime-local" value={w.end} onChange={(_, d) => setWin(i, { end: d.value })} />
                      </div>
                    </div>
                    {windows.length > 1 && (
                      <div>
                        <Button appearance="secondary" size="small" onClick={() => removeWin(i)} disabled={saving}>Remove</Button>
                      </div>
                    )}
                  </div>
                ))}
                <div>
                  <Button onClick={addWin} disabled={saving}>Add another period</Button>
                </div>
              </>
            )}
            {/* Assignees moved to Rotation defaults; periods inherit automatically */}
          </div>
        </DialogContent>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
          <Button appearance="secondary" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
          <Button appearance="primary" onClick={submit} disabled={saving || !rotationId}>{saving ? 'Saving...' : 'Create'}</Button>
        </div>
      </DialogBody>
    </DialogSurface>
  );
}

function TemplatesManager({ rotationId, templates, loading, error, onChanged }: { rotationId: string; templates: PeriodTemplate[]; loading: boolean; error: string | null; onChanged: () => void; }) {
  const api = useApi();
  const [sel, setSel] = React.useState<Record<string, boolean>>({});
  const [busy, setBusy] = React.useState(false);
  const [localError, setLocalError] = React.useState<string | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editTpl, setEditTpl] = React.useState<PeriodTemplate | null>(null);
  const [rangeStart, setRangeStart] = React.useState<string>('');
  const [rangeEnd, setRangeEnd] = React.useState<string>('');

  React.useEffect(() => {
    // reset selection on rotation or list change
    const next: Record<string, boolean> = {};
    for (const t of templates) next[t.template_id] = false;
    setSel(next);
  }, [rotationId, templates]);

  const week = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

  async function applyRange() {
    if (!rotationId) return;
    setBusy(true); setLocalError(null);
    try {
      const ids = Object.entries(sel).filter(([, v]) => v).map(([k]) => k);
      const active = ids.length ? ids : templates.filter(t => t.is_active).map(t => t.template_id);
      if (!rangeStart || !rangeEnd) { setLocalError('Pick a start and end date.'); setBusy(false); return; }
      const start_utc = new Date(`${rangeStart}T00:00`).toISOString();
      const end_plus = new Date(`${rangeEnd}T00:00`); end_plus.setDate(end_plus.getDate() + 1);
      await api.post(`/api/v1/rotations/${rotationId}/generate_periods_from_templates`, {
        start_utc,
        end_utc: end_plus.toISOString(),
        template_ids: active,
        name_template: 'On-Call {start:%Y-%m-%d}',
      });
      await onChanged();
    } catch (e: any) {
      setLocalError(e.message || String(e));
    } finally { setBusy(false); }
  }

  async function remove(templateId: string) {
    if (!confirm('Delete this template?')) return;
    setBusy(true); setLocalError(null);
    try {
      await api.delete(`/api/v1/templates/${templateId}`);
      await onChanged();
    } catch (e: any) { setLocalError(e.message || String(e)); } finally { setBusy(false); }
  }

  return (
    <div style={{ border: `1px solid ${tokens.colorNeutralStroke2}`, borderRadius: 8, padding: 12, marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <h3 style={{ margin: 0 }}>Templates</h3>
        <Dialog open={createOpen} onOpenChange={(_, d) => setCreateOpen(!!d.open)}>
          <DialogTrigger>
            <Button size="small" appearance="primary" onClick={() => setCreateOpen(true)} disabled={!rotationId}>New Template</Button>
          </DialogTrigger>
          {createOpen && (
            <TemplateEditDialog rotationId={rotationId} onSaved={() => { setCreateOpen(false); onChanged(); }} onCancel={() => setCreateOpen(false)} />
          )}
        </Dialog>
        {editTpl && (
          <Dialog open onOpenChange={(_, d) => { if (!d.open) setEditTpl(null); }}>
            <TemplateEditDialog rotationId={rotationId} template={editTpl} onSaved={() => { setEditTpl(null); onChanged(); }} onCancel={() => setEditTpl(null)} />
          </Dialog>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <Label>Apply to date range</Label>
          <Input type="date" value={rangeStart} onChange={(_, d) => setRangeStart(d.value)} />
          <Input type="date" value={rangeEnd} onChange={(_, d) => setRangeEnd(d.value)} />
          <Button onClick={applyRange} disabled={busy || !rotationId}>{busy ? 'Applying…' : 'Apply'}</Button>
        </div>
      </div>
      {(error || localError) && <div style={{ color: tokens.colorPaletteRedForeground3, marginBottom: 8 }}>{error || localError}</div>}
      {loading ? <Spinner label="Loading templates…" /> : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'transparent' }}>
            <thead>
              <tr>
                <th style={th}></th>
                <th style={th}>Name</th>
                <th style={th}>Day</th>
                <th style={th}>Start</th>
                <th style={th}>End</th>
                <th style={th}>Active</th>
                <th style={th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {templates.map(t => (
                <tr key={t.template_id}>
                  <td style={td}>
                    <input type="checkbox" checked={!!sel[t.template_id]} onChange={e => setSel(s => ({ ...s, [t.template_id]: e.currentTarget.checked }))} />
                  </td>
                  <td style={td}>{t.name || ''}</td>
                  <td style={td}>{week[t.day_of_week] ?? t.day_of_week}</td>
                  <td style={td}>{t.start_time}</td>
                  <td style={td}>{t.end_time}</td>
                  <td style={td}>{t.is_active ? 'Yes' : 'No'}</td>
                  <td style={td}>
                    <Button size="small" onClick={() => setEditTpl(t)} disabled={busy}>Edit</Button>
                    <Button size="small" appearance="secondary" onClick={() => remove(t.template_id)} disabled={busy} style={{ marginLeft: 8 }}>Delete</Button>
                  </td>
                </tr>
              ))}
              {templates.length === 0 && (
                <tr><td style={td} colSpan={7}>No templates yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TemplateEditDialog({ rotationId, template, onSaved, onCancel }: { rotationId: string; template?: PeriodTemplate; onSaved: () => void; onCancel: () => void; }) {
  const api = useApi();
  const isEdit = !!template;
  const [name, setName] = React.useState<string>(template?.name || '');
  const [day, setDay] = React.useState<number>(template?.day_of_week ?? 0);
  const [start, setStart] = React.useState<string>(template?.start_time || '09:00');
  const [end, setEnd] = React.useState<string>(template?.end_time || '17:00');
  const [active, setActive] = React.useState<boolean>(template?.is_active ?? true);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const week = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

  async function save() {
    setBusy(true); setError(null);
    try {
      if (isEdit && template) {
        await api.patch(`/api/v1/templates/${template.template_id}`, {
          name: name || null,
          day_of_week: day,
          start_time: start,
          end_time: end,
          is_active: active,
        });
      } else {
        await api.post(`/api/v1/rotations/${rotationId}/templates`, {
          name: name || null,
          day_of_week: day,
          start_time: start,
          end_time: end,
          is_active: active,
        });
      }
      onSaved();
    } catch (e: any) {
      setError(e.message || String(e));
    } finally { setBusy(false); }
  }

  return (
    <DialogSurface style={{ maxWidth: 480 }}>
      <DialogBody>
        <DialogTitle>{isEdit ? 'Edit Template' : 'New Template'}</DialogTitle>
        <DialogContent>
          {error && <div style={{ color: tokens.colorPaletteRedForeground3, marginBottom: 8 }}>{error}</div>}
          <div style={{ display: 'grid', gap: 8 }}>
            <div>
              <Label>Name</Label>
              <Input value={name} onChange={(_, d) => setName(d.value)} placeholder="Optional" />
            </div>
            <div>
              <Label>Day of week</Label>
              <Select value={String(day)} onChange={(_, d) => setDay(parseInt(d.value, 10))}>
                {week.map((w, idx) => (
                  <option key={idx} value={idx}>{w}</option>
                ))}
              </Select>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <Label>Start time</Label>
                <Input type="time" value={start} onChange={(_, d) => setStart(d.value)} />
              </div>
              <div style={{ flex: 1 }}>
                <Label>End time</Label>
                <Input type="time" value={end} onChange={(_, d) => setEnd(d.value)} />
              </div>
            </div>
            <div>
              <Label>Active</Label>
              <Select value={active ? '1' : '0'} onChange={(_, d) => setActive(d.value === '1')}>
                <option value="1">Yes</option>
                <option value="0">No</option>
              </Select>
            </div>
          </div>
        </DialogContent>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
          <Button appearance="secondary" onClick={onCancel} disabled={busy}>Cancel</Button>
          <Button appearance="primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save'}</Button>
        </div>
      </DialogBody>
    </DialogSurface>
  );
}

function fmt(iso: string) {
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

function toLocalInputValue(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const th: React.CSSProperties = { textAlign: 'left', borderBottom: `1px solid ${tokens.colorNeutralStroke2}`, padding: 8, color: tokens.colorNeutralForeground2 } as any;
const td: React.CSSProperties = { borderBottom: `1px solid ${tokens.colorNeutralStroke1}`, padding: 8 } as any;

// Quick Create state and component co-located in file
type QuickCreateState = {
  open: boolean;
  start: string;
  end: string;
  name: string;
  primaryUserId: string; // deprecated in UI
  secondaryUserId: string; // deprecated in UI
};

type EditState = {
  open: boolean;
  period: Period | null;
  name: string;
  is_locked: boolean;
};

function QuickCreateDialog({ rotationId, users, state, onClose, onCreated }: { rotationId: string; users: User[]; state: QuickCreateState; onClose: () => void; onCreated: () => void; }) {
  const api = useApi();
  const [name, setName] = React.useState(state.name);
  const [start, setStart] = React.useState(state.start);
  const [end, setEnd] = React.useState(state.end);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function submit() {
    if (!rotationId) return;
    if (!start || !end || new Date(start) >= new Date(end)) {
      setError('Please provide a valid start and end time.');
      return;
    }
    setSaving(true); setError(null);
    try {
      const created = await api.post<Period>(`/api/v1/periods`, {
        rotation_id: rotationId,
        name: name || 'On-Call',
        start_utc: new Date(start).toISOString(),
        end_utc: new Date(end).toISOString(),
        is_locked: false,
      });
      onCreated();
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(_, d) => { if (!d.open) onClose(); }}>
      <DialogSurface style={{ maxWidth: 520 }}>
        <DialogBody>
          <DialogTitle>New Period</DialogTitle>
          <DialogContent>
            {error && <div style={{ color: tokens.colorPaletteRedForeground3, marginBottom: 8 }}>{error}</div>}
            <div style={{ display: 'grid', gap: 10 }}>
              <div>
                <Label>Name</Label>
                <Input value={name} onChange={(_, d) => setName(d.value)} placeholder="On-Call" />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <Label>Start</Label>
                  <Input type="datetime-local" value={start} onChange={(_, d) => setStart(d.value)} />
                </div>
                <div style={{ flex: 1 }}>
                  <Label>End</Label>
                  <Input type="datetime-local" value={end} onChange={(_, d) => setEnd(d.value)} />
                </div>
              </div>
              {/* Assignees moved to Rotation defaults; periods inherit automatically */}
            </div>
          </DialogContent>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
            <Button appearance="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button appearance="primary" onClick={submit} disabled={saving || !rotationId}>{saving ? 'Saving…' : 'Create'}</Button>
          </div>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

function EditPeriodDialog({ period, name: initialName, isLocked: initialLocked, onClose, onSaved, onDeleted }: { period: Period; name: string; isLocked: boolean; onClose: () => void; onSaved: () => void; onDeleted: () => void; }) {
  const api = useApi();
  const [name, setName] = React.useState(initialName);
  const [isLocked, setIsLocked] = React.useState(initialLocked);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function save() {
    setSaving(true); setError(null);
    try {
      await api.patch(`/api/v1/periods/${period.period_id}`, { name, is_locked: isLocked });
      await onSaved();
    } catch (e: any) {
      setError(e.message || String(e));
    } finally { setSaving(false); }
  }

  async function del() {
    if (!confirm('Delete this period?')) return;
    setSaving(true); setError(null);
    try {
      await api.delete(`/api/v1/periods/${period.period_id}`);
      await onDeleted();
    } catch (e: any) {
      setError(e.message || String(e));
    } finally { setSaving(false); }
  }

  return (
    <Dialog open onOpenChange={(_, d) => { if (!d.open) onClose(); }}>
      <DialogSurface style={{ maxWidth: 520 }}>
        <DialogBody>
          <DialogTitle>Edit Period</DialogTitle>
          <DialogContent>
            {error && <div style={{ color: tokens.colorPaletteRedForeground3, marginBottom: 8 }}>{error}</div>}
            <div style={{ display: 'grid', gap: 10 }}>
              <div>
                <Label>Name</Label>
                <Input value={name} onChange={(_, d) => setName(d.value)} />
              </div>
              <div>
                <Label>Lock</Label>
                <Select value={isLocked ? '1' : '0'} onChange={(_, d) => setIsLocked(d.value === '1')}>
                  <option value="0">Unlocked</option>
                  <option value="1">Locked</option>
                </Select>
              </div>
            </div>
          </DialogContent>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', marginTop: 12 }}>
            <Button appearance="secondary" onClick={del} disabled={saving}>Delete</Button>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button appearance="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
              <Button appearance="primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
            </div>
          </div>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

function RotationEditDialog({ rotation, users, onSaved, onCancel }: { rotation: Rotation; users: User[]; onSaved: () => void; onCancel: () => void; }) {
  const api = useApi();
  const [name, setName] = React.useState(rotation.name);
  const [description, setDescription] = React.useState(rotation.description || '');
  const [timeZone, setTimeZone] = React.useState(rotation.time_zone);
  const [periodLen, setPeriodLen] = React.useState<number>(rotation.period_length_days);
  const [startUtc, setStartUtc] = React.useState<string>(rotation.start_date_utc);
  const [isActive, setIsActive] = React.useState(rotation.is_active);
  const [defaultPrimary, setDefaultPrimary] = React.useState<string>(rotation.default_primary_user_id || '');
  const [defaultSecondary, setDefaultSecondary] = React.useState<string>(rotation.default_secondary_user_id || '');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function save() {
    setBusy(true); setError(null);
    try {
      await api.patch<Rotation>(`/api/v1/rotations/${rotation.rotation_id}`, {
        name,
        description: description || null,
        time_zone: timeZone,
        period_length_days: periodLen,
        start_date_utc: new Date(startUtc).toISOString(),
        is_active: isActive,
        default_primary_user_id: defaultPrimary || null,
        default_secondary_user_id: defaultSecondary || null,
      });
      onSaved();
    } catch (e: any) {
      setError(e.message || String(e));
    } finally { setBusy(false); }
  }

  return (
    <DialogSurface style={{ maxWidth: 560 }}>
      <DialogBody>
        <DialogTitle>Edit Rotation</DialogTitle>
        <DialogContent>
          {error && <div style={{ color: tokens.colorPaletteRedForeground3, marginBottom: 8 }}>{error}</div>}
          <div style={{ display: 'grid', gap: 10 }}>
            <div>
              <Label>Name</Label>
              <Input value={name} onChange={(_, d) => setName(d.value)} />
            </div>
            <div>
              <Label>Description</Label>
              <Input value={description} onChange={(_, d) => setDescription(d.value)} />
            </div>
            <div>
              <Label>Time Zone (IANA)</Label>
              <Input value={timeZone} onChange={(_, d) => setTimeZone(d.value)} />
            </div>
            <div>
              <Label>Period Length (days)</Label>
              <Input type="number" min={1} value={String(periodLen)} onChange={(_, d) => setPeriodLen(parseInt(d.value || '1', 10))} />
            </div>
            <div>
              <Label>Anchor Start (UTC)</Label>
              <Input type="datetime-local" value={toLocalInputValue(startUtc)} onChange={(_, d) => setStartUtc(new Date(d.value).toISOString())} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <Label>Default Primary (optional)</Label>
                <Select value={defaultPrimary} onChange={(_, d) => setDefaultPrimary(d.value)}>
                  <option value="">(none)</option>
                  {users.map(u => <option key={u.user_id} value={u.user_id}>{u.display_name}</option>)}
                </Select>
              </div>
              <div style={{ flex: 1 }}>
                <Label>Default Secondary (optional)</Label>
                <Select value={defaultSecondary} onChange={(_, d) => setDefaultSecondary(d.value)}>
                  <option value="">(none)</option>
                  {users.map(u => <option key={u.user_id} value={u.user_id}>{u.display_name}</option>)}
                </Select>
              </div>
            </div>
            <div>
              <Label>Active</Label>
              <Select value={isActive ? '1' : '0'} onChange={(_, d) => setIsActive(d.value === '1')}>
                <option value="1">Yes</option>
                <option value="0">No</option>
              </Select>
            </div>
          </div>
        </DialogContent>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
          <Button appearance="secondary" onClick={onCancel} disabled={busy}>Cancel</Button>
          <Button appearance="primary" onClick={save} disabled={busy || !name}>{busy ? 'Saving…' : 'Save'}</Button>
        </div>
      </DialogBody>
    </DialogSurface>
  );
}

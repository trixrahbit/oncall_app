import React from 'react';
import { Button, Dialog, DialogBody, DialogContent, DialogSurface, DialogTitle, DialogTrigger, Input, Label, Select, Spinner, Switch, tokens } from '@fluentui/react-components';
import { WebhookEndpoint, WhoAmI, useApi, GlobalSettings } from '../apiClient';
import { Link } from 'react-router-dom';

type EndpointCreate = {
  name: string;
  url: string;
  method: 'GET' | 'POST';
  shared_secret?: string | null;
  is_active: boolean;
  event_filter?: string | null;
};

type EndpointUpdate = Partial<EndpointCreate>;

export default function SettingsPage() {
  const api = useApi();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [endpoints, setEndpoints] = React.useState<WebhookEndpoint[]>([]);
  const [gSettings, setGSettings] = React.useState<GlobalSettings | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editItem, setEditItem] = React.useState<WebhookEndpoint | null>(null);
  const [isAdmin, setIsAdmin] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [rows, gs] = await Promise.all([
        api.get<WebhookEndpoint[]>(`/api/v1/webhook_endpoints`),
        api.get<GlobalSettings>(`/api/v1/settings`).catch(() => null as any),
      ]);
      setEndpoints(rows);
      if (gs) setGSettings(gs);
    } catch (e: any) { setError(e.message || String(e)); } finally { setLoading(false); }
  }, [api]);

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

  return (
    <div>
      <h2>Settings</h2>
      {error && <div style={{ color: tokens.colorPaletteRedForeground3, marginBottom: 8 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <Dialog open={createOpen} onOpenChange={(_, d) => setCreateOpen(!!d.open)}>
          <DialogTrigger>
            <Button appearance="primary" onClick={() => setCreateOpen(true)}>New Webhook Endpoint</Button>
          </DialogTrigger>
          <EndpointCreateDialog onCreated={() => { setCreateOpen(false); load(); }} onCancel={() => setCreateOpen(false)} />
        </Dialog>
        <Button onClick={load}>Refresh</Button>
        {isAdmin && (
          <Link to="/users" style={{ textDecoration: 'none' }}>
            <Button appearance="secondary">👥 Manage Users</Button>
          </Link>
        )}
      </div>
      {loading && <Spinner label="Loading settings..." />}
      {!loading && (
        <>
          {/* Global Time Settings */}
          <div style={{ border: `1px solid ${tokens.colorNeutralStroke2}`, borderRadius: 8, padding: 12, marginBottom: 16 }}>
            <h3 style={{ marginTop: 0 }}>Time & Calendar Settings</h3>
            {!gSettings ? (
              <div>Unable to load global settings.</div>
            ) : (
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'end' }}>
                <div style={{ minWidth: 320 }}>
                  <Label htmlFor="tz">Default Time Zone (IANA)</Label>
                  <Select id="tz" value={gSettings.default_time_zone}
                          onChange={(_, d) => setGSettings({ ...gSettings, default_time_zone: d.value })}>
                    {(() => {
                      const COMMON_TZS = [
                        'UTC',
                        'America/Los_Angeles',
                        'America/Denver',
                        'America/Chicago',
                        'America/New_York',
                        'America/Phoenix',
                        'America/Anchorage',
                        'Pacific/Honolulu',
                        'Europe/London',
                        'Europe/Berlin',
                        'Europe/Paris',
                        'Europe/Madrid',
                        'Europe/Amsterdam',
                        'Europe/Prague',
                        'Europe/Warsaw',
                        'Europe/Athens',
                        'Asia/Jerusalem',
                        'Asia/Dubai',
                        'Asia/Kolkata',
                        'Asia/Bangkok',
                        'Asia/Singapore',
                        'Asia/Hong_Kong',
                        'Asia/Tokyo',
                        'Australia/Sydney',
                        'Pacific/Auckland',
                      ];
                      const hasCurrent = COMMON_TZS.includes(gSettings.default_time_zone);
                      const options = hasCurrent ? COMMON_TZS : [gSettings.default_time_zone, ...COMMON_TZS];
                      return options.map(tz => (
                        <option key={tz} value={tz}>{tz}</option>
                      ));
                    })()}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="ws">Week Start</Label>
                  <Select id="ws" value={String(gSettings.week_start)} onChange={(_, d) => setGSettings({ ...gSettings, week_start: Number(d.value) })}>
                    <option value="0">Sunday</option>
                    <option value="1">Monday</option>
                    <option value="2">Tuesday</option>
                    <option value="3">Wednesday</option>
                    <option value="4">Thursday</option>
                    <option value="5">Friday</option>
                    <option value="6">Saturday</option>
                  </Select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <Label>Time Format</Label>
                  <Switch checked={gSettings.use_24h} onChange={(_, d) => setGSettings({ ...gSettings, use_24h: d.checked })} label={gSettings.use_24h ? '24-hour' : '12-hour'} />
                </div>
                <div style={{ marginLeft: 'auto' }}>
                  <Label>&nbsp;</Label>
                  <div>
                    <Button appearance="primary" disabled={!isAdmin} onClick={async () => {
                      if (!gSettings) return;
                      try {
                        const saved = await api.put<GlobalSettings>(`/api/v1/settings`, gSettings as any);
                        setGSettings(saved);
                      } catch (e: any) { setError(e.message || String(e)); }
                    }}>Save</Button>
                    {!isAdmin && (
                      <div style={{ color: tokens.colorNeutralForeground3, marginTop: 4 }}>Only admins can change settings.</div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Webhook Endpoints */}
          <div style={{ overflowX: 'auto', border: `1px solid ${tokens.colorNeutralStroke2}`, borderRadius: 8, padding: 12, background: 'transparent' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'transparent' }}>
              <thead>
                <tr>
                  <th style={th}>Name</th>
                  <th style={th}>URL</th>
                  <th style={th}>Method</th>
                  <th style={th}>Active</th>
                  <th style={th}>Event Filter</th>
                  <th style={th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {endpoints.map(e => (
                  <tr key={e.endpoint_id}>
                    <td style={td}>{e.name}</td>
                    <td style={td}>{e.url}</td>
                    <td style={td}>{e.method}</td>
                    <td style={td}>{e.is_active ? 'Yes' : 'No'}</td>
                    <td style={td}>{e.event_filter || ''}</td>
                    <td style={td}>
                      <Dialog open={editItem?.endpoint_id === e.endpoint_id} onOpenChange={(_, d) => setEditItem(d.open ? e : null)}>
                        <DialogTrigger>
                          <Button size="small" onClick={() => setEditItem(e)}>Edit</Button>
                        </DialogTrigger>
                        {editItem && editItem.endpoint_id === e.endpoint_id && (
                          <EndpointEditDialog endpoint={editItem} onSaved={() => { setEditItem(null); load(); }} onCancel={() => setEditItem(null)} />
                        )}
                      </Dialog>
                      <Button size="small" appearance="secondary" onClick={async () => { await api.delete(`/api/v1/webhook_endpoints/${e.endpoint_id}`); load(); }}>Delete</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function EndpointCreateDialog({ onCreated, onCancel }: { onCreated: () => void; onCancel: () => void; }) {
  const api = useApi();
  const [model, setModel] = React.useState<EndpointCreate>({ name: '', url: '', method: 'POST', shared_secret: '', is_active: true, event_filter: '' });
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  async function submit() {
    setBusy(true); setError(null);
    try {
      const payload = { ...model, shared_secret: model.shared_secret || null, event_filter: model.event_filter || null };
      await api.post<WebhookEndpoint>(`/api/v1/webhook_endpoints`, payload);
      onCreated();
    } catch (e: any) { setError(e.message || String(e)); } finally { setBusy(false); }
  }
  return (
    <DialogSurface style={{ maxWidth: 560 }}>
      <DialogBody>
        <DialogTitle>New Webhook Endpoint</DialogTitle>
        <DialogContent>
          {error && <div style={{ color: tokens.colorPaletteRedForeground3, marginBottom: 8 }}>{error}</div>}
          <div style={{ display: 'grid', gap: 10 }}>
            <div>
              <Label>Name</Label>
              <Input value={model.name} onChange={(_, d) => setModel({ ...model, name: d.value })} placeholder="Endpoint name" />
            </div>
            <div>
              <Label>URL</Label>
              <Input value={model.url} onChange={(_, d) => setModel({ ...model, url: d.value })} placeholder="https://example.com/webhook" />
            </div>
            <div>
              <Label>HTTP Method</Label>
              <Select value={model.method} onChange={(_, d) => setModel({ ...model, method: (d.value as 'GET' | 'POST') })}>
                <option value="POST">POST</option>
                <option value="GET">GET</option>
              </Select>
            </div>
            <div>
              <Label>Shared Secret (HMAC)</Label>
              <Input value={model.shared_secret || ''} onChange={(_, d) => setModel({ ...model, shared_secret: d.value })} placeholder="Optional secret used to sign payloads" />
            </div>
            <div>
              <Label>Event Filter (optional)</Label>
              <Input value={model.event_filter || ''} onChange={(_, d) => setModel({ ...model, event_filter: d.value })} placeholder="Comma-separated event names" />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Switch checked={model.is_active} onChange={(_, d) => setModel({ ...model, is_active: !!d.checked })} />
              <Label>Active</Label>
            </div>
          </div>
        </DialogContent>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
          <Button appearance="secondary" onClick={onCancel} disabled={busy}>Cancel</Button>
          <Button appearance="primary" onClick={submit} disabled={busy || !model.name || !model.url}>{busy ? 'Saving...' : 'Create'}</Button>
        </div>
      </DialogBody>
    </DialogSurface>
  );
}

function EndpointEditDialog({ endpoint, onSaved, onCancel }: { endpoint: WebhookEndpoint; onSaved: () => void; onCancel: () => void; }) {
  const api = useApi();
  const [model, setModel] = React.useState<EndpointCreate>({
    name: endpoint.name,
    url: endpoint.url,
    method: endpoint.method,
    shared_secret: endpoint.shared_secret || '',
    is_active: endpoint.is_active,
    event_filter: endpoint.event_filter || '',
  });
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  async function submit() {
    setBusy(true); setError(null);
    try {
      const payload: EndpointUpdate = {
        name: model.name,
        url: model.url,
        method: model.method,
        shared_secret: model.shared_secret || null,
        is_active: model.is_active,
        event_filter: model.event_filter || null,
      };
      await api.patch<WebhookEndpoint>(`/api/v1/webhook_endpoints/${endpoint.endpoint_id}`, payload);
      onSaved();
    } catch (e: any) { setError(e.message || String(e)); } finally { setBusy(false); }
  }
  return (
    <DialogSurface>
      <DialogBody>
        <DialogTitle>Edit Webhook Endpoint</DialogTitle>
        <DialogContent>
          {error && <div style={{ color: tokens.colorPaletteRedForeground3, marginBottom: 8 }}>{error}</div>}
          <Label>Name</Label>
          <Input value={model.name} onChange={(_, d) => setModel({ ...model, name: d.value })} />
          <Label>URL</Label>
          <Input value={model.url} onChange={(_, d) => setModel({ ...model, url: d.value })} />
          <Label>HTTP Method</Label>
          <Select value={model.method} onChange={(_, d) => setModel({ ...model, method: (d.value as 'GET' | 'POST') })}>
            <option value="POST">POST</option>
            <option value="GET">GET</option>
          </Select>
          <Label>Shared Secret (HMAC)</Label>
          <Input value={model.shared_secret || ''} onChange={(_, d) => setModel({ ...model, shared_secret: d.value })} />
          <Label>Event Filter (optional)</Label>
          <Input value={model.event_filter || ''} onChange={(_, d) => setModel({ ...model, event_filter: d.value })} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
            <Switch checked={model.is_active} onChange={(_, d) => setModel({ ...model, is_active: !!d.checked })} /> Active
          </div>
        </DialogContent>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
          <Button appearance="secondary" onClick={onCancel} disabled={busy}>Cancel</Button>
          <Button appearance="primary" onClick={submit} disabled={busy || !model.name || !model.url}>{busy ? 'Saving...' : 'Save'}</Button>
        </div>
      </DialogBody>
    </DialogSurface>
  );
}

const th: React.CSSProperties = { textAlign: 'left', borderBottom: `1px solid ${tokens.colorNeutralStroke2}`, padding: 8, color: tokens.colorNeutralForeground2 } as any;
const td: React.CSSProperties = { borderBottom: `1px solid ${tokens.colorNeutralStroke1}`, padding: 8 } as any;

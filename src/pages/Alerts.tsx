import React from 'react';
import { Button, Dialog, DialogBody, DialogContent, DialogSurface, DialogTitle, DialogTrigger, Input, Label, Select, Switch, Spinner, tokens } from '@fluentui/react-components';
import { AlertRule, AlertRuleCreate, AlertRuleUpdate, IncomingRegistration, WebhookEndpoint, useApi } from '../apiClient';

type FormModel = {
  name: string;
  is_active: boolean;
  incoming_registration_id: string;
  event_filter?: string;
  endpoint_id: string;
};

export default function AlertsPage() {
  const api = useApi();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [rules, setRules] = React.useState<AlertRule[]>([]);
  const [incoming, setIncoming] = React.useState<IncomingRegistration[]>([]);
  const [endpoints, setEndpoints] = React.useState<WebhookEndpoint[]>([]);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editItem, setEditItem] = React.useState<AlertRule | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [rs, irs, eps] = await Promise.all([
        api.get<AlertRule[]>('/api/v1/alert_rules'),
        api.get<IncomingRegistration[]>('/api/v1/incoming_registrations'),
        api.get<WebhookEndpoint[]>('/api/v1/webhook_endpoints'),
      ]);
      setRules(rs);
      setIncoming(irs);
      setEndpoints(eps);
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [api]);

  React.useEffect(() => { load(); }, [load]);

  return (
    <div>
      <h2>Alerts</h2>
      <p style={{ marginTop: -8, color: tokens.colorNeutralForeground3 }}>
        Define simple alert workflows: when an incoming trigger fires, perform an action (e.g., send to a webhook endpoint).
      </p>
      {error && <div style={{ color: tokens.colorPaletteRedForeground3, marginBottom: 8 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <Dialog open={createOpen} onOpenChange={(_, d) => setCreateOpen(!!d.open)}>
          <DialogTrigger>
            <Button appearance="primary" onClick={() => setCreateOpen(true)}>New Alert Rule</Button>
          </DialogTrigger>
          <CreateDialog incoming={incoming} endpoints={endpoints} onCreated={() => { setCreateOpen(false); load(); }} onCancel={() => setCreateOpen(false)} />
        </Dialog>
        <Button onClick={load}>Refresh</Button>
      </div>
      {loading && <Spinner label="Loading alert rules..." />}
      {!loading && (
        <div style={{ display: 'grid', gap: 12 }}>
          {rules.length === 0 && (
            <div style={{ color: tokens.colorNeutralForeground3 }}>No alert rules yet. Create one to get started.</div>
          )}
          {rules.map(r => (
            <div key={r.rule_id} style={{ border: `1px solid ${tokens.colorNeutralStroke2}`, borderRadius: 8, padding: 12, display: 'grid', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontWeight: 600 }}>
                  {r.name} {r.is_active ? '' : <span style={{ color: tokens.colorNeutralForeground3 }}>(inactive)</span>}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Dialog open={!!editItem && editItem.rule_id === r.rule_id} onOpenChange={(_, d) => { if (!d.open) setEditItem(null); }}>
                    <DialogTrigger>
                      <Button size="small" onClick={() => setEditItem(r)}>Edit</Button>
                    </DialogTrigger>
                    {editItem && editItem.rule_id === r.rule_id && (
                      <EditDialog
                        rule={editItem}
                        incoming={incoming}
                        endpoints={endpoints}
                        onSaved={() => { setEditItem(null); load(); }}
                        onCancel={() => setEditItem(null)}
                      />
                    )}
                  </Dialog>
                  <Button size="small" appearance="secondary"
                          onClick={async () => { await api.delete(`/api/v1/alert_rules/${r.rule_id}`); load(); }}
                          title="Delete rule">
                    Delete
                  </Button>
                </div>
              </div>
              <div style={{ color: tokens.colorNeutralForeground2 }}>
                Trigger: Incoming Webhook{r.event_filter ? ` (${r.event_filter})` : ''}
              </div>
              <div style={{ color: tokens.colorNeutralForeground2 }}>
                Action: Send to Webhook Endpoint
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CreateDialog({ incoming, endpoints, onCreated, onCancel }: { incoming: IncomingRegistration[]; endpoints: WebhookEndpoint[]; onCreated: () => void; onCancel: () => void; }) {
  const api = useApi();
  const [model, setModel] = React.useState<FormModel>(() => ({ name: '', is_active: true, incoming_registration_id: incoming[0]?.registration_id || '', endpoint_id: endpoints[0]?.endpoint_id || '' }));
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    // keep defaults in sync when data loads
    setModel(m => ({ ...m,
      incoming_registration_id: m.incoming_registration_id || incoming[0]?.registration_id || '',
      endpoint_id: m.endpoint_id || endpoints[0]?.endpoint_id || '',
    }));
  }, [incoming, endpoints]);

  const save = async () => {
    setSaving(true); setError(null);
    try {
      const payload: AlertRuleCreate = {
        name: model.name,
        is_active: model.is_active,
        trigger_type: 'incoming_webhook',
        incoming_registration_id: model.incoming_registration_id,
        event_filter: model.event_filter || undefined,
        action_type: 'webhook',
        endpoint_id: model.endpoint_id,
      };
      await api.post<AlertRule>('/api/v1/alert_rules', payload);
      onCreated();
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <DialogSurface>
      <DialogBody>
        <DialogTitle>New Alert Rule</DialogTitle>
        <DialogContent>
          {error && <div style={{ color: tokens.colorPaletteRedForeground3, marginBottom: 8 }}>{error}</div>}
          <div style={{ display: 'grid', gap: 12, minWidth: 420 }}>
            <div>
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={model.name} onChange={(_, d) => setModel({ ...model, name: d.value })} placeholder="e.g., Forward RWST alerts" />
            </div>
            <div>
              <Label htmlFor="incoming">Trigger: Incoming Registration</Label>
              <Select id="incoming" value={model.incoming_registration_id} onChange={(_, d) => setModel({ ...model, incoming_registration_id: d.value })}>
                {incoming.map(r => (
                  <option key={r.registration_id} value={r.registration_id}>{r.name}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="event">Optional Event Filter</Label>
              <Input id="event" value={model.event_filter || ''} onChange={(_, d) => setModel({ ...model, event_filter: d.value })} placeholder="e.g., incident.created" />
            </div>
            <div>
              <Label htmlFor="endpoint">Action: Webhook Endpoint</Label>
              <Select id="endpoint" value={model.endpoint_id} onChange={(_, d) => setModel({ ...model, endpoint_id: d.value })}>
                {endpoints.map(e => (
                  <option key={e.endpoint_id} value={e.endpoint_id}>{e.name}</option>
                ))}
              </Select>
            </div>
            <div>
              <Switch checked={model.is_active} onChange={(_, d) => setModel({ ...model, is_active: d.checked })} label={model.is_active ? 'Active' : 'Inactive'} />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Button appearance="secondary" onClick={onCancel} disabled={saving}>Cancel</Button>
              <Button appearance="primary" onClick={save} disabled={saving || !model.name || !model.incoming_registration_id || !model.endpoint_id}>
                {saving ? 'Saving...' : 'Create'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </DialogBody>
    </DialogSurface>
  );
}

function EditDialog({ rule, incoming, endpoints, onSaved, onCancel }: { rule: AlertRule; incoming: IncomingRegistration[]; endpoints: WebhookEndpoint[]; onSaved: () => void; onCancel: () => void; }) {
  const api = useApi();
  const [model, setModel] = React.useState<FormModel>(() => ({
    name: rule.name,
    is_active: rule.is_active,
    incoming_registration_id: rule.incoming_registration_id || incoming[0]?.registration_id || '',
    event_filter: rule.event_filter || '',
    endpoint_id: rule.endpoint_id || endpoints[0]?.endpoint_id || '',
  }));
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const save = async () => {
    setSaving(true); setError(null);
    try {
      const payload: AlertRuleUpdate = {
        name: model.name,
        is_active: model.is_active,
        incoming_registration_id: model.incoming_registration_id,
        event_filter: model.event_filter || undefined,
        endpoint_id: model.endpoint_id,
      };
      await api.patch<AlertRule>(`/api/v1/alert_rules/${rule.rule_id}`, payload);
      onSaved();
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <DialogSurface>
      <DialogBody>
        <DialogTitle>Edit Alert Rule</DialogTitle>
        <DialogContent>
          {error && <div style={{ color: tokens.colorPaletteRedForeground3, marginBottom: 8 }}>{error}</div>}
          <div style={{ display: 'grid', gap: 12, minWidth: 420 }}>
            <div>
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={model.name} onChange={(_, d) => setModel({ ...model, name: d.value })} />
            </div>
            <div>
              <Label htmlFor="incoming">Trigger: Incoming Registration</Label>
              <Select id="incoming" value={model.incoming_registration_id} onChange={(_, d) => setModel({ ...model, incoming_registration_id: d.value })}>
                {incoming.map(r => (
                  <option key={r.registration_id} value={r.registration_id}>{r.name}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="event">Optional Event Filter</Label>
              <Input id="event" value={model.event_filter || ''} onChange={(_, d) => setModel({ ...model, event_filter: d.value })} />
            </div>
            <div>
              <Label htmlFor="endpoint">Action: Webhook Endpoint</Label>
              <Select id="endpoint" value={model.endpoint_id} onChange={(_, d) => setModel({ ...model, endpoint_id: d.value })}>
                {endpoints.map(e => (
                  <option key={e.endpoint_id} value={e.endpoint_id}>{e.name}</option>
                ))}
              </Select>
            </div>
            <div>
              <Switch checked={model.is_active} onChange={(_, d) => setModel({ ...model, is_active: d.checked })} label={model.is_active ? 'Active' : 'Inactive'} />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Button appearance="secondary" onClick={onCancel} disabled={saving}>Cancel</Button>
              <Button appearance="primary" onClick={save} disabled={saving || !model.name || !model.incoming_registration_id || !model.endpoint_id}>
                {saving ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </DialogBody>
    </DialogSurface>
  );
}

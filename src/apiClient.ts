import React from 'react';
import { InteractionRequiredAuthError } from '@azure/msal-browser';
import { useMsal } from '@azure/msal-react';
import { apiScope } from './msal';

const API_BASE = (import.meta.env.VITE_API_BASE as string) || 'http://localhost:8000';
const DEV_BYPASS = (import.meta as any).env?.VITE_DEV_BYPASS_AUTH === 'true';

export function useApi() {
  const { instance, accounts } = useMsal();
  const getToken = React.useCallback(async (): Promise<string> => {
    if (DEV_BYPASS) {
      // In dev bypass, backend accepts requests without Authorization
      return '';
    }
    const account = accounts[0];
    if (!account) throw new Error('Not signed in');
    try {
      const res = await instance.acquireTokenSilent({
        account,
        scopes: [apiScope],
      });
      return res.accessToken;
    } catch (e) {
      if (e instanceof InteractionRequiredAuthError) {
        await instance.acquireTokenRedirect({ scopes: [apiScope] });
      }
      throw e as Error;
    }
  }, [accounts, instance]);

  const request = React.useCallback(async <T,>(path: string, init?: RequestInit): Promise<T> => {
    const token = await getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(init?.headers as Record<string, string> | undefined),
    };
    if (!DEV_BYPASS && token) {
      headers.Authorization = `Bearer ${token}`;
    }
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers,
    });
    if (!res.ok) {
      const text = await res.text();
      const snippet = text.slice(0, 200).replace(/\s+/g, ' ').trim();
      throw new Error(`API ${res.status} ${res.statusText}: ${snippet}`);
    }
    if (res.status === 204) return undefined as unknown as T;

    const contentType = res.headers.get('content-type') || '';
    if (contentType.toLowerCase().includes('application/json')) {
      return (await res.json()) as T;
    }

    // Fallback: got a successful response but not JSON (often an HTML error/redirect)
    const text = await res.text();
    const trimmed = text.trim().toLowerCase();
    const looksHtml = trimmed.startsWith('<!doctype') || trimmed.startsWith('<html');
    const hint = looksHtml
      ? ' Received HTML. This often indicates a login redirect or a misconfigured API base/proxy.'
      : '';
    const snippet = text.slice(0, 200).replace(/\s+/g, ' ').trim();
    throw new Error(`API ${res.status}: Expected JSON but got '${contentType || 'unknown'}'.${hint} Preview: ${snippet}`);
  }, [getToken]);

  return React.useMemo(() => ({
    get: <T,>(path: string) => request<T>(path),
    post: <T,>(path: string, body?: any) => request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
    patch: <T,>(path: string, body?: any) => request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
    put: <T,>(path: string, body?: any) => request<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
    delete: <T,>(path: string) => request<T>(path, { method: 'DELETE' }),
  }), [request]);
}

export type User = {
  user_id: string;
  entra_object_id: string;
  upn: string;
  display_name: string;
  email: string;
  time_zone?: string | null;
  is_active: boolean;
};

// Rotations
export type Rotation = {
  rotation_id: string;
  name: string;
  description?: string | null;
  time_zone: string;
  period_length_days: number;
  start_date_utc: string; // ISO
  is_active: boolean;
  default_primary_user_id?: string | null;
  default_secondary_user_id?: string | null;
};

export type RotationMember = {
  rotation_member_id: string;
  rotation_id: string;
  user_id: string;
  sort_order: number;
  is_active: boolean;
};

// Periods
export type Period = {
  period_id: string;
  rotation_id: string;
  name: string;
  start_utc: string;
  end_utc: string;
  is_locked: boolean;
  calendar_event_id?: string | null;
};

// Assignments
export type Assignment = {
  assignment_id: string;
  period_id: string;
  user_id: string;
  role: 'primary' | 'secondary';
};

// Period Templates (weekday-based)
export type PeriodTemplate = {
  template_id: string;
  rotation_id: string;
  day_of_week: number; // 0=Mon .. 6=Sun
  start_time: string;  // HH:mm
  end_time: string;    // HH:mm
  name?: string | null;
  is_active: boolean;
};

// Global Settings
export type GlobalSettings = {
  default_time_zone: string; // IANA time zone, e.g., 'America/Chicago'
  week_start: number; // 0-6, 0=Sunday
  use_24h: boolean;
};

export type PeriodTemplateCreate = {
  day_of_week: number;
  start_time: string; // HH:mm
  end_time: string;   // HH:mm
  name?: string | null;
  is_active?: boolean;
};

export type PeriodTemplateUpdate = Partial<PeriodTemplateCreate> & {
  day_of_week?: number;
  start_time?: string;
  end_time?: string;
  name?: string | null;
  is_active?: boolean;
};

export type TemplatesExpansionRequest = {
  start_utc: string;
  end_utc: string;
  name_template?: string;
  template_ids?: string[];
};

// Webhook Endpoints (Settings)
export type WebhookEndpoint = {
  endpoint_id: string;
  name: string;
  url: string;
  method: 'GET' | 'POST';
  shared_secret?: string | null;
  is_active: boolean;
  event_filter?: string | null;
};

// Incoming Webhook Registrations
export type IncomingRegistration = {
  registration_id: string;
  name: string;
  shared_secret?: string | null;
  is_active: boolean;
};

// Alert Rules (Triggers -> Actions)
export type AlertRule = {
  rule_id: string;
  name: string;
  is_active: boolean;
  trigger_type: 'incoming_webhook';
  incoming_registration_id?: string | null;
  event_filter?: string | null;
  action_type: 'webhook';
  endpoint_id?: string | null;
};

export type AlertRuleCreate = {
  name: string;
  is_active?: boolean;
  trigger_type?: 'incoming_webhook';
  incoming_registration_id?: string | null;
  event_filter?: string | null;
  action_type?: 'webhook';
  endpoint_id?: string | null;
};

export type AlertRuleUpdate = Partial<AlertRuleCreate>;

// Overrides
export type Override = {
  override_id: string;
  period_id?: string | null;
  rotation_id?: string | null;
  original_user_id: string;
  replacement_user_id: string;
  start_utc: string; // ISO
  end_utc: string;   // ISO
  reason?: string | null;
};

// Effective schedule rows (resolved with overrides applied)
export type EffectiveAssignment = {
  period_id: string;
  rotation_id: string;
  start_utc: string;
  end_utc: string;
  primary_user_id?: string | null;
  secondary_user_id?: string | null;
  overridden?: boolean;
  notes?: string | null;
};

// WhoAmI (from backend /whoami)
export type WhoAmI = {
  sub?: string;
  name?: string;
  upn?: string;
  is_admin?: boolean;
};

// Incidents
export type Incident = {
  incident_id: string;
  title: string;
  rotation_id: string;
  assigned_user_id?: string | null;
  created_at: string; // ISO
  resolved_at?: string | null;
};

export type IncidentCreate = {
  title: string;
  rotation_id: string;
  assigned_user_id?: string | null;
};

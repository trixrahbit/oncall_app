import { InteractionRequiredAuthError } from '@azure/msal-browser';
import { useMsal } from '@azure/msal-react';
import { apiScope } from './msal';

const API_BASE = (import.meta.env.VITE_API_BASE as string) || 'http://localhost:8000';

export function useApi() {
  const { instance, accounts } = useMsal();
  async function getToken(): Promise<string> {
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
      throw e;
    }
  }

  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const token = await getToken();
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(init?.headers || {}),
      },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`API ${res.status}: ${text}`);
    }
    if (res.status === 204) return undefined as unknown as T;
    return (await res.json()) as T;
  }

  return {
    get: <T,>(path: string) => request<T>(path),
    post: <T,>(path: string, body?: any) => request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
    patch: <T,>(path: string, body?: any) => request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  };
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

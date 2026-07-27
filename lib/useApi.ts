import { useAuth } from './auth-context';
import { useCallback } from 'react';
import { API_BASE } from './api';

export function useApi() {
  const { token } = useAuth();

  const apiFetch = useCallback(async (path: string, options?: RequestInit) => {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options?.headers,
      },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  }, [token]);

  return { apiFetch };
}

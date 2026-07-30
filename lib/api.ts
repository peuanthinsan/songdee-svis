import { Platform } from 'react-native';
import { readAuthToken } from './auth-storage';

export const API_BASE = (
  process.env.EXPO_PUBLIC_API_URL
  ?? (Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000')
).trim().replace(/\/+$/, '');

// Sign-out callback — set by AuthProvider so apiFetch can trigger sign-out on 401
let onUnauthorized: (() => void) | null = null;
export function setOnUnauthorized(cb: () => void) {
  onUnauthorized = cb;
}

export async function getAuthToken(): Promise<string | null> {
  return readAuthToken();
}

export async function apiFetch(path: string, options?: RequestInit & { timeout?: number }) {
  const { timeout = 30000, ...fetchOptions } = options || {};
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  const token = await readAuthToken();

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...fetchOptions,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...fetchOptions?.headers,
      },
    });

    // Auto sign-out on 401 (expired/invalid token)
    if (res.status === 401 && onUnauthorized) {
      onUnauthorized();
      throw new Error('Session expired');
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

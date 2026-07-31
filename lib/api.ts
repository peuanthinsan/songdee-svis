import { Platform } from 'react-native';
import { readAuthToken } from './auth-storage';

export const API_BASE = (
  process.env.EXPO_PUBLIC_API_URL
  ?? (Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000')
).trim().replace(/\/+$/, '');

// Sign-out callback — set by AuthProvider so apiFetch can trigger sign-out on 401
let onUnauthorized: (() => void) | null = null;
let inMemoryAuthToken: string | null | undefined;

export function setOnUnauthorized(cb: () => void) {
  onUnauthorized = cb;
}

export function setAuthToken(token: string | null) {
  inMemoryAuthToken = token;
}

export function isAuthTokenCurrent(token: string): boolean {
  return inMemoryAuthToken === token;
}

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function getAuthToken(): Promise<string | null> {
  if (inMemoryAuthToken !== undefined) return inMemoryAuthToken;
  inMemoryAuthToken = await readAuthToken();
  return inMemoryAuthToken;
}

export async function apiFetch(
  path: string,
  options?: RequestInit & { timeout?: number; authToken?: string }
) {
  const {
    timeout = 30000,
    authToken,
    signal: externalSignal,
    ...fetchOptions
  } = options || {};
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  const abortFromExternalSignal = () => controller.abort();
  if (externalSignal?.aborted) {
    controller.abort();
  } else {
    externalSignal?.addEventListener('abort', abortFromExternalSignal, { once: true });
  }

  const token = authToken ?? await getAuthToken();

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
    if (
      res.status === 401
      && token
      && isAuthTokenCurrent(token)
      && onUnauthorized
    ) {
      onUnauthorized();
      throw new ApiError('Session expired', res.status);
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Request failed' }));
      throw new ApiError(err.error || `HTTP ${res.status}`, res.status);
    }
    return res.json();
  } finally {
    clearTimeout(timeoutId);
    externalSignal?.removeEventListener('abort', abortFromExternalSignal);
  }
}

import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { API_BASE, setOnUnauthorized } from './api';
import {
  AUTH_TOKEN_KEY,
  AUTH_USER_KEY,
  clearAuthStorage,
  readAuthToken,
  readAuthUser,
} from './auth-storage';

export type UserRole = 'driver' | 'supervisor' | 'admin';

export type AuthUser = {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  fleetId: string;
  companyId: string;
  companySlug: string;
  companyName: string;
  primaryColor: string;
  accentColor: string;
};

type AuthContextType = {
  user: AuthUser | null;
  token: string | null;
  isLoaded: boolean;
  isSignedIn: boolean;
  signIn: (username: string, password: string, companySlug?: string) => Promise<void>;
  signOut: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  updateProfile: (firstName: string, lastName: string) => Promise<void>;
};

const AuthCtx = createContext<AuthContextType | null>(null);

const TOKEN_REFRESH_INTERVAL = 12 * 60 * 60 * 1000; // 12 hours

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const signOut = useCallback(async () => {
    setToken(null);
    setUser(null);
    await clearAuthStorage();
    if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  }, []);

  // Register 401 handler so apiFetch can trigger sign-out
  useEffect(() => {
    setOnUnauthorized(() => signOut());
  }, [signOut]);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;
    fetch(`${API_BASE}/api/companies`)
      .then((res) => {
        if (!res.ok) throw new Error('Unable to load company branding');
        return res.json();
      })
      .then(async (data) => {
        if (cancelled) return;
        const company = (data.companies ?? []).find(
          (candidate: { slug: string }) => candidate.slug === user.companySlug,
        );
        if (
          !company
          || (
            company.primaryColor === user.primaryColor
            && company.accentColor === user.accentColor
          )
        ) {
          return;
        }

        const nextUser = {
          ...user,
          primaryColor: company.primaryColor,
          accentColor: company.accentColor,
        };
        setUser(nextUser);
        await SecureStore.setItemAsync(AUTH_USER_KEY, JSON.stringify(nextUser));
      })
      .catch(() => {
        // Offline sessions keep their last authenticated company palette.
      });

    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.companySlug]);

  const refreshToken = useCallback(async (currentToken: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${currentToken}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setToken(data.token);
        await SecureStore.setItemAsync(AUTH_TOKEN_KEY, data.token);
        return data.token;
      }
      // Token expired beyond refresh window — sign out
      if (res.status === 401) {
        await signOut();
      }
    } catch {
      // Network error — skip refresh, try again later
    }
    return null;
  }, [signOut]);

  const startRefreshTimer = useCallback((currentToken: string) => {
    if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    refreshTimerRef.current = setInterval(async () => {
      const savedToken = await readAuthToken();
      if (savedToken) refreshToken(savedToken);
    }, TOKEN_REFRESH_INTERVAL);
  }, [refreshToken]);

  // Load saved token on mount
  useEffect(() => {
    (async () => {
      try {
        const [savedToken, savedUser] = await Promise.all([
          readAuthToken(),
          readAuthUser(),
        ]);
        if (savedToken && savedUser) {
          const parsedUser = JSON.parse(savedUser) as AuthUser;
          if (parsedUser.companyId) {
            setToken(savedToken);
            setUser(parsedUser);
            startRefreshTimer(savedToken);
          }
        }
      } catch (e) {
        console.warn('[Auth] Failed to load saved session');
      } finally {
        setIsLoaded(true);
      }
    })();
    return () => {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    };
  }, []);

  const signIn = useCallback(async (username: string, password: string, companySlug = 'dhl') => {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, companySlug }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Login failed');
    }

    const data = await res.json();
    setToken(data.token);
    setUser(data.user);
    await SecureStore.setItemAsync(AUTH_TOKEN_KEY, data.token);
    await SecureStore.setItemAsync(AUTH_USER_KEY, JSON.stringify(data.user));
    startRefreshTimer(data.token);
  }, [startRefreshTimer]);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    const res = await fetch(`${API_BASE}/api/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ currentPassword, newPassword }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Password change failed');
    }
  }, [token]);

  const updateProfile = useCallback(async (firstName: string, lastName: string) => {
    const res = await fetch(`${API_BASE}/api/auth/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ firstName, lastName }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Update failed');
    }

    const updated = await res.json();
    const newUser = { ...user!, firstName: updated.firstName, lastName: updated.lastName };
    setUser(newUser);
    await SecureStore.setItemAsync(AUTH_USER_KEY, JSON.stringify(newUser));
  }, [token, user]);

  return (
    <AuthCtx.Provider value={{
      user,
      token,
      isLoaded,
      isSignedIn: !!token && !!user,
      signIn,
      signOut,
      changePassword,
      updateProfile,
    }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

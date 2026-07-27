import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { API_BASE, setOnUnauthorized } from './api';

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
const TOKEN_KEY = 'svis_auth_token';
const USER_KEY = 'svis_auth_user';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const signOut = useCallback(async () => {
    setToken(null);
    setUser(null);
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(USER_KEY);
    await SecureStore.deleteItemAsync('auth_token');
    await SecureStore.deleteItemAsync('auth_user');
    if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  }, []);

  // Register 401 handler so apiFetch can trigger sign-out
  useEffect(() => {
    setOnUnauthorized(() => signOut());
  }, [signOut]);

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
        await SecureStore.setItemAsync(TOKEN_KEY, data.token);
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
      const savedToken = await SecureStore.getItemAsync(TOKEN_KEY);
      if (savedToken) refreshToken(savedToken);
    }, TOKEN_REFRESH_INTERVAL);
  }, [refreshToken]);

  // Load saved token on mount
  useEffect(() => {
    (async () => {
      try {
        const savedToken = await SecureStore.getItemAsync(TOKEN_KEY);
        const savedUser = await SecureStore.getItemAsync(USER_KEY);
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
    await SecureStore.setItemAsync(TOKEN_KEY, data.token);
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(data.user));
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
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(newUser));
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

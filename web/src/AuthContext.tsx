import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { ApiError, fetchCompanies, login as apiLogin } from './api';
import { applyBranding } from './branding';
import {
  canAccessDashboard,
  clearSession,
  getStoredUser,
  getToken,
  saveSession,
  type User,
} from './auth';

type AuthContextValue = {
  user: User | null;
  token: string | null;
  loading: boolean;
  signIn: (username: string, password: string, companySlug?: string) => Promise<void>;
  signOut: () => void;
  isDashboardUser: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => getStoredUser());
  const [token, setToken] = useState<string | null>(() => getToken());
  const [loading, setLoading] = useState(false);

  useLayoutEffect(() => {
    applyBranding(user
      ? {
          companyName: user.companyName,
          primaryColor: user.primaryColor,
          accentColor: user.accentColor,
        }
      : undefined);
  }, [user]);

  useEffect(() => {
    if (!user || !token) return;

    let cancelled = false;
    fetchCompanies()
      .then(({ companies }) => {
        if (cancelled) return;
        const company = companies.find((candidate) => candidate.slug === user.companySlug);
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
        saveSession(token, nextUser);
        setUser(nextUser);
      })
      .catch(() => {
        // Keep the last authenticated palette when company metadata is unavailable.
      });

    return () => {
      cancelled = true;
    };
  }, [token, user?.companySlug]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      loading,
      isDashboardUser: user ? canAccessDashboard(user.role) : false,
      async signIn(username, password, companySlug = 'dhl') {
        setLoading(true);
        try {
          const res = await apiLogin(username, password, companySlug);
          const nextUser: User = {
            id: res.user.id,
            username: res.user.username,
            firstName: res.user.firstName,
            lastName: res.user.lastName,
            role: res.user.role,
            fleetId: res.user.fleetId,
            companyId: res.user.companyId,
            companySlug: res.user.companySlug,
            companyName: res.user.companyName,
            primaryColor: res.user.primaryColor,
            accentColor: res.user.accentColor,
          };
          saveSession(res.token, nextUser);
          setToken(res.token);
          setUser(nextUser);
        } catch (err) {
          if (err instanceof ApiError && err.status === 401) {
            throw new Error('invalid');
          }
          throw err;
        } finally {
          setLoading(false);
        }
      },
      signOut() {
        clearSession();
        setToken(null);
        setUser(null);
      },
    }),
    [user, token, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

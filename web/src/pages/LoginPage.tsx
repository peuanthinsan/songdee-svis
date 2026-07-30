import { FormEvent, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { brand } from '../branding';
import { canAccessDashboard, getStoredUser } from '../auth';
import { useAuth } from '../AuthContext';
import { t } from '../i18n';
import {
  fetchCompanies,
  fetchLoginUsers,
  type Company,
  type LoginAccount,
} from '../api';

export function LoginPage() {
  const { signIn, signOut, loading, user, isDashboardUser } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companySlug, setCompanySlug] = useState('dhl');
  const [accounts, setAccounts] = useState<LoginAccount[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState(false);
  const [manualUsername, setManualUsername] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCompanies()
      .then((data) => {
        setCompanies(data.companies);
        setCompanySlug(data.defaultCompanySlug || data.companies[0]?.slug || 'dhl');
      })
      .catch(() => {
        setCompanies([{
          slug: 'dhl',
          name: 'DHL Express',
          shortName: 'DHL',
          primaryColor: '#FFCC00',
          accentColor: '#D40511',
        }]);
      });
  }, []);

  useEffect(() => {
    let cancelled = false;
    setUsername('');
    setPassword('');
    setAccounts([]);
    setUsersError(false);
    setUsersLoading(true);
    setManualUsername(false);

    fetchLoginUsers(companySlug)
      .then((data) => {
        if (cancelled) return;
        setAccounts(data.staffAccounts);
        setUsersLoading(false);
        if (data.staffAccounts.length === 0) {
          setManualUsername(true);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setUsersError(true);
        setUsersLoading(false);
        setManualUsername(true);
      });

    return () => {
      cancelled = true;
    };
  }, [companySlug]);

  if (user && isDashboardUser) return <Navigate to="/" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await signIn(username.trim(), password, companySlug);
      const stored = getStoredUser();
      if (stored && !canAccessDashboard(stored.role)) {
        signOut();
        setError(t('driverOnly'));
      }
    } catch (err) {
      setError(err instanceof Error && err.message === 'invalid' ? t('invalidCredentials') : t('error'));
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-card__intro">
          <img className="login-card__logo" src={`${import.meta.env.BASE_URL}logo.svg`} alt="Songdee VIS" />
          <div className="login-card__badge" style={{ background: brand.primary, color: brand.primaryText }}>
            {brand.productName}
          </div>
          <h1>{t('login')}</h1>
          <p className="muted">{t('supervisorAdminAccess')}</p>
        </div>

        <form onSubmit={onSubmit} className="login-form">
          <label>
            {t('company')}
            <select
              value={companySlug}
              onChange={(e) => setCompanySlug(e.target.value)}
              required
            >
              {companies.map((company) => (
                <option key={company.slug} value={company.slug}>{company.name}</option>
              ))}
            </select>
          </label>

          <label>
            {t('username')}
            {manualUsername ? (
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
              />
            ) : (
              <select
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                disabled={usersLoading}
                required
              >
                <option value="" disabled>
                  {usersLoading ? t('loadingUsers') : t('selectUser')}
                </option>
                {accounts.map((account) => (
                  <option key={account.username} value={account.username}>
                    {account.displayName} ({account.username})
                  </option>
                ))}
              </select>
            )}
          </label>

          {!usersLoading && accounts.length === 0 && !usersError && (
            <div className="login-field-note">{t('noDashboardUsers')}</div>
          )}
          {usersError && (
            <div className="login-field-note login-field-note--warn">{t('usersLoadError')}</div>
          )}
          {!usersLoading && (
            <button
              type="button"
              className="login-picker-toggle"
              onClick={() => {
                setUsername('');
                setManualUsername((current) => !current);
              }}
            >
              {manualUsername ? t('useUserPicker') : t('enterUsernameManually')}
            </button>
          )}

          <label>
            {t('password')}
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          {error && <div className="alert alert--error">{error}</div>}
          {user && !isDashboardUser && <div className="alert alert--warn">{t('driverOnly')}</div>}
          <button
            type="submit"
            className="btn btn--primary login-submit"
            disabled={loading || usersLoading || !username || !password}
          >
            {loading ? t('signingIn') : t('signIn')}
          </button>
        </form>
      </div>
    </div>
  );
}

import { NavLink, Outlet } from 'react-router-dom';
import { brand } from '../branding';
import { useAuth } from '../AuthContext';
import { getLang, setLang, t } from '../i18n';

export function Layout() {
  const { user, signOut } = useAuth();
  const lang = getLang();

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar__brand">
          <img className="topbar__logo" src={`${import.meta.env.BASE_URL}logo.svg`} alt="Songdee VIS" />
          <div>
            <div className="topbar__title">{brand.appName}</div>
            <div className="topbar__subtitle">{t('dashboard')}</div>
          </div>
        </div>
        <div className="topbar__actions">
          <button
            type="button"
            className="lang-btn"
            onClick={() => {
              setLang(lang === 'th' ? 'en' : 'th');
              window.location.reload();
            }}
          >
            {lang === 'th' ? 'EN' : 'TH'}
          </button>
          {user && (
            <div className="topbar__user">
              <span className="company-pill">{user.companyName}</span>
              <span>{user.firstName}</span>
              <button type="button" className="link-btn" onClick={signOut}>
                {t('logout')}
              </button>
            </div>
          )}
        </div>
      </header>

      <nav className="tabs">
        <NavLink to="/" end className={({ isActive }) => (isActive ? 'tabs__link tabs__link--active' : 'tabs__link')}>
          {t('dashboard')}
        </NavLink>
        <NavLink to="/issues" className={({ isActive }) => (isActive ? 'tabs__link tabs__link--active' : 'tabs__link')}>
          {t('issues')}
        </NavLink>
        <NavLink to="/history" className={({ isActive }) => (isActive ? 'tabs__link tabs__link--active' : 'tabs__link')}>
          {t('history')}
        </NavLink>
        {user?.role === 'admin' && (
          <NavLink to="/admin" className={({ isActive }) => (isActive ? 'tabs__link tabs__link--active' : 'tabs__link')}>
            {t('admin')}
          </NavLink>
        )}
      </nav>

      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { t } from '../i18n';
import { SettingsTab } from './admin/SettingsTab';
import { UsersTab } from './admin/UsersTab';
import { VehiclesTab } from './admin/VehiclesTab';
import { FleetsTab } from './admin/FleetsTab';
import { AnalyticsTab } from './admin/AnalyticsTab';
import { ChecklistTab } from './admin/ChecklistTab';
import { IssuesMgmtTab } from './admin/IssuesMgmtTab';
import { MaintenanceTab } from './admin/MaintenanceTab';

type AdminTab = 'settings' | 'users' | 'vehicles' | 'fleets' | 'analytics' | 'checklist' | 'issues' | 'maintenance';

const TABS: { id: AdminTab; key: 'adminSettings' | 'adminUsers' | 'adminVehicles' | 'adminFleets' | 'adminAnalytics' | 'adminChecklist' | 'adminIssuesMgmt' | 'adminMaintenance' }[] = [
  { id: 'settings', key: 'adminSettings' },
  { id: 'users', key: 'adminUsers' },
  { id: 'vehicles', key: 'adminVehicles' },
  { id: 'fleets', key: 'adminFleets' },
  { id: 'analytics', key: 'adminAnalytics' },
  { id: 'checklist', key: 'adminChecklist' },
  { id: 'issues', key: 'adminIssuesMgmt' },
  { id: 'maintenance', key: 'adminMaintenance' },
];

const ADMIN_TAB_STORAGE_KEY = 'svis_admin_active_tab';
const adminTabIds = new Set<AdminTab>(TABS.map((item) => item.id));

function savedAdminTab(): AdminTab {
  try {
    const value = localStorage.getItem(ADMIN_TAB_STORAGE_KEY) as AdminTab | null;
    return value && adminTabIds.has(value) ? value : 'settings';
  } catch {
    return 'settings';
  }
}

export function AdminPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<AdminTab>(savedAdminTab);

  useEffect(() => {
    try { localStorage.setItem(ADMIN_TAB_STORAGE_KEY, tab); } catch { /* storage may be unavailable */ }
  }, [tab]);

  useEffect(() => {
    if (user && user.role !== 'admin') navigate('/', { replace: true });
  }, [user, navigate]);

  if (!user || user.role !== 'admin') return null;

  return (
    <div className="stack">
      <div className="panel admin-tabs">
        <div className="admin-tabs__list" aria-label={t('admin')}>
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={tab === item.id}
              onClick={() => setTab(item.id)}
              className={`admin-tabs__button${tab === item.id ? ' admin-tabs__button--active' : ''}`}
            >
              {t(item.key)}
            </button>
          ))}
        </div>
      </div>
      {tab === 'settings' && <SettingsTab />}
      {tab === 'users' && <UsersTab />}
      {tab === 'vehicles' && <VehiclesTab />}
      {tab === 'fleets' && <FleetsTab />}
      {tab === 'analytics' && <AnalyticsTab />}
      {tab === 'checklist' && <ChecklistTab />}
      {tab === 'issues' && <IssuesMgmtTab />}
      {tab === 'maintenance' && <MaintenanceTab />}
    </div>
  );
}

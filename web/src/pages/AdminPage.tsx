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

export function AdminPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<AdminTab>('settings');

  useEffect(() => {
    if (user && user.role !== 'admin') navigate('/', { replace: true });
  }, [user, navigate]);

  if (!user || user.role !== 'admin') return null;

  return (
    <div className="stack">
      <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', borderBottom: '1px solid var(--border)' }}>
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              style={{
                padding: '12px 18px',
                border: 'none',
                background: 'none',
                fontWeight: 700,
                fontSize: 14,
                cursor: 'pointer',
                borderBottom: `2px solid ${tab === item.id ? 'var(--brand-accent)' : 'transparent'}`,
                color: tab === item.id ? 'var(--brand-accent)' : 'var(--text-secondary)',
              }}
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

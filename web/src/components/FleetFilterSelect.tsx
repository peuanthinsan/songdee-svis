import { useAuth } from '../AuthContext';
import { useFleetFilter } from '../FleetFilterContext';
import { t } from '../i18n';

export function FleetFilterSelect() {
  const { user } = useAuth();
  const {
    fleetIds,
    fleetsLoading,
    selectedFleet,
    setSelectedFleet,
  } = useFleetFilter();

  if (user?.role !== 'admin') return null;

  return (
    <select
      className="fleet-select"
      value={selectedFleet ?? ''}
      onChange={(event) => setSelectedFleet(event.target.value || undefined)}
      aria-label={t('fleet')}
      disabled={fleetsLoading}
    >
      <option value="">{t('allFleets')}</option>
      {fleetIds.map((fleetId) => (
        <option key={fleetId} value={fleetId}>{fleetId}</option>
      ))}
    </select>
  );
}

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useLocation } from 'react-router-dom';
import { fetchAdminFleets } from './api';
import { useAuth } from './AuthContext';
import { fleetIdsFromRows, resolveFleetScope, supportsFleetFilter } from './fleet-filter';

type FleetSelection = {
  companyId: string;
  fleetId?: string;
};

type FleetOptions = {
  companyId: string;
  fleetIds: string[];
};

type FleetFilterContextValue = {
  fleetIds: string[];
  fleetsLoading: boolean;
  fleetScope?: string;
  selectedFleet?: string;
  setSelectedFleet: (fleetId?: string) => void;
};

const FleetFilterContext = createContext<FleetFilterContextValue | null>(null);
const EMPTY_FLEET_IDS: string[] = [];

export function FleetFilterProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const isAdmin = user?.role === 'admin';
  const companyId = user?.companyId;
  const [selection, setSelection] = useState<FleetSelection | null>(null);
  const [options, setOptions] = useState<FleetOptions | null>(null);
  const [fleetsLoading, setFleetsLoading] = useState(false);

  const selectedFleet = isAdmin && companyId && selection?.companyId === companyId
    ? selection.fleetId
    : undefined;
  const fleetIds = isAdmin && companyId && options?.companyId === companyId
    ? options.fleetIds
    : EMPTY_FLEET_IDS;
  const fleetScope = resolveFleetScope(isAdmin, user?.fleetId, selectedFleet);

  useEffect(() => {
    if (!isAdmin || !companyId || !supportsFleetFilter(pathname)) {
      setFleetsLoading(false);
      return;
    }

    let cancelled = false;
    setFleetsLoading(true);
    fetchAdminFleets()
      .then((rows) => {
        if (cancelled) return;
        const nextFleetIds = fleetIdsFromRows(rows);
        setOptions({ companyId, fleetIds: nextFleetIds });
        setSelection((current) => {
          if (current?.companyId !== companyId || !current.fleetId) return current;
          return nextFleetIds.includes(current.fleetId) ? current : { companyId };
        });
      })
      .catch(() => {
        // Keep the last successful option list. Navigating back to any eligible
        // page retries the request, including after fleets change in Admin.
      })
      .finally(() => {
        if (!cancelled) setFleetsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [companyId, isAdmin, pathname]);

  const setSelectedFleet = useCallback((fleetId?: string) => {
    if (!isAdmin || !companyId) return;
    setSelection({ companyId, fleetId: fleetId || undefined });
  }, [companyId, isAdmin]);

  const value = useMemo<FleetFilterContextValue>(() => ({
    fleetIds,
    fleetsLoading,
    fleetScope,
    selectedFleet,
    setSelectedFleet,
  }), [fleetIds, fleetsLoading, fleetScope, selectedFleet, setSelectedFleet]);

  return <FleetFilterContext.Provider value={value}>{children}</FleetFilterContext.Provider>;
}

export function useFleetFilter() {
  const context = useContext(FleetFilterContext);
  if (!context) throw new Error('useFleetFilter must be used within FleetFilterProvider');
  return context;
}

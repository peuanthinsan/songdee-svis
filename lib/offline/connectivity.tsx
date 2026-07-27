import { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { processSyncQueue, getPendingCount } from './sync-service';

type ConnectivityState = {
  isOnline: boolean;
  pendingCount: number;
  syncing: boolean;
  triggerSync: () => void;
  refreshPendingCount: () => void;
};

const ConnectivityContext = createContext<ConnectivityState>({
  isOnline: true,
  pendingCount: 0,
  syncing: false,
  triggerSync: () => {},
  refreshPendingCount: () => {},
});

export function ConnectivityProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const syncingRef = useRef(false);

  const refreshPendingCount = useCallback(async () => {
    try {
      const count = await getPendingCount();
      setPendingCount(count);
    } catch {
      // DB not ready yet — ignore
    }
  }, []);

  const triggerSync = useCallback(async () => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    setSyncing(true);
    try {
      await processSyncQueue();
      await refreshPendingCount();
    } catch {
      // Sync failed — will retry next time
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  }, [refreshPendingCount]);

  useEffect(() => {
    refreshPendingCount();

    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      const online = state.isConnected === true && state.isInternetReachable !== false;
      setIsOnline(online);
      // Auto-sync when coming back online
      if (online) {
        triggerSync();
      }
    });

    return () => unsubscribe();
  }, [triggerSync, refreshPendingCount]);

  return (
    <ConnectivityContext.Provider value={{ isOnline, pendingCount, syncing, triggerSync, refreshPendingCount }}>
      {children}
    </ConnectivityContext.Provider>
  );
}

export function useConnectivity() {
  return useContext(ConnectivityContext);
}

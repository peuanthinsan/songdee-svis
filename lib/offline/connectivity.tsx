import { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { InteractionManager } from 'react-native';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { useAuth } from '../auth-context';

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
  const { isSignedIn, token, user } = useAuth();
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const syncingRef = useRef(false);
  const activeSyncControllerRef = useRef<AbortController | null>(null);
  const lastOnlineRef = useRef<boolean | null>(null);
  const ownerScope = user ? `${user.companyId}:${user.id}` : undefined;
  const ownerScopeRef = useRef(ownerScope);
  ownerScopeRef.current = ownerScope;

  const refreshPendingCount = useCallback(async () => {
    if (!ownerScope) return;
    try {
      const { getPendingCount } = await import('./sync-service');
      const count = await getPendingCount(ownerScope);
      if (ownerScopeRef.current === ownerScope) setPendingCount(count);
    } catch {
      // DB not ready yet — ignore
    }
  }, [ownerScope]);

  const triggerSync = useCallback(async () => {
    if (!ownerScope || !token || !user?.id || syncingRef.current) return;
    const controller = new AbortController();
    activeSyncControllerRef.current = controller;
    syncingRef.current = true;
    setSyncing(true);
    try {
      const { processSyncQueue } = await import('./sync-service');
      await processSyncQueue(ownerScope, user.id, token, controller.signal);
      if (!controller.signal.aborted) await refreshPendingCount();
    } catch {
      // Sync failed — will retry next time
    } finally {
      if (activeSyncControllerRef.current === controller) {
        activeSyncControllerRef.current = null;
        syncingRef.current = false;
        setSyncing(false);
      }
    }
  }, [ownerScope, refreshPendingCount, token, user?.id]);

  useEffect(() => {
    if (!isSignedIn || !ownerScope) {
      setPendingCount(0);
      setSyncing(false);
      lastOnlineRef.current = null;
      return;
    }

    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      const online = state.isConnected === true && state.isInternetReachable !== false;
      const wasOnline = lastOnlineRef.current;
      lastOnlineRef.current = online;
      setIsOnline(online);
      // Auto-sync when coming back online
      if (online && wasOnline === false) {
        triggerSync();
      }
    });

    const task = InteractionManager.runAfterInteractions(async () => {
      await refreshPendingCount();
      const state = await NetInfo.fetch();
      const online = state.isConnected === true && state.isInternetReachable !== false;
      if (online) triggerSync();
    });

    return () => {
      task.cancel();
      unsubscribe();
      activeSyncControllerRef.current?.abort();
      activeSyncControllerRef.current = null;
      syncingRef.current = false;
    };
  }, [isSignedIn, ownerScope, triggerSync, refreshPendingCount]);

  return (
    <ConnectivityContext.Provider value={{ isOnline, pendingCount, syncing, triggerSync, refreshPendingCount }}>
      {children}
    </ConnectivityContext.Provider>
  );
}

export function useConnectivity() {
  return useContext(ConnectivityContext);
}

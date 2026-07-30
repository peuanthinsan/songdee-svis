import { useCallback, useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter, useFocusEffect } from 'expo-router';
import { colors, spacing, borderRadius, shadows } from '../../../constants/theme';
import { useI18n } from '../../../lib/i18n-context';
import { useRole } from '../../../lib/useRole';
import { apiFetch } from '../../../lib/api';
import { useDebounce } from '../../../lib/useDebounce';
import { useConnectivity } from '../../../lib/offline/connectivity';
import { cacheVehicles, getCachedVehicles } from '../../../lib/offline/cache-service';
import { SyncStatusBanner } from '../../../components/SyncStatusBanner';
import { SkeletonVehicleList } from '../../../components/Skeleton';
import { vehicleTypeLabel, type Vehicle } from '../../../lib/types';

type VehicleWithStatus = Vehicle & {
  today_status: 'checked' | 'pending';
  daily_status: 'checked' | 'pending';
  weekly_status: 'checked' | 'pending';
  daily_result?: string;
  daily_checked_by?: string;
  checked_by?: string;
};

const PAGE_LIMIT = 50;

export default function VehiclesScreen() {
  const { t } = useI18n();
  const { fleetId, isDriver, isSupervisor, isAdmin } = useRole();
  const [vehicles, setVehicles] = useState<VehicleWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const offsetRef = useRef(0);
  const fetchIdRef = useRef(0);
  const router = useRouter();

  const { isOnline } = useConnectivity();

  const fetchVehicles = useCallback(async (reset = false) => {
    const myFetchId = ++fetchIdRef.current;
    try {
      setError(null);
      const currentOffset = reset ? 0 : offsetRef.current;
      let fetched: VehicleWithStatus[];

      try {
        const params = new URLSearchParams();
        if (!isAdmin && fleetId) params.set('fleetId', fleetId);
        if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim());
        params.set('limit', String(PAGE_LIMIT));
        params.set('offset', String(currentOffset));
        const data = await apiFetch(`/api/vehicles?${params.toString()}`);
        if (myFetchId !== fetchIdRef.current) return; // stale response
        fetched = data.vehicles || data;
        if (reset) cacheVehicles(fetched);
        setTotal(data.total ?? fetched.length);
      } catch {
        if (myFetchId !== fetchIdRef.current) return;
        if (!reset) { setLoadingMore(false); return; }
        const cached = await getCachedVehicles(isAdmin ? undefined : fleetId);
        fetched = cached as VehicleWithStatus[];
        setTotal(fetched.length);
      }

      if (myFetchId !== fetchIdRef.current) return;

      if (reset) {
        setVehicles(fetched);
        offsetRef.current = fetched.length;
      } else {
        // Deduplicate: only append vehicles not already in the list
        setVehicles((prev) => {
          const existingIds = new Set(prev.map(v => v.id));
          const newItems = fetched.filter(v => !existingIds.has(v.id));
          return [...prev, ...newItems];
        });
        offsetRef.current = currentOffset + fetched.length;
      }
      setHasMore(fetched.length >= PAGE_LIMIT);
    } catch (err) {
      console.error('Failed to fetch vehicles:', err);
      setError(t('general.error'));
    } finally {
      if (myFetchId === fetchIdRef.current) {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    }
  }, [debouncedSearch]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      setVehicles([]);
      offsetRef.current = 0;
      setHasMore(true);
      fetchVehicles(true);
    }, [debouncedSearch])
  );

  const onRefresh = () => {
    setRefreshing(true);
    setVehicles([]);
    offsetRef.current = 0;
    setHasMore(true);
    fetchVehicles(true);
  };

  const loadMore = () => {
    if (!hasMore || loading || loadingMore) return;
    setLoadingMore(true);
    fetchVehicles(false);
  };

  if (loading && !refreshing) {
    return <SkeletonVehicleList />;
  }

  if (error && vehicles.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => { setLoading(true); fetchVehicles(true); }}>
          <Text style={styles.retryText}>{t('general.retry')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const checked = vehicles.filter(v => v.today_status === 'checked').length;
  const displayed = vehicles.length;
  const pct = total > 0 ? Math.round((checked / displayed) * 100) : 0;

  return (
    <View style={styles.container}>
      <FlatList
        data={vehicles}
        keyExtractor={(item) => item.id}
        initialNumToRender={15}
        maxToRenderPerBatch={10}
        windowSize={10}
        getItemLayout={(_, index) => ({
          length: 62,
          offset: 62 * index,
          index,
        })}
        onEndReachedThreshold={0.5}
        onEndReached={() => { if (hasMore && !loading) loadMore(); }}
        ListFooterComponent={loadingMore ? <ActivityIndicator style={{ paddingVertical: spacing.md }} color={colors.primary} /> : null}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListHeaderComponent={
          <>
            <SyncStatusBanner />
            {/* Search bar */}
            <View style={styles.searchWrap}>
              <Ionicons name="search-outline" size={16} color={colors.textTertiary} style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                value={search}
                onChangeText={setSearch}
                placeholder={t('admin.search')}
                placeholderTextColor={colors.textTertiary}
                clearButtonMode="while-editing"
                autoCorrect={false}
                autoCapitalize="characters"
              />
            </View>
            {/* Summary bar */}
            <View style={styles.summary}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryNum}>{checked}<Text style={styles.summaryTotal}>/{displayed}</Text></Text>
                <Text style={styles.summaryPct}>{pct}%</Text>
              </View>
              <View style={styles.bar}>
                <View style={[styles.barFill, { width: `${pct}%` }]} />
              </View>
            </View>
          </>
        }
        ListEmptyComponent={
          <View style={{ padding: spacing.xl, alignItems: 'center' }}>
            <Ionicons name="car-outline" size={48} color={colors.textTertiary} />
            <Text style={{ color: colors.textSecondary, marginTop: spacing.sm, fontSize: 15 }}>
              {t('vehicles.noVehicles')}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const dailyDone = item.daily_status === 'checked';
          const weeklyDone = item.weekly_status === 'checked';
          const isFail = dailyDone && item.daily_result === 'fail';
          const bothDone = dailyDone && weeklyDone;
          const accentColor = isFail ? '#C62828' : bothDone ? colors.statusPass : dailyDone ? colors.statusPass : colors.primary;
          return (
            <TouchableOpacity
              style={[styles.card, bothDone && !isDriver && !isSupervisor && !isFail && styles.cardDone]}
              activeOpacity={0.6}
              onPress={() => {
                router.push(`/(app)/vehicles/${item.id}/inspect`);
              }}
            >
              <View style={[styles.accent, { backgroundColor: accentColor }]} />
              <View style={styles.statusDots}>
                <View style={[styles.dot, dailyDone ? (isFail ? styles.dotFail : styles.dotPass) : styles.dotPending]} />
                <View style={[styles.dot, weeklyDone ? styles.dotPass : styles.dotPending]} />
              </View>
              <View style={styles.cardContent}>
                <Text style={styles.plate}>{item.plate_number}</Text>
                <Text style={styles.meta}>
                  {vehicleTypeLabel(item.vehicle_type)}
                  {' \u2022 '}{item.fleet_id}
                  {item.daily_checked_by ? ` \u2022 ${item.daily_checked_by}` : ''}
                </Text>
                <Text style={styles.statusLabel}>
                  {isFail ? 'Daily: Fail' : dailyDone ? 'Daily \u2713' : 'Daily pending'}
                  {'  \u2022  '}
                  {weeklyDone ? 'Weekly \u2713' : 'Weekly pending'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  errorText: { fontSize: 16, color: colors.accent, marginBottom: spacing.md },
  retryBtn: { backgroundColor: colors.primary, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: borderRadius.sm },
  retryText: { fontWeight: '600', color: colors.onPrimary },
  // Search
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: borderRadius.sm,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.sm,
    ...shadows.sm,
  },
  searchIcon: { marginRight: spacing.xs },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 15,
    color: colors.textPrimary,
  },
  // Summary
  summary: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    ...shadows.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: spacing.sm,
  },
  summaryNum: { fontSize: 28, fontWeight: '800', color: colors.statusChecked },
  summaryTotal: { fontSize: 20, fontWeight: '600', color: colors.textSecondary },
  summaryPct: { fontSize: 20, fontWeight: '700', color: colors.textPrimary },
  bar: { height: 6, backgroundColor: colors.border, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: colors.statusChecked, borderRadius: 3 },
  // Card row
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    paddingLeft: spacing.md + 4,
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    gap: spacing.md,
    overflow: 'hidden',
    ...shadows.sm,
  },
  cardDone: { opacity: 0.55 },
  accent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    borderTopLeftRadius: borderRadius.md,
    borderBottomLeftRadius: borderRadius.md,
  },
  cardContent: { flex: 1 },
  plate: { fontSize: 16, fontWeight: '600', color: colors.textPrimary },
  meta: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  statusLabel: {
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: 3,
  },
  statusDots: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dotPass: {
    backgroundColor: colors.statusPass,
  },
  dotFail: {
    backgroundColor: '#C62828',
  },
  dotPending: {
    backgroundColor: colors.border,
  },
});

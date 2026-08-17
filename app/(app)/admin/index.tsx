import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { colors, spacing, borderRadius, shadows } from '../../../constants/theme';
import { useI18n } from '../../../lib/i18n-context';
import { apiFetch } from '../../../lib/api';

type FleetSummary = {
  fleet_id: string;
  vehicle_count: number;
};

type UserStats = {
  total: number;
  byRole: { role: string; count: number }[];
  byFleet: { fleetId: string; count: number }[];
};

type HubCard = {
  key: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  count: number | null;
  route: string;
  accent: string;
};

export default function AdminScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const [fleets, setFleets] = useState<FleetSummary[]>([]);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [openIssueCount, setOpenIssueCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const [vehicleData, fleetDataResult, stats, issueData] = await Promise.all([
        apiFetch('/api/vehicles'),
        apiFetch('/api/admin/fleets').catch(() => null),
        apiFetch('/api/admin/user-stats').catch(() => null),
        apiFetch('/api/issues?status=open&limit=200').catch(() => null),
      ]);

      const vehicleList = vehicleData.vehicles || vehicleData;
      const fleetData = Array.isArray(fleetDataResult) ? fleetDataResult : null;
      const fleetMap: Record<string, number> = {};
      for (const v of vehicleList) {
        fleetMap[v.fleet_id] = (fleetMap[v.fleet_id] || 0) + 1;
      }
      const summaries: FleetSummary[] = Object.entries(fleetMap)
        .map(([fleet_id, vehicle_count]) => ({ fleet_id, vehicle_count }))
        .sort((a, b) => a.fleet_id.localeCompare(b.fleet_id));

      setFleets(fleetData ? fleetData.map((fleet: any) => ({ fleet_id: fleet.fleet_id, vehicle_count: Number(fleet.vehicle_count) || 0 })) : summaries);
      setUserStats(stats);
      if (issueData && Array.isArray(issueData.issues)) {
        setOpenIssueCount(issueData.issues.length);
      }
    } catch (err: any) {
      setError(err.message || t('general.error'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const totalVehicles = fleets.reduce((sum, f) => sum + f.vehicle_count, 0);

  const hubCards: HubCard[] = [
    {
      key: 'users',
      icon: 'people-outline',
      label: t('admin.hub.users'),
      count: userStats?.total ?? null,
      route: '/admin/users',
      accent: colors.primary,
    },
    {
      key: 'vehicles',
      icon: 'car-outline',
      label: t('admin.hub.vehicles'),
      count: totalVehicles,
      route: '/admin/vehicles',
      accent: colors.primary,
    },
    {
      key: 'fleets',
      icon: 'layers-outline',
      label: t('admin.hub.fleets'),
      count: fleets.length,
      route: '/admin/fleets',
      accent: colors.primary,
    },
    {
      key: 'issues',
      icon: 'warning-outline',
      label: t('admin.hub.issues'),
      count: openIssueCount,
      route: '/admin/issues',
      accent: colors.accent,
    },
    {
      key: 'analytics',
      icon: 'analytics-outline' as any,
      label: t('admin.hub.analytics'),
      count: null,
      route: '/(app)/admin/analytics',
      accent: colors.primary,
    },
    {
      key: 'checklist',
      icon: 'list-outline' as any,
      label: t('admin.hub.checklist'),
      count: null,
      route: '/(app)/admin/checklist',
      accent: colors.primary,
    },
    {
      key: 'settings',
      icon: 'settings-outline' as any,
      label: t('admin.hub.settings'),
      count: null,
      route: '/(app)/admin/settings',
      accent: colors.primary,
    },
  ];

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>{t('general.loading')}</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
    >
      <Text style={styles.title}>{t('admin.title')}</Text>

      {error ? (
        <View style={styles.errorSection}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.accent} style={{ marginBottom: spacing.md }} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => { setLoading(true); fetchData(); }} activeOpacity={0.7}>
            <Text style={styles.retryText}>{t('general.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* Navigation Hub Cards (2x2 grid) */}
          <View style={styles.hubGrid}>
            {hubCards.map((card) => (
              <TouchableOpacity
                key={card.key}
                style={styles.hubCard}
                onPress={() => router.push(card.route as any)}
                activeOpacity={0.75}
              >
                <View style={styles.hubCardInner}>
                  <View style={[styles.hubIconWrap, { backgroundColor: card.accent + '20' }]}>
                    <Ionicons name={card.icon} size={24} color={card.accent === colors.primary ? colors.textPrimary : card.accent} />
                  </View>
                  {card.count !== null && (
                    <Text style={styles.hubCount}>{card.count}</Text>
                  )}
                  <Text style={styles.hubLabel} numberOfLines={2}>{card.label}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {/* Summary stats as rows */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>{t('admin.fleetsCount')}</Text>
              <Text style={styles.summaryNum}>{fleets.length}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>{t('admin.vehicles')}</Text>
              <Text style={styles.summaryNum}>{totalVehicles}</Text>
            </View>
          </View>

          {/* Fleet list */}
          <Text style={styles.sectionTitle}>{t('admin.fleetSummary')}</Text>
          {fleets.map((fleet) => (
            <View key={fleet.fleet_id} style={styles.fleetRow}>
              <Text style={styles.fleetId}>{fleet.fleet_id}</Text>
              <Text style={styles.fleetCount}>
                {fleet.vehicle_count} {t('admin.vehicles')}
              </Text>
            </View>
          ))}

          {/* User management section */}
          <Text style={[styles.sectionTitle, { marginTop: spacing.lg }]}>{t('admin.userManagement')}</Text>
          {userStats ? (
            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{t('admin.userCount')}</Text>
                <Text style={styles.summaryNum}>{userStats.total}</Text>
              </View>
              {userStats.byRole.map((r) => (
                <View key={r.role}>
                  <View style={styles.summaryDivider} />
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>{r.role}</Text>
                    <Text style={styles.summaryNum}>{r.count}</Text>
                  </View>
                </View>
              ))}
              {userStats.byFleet.length > 0 && (
                <>
                  <View style={styles.summaryDivider} />
                  {userStats.byFleet.map((f) => (
                    <View key={f.fleetId}>
                      <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>{f.fleetId}</Text>
                        <Text style={styles.summaryNum}>{f.count}</Text>
                      </View>
                    </View>
                  ))}
                </>
              )}
            </View>
          ) : (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.md }} />
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 12,
    paddingBottom: spacing.xl,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: spacing.sm,
    color: colors.textSecondary,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 12,
  },
  // Hub grid
  hubGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -spacing.xs,
    marginBottom: 12,
  },
  hubCard: {
    width: '50%',
    paddingHorizontal: spacing.xs,
    marginBottom: spacing.sm,
  },
  // Inner card content
  hubCardInner: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    padding: 12,
    alignItems: 'flex-start',
    justifyContent: 'center',
    minHeight: 88,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  hubIconWrap: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
    backgroundColor: colors.primary + '20',
  },
  hubCount: {
    fontSize: 19,
    fontWeight: '800',
    color: colors.textPrimary,
    marginTop: 2,
  },
  hubLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    textAlign: 'left',
    marginTop: 2,
  },
  // Summary card
  summaryCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: colors.border,
  },
  summaryLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  summaryNum: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  // Section
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  // Fleet rows
  fleetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    marginBottom: 4,
  },
  fleetId: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  fleetCount: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  // Error
  errorSection: {
    alignItems: 'center',
    padding: spacing.lg,
  },
  errorText: {
    fontSize: 16,
    color: colors.accent,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 4,
    borderRadius: borderRadius.sm,
  },
  retryText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.onPrimary,
  },
});

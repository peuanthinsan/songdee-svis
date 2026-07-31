import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator,
  RefreshControl, TouchableOpacity,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, spacing, borderRadius, shadows } from '../../../../constants/theme';
import { useI18n } from '../../../../lib/i18n-context';
import { apiFetch } from '../../../../lib/api';
import { vehicleTypeLabel } from '../../../../lib/types';
import { getTodayThai } from '../../../../lib/format-date';
import { useRole } from '../../../../lib/useRole';

type Action = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  count?: string;
  onPress?: () => void;
  muted?: boolean;
};

export default function VehicleDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useI18n();
  const router = useRouter();
  const { isAdmin } = useRole();
  const [vehicle, setVehicle] = useState<any>(null);
  const [issues, setIssues] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const fetchData = useCallback(async () => {
    if (!id) return;
    try {
      const end = getTodayThai();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 90);
      const start = startDate.toISOString().slice(0, 10);
      const [v, issueData, historyData] = await Promise.all([
        apiFetch(`/api/vehicles?id=${id}`),
        apiFetch(`/api/issues?vehicleId=${id}&limit=100`),
        apiFetch(`/api/history?vehicleId=${id}&startDate=${start}&endDate=${end}&limit=20`),
      ]);
      setVehicle(v);
      setIssues(Array.isArray(issueData?.issues) ? issueData.issues : []);
      setHistory(Array.isArray(historyData?.inspections) ? historyData.inspections : []);
      setError(false);
    } catch (err) {
      console.error('Failed to load vehicle hub:', err);
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={colors.accent} /></View>;
  if (error || !vehicle) {
    return <View style={styles.center}>
      <Ionicons name="alert-circle-outline" size={44} color={colors.accent} />
      <Text style={styles.errorText}>{t('general.error')}</Text>
      <TouchableOpacity style={styles.retryButton} onPress={() => { setLoading(true); fetchData(); }}>
        <Text style={styles.retryText}>{t('general.retry')}</Text>
      </TouchableOpacity>
    </View>;
  }

  const openIssues = issues.filter((issue) => issue.status !== 'completed');
  const passed = history.filter((entry) => entry.overall_status === 'pass').length;
  const lastInspection = history[0];
  const statusColor = vehicle.daily_result === 'fail' ? colors.statusFail
    : vehicle.daily_status === 'checked' ? colors.statusPass : colors.statusPending;
  const statusLabel = vehicle.daily_result === 'fail' ? t('inspection.fail')
    : vehicle.daily_status === 'checked' ? t('inspection.pass') : t('vehicles.pending');

  const actions: Action[] = [
    {
      icon: 'alert-circle-outline', title: t('vehicleHub.openIssues'),
      description: openIssues.length ? t('vehicleHub.openIssuesDescription') : t('vehicleHub.noOpenIssues'),
      count: String(openIssues.length), onPress: () => router.push(`/(app)/issues?vehicleId=${id}`),
    },
    {
      icon: 'time-outline', title: t('vehicleHub.history'),
      description: history.length ? `${history.length} ${t('vehicleHub.inspectionsIn90Days')}` : t('vehicleHub.noHistory'),
      count: String(history.length),
    },
    {
      icon: 'create-outline', title: t('vehicleHub.settings'),
      description: t('vehicleHub.settingsDescription'), onPress: isAdmin ? () => router.push('/(app)/admin/settings') : undefined,
      muted: true,
    },
    {
      icon: 'information-circle-outline', title: t('vehicleHub.information'),
      description: `${vehicleTypeLabel(vehicle.vehicle_type)} · ${vehicle.fleet_id}`,
    },
    {
      icon: 'shield-checkmark-outline', title: t('vehicleHub.preventativeMeasures'),
      description: t('vehicleHub.preventativeMeasuresDescription'), onPress: () => router.push(`/(app)/vehicles/${id}/inspect`),
    },
    {
      icon: 'apps-outline', title: t('vehicleHub.allFeatures'),
      description: t('vehicleHub.allFeaturesDescription'), onPress: () => router.push(`/(app)/vehicles/${id}/inspect`),
    },
  ];

  return <>
    <Stack.Screen options={{ title: vehicle.plate_number || t('vehicles.title') }} />
    <ScrollView style={styles.container} contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />}>
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <View style={styles.vehicleIcon}><Ionicons name="car-sport-outline" size={28} color={colors.primary} /></View>
          <View style={styles.heroText}>
            <Text style={styles.plate}>{vehicle.plate_number}</Text>
            <Text style={styles.meta}>{vehicleTypeLabel(vehicle.vehicle_type)} · {vehicle.fleet_id}</Text>
          </View>
          <View style={[styles.statusPill, { backgroundColor: `${statusColor}18` }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusPillText, { color: statusColor }]}>{statusLabel}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.inspectButton} onPress={() => router.push(`/(app)/vehicles/${id}/inspect`)} activeOpacity={0.8}>
          <Ionicons name="clipboard-outline" size={18} color={colors.onPrimary} />
          <Text style={styles.inspectButtonText}>{t('vehicleHub.startInspection')}</Text>
          <Ionicons name="arrow-forward" size={16} color={colors.onPrimary} />
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>{t('vehicleHub.title')}</Text>
      <View style={styles.grid}>
        {actions.map((action) => <TouchableOpacity key={action.title} style={[styles.actionCard, action.muted && styles.mutedCard]}
          onPress={action.onPress} activeOpacity={action.onPress ? 0.7 : 1}>
          <View style={styles.actionIcon}><Ionicons name={action.icon} size={21} color={action.muted ? colors.textSecondary : colors.primary} /></View>
          <View style={styles.actionBody}><Text style={styles.actionTitle}>{action.title}</Text><Text style={styles.actionDescription}>{action.description}</Text></View>
          {action.count !== undefined ? <Text style={styles.count}>{action.count}</Text> : action.onPress ? <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} /> : null}
        </TouchableOpacity>)}
      </View>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>{t('vehicleHub.recentActivity')}</Text>
        <Text style={styles.summaryText}>{lastInspection ? `${t('vehicleHub.lastInspection')}: ${lastInspection.inspection_date}` : t('vehicleHub.noHistory')}</Text>
        {history.length > 0 && <Text style={styles.summaryText}>{passed}/{history.length} {t('vehicleHub.inspectionsPassed')}</Text>}
        {history.slice(0, 5).map((entry) => <View key={entry.id} style={styles.historyRow}>
          <View style={[styles.historyDot, { backgroundColor: entry.overall_status === 'pass' ? colors.statusPass : colors.statusFail }]} />
          <Text style={styles.historyDate}>{entry.inspection_date}</Text>
          <Text style={[styles.historyStatus, { color: entry.overall_status === 'pass' ? colors.statusPass : colors.statusFail }]}>
            {entry.overall_status === 'pass' ? t('inspection.pass') : t('inspection.fail')}
          </Text>
        </View>)}
      </View>
    </ScrollView>
  </>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background, padding: spacing.lg },
  errorText: { color: colors.textSecondary, marginTop: spacing.sm },
  retryButton: { marginTop: spacing.md, backgroundColor: colors.primary, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: borderRadius.sm },
  retryText: { color: colors.onPrimary, fontWeight: '700' },
  hero: { backgroundColor: colors.white, borderRadius: borderRadius.md, padding: spacing.md, ...shadows.sm },
  heroTop: { flexDirection: 'row', alignItems: 'center' },
  vehicleIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: `${colors.primary}15`, justifyContent: 'center', alignItems: 'center' },
  heroText: { flex: 1, marginLeft: spacing.sm },
  plate: { fontSize: 22, fontWeight: '800', color: colors.textPrimary },
  meta: { marginTop: 3, color: colors.textSecondary, fontSize: 13 },
  statusPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 9, paddingVertical: 6, borderRadius: 20, gap: 5 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusPillText: { fontSize: 12, fontWeight: '700' },
  inspectButton: { marginTop: spacing.md, backgroundColor: colors.primary, borderRadius: borderRadius.sm, padding: 12, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  inspectButtonText: { flex: 1, color: colors.onPrimary, fontWeight: '700', fontSize: 15 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: colors.textPrimary, marginTop: spacing.lg, marginBottom: spacing.sm },
  grid: { gap: spacing.sm },
  actionCard: { minHeight: 72, padding: spacing.sm, backgroundColor: colors.white, borderRadius: borderRadius.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, ...shadows.sm },
  mutedCard: { opacity: 0.8 },
  actionIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' },
  actionBody: { flex: 1 },
  actionTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: '700' },
  actionDescription: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  count: { color: colors.textPrimary, fontSize: 20, fontWeight: '800', marginRight: 4 },
  summaryCard: { marginTop: spacing.lg, padding: spacing.md, backgroundColor: colors.white, borderRadius: borderRadius.md, ...shadows.sm },
  summaryTitle: { color: colors.textPrimary, fontWeight: '800', fontSize: 15, marginBottom: spacing.xs },
  summaryText: { color: colors.textSecondary, fontSize: 13, marginTop: 3 },
  historyRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  historyDot: { width: 8, height: 8, borderRadius: 4, marginRight: spacing.sm },
  historyDate: { flex: 1, color: colors.textPrimary, fontSize: 13 },
  historyStatus: { fontSize: 13, fontWeight: '700' },
});

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Modal,
  Alert,
  TextInput,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Svg, { Circle, Text as SvgText, G } from 'react-native-svg';
import { useFocusEffect } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { colors, spacing, borderRadius, shadows, statusColors, modalOverlay } from '../../../constants/theme';
import { useI18n } from '../../../lib/i18n-context';
import { useRole } from '../../../lib/useRole';
import { useAuth } from '../../../lib/auth-context';
import { apiFetch, API_BASE, getAuthToken } from '../../../lib/api';
import { formatDateThai } from '../../../lib/format-date';
import { SkeletonDashboard } from '../../../components/Skeleton';

type FleetStat = {
  fleetId: string;
  total: number;
  checked: number;
  pending: number;
};

type WeeklyStat = {
  total: number;
  checked: number;
  pending: number;
  percentage: number;
};

type DashboardData = {
  date: string;
  overall: {
    total: number;
    checked: number;
    pending: number;
    percentage: number;
  };
  weekly?: WeeklyStat;
  fleets: FleetStat[];
};

type HistoryInspection = {
  id: string;
  vehicle_id: string;
  plate_number: string;
  vehicle_type: string;
  overall_status: string;
  inspection_date: string;
  inspector_name?: string;
};

type HistoryData = {
  total: number;
  passed: number;
  failed: number;
  inspections: HistoryInspection[];
};

/* ───────────────────────── Donut Chart ───────────────────────── */

function DonutChart({ checked, total, size = 160 }: { checked: number; total: number; size?: number }) {
  const pending = total - checked;
  const pct = total > 0 ? checked / total : 0;
  const radius = (size - 20) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  const checkedLength = circumference * pct;
  const pendingLength = circumference * (1 - pct);

  return (
    <Svg width={size} height={size}>
      {/* Pending (red) - full circle background */}
      <Circle
        cx={center} cy={center} r={radius}
        stroke={colors.statusFail}
        strokeWidth={18}
        fill="none"
        opacity={0.9}
      />
      {/* Checked (green) - overlaid arc */}
      <Circle
        cx={center} cy={center} r={radius}
        stroke={colors.statusChecked}
        strokeWidth={18}
        fill="none"
        strokeDasharray={`${checkedLength} ${pendingLength}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${center} ${center})`}
      />
      {/* Center text */}
      <SvgText
        x={center} y={center - 6}
        textAnchor="middle"
        fontSize={32}
        fontWeight="800"
        fill={colors.textPrimary}
      >
        {Math.round(pct * 100)}%
      </SvgText>
      <SvgText
        x={center} y={center + 18}
        textAnchor="middle"
        fontSize={12}
        fill={colors.textSecondary}
      >
        {checked}/{total}
      </SvgText>
    </Svg>
  );
}

/* ───────────────────────── Fleet Row ───────────────────────── */

function FleetRow({ fleet }: { fleet: FleetStat }) {
  const pct = fleet.total > 0 ? Math.round((fleet.checked / fleet.total) * 100) : 0;
  const isComplete = pct === 100;
  const isZero = pct === 0;

  return (
    <View style={[styles.fleetRow, isComplete && styles.fleetRowComplete]}>
      <View style={styles.fleetInfo}>
        <Text style={[styles.fleetCode, isZero && styles.fleetCodeUrgent]}>
          {fleet.fleetId}
        </Text>
        <View style={styles.fleetBar}>
          <View style={[styles.fleetBarFill, {
            width: `${pct}%`,
            backgroundColor: isComplete ? colors.statusChecked : isZero ? colors.statusFail : colors.primary,
          }]} />
        </View>
      </View>
      <Text style={styles.fleetNumbers}>{fleet.checked}/{fleet.total}</Text>
      <Text style={[styles.fleetPct, {
        color: isComplete ? colors.statusChecked : isZero ? colors.statusFail : colors.textPrimary,
      }]}>{pct}%</Text>
    </View>
  );
}

/* ───────────────────────── History Section ───────────────────────── */

type DateRange = 'today' | 'week' | 'month';

function pad2(n: number) { return n < 10 ? `0${n}` : `${n}`; }
function fmtLocalDate(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function startOfWeekMon(d: Date) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = x.getDay();
  const diff = (day + 6) % 7;
  x.setDate(x.getDate() - diff);
  return x;
}
function startOfMonthLocal(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonthLocal(d: Date) { return new Date(d.getFullYear(), d.getMonth() + 1, 0); }

function buildMonthOptions(count = 12) {
  const now = new Date();
  const out: { value: string; label: string }[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({
      value: `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`,
      label: d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }),
    });
  }
  return out;
}

type ExportPeriod = 'all' | 'today' | 'week' | 'month' | 'pickMonth' | 'custom';
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function getDateRange(range: DateRange): { startDate: string; endDate: string } {
  const now = new Date(new Date().getTime() + 7 * 60 * 60 * 1000);
  const endDate = now.toISOString().split('T')[0];

  switch (range) {
    case 'today':
      return { startDate: endDate, endDate };
    case 'week': {
      const weekAgo = new Date(now);
      weekAgo.setUTCDate(weekAgo.getUTCDate() - 7);
      return { startDate: weekAgo.toISOString().split('T')[0], endDate };
    }
    case 'month': {
      const monthAgo = new Date(now);
      monthAgo.setUTCMonth(monthAgo.getUTCMonth() - 1);
      return { startDate: monthAgo.toISOString().split('T')[0], endDate };
    }
  }
}

function HistorySection({ fleetId, isAdmin }: { fleetId: string; isAdmin: boolean }) {
  const { t } = useI18n();
  const [range, setRange] = useState<DateRange>('today');
  const [history, setHistory] = useState<HistoryData | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);

  const fetchHistory = useCallback(async () => {
    try {
      const { startDate, endDate } = getDateRange(range);
      const params = new URLSearchParams({ startDate, endDate });
      if (!isAdmin && fleetId) params.append('fleetId', fleetId);
      const data = await apiFetch(`/api/history?${params.toString()}`);
      setHistory(data);
    } catch {
      setHistory(null);
    } finally {
      setInitialLoading(false);
    }
  }, [range, fleetId, isAdmin]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const rangeButtons: { key: DateRange; label: string }[] = [
    { key: 'today', label: t('dashboard.today') },
    { key: 'week', label: t('dashboard.thisWeek') },
    { key: 'month', label: t('dashboard.thisMonth') },
  ];

  return (
    <View style={historyStyles.container}>
      <Text style={historyStyles.title}>{t('dashboard.history')}</Text>

      {/* Tab buttons with underline */}
      <View style={historyStyles.rangeRow}>
        {rangeButtons.map((btn) => (
          <TouchableOpacity
            key={btn.key}
            style={[historyStyles.rangeBtn, range === btn.key && historyStyles.rangeBtnActive]}
            onPress={() => setRange(btn.key)}
            activeOpacity={0.7}
          >
            <Text style={[historyStyles.rangeBtnText, range === btn.key && historyStyles.rangeBtnTextActive]}>
              {btn.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {initialLoading && !history ? (
        <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.md }} />
      ) : history ? (
        <View>
          {/* Stats as simple rows */}
          <View style={historyStyles.statsCard}>
            <View style={historyStyles.statRow}>
              <Text style={historyStyles.statLabel}>{t('dashboard.totalInspections')}</Text>
              <Text style={historyStyles.statNumber}>{history.total}</Text>
            </View>
            <View style={historyStyles.statDivider} />
            <View style={historyStyles.statRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="checkmark-circle" size={16} color={colors.statusPass} style={{ marginRight: 6 }} />
                <Text style={historyStyles.statLabel}>{t('dashboard.passed')}</Text>
              </View>
              <Text style={[historyStyles.statNumber, { color: colors.statusPass }]}>{history.passed}</Text>
            </View>
            <View style={historyStyles.statDivider} />
            <View style={historyStyles.statRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="close-circle" size={16} color={colors.statusFail} style={{ marginRight: 6 }} />
                <Text style={historyStyles.statLabel}>{t('dashboard.failed')}</Text>
              </View>
              <Text style={[historyStyles.statNumber, { color: colors.statusFail }]}>{history.failed}</Text>
            </View>
          </View>

          {history.inspections.length === 0 ? (
            <Text style={historyStyles.emptyText}>{t('dashboard.noInspections')}</Text>
          ) : (
            history.inspections
              .filter((ins) => ins.overall_status === 'fail')
              .slice(0, 10)
              .map((ins) => {
                const dateStr = formatDateThai(ins.inspection_date);
                return (
                  <View key={ins.id} style={historyStyles.failRow}>
                    <Ionicons name="warning" size={20} color={colors.accent} />
                    <View style={{ flex: 1, marginLeft: spacing.md }}>
                      <Text style={historyStyles.failPlate}>{ins.plate_number}</Text>
                      <Text style={historyStyles.failMeta}>
                        {ins.inspector_name ? `${ins.inspector_name} \u2022 ` : ''}
                        {dateStr}
                      </Text>
                    </View>
                    <View style={historyStyles.failBadge}>
                      <Text style={historyStyles.failBadgeText}>{t('inspection.fail')}</Text>
                    </View>
                  </View>
                );
              })
          )}
        </View>
      ) : null}
    </View>
  );
}

const historyStyles = StyleSheet.create({
  container: {
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  rangeRow: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rangeBtn: {
    paddingVertical: spacing.sm,
    paddingBottom: 10,
    marginBottom: -1,
  },
  rangeBtnActive: {
    borderBottomWidth: 2,
    borderBottomColor: colors.accent,
  },
  rangeBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  rangeBtnTextActive: {
    color: colors.accent,
    fontWeight: '700',
  },
  statsCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  statDivider: {
    height: 1,
    backgroundColor: colors.border,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  statLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
  failRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  failPlate: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  failMeta: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  failBadge: {
    backgroundColor: colors.accent + '15',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  failBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.accent,
  },
});

/* ───────────────────────── Dashboard Screen ───────────────────────── */

export default function DashboardScreen() {
  const { t } = useI18n();
  const { fleetId, isAdmin } = useRole();
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Export modal state
  const [filterVisible, setFilterVisible] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [fleetList, setFleetList] = useState<{ fleet_id: string }[]>([]);
  const [fleetsLoaded, setFleetsLoaded] = useState(false);
  const [selectedFleets, setSelectedFleets] = useState<string[]>([]);
  const [period, setPeriod] = useState<ExportPeriod>('all');
  const [pickedMonth, setPickedMonth] = useState<string>('');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');

  const monthOptions = useMemo(() => buildMonthOptions(12), []);

  const fetchDashboard = useCallback(async () => {
    try {
      setError(null);
      const url = isAdmin ? '/api/dashboard' : `/api/dashboard?fleetId=${fleetId}`;
      const d = await apiFetch(url);
      setData(d);
    } catch (err) {
      console.error('Failed to fetch dashboard:', err);
      setError(t('general.error'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchDashboard();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchDashboard();
  };

  const loadFleets = useCallback(async () => {
    if (!isAdmin || fleetsLoaded) return;
    try {
      const list = await apiFetch('/api/admin/fleets');
      setFleetList(Array.isArray(list) ? list : []);
      setFleetsLoaded(true);
    } catch (err) {
      console.error('Failed to load fleets:', err);
    }
  }, [isAdmin, fleetsLoaded]);

  const openExport = () => {
    setFilterVisible(true);
    loadFleets();
  };

  const toggleFleet = (id: string) => {
    setSelectedFleets((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]
    );
  };

  const resolveDateRange = (): { start?: string; end?: string; error?: string } => {
    const today = new Date();
    if (period === 'all') return {};
    if (period === 'today') {
      const s = fmtLocalDate(today);
      return { start: s, end: s };
    }
    if (period === 'week') {
      return { start: fmtLocalDate(startOfWeekMon(today)), end: fmtLocalDate(today) };
    }
    if (period === 'month') {
      return { start: fmtLocalDate(startOfMonthLocal(today)), end: fmtLocalDate(endOfMonthLocal(today)) };
    }
    if (period === 'pickMonth') {
      if (!pickedMonth) return { error: t('dashboard.selectMonth') };
      const [y, m] = pickedMonth.split('-').map(Number);
      const d = new Date(y, m - 1, 1);
      return { start: fmtLocalDate(startOfMonthLocal(d)), end: fmtLocalDate(endOfMonthLocal(d)) };
    }
    if (period === 'custom') {
      if (!ISO_DATE_RE.test(dateStart) || !ISO_DATE_RE.test(dateEnd)) {
        return { error: t('dashboard.invalidDates') };
      }
      if (dateStart > dateEnd) return { error: t('dashboard.startAfterEnd') };
      return { start: dateStart, end: dateEnd };
    }
    return {};
  };

  const confirmExport = async () => {
    const range = resolveDateRange();
    if (range.error) {
      Alert.alert(t('dashboard.invalidPeriod'), range.error);
      return;
    }
    try {
      setExporting(true);
      const token = await getAuthToken();
      const params = new URLSearchParams();
      if (!isAdmin && fleetId) {
        params.set('fleetId', fleetId);
      } else if (isAdmin && selectedFleets.length > 0) {
        params.set('fleetId', selectedFleets.join(','));
      }
      if (range.start) params.set('dateStart', range.start);
      if (range.end) params.set('dateEnd', range.end);
      const url = `${API_BASE}/api/dashboard/export?${params.toString()}`;
      const fileUri = FileSystem.cacheDirectory + `dashboard-${new Date().toISOString().slice(0, 10)}.xlsx`;
      const result = await FileSystem.downloadAsync(url, fileUri, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (result.status !== 200) throw new Error(`Export failed (${result.status})`);
      setFilterVisible(false);
      await Sharing.shareAsync(result.uri, {
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        dialogTitle: t('dashboard.saveReport'),
        UTI: 'com.microsoft.excel.xlsx',
      });
    } catch (err: any) {
      Alert.alert(t('dashboard.exportFailed'), err.message || t('general.error'));
    } finally {
      setExporting(false);
    }
  };

  const periodChips: { key: ExportPeriod; labelKey: string }[] = [
    { key: 'all',       labelKey: 'dashboard.allTime' },
    { key: 'today',     labelKey: 'dashboard.today' },
    { key: 'week',      labelKey: 'dashboard.thisWeek' },
    { key: 'month',     labelKey: 'dashboard.thisMonth' },
    { key: 'pickMonth', labelKey: 'dashboard.pickMonth' },
    { key: 'custom',    labelKey: 'dashboard.custom' },
  ];

  if (loading) {
    return <SkeletonDashboard />;
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.accent} style={{ marginBottom: spacing.md }} />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => { setLoading(true); fetchDashboard(); }} activeOpacity={0.7}>
          <Text style={styles.retryText}>{t('general.retry')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!data) {
    return (
      <View style={styles.centered}>
        <Ionicons name="analytics-outline" size={48} color={colors.textTertiary} style={{ marginBottom: spacing.sm }} />
        <Text style={styles.emptyText}>{t('dashboard.noData')}</Text>
      </View>
    );
  }

  const { overall, weekly, fleets } = data;

  // Sort fleets by urgency: most pending first, 100% pushed to bottom
  const sortedFleets = [...fleets].sort((a, b) => {
    const aPct = a.total > 0 ? a.checked / a.total : 1;
    const bPct = b.total > 0 ? b.checked / b.total : 1;
    return aPct - bPct;
  });

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {/* ─── Greeting + Export ─── */}
        <View style={styles.greetingRow}>
          <View style={styles.greetingWrap}>
            {user && (
              <>
                <Text style={styles.greetingName}>
                  {t('dashboard.greeting').replace('{name}', user.firstName)}
                </Text>
                <Text style={styles.greetingDate}>
                  {formatDateThai(new Date())}
                </Text>
              </>
            )}
          </View>
          <TouchableOpacity
            style={styles.exportBtn}
            onPress={openExport}
            activeOpacity={0.7}
          >
            <Ionicons name="download-outline" size={16} color="#fff" />
            <Text style={styles.exportBtnText}>{t('dashboard.export')}</Text>
          </TouchableOpacity>
        </View>

        {/* ─── Hero: Donut Chart ─── */}
        <View style={styles.heroCard}>
          <View style={styles.donutContainer}>
            {overall.total === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: spacing.lg }}>
                <Ionicons name="analytics-outline" size={48} color={colors.textTertiary} />
                <Text style={{ color: colors.textSecondary, marginTop: spacing.sm }}>{t('dashboard.noInspections')}</Text>
              </View>
            ) : (
              <DonutChart checked={overall.checked} total={overall.total} />
            )}
          </View>

          {/* Legend */}
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <Ionicons name="ellipse" size={10} color={colors.statusChecked} />
              <Text style={styles.legendText}>{t('dashboard.checkedLabel')}</Text>
            </View>
            <View style={styles.legendItem}>
              <Ionicons name="ellipse" size={10} color={colors.statusFail} />
              <Text style={styles.legendText}>{t('dashboard.pendingLabel')}</Text>
            </View>
          </View>

          {/* Stat boxes */}
          <View style={styles.statBoxRow}>
            <View style={[styles.statBox, styles.statBoxChecked]}>
              <Ionicons name="checkmark-circle" size={20} color={colors.statusChecked} />
              <Text style={styles.statBoxCount}>{overall.checked}</Text>
              <Text style={styles.statBoxLabel}>{t('dashboard.checkedLabel')}</Text>
            </View>
            <View style={[styles.statBox, styles.statBoxPending]}>
              <Ionicons name="ellipse-outline" size={20} color={colors.statusFail} />
              <Text style={styles.statBoxCount}>{overall.pending}</Text>
              <Text style={styles.statBoxLabel}>{t('dashboard.pendingLabel')}</Text>
            </View>
          </View>

          {/* Date */}
          <Text style={styles.dateLabel}>{t('dashboard.today')} {data.date}</Text>
        </View>

        {/* ─── Fleet List ─── */}
        <Text style={styles.sectionTitle}>{t('dashboard.pendingByFleet')}</Text>

        <View style={styles.fleetCard}>
          {sortedFleets.map((fleet) => (
            <FleetRow key={fleet.fleetId} fleet={fleet} />
          ))}
        </View>

        {/* ─── Weekly Inspection Card ─── */}
        {weekly && weekly.total > 0 && (
          <>
            <Text style={styles.sectionTitle}>{t('dashboard.weeklyCompletion')}</Text>
            <View style={weeklyStyles.card}>
              <View style={weeklyStyles.row}>
                <View style={weeklyStyles.stat}>
                  <Ionicons name="checkmark-circle" size={20} color={colors.statusChecked} />
                  <Text style={weeklyStyles.num}>{weekly.checked}</Text>
                  <Text style={weeklyStyles.label}>{t('dashboard.checkedLabel')}</Text>
                </View>
                <View style={weeklyStyles.divider} />
                <View style={weeklyStyles.stat}>
                  <Ionicons name="ellipse-outline" size={20} color={colors.statusFail} />
                  <Text style={weeklyStyles.num}>{weekly.pending}</Text>
                  <Text style={weeklyStyles.label}>{t('dashboard.pendingLabel')}</Text>
                </View>
                <View style={weeklyStyles.divider} />
                <View style={weeklyStyles.stat}>
                  <Text style={[weeklyStyles.pct, {
                    color: weekly.percentage === 100 ? colors.statusChecked : weekly.percentage === 0 ? colors.statusFail : colors.textPrimary,
                  }]}>{weekly.percentage}%</Text>
                  <Text style={weeklyStyles.label}>{weekly.checked}/{weekly.total}</Text>
                </View>
              </View>
              <View style={weeklyStyles.barTrack}>
                <View style={[weeklyStyles.barFill, {
                  width: `${weekly.percentage}%`,
                  backgroundColor: weekly.percentage === 100 ? colors.statusChecked : colors.primary,
                }]} />
              </View>
            </View>
          </>
        )}

        {/* ─── History Section ─── */}
        <HistorySection fleetId={fleetId} isAdmin={isAdmin} />
      </ScrollView>

      {/* ─── Export Modal ─── */}
      <Modal
        visible={filterVisible}
        transparent
        animationType="slide"
        onRequestClose={() => !exporting && setFilterVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('dashboard.exportTitle')}</Text>
              <TouchableOpacity
                onPress={() => !exporting && setFilterVisible(false)}
                disabled={exporting}
                hitSlop={8}
              >
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} contentContainerStyle={{ paddingBottom: spacing.md }}>
              {isAdmin && (
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>{t('dashboard.fleets')}</Text>
                  <View style={styles.chipRow}>
                    <TouchableOpacity
                      style={[styles.chip, selectedFleets.length === 0 && styles.chipActive]}
                      onPress={() => setSelectedFleets([])}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.chipText, selectedFleets.length === 0 && styles.chipTextActive]}>
                        {t('dashboard.allFleets')}
                      </Text>
                    </TouchableOpacity>
                    {fleetList.map((f) => {
                      const active = selectedFleets.includes(f.fleet_id);
                      return (
                        <TouchableOpacity
                          key={f.fleet_id}
                          style={[styles.chip, active && styles.chipActive]}
                          onPress={() => toggleFleet(f.fleet_id)}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.chipText, active && styles.chipTextActive]}>
                            {f.fleet_id}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                    {!fleetsLoaded && (
                      <ActivityIndicator size="small" color={colors.accent} />
                    )}
                  </View>
                </View>
              )}

              {!isAdmin && fleetId ? (
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>{t('dashboard.fleet')}</Text>
                  <View style={[styles.chip, styles.chipActive, { alignSelf: 'flex-start' }]}>
                    <Text style={[styles.chipText, styles.chipTextActive]}>{fleetId}</Text>
                  </View>
                </View>
              ) : null}

              <View style={styles.section}>
                <Text style={styles.sectionLabel}>{t('dashboard.timePeriod')}</Text>
                <View style={styles.chipRow}>
                  {periodChips.map((p) => {
                    const active = period === p.key;
                    return (
                      <TouchableOpacity
                        key={p.key}
                        style={[styles.chip, active && styles.chipActive]}
                        onPress={() => setPeriod(p.key)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>
                          {t(p.labelKey as any)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {period === 'pickMonth' && (
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>{t('dashboard.month')}</Text>
                  <View style={styles.chipRow}>
                    {monthOptions.map((m) => {
                      const active = pickedMonth === m.value;
                      return (
                        <TouchableOpacity
                          key={m.value}
                          style={[styles.chip, active && styles.chipActive]}
                          onPress={() => setPickedMonth(m.value)}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.chipText, active && styles.chipTextActive]}>
                            {m.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {period === 'custom' && (
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>{t('dashboard.from')}</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={colors.textTertiary}
                    value={dateStart}
                    onChangeText={setDateStart}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <Text style={[styles.sectionLabel, { marginTop: spacing.sm }]}>{t('dashboard.to')}</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={colors.textTertiary}
                    value={dateEnd}
                    onChangeText={setDateEnd}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              )}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setFilterVisible(false)}
                disabled={exporting}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelBtnText}>{t('general.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, exporting && styles.exportBtnDisabled]}
                onPress={confirmExport}
                disabled={exporting}
                activeOpacity={0.7}
              >
                {exporting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="download-outline" size={16} color="#fff" />
                    <Text style={styles.confirmBtnText}>{t('dashboard.export')}</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* ───────────────────────── Styles ───────────────────────── */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
  emptyText: {
    fontSize: 16,
    color: colors.textSecondary,
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
  list: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  greetingWrap: {
    flex: 1,
  },
  greetingName: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  greetingDate: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 8,
    borderRadius: borderRadius.sm,
  },
  exportBtnDisabled: {
    opacity: 0.6,
  },
  exportBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },

  /* Modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: modalOverlay,
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  modalBody: {
    paddingHorizontal: spacing.md,
  },
  section: {
    paddingTop: spacing.md,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.inputBackground,
  },
  chipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  chipTextActive: {
    color: '#fff',
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.textPrimary,
    backgroundColor: colors.inputBackground,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    backgroundColor: colors.white,
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  confirmBtn: {
    flex: 1.4,
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 12,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },

  /* Hero card */
  heroCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
    alignItems: 'center',
    ...shadows.sm,
  },
  donutContainer: {
    marginBottom: spacing.sm,
  },

  /* Legend */
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.lg,
    marginBottom: spacing.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendText: {
    fontSize: 12,
    color: colors.textSecondary,
  },

  /* Stat boxes */
  statBoxRow: {
    flexDirection: 'row',
    gap: spacing.md,
    width: '100%',
    marginBottom: spacing.sm,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    gap: 4,
  },
  statBoxChecked: {
    backgroundColor: statusColors.pass.bg,
  },
  statBoxPending: {
    backgroundColor: statusColors.fail.bg,
  },
  statBoxCount: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  statBoxLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },

  /* Date */
  dateLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },

  /* Section title */
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },

  /* Fleet card */
  fleetCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    ...shadows.sm,
  },

  /* Fleet row */
  fleetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  fleetRowComplete: {
    opacity: 0.55,
  },
  fleetInfo: {
    flex: 1,
    marginRight: spacing.sm,
  },
  fleetCode: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  fleetCodeUrgent: {
    color: colors.statusFail,
  },
  fleetBar: {
    height: 6,
    backgroundColor: colors.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  fleetBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  fleetNumbers: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    width: 44,
    textAlign: 'right',
    marginRight: spacing.sm,
  },
  fleetPct: {
    fontSize: 14,
    fontWeight: '700',
    width: 40,
    textAlign: 'right',
  },
});

const weeklyStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginBottom: spacing.md,
  },
  stat: {
    alignItems: 'center',
    flex: 1,
    gap: 4,
  },
  divider: {
    width: 1,
    height: 40,
    backgroundColor: colors.border,
  },
  num: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  pct: {
    fontSize: 24,
    fontWeight: '800',
  },
  label: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  barTrack: {
    height: 8,
    backgroundColor: colors.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: 8,
    borderRadius: 4,
  },
});

import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
} from 'react-native';
import Svg, { Rect, Text as SvgText, G } from 'react-native-svg';
import { Stack } from 'expo-router';
import { colors, spacing, borderRadius, shadows } from '../../../constants/theme';
import { useI18n } from '../../../lib/i18n-context';
import { apiFetch } from '../../../lib/api';
import { LineChart } from '../../../components/LineChart';

const PERIODS = [7, 30, 90] as const;
type Period = typeof PERIODS[number];

type FailingVehicle = {
  plate_number: string;
  fleet_id: string;
  fail_count: number;
};

type FailingItem = {
  item_name_th: string;
  item_name_en: string;
  fail_count: number;
};

type FleetStat = {
  fleet_id: string;
  total: number;
  passed: number;
  failed: number;
};

type DailyTrendPoint = {
  date: string;
  passed: number;
  failed: number;
};

type CompletionPoint = {
  date: string;
  inspected: number;
  total: number;
  rate: number;
};

type ResolutionPoint = {
  period: string;
  avg_hours: number;
  count: number;
};

type AnalyticsData = {
  topFailingVehicles: FailingVehicle[];
  topFailingItems: FailingItem[];
  fleetStats: FleetStat[];
  dailyTrend: DailyTrendPoint[];
  completionTrend: CompletionPoint[];
  resolutionTrend: ResolutionPoint[];
  period: { days: number; since: string };
};

const CHART_PADDING_H = 48;
const CHART_PADDING_V_TOP = 20;
const CHART_PADDING_V_BOTTOM = 28;
const BAR_GAP = 6;

function DailyTrendChart({ data, width }: { data: DailyTrendPoint[]; width: number }) {
  const visible = data.slice(-10);
  if (visible.length === 0) return null;

  const chartWidth = width - CHART_PADDING_H * 2;
  const chartHeight = 140;
  const totalHeight = chartHeight + CHART_PADDING_V_TOP + CHART_PADDING_V_BOTTOM;

  const maxTotal = Math.max(...visible.map((d) => d.passed + d.failed), 1);
  const barWidth = Math.max(4, (chartWidth - BAR_GAP * (visible.length - 1)) / visible.length);

  return (
    <Svg width={width} height={totalHeight}>
      {visible.map((point, i) => {
        const total = point.passed + point.failed;
        const passH = (point.passed / maxTotal) * chartHeight;
        const failH = (point.failed / maxTotal) * chartHeight;
        const x = CHART_PADDING_H + i * (barWidth + BAR_GAP);

        // date label: show MM/DD
        const dateParts = point.date.split('-');
        const dateLabel = dateParts.length === 3 ? `${dateParts[1]}/${dateParts[2]}` : point.date;

        return (
          <G key={point.date}>
            {/* Pass bar (bottom portion of stacked bar) */}
            {passH > 0 && (
              <Rect
                x={x}
                y={CHART_PADDING_V_TOP + chartHeight - passH - failH}
                width={barWidth}
                height={passH}
                fill={colors.statusPass}
                rx={2}
              />
            )}
            {/* Fail bar (top portion of stacked bar) */}
            {failH > 0 && (
              <Rect
                x={x}
                y={CHART_PADDING_V_TOP + chartHeight - failH}
                width={barWidth}
                height={failH}
                fill={colors.accent}
                rx={2}
              />
            )}
            {/* Total count above bar */}
            {total > 0 && (
              <SvgText
                x={x + barWidth / 2}
                y={CHART_PADDING_V_TOP + chartHeight - passH - failH - 4}
                fontSize={9}
                fill={colors.textSecondary}
                textAnchor="middle"
              >
                {total}
              </SvgText>
            )}
            {/* Date label below */}
            <SvgText
              x={x + barWidth / 2}
              y={CHART_PADDING_V_TOP + chartHeight + 16}
              fontSize={9}
              fill={colors.textSecondary}
              textAnchor="middle"
            >
              {dateLabel}
            </SvgText>
          </G>
        );
      })}
    </Svg>
  );
}

function RankedRow({
  rank,
  label,
  sublabel,
  count,
  maxCount,
}: {
  rank: number;
  label: string;
  sublabel?: string;
  count: number;
  maxCount: number;
}) {
  const barPct = maxCount > 0 ? count / maxCount : 0;

  return (
    <View style={styles.rankedRow}>
      <View style={styles.rankedMeta}>
        <Text style={styles.rankedNum}>{rank}</Text>
        <View style={styles.rankedLabelWrap}>
          <Text style={styles.rankedLabel} numberOfLines={1}>
            {label}
          </Text>
          {sublabel ? (
            <Text style={styles.rankedSublabel} numberOfLines={1}>
              {sublabel}
            </Text>
          ) : null}
        </View>
        <Text style={styles.rankedCount}>{count}</Text>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${barPct * 100}%` }]} />
      </View>
    </View>
  );
}

function FleetBar({ stat }: { stat: FleetStat }) {
  const passPct = stat.total > 0 ? stat.passed / stat.total : 0;
  const failPct = stat.total > 0 ? stat.failed / stat.total : 0;

  return (
    <View style={styles.fleetBarRow}>
      <View style={styles.fleetBarHeader}>
        <Text style={styles.fleetBarId} numberOfLines={1}>
          {stat.fleet_id}
        </Text>
        <Text style={styles.fleetBarTotal}>{stat.total} total</Text>
        <Text style={styles.fleetBarPassRate}>{Math.round(passPct * 100)}%</Text>
      </View>
      <View style={styles.fleetBarTrack}>
        {passPct > 0 && (
          <View style={[styles.fleetBarPass, { flex: passPct }]} />
        )}
        {failPct > 0 && (
          <View style={[styles.fleetBarFail, { flex: failPct }]} />
        )}
        {stat.total === 0 && <View style={[styles.fleetBarEmpty, { flex: 1 }]} />}
      </View>
      <View style={styles.fleetBarLegendRow}>
        <View style={styles.fleetLegendDot}>
          <View style={[styles.legendDot, { backgroundColor: colors.statusPass }]} />
          <Text style={styles.legendText}>{stat.passed}</Text>
        </View>
        <View style={styles.fleetLegendDot}>
          <View style={[styles.legendDot, { backgroundColor: colors.accent }]} />
          <Text style={styles.legendText}>{stat.failed}</Text>
        </View>
      </View>
    </View>
  );
}

export default function AnalyticsScreen() {
  const { t, locale } = useI18n();
  const [period, setPeriod] = useState<Period>(30);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const screenWidth = Dimensions.get('window').width;

  const fetchData = useCallback(
    async (days: number) => {
      try {
        setError(null);
        const result: AnalyticsData = await apiFetch(`/api/admin/analytics?days=${days}`);
        setData(result);
      } catch (err: any) {
        setError(err.message || t('general.error'));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [t],
  );

  useEffect(() => {
    setLoading(true);
    fetchData(period);
  }, [period, fetchData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData(period);
  };

  const selectPeriod = (days: Period) => {
    if (days !== period) {
      setPeriod(days);
      setLoading(true);
    }
  };

  const cardWidth = screenWidth - spacing.md * 2;

  return (
    <>
      <Stack.Screen options={{ title: t('admin.analytics.title') }} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* Period selector */}
        <View style={styles.periodRow}>
          {PERIODS.map((days) => (
            <TouchableOpacity
              key={days}
              style={[styles.periodBtn, period === days && styles.periodBtnActive]}
              onPress={() => selectPeriod(days)}
              activeOpacity={0.75}
            >
              <Text
                style={[
                  styles.periodBtnText,
                  period === days && styles.periodBtnTextActive,
                ]}
              >
                {days === 7 ? '7d' : days === 30 ? '30d' : '90d'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading && !refreshing ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>{t('general.loading')}</Text>
          </View>
        ) : error ? (
          <View style={styles.errorSection}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => {
                setLoading(true);
                fetchData(period);
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.retryText}>{t('general.retry')}</Text>
            </TouchableOpacity>
          </View>
        ) : !data ? null : (
          <>
            {/* ── Daily Trend ── */}
            <View style={[styles.card, { paddingHorizontal: 0 }]}>
              <Text style={[styles.cardTitle, { paddingHorizontal: spacing.md }]}>
                {t('admin.analytics.dailyTrend')}
              </Text>
              {data.dailyTrend.length === 0 ? (
                <Text style={styles.noData}>{t('admin.analytics.noData')}</Text>
              ) : (
                <>
                  {/* Legend */}
                  <View style={[styles.legendRow, { paddingHorizontal: spacing.md }]}>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: colors.statusPass }]} />
                      <Text style={styles.legendText}>{t('inspection.pass')}</Text>
                    </View>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: colors.accent }]} />
                      <Text style={styles.legendText}>{t('inspection.fail')}</Text>
                    </View>
                  </View>
                  <DailyTrendChart data={data.dailyTrend} width={cardWidth} />
                </>
              )}
            </View>

            {/* ── Top Failing Vehicles ── */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t('admin.analytics.topFailVehicles')}</Text>
              {data.topFailingVehicles.length === 0 ? (
                <Text style={styles.noData}>{t('admin.analytics.noData')}</Text>
              ) : (
                (() => {
                  const maxFail = Math.max(
                    ...data.topFailingVehicles.map((v) => v.fail_count),
                    1,
                  );
                  return data.topFailingVehicles.slice(0, 10).map((v, i) => (
                    <RankedRow
                      key={v.plate_number}
                      rank={i + 1}
                      label={v.plate_number}
                      sublabel={v.fleet_id}
                      count={v.fail_count}
                      maxCount={maxFail}
                    />
                  ));
                })()
              )}
            </View>

            {/* ── Top Failing Items ── */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t('admin.analytics.topFailItems')}</Text>
              {data.topFailingItems.length === 0 ? (
                <Text style={styles.noData}>{t('admin.analytics.noData')}</Text>
              ) : (
                (() => {
                  const maxFail = Math.max(
                    ...data.topFailingItems.map((item) => item.fail_count),
                    1,
                  );
                  return data.topFailingItems.slice(0, 10).map((item, i) => {
                    const name =
                      locale === 'th' ? item.item_name_th : item.item_name_en;
                    return (
                      <RankedRow
                        key={`${item.item_name_en}-${i}`}
                        rank={i + 1}
                        label={name || item.item_name_en || item.item_name_th}
                        count={item.fail_count}
                        maxCount={maxFail}
                      />
                    );
                  });
                })()
              )}
            </View>

            {/* ── Fleet Comparison ── */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t('admin.analytics.fleetComparison')}</Text>
              {data.fleetStats.length === 0 ? (
                <Text style={styles.noData}>{t('admin.analytics.noData')}</Text>
              ) : (
                data.fleetStats.map((stat) => (
                  <FleetBar key={stat.fleet_id} stat={stat} />
                ))
              )}
            </View>

            {/* ── Completion Rate Trend ── */}
            <View style={[styles.card, { paddingHorizontal: 0 }]}>
              <Text style={[styles.cardTitle, { paddingHorizontal: spacing.md }]}>
                {t('admin.analytics.completionRate')}
              </Text>
              {data.completionTrend.length === 0 ? (
                <Text style={styles.noData}>{t('admin.analytics.noData')}</Text>
              ) : (
                <View style={{ paddingHorizontal: spacing.xs }}>
                  <LineChart
                    data={data.completionTrend.map((d) => ({
                      label: d.date.slice(5).replace('-', '/'),
                      value: d.rate,
                    }))}
                    width={cardWidth}
                    color={colors.statusPass}
                    suffix="%"
                  />
                </View>
              )}
            </View>

            {/* ── Fail Rate Trend ── */}
            <View style={[styles.card, { paddingHorizontal: 0 }]}>
              <Text style={[styles.cardTitle, { paddingHorizontal: spacing.md }]}>
                {t('admin.analytics.failRate')}
              </Text>
              {data.dailyTrend.length === 0 ? (
                <Text style={styles.noData}>{t('admin.analytics.noData')}</Text>
              ) : (
                <View style={{ paddingHorizontal: spacing.xs }}>
                  <LineChart
                    data={data.dailyTrend.map((d) => ({
                      label: d.date.slice(5).replace('-', '/'),
                      value: d.passed + d.failed > 0
                        ? Math.round((d.failed / (d.passed + d.failed)) * 100)
                        : 0,
                    }))}
                    width={cardWidth}
                    color={colors.accent}
                    suffix="%"
                  />
                </View>
              )}
            </View>

            {/* ── Issue Resolution Time ── */}
            <View style={[styles.card, { paddingHorizontal: 0 }]}>
              <Text style={[styles.cardTitle, { paddingHorizontal: spacing.md }]}>
                {t('admin.analytics.resolutionTime')}
              </Text>
              {data.resolutionTrend.length === 0 ? (
                <Text style={styles.noData}>{t('admin.analytics.noData')}</Text>
              ) : (
                <View style={{ paddingHorizontal: spacing.xs }}>
                  <LineChart
                    data={data.resolutionTrend.map((d) => ({
                      label: d.period.slice(5).replace('-', '/'),
                      value: parseFloat(String(d.avg_hours)),
                    }))}
                    width={cardWidth}
                    color={colors.primary}
                    suffix="h"
                  />
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  centered: {
    alignItems: 'center',
    paddingVertical: spacing.xl * 2,
  },
  loadingText: {
    marginTop: spacing.sm,
    color: colors.textSecondary,
  },
  // Period selector
  periodRow: {
    flexDirection: 'row',
    marginBottom: spacing.md,
    backgroundColor: colors.white,
    borderRadius: borderRadius.sm,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  periodBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: borderRadius.sm - 2,
  },
  periodBtnActive: {
    backgroundColor: colors.primary,
  },
  periodBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  periodBtnTextActive: {
    color: colors.onPrimary,
  },
  // Card
  card: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
    overflow: 'hidden',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  noData: {
    fontSize: 13,
    color: colors.textTertiary,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
  // Legend
  legendRow: {
    flexDirection: 'row',
    marginBottom: 4,
    gap: spacing.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  // Ranked rows
  rankedRow: {
    marginBottom: spacing.sm,
  },
  rankedMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  rankedNum: {
    width: 20,
    fontSize: 12,
    fontWeight: '700',
    color: colors.textTertiary,
    textAlign: 'center',
    marginRight: 6,
  },
  rankedLabelWrap: {
    flex: 1,
  },
  rankedLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  rankedSublabel: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  rankedCount: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.accent,
    marginLeft: spacing.sm,
    minWidth: 24,
    textAlign: 'right',
  },
  barTrack: {
    height: 6,
    backgroundColor: colors.border,
    borderRadius: 3,
    overflow: 'hidden',
    marginLeft: 26,
  },
  barFill: {
    height: 6,
    backgroundColor: colors.accent,
    borderRadius: 3,
  },
  // Fleet comparison bars
  fleetBarRow: {
    marginBottom: spacing.md,
  },
  fleetBarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  fleetBarId: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  fleetBarTotal: {
    fontSize: 11,
    color: colors.textSecondary,
    marginRight: spacing.sm,
  },
  fleetBarPassRate: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.statusPass,
    minWidth: 36,
    textAlign: 'right',
  },
  fleetBarTrack: {
    flexDirection: 'row',
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: colors.border,
  },
  fleetBarPass: {
    backgroundColor: colors.statusPass,
  },
  fleetBarFail: {
    backgroundColor: colors.accent,
  },
  fleetBarEmpty: {
    backgroundColor: colors.border,
  },
  fleetBarLegendRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: 4,
  },
  fleetLegendDot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  // Error
  errorSection: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  errorText: {
    fontSize: 15,
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

import { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Alert,
  TextInput,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { colors, spacing, borderRadius, shadows } from '../../../constants/theme';
import { useI18n } from '../../../lib/i18n-context';
import { API_BASE, apiFetch, getAuthToken } from '../../../lib/api';
import { brand } from '../../../branding';
import { useDebounce } from '../../../lib/useDebounce';
import { formatDateTimeThai as formatDate } from '../../../lib/format-date';
import { vehicleTypeLabel, type IssueStatus } from '../../../lib/types';

type IssueWithVehicle = {
  id: string;
  inspection_id: string;
  vehicle_id: string;
  fleet_id: string;
  status: IssueStatus;
  defect_photo_urls: string[];
  completion_photo_urls: string[];
  created_at: string;
  updated_at: string;
  plate_number: string;
  vehicle_type: string;
  vehicle_fleet: string;
  inspector_name: string | null;
  inspection_date: string | null;
};

type TabFilter = 'all' | 'open' | 'in_progress' | 'completed';

const STATUS_COLORS: Record<IssueStatus, string> = {
  open: colors.statusFail,
  in_progress: colors.primary,
  completed: colors.statusPass,
};

const STATUS_ICONS: Record<IssueStatus, keyof typeof Ionicons.glyphMap> = {
  open: 'alert-circle',
  in_progress: 'time-outline',
  completed: 'checkmark-circle',
};

const ITEM_HEIGHT = 80;
const PAGE_LIMIT = 50;

export default function AdminIssuesScreen() {
  const { t } = useI18n();
  const [issues, setIssues] = useState<IssueWithVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabFilter>('all');
  const [error, setError] = useState<string | null>(null);
  const [selectedIssue, setSelectedIssue] = useState<IssueWithVehicle | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [hasMore, setHasMore] = useState(true);
  const [exporting, setExporting] = useState(false);
  const offsetRef = useRef(0);
  const debouncedSearch = useDebounce(search, 300);

  const fetchIssues = useCallback(async (reset = false) => {
    try {
      setError(null);
      const currentOffset = reset ? 0 : offsetRef.current;
      const params = new URLSearchParams();
      if (activeTab !== 'all') params.set('status', activeTab);
      if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim());
      params.set('limit', String(PAGE_LIMIT));
      params.set('offset', String(currentOffset));
      const data = await apiFetch(`/api/issues?${params.toString()}`);
      const fetched: IssueWithVehicle[] = data.issues || data;
      if (reset) {
        setIssues(fetched);
        offsetRef.current = fetched.length;
      } else {
        setIssues((prev) => [...prev, ...fetched]);
        offsetRef.current = currentOffset + fetched.length;
      }
      setHasMore(fetched.length >= PAGE_LIMIT);
    } catch (err) {
      console.error('Failed to fetch issues:', err);
      setError(t('general.error'));
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [activeTab, debouncedSearch]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      setIssues([]);
      offsetRef.current = 0;
      setHasMore(true);
      fetchIssues(true);
    }, [activeTab, debouncedSearch])
  );

  const onRefresh = () => {
    setRefreshing(true);
    setIssues([]);
    offsetRef.current = 0;
    setHasMore(true);
    fetchIssues(true);
  };

  const loadMore = () => {
    if (!hasMore || loading || loadingMore) return;
    setLoadingMore(true);
    fetchIssues(false);
  };

  const handleStatusChange = async (issue: IssueWithVehicle, newStatus: IssueStatus) => {
    if (issue.status === newStatus) return;
    setActionLoading(true);
    try {
      await apiFetch(`/api/issues/${issue.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      setSelectedIssue(null);
      Alert.alert(t('admin.issues.statusChanged'));
      setLoading(true);
      setIssues([]);
      offsetRef.current = 0;
      setHasMore(true);
      fetchIssues(true);
    } catch {
      Alert.alert(t('general.error'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleForceClose = (issue: IssueWithVehicle) => {
    Alert.alert(
      t('admin.issues.forceClose'),
      t('admin.issues.closeConfirm'),
      [
        { text: t('admin.cancel'), style: 'cancel' },
        {
          text: t('admin.issues.forceClose'),
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              await apiFetch(`/api/issues/${issue.id}`, {
                method: 'PATCH',
                body: JSON.stringify({ status: 'completed', forceClose: true }),
              });
              setSelectedIssue(null);
              setIssues([]);
              offsetRef.current = 0;
              setHasMore(true);
              fetchIssues(true);
              Alert.alert('', t('admin.issues.closed'));
            } catch {
              Alert.alert(t('general.error'));
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (activeTab !== 'all') params.set('status', activeTab);
      const token = await getAuthToken();
      const url = `${API_BASE}/api/issues/export?${params.toString()}`;
      const filename = `${brand.fileSlug}-issues-${new Date().toISOString().slice(0, 10)}.xlsx`;
      const fileUri = `${FileSystem.cacheDirectory}${filename}`;

      const result = await FileSystem.downloadAsync(url, fileUri, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (result.status !== 200) throw new Error(`Export failed (${result.status})`);

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(result.uri, {
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          dialogTitle: 'Save Issues Report',
          UTI: 'com.microsoft.excel.xlsx',
        });
      } else {
        Alert.alert(t('general.exportSaved'), result.uri);
      }
    } catch (err: any) {
      Alert.alert(t('general.error'), err.message || t('general.exportFailed'));
    } finally {
      setExporting(false);
    }
  };

  const statusLabel = (status: IssueStatus) => {
    switch (status) {
      case 'open': return t('issues.statusOpen');
      case 'in_progress': return t('issues.statusInProgress');
      case 'completed': return t('issues.statusCompleted');
    }
  };

  // formatDate imported from lib/format-date

  const tabs: { key: TabFilter; label: string }[] = [
    { key: 'all', label: t('issues.all') },
    { key: 'open', label: t('issues.open') },
    { key: 'in_progress', label: t('issues.inProgress') },
    { key: 'completed', label: t('issues.completed') },
  ];

  const renderIssue = ({ item }: { item: IssueWithVehicle }) => (
    <TouchableOpacity
      style={[styles.row, item.status === 'completed' && styles.rowDone]}
      activeOpacity={0.6}
      onPress={() => setSelectedIssue(item)}
    >
      <Ionicons
        name={STATUS_ICONS[item.status]}
        size={26}
        color={STATUS_COLORS[item.status]}
      />
      <View style={styles.rowContent}>
        <View style={styles.rowHeader}>
          <Text style={styles.plate}>{item.plate_number}</Text>
          <View style={[styles.badge, { backgroundColor: STATUS_COLORS[item.status] + '20' }]}>
            <Text style={[styles.badgeText, { color: STATUS_COLORS[item.status] }]}>
              {statusLabel(item.status)}
            </Text>
          </View>
        </View>
        <Text style={styles.meta}>
          {vehicleTypeLabel(item.vehicle_type)}
          {' • '}{item.fleet_id}{' • '}{formatDate(item.created_at)}
        </Text>
        {item.inspector_name && (
          <Text style={styles.inspector}>{item.inspector_name}</Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Status filter tabs */}
      <View style={styles.tabRow}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Search bar + Export */}
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
          autoCapitalize="none"
        />
        <TouchableOpacity
          style={[styles.exportBtn, exporting && styles.exportBtnDisabled]}
          onPress={handleExport}
          disabled={exporting}
          activeOpacity={0.75}
        >
          {exporting ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Ionicons name="download-outline" size={16} color={colors.white} />
          )}
          <Text style={styles.exportBtnText}>
            {exporting ? t('issues.exporting') : t('issues.export')}
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>{t('general.loading')}</Text>
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.accent} style={{ marginBottom: spacing.md }} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => { setLoading(true); setIssues([]); offsetRef.current = 0; setHasMore(true); fetchIssues(true); }}
            activeOpacity={0.7}
          >
            <Text style={styles.retryText}>{t('general.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : issues.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="checkmark-done-circle-outline" size={48} color={colors.textTertiary} style={{ marginBottom: spacing.sm }} />
          <Text style={styles.emptyText}>{t('issues.noIssues')}</Text>
        </View>
      ) : (
        <FlatList
          data={issues}
          keyExtractor={(item) => item.id}
          renderItem={renderIssue}
          initialNumToRender={14}
          maxToRenderPerBatch={10}
          windowSize={10}
          getItemLayout={(_, index) => ({
            length: ITEM_HEIGHT,
            offset: ITEM_HEIGHT * index,
            index,
          })}
          onEndReachedThreshold={0.5}
          onEndReached={() => { if (hasMore && !loading) loadMore(); }}
          ListFooterComponent={loadingMore ? <ActivityIndicator style={styles.footerLoader} color={colors.primary} /> : null}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
        />
      )}

      {/* Action modal */}
      <Modal
        visible={selectedIssue !== null}
        transparent
        statusBarTranslucent
        animationType="slide"
        onRequestClose={() => setSelectedIssue(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setSelectedIssue(null)}
        />
        {selectedIssue && (
          <View style={styles.modalSheet}>
            {/* Handle bar */}
            <View style={styles.modalHandle} />

            {/* Vehicle info */}
            <View style={styles.modalVehicleInfo}>
              <Text style={styles.modalPlate}>{selectedIssue.plate_number}</Text>
              <Text style={styles.modalMeta}>
                {vehicleTypeLabel(selectedIssue.vehicle_type)}
                {' • '}{selectedIssue.fleet_id}{' • '}{formatDate(selectedIssue.created_at)}
              </Text>
              {selectedIssue.inspector_name && (
                <Text style={styles.modalMeta}>
                  {t('inspection.inspector')}: {selectedIssue.inspector_name}
                </Text>
              )}
            </View>

            {/* Current status */}
            <View style={styles.modalStatusRow}>
              <Text style={styles.modalStatusLabel}>{t('admin.issues.changeStatus')}</Text>
              <View style={[styles.badge, { backgroundColor: STATUS_COLORS[selectedIssue.status] + '20' }]}>
                <Text style={[styles.badgeText, { color: STATUS_COLORS[selectedIssue.status] }]}>
                  {statusLabel(selectedIssue.status)}
                </Text>
              </View>
            </View>

            {/* Status change buttons */}
            <View style={styles.statusBtnRow}>
              {(['open', 'in_progress', 'completed'] as IssueStatus[]).map((s) => {
                const isActive = selectedIssue.status === s;
                return (
                  <TouchableOpacity
                    key={s}
                    style={[
                      styles.statusBtn,
                      { borderColor: STATUS_COLORS[s] },
                      isActive && { backgroundColor: STATUS_COLORS[s] },
                    ]}
                    onPress={() => handleStatusChange(selectedIssue, s)}
                    activeOpacity={0.75}
                    disabled={actionLoading || isActive}
                  >
                    <Ionicons
                      name={STATUS_ICONS[s]}
                      size={16}
                      color={isActive ? colors.white : STATUS_COLORS[s]}
                    />
                    <Text style={[styles.statusBtnText, { color: isActive ? colors.white : STATUS_COLORS[s] }]}>
                      {statusLabel(s)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Divider */}
            <View style={styles.divider} />

            {/* Force close button */}
            <TouchableOpacity
              style={[
                styles.forceCloseBtn,
                (actionLoading || selectedIssue.status === 'completed') && styles.forceBtnDisabled,
              ]}
              onPress={() => handleForceClose(selectedIssue)}
              activeOpacity={0.8}
              disabled={actionLoading || selectedIssue.status === 'completed'}
            >
              {actionLoading ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <>
                  <Ionicons name="close-circle" size={20} color={colors.white} />
                  <Text style={styles.forceCloseBtnText}>{t('admin.issues.forceClose')}</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Cancel button */}
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => setSelectedIssue(null)}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelBtnText}>{t('admin.cancel')}</Text>
            </TouchableOpacity>
          </View>
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  /* Tab bar */
  tabRow: {
    flexDirection: 'row',
    padding: spacing.sm,
    margin: spacing.sm,
    marginBottom: 0,
    gap: 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.inputBackground,
  },
  tab: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: 4,
  },
  tabActive: {
    backgroundColor: colors.primary,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: colors.onPrimary,
    fontWeight: '700',
  },

  /* Search bar */
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  searchIcon: {
    marginRight: spacing.xs,
  },
  searchInput: {
    flex: 1,
    height: 36,
    fontSize: 15,
    color: colors.textPrimary,
    backgroundColor: colors.inputBackground,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    borderRadius: borderRadius.sm,
    marginLeft: spacing.xs,
  },
  exportBtnDisabled: {
    opacity: 0.6,
  },
  exportBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.white,
  },

  /* List row */
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.md,
    minHeight: ITEM_HEIGHT,
  },
  rowDone: {
    opacity: 0.6,
  },
  rowContent: {
    flex: 1,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  plate: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  meta: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  inspector: {
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: 2,
  },

  /* Status badge */
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },

  /* Footer loader */
  footerLoader: {
    paddingVertical: spacing.md,
  },

  /* States */
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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

  /* Modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xl + spacing.md,
    ...shadows.lg,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },
  modalVehicleInfo: {
    marginBottom: spacing.md,
  },
  modalPlate: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  modalMeta: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  modalStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  modalStatusLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },

  /* Status change buttons */
  statusBtnRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  statusBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.sm,
    borderWidth: 1.5,
  },
  statusBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },

  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginBottom: spacing.md,
  },

  /* Force close */
  forceCloseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.accent,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  forceBtnDisabled: {
    opacity: 0.45,
  },
  forceCloseBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.white,
  },

  /* Cancel */
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.inputBackground,
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textSecondary,
  },
});

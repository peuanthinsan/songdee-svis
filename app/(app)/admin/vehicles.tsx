import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Modal,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from 'expo-router';
import { colors, spacing, borderRadius, shadows } from '../../../constants/theme';
import { useI18n } from '../../../lib/i18n-context';
import { apiFetch } from '../../../lib/api';
import { useDebounce } from '../../../lib/useDebounce';
import { type VehicleType, VEHICLE_TYPE_LABELS } from '../../../lib/types';

type Vehicle = {
  id: string;
  plate_number: string;
  vehicle_type: VehicleType;
  fleet_id: string;
  fleet_manager_email: string;
};

type FleetSummary = {
  fleet_id: string;
};

type FormState = {
  plate_number: string;
  vehicle_type: VehicleType;
  fleet_id: string;
  fleet_manager_email: string;
};

const VEHICLE_TYPE_ICONS: Record<VehicleType, React.ComponentProps<typeof Ionicons>['name']> = {
  car: 'car-outline',
  van: 'bus-outline',
  e_van: 'bus-outline',
  motorcycle: 'bicycle-outline',
  e_bike: 'bicycle-outline',
};

const EMPTY_FORM: FormState = {
  plate_number: '',
  vehicle_type: 'car',
  fleet_id: '',
  fleet_manager_email: '',
};

function mergeVehiclesById(current: Vehicle[], incoming: Vehicle[]): Vehicle[] {
  const vehiclesById = new Map(current.map((vehicle) => [vehicle.id, vehicle]));
  for (const vehicle of incoming) {
    vehiclesById.set(vehicle.id, vehicle);
  }
  return [...vehiclesById.values()];
}

export default function AdminVehiclesScreen() {
  const { t } = useI18n();
  const navigation = useNavigation();

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const offsetRef = useRef(0);
  const requestGenerationRef = useRef(0);
  const fleetRequestGenerationRef = useRef(0);
  const resetInFlightRef = useRef(false);
  const loadMoreInFlightRef = useRef(false);
  const [reloadVersion, setReloadVersion] = useState(0);

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [selectedFleet, setSelectedFleet] = useState<string | null>(null);
  const [fleetIds, setFleetIds] = useState<string[]>([]);

  const [modalVisible, setModalVisible] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const PAGE_LIMIT = 100;

  const fetchFleetIds = useCallback(async () => {
    const requestGeneration = ++fleetRequestGenerationRef.current;
    try {
      const data = await apiFetch('/api/admin/fleets');
      const fleets: FleetSummary[] = data.fleets ?? data ?? [];
      if (requestGeneration !== fleetRequestGenerationRef.current) return;
      setFleetIds(
        [...new Set(fleets.map((fleet) => fleet.fleet_id).filter(Boolean))].sort()
      );
    } catch {
      // Vehicle rows still contribute fleet IDs below if this metadata request fails.
    }
  }, []);

  const fetchVehicles = useCallback(async (reset = false) => {
    if (!reset && (resetInFlightRef.current || loadMoreInFlightRef.current)) return;

    const requestGeneration = reset
      ? ++requestGenerationRef.current
      : requestGenerationRef.current;

    if (reset) {
      resetInFlightRef.current = true;
    } else {
      loadMoreInFlightRef.current = true;
      setLoadingMore(true);
    }

    try {
      setError(null);
      const currentOffset = reset ? 0 : offsetRef.current;
      const params = new URLSearchParams();
      params.set('limit', String(PAGE_LIMIT));
      params.set('offset', String(currentOffset));
      if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim());
      if (selectedFleet) params.set('fleetId', selectedFleet);
      const data = await apiFetch(`/api/admin/vehicles?${params.toString()}`);
      const fetched: Vehicle[] = data.vehicles ?? data ?? [];
      if (requestGeneration !== requestGenerationRef.current) return;

      setFleetIds((current) => (
        [...new Set([
          ...current,
          ...fetched.map((vehicle) => vehicle.fleet_id).filter(Boolean),
        ])].sort()
      ));

      if (reset) {
        setVehicles(mergeVehiclesById([], fetched));
        offsetRef.current = fetched.length;
      } else {
        setVehicles((current) => mergeVehiclesById(current, fetched));
        offsetRef.current = currentOffset + fetched.length;
      }
      setHasMore(fetched.length >= PAGE_LIMIT);
    } catch (err: any) {
      if (requestGeneration === requestGenerationRef.current) {
        setError(err.message || t('general.error'));
      }
    } finally {
      if (!reset) loadMoreInFlightRef.current = false;
      if (requestGeneration === requestGenerationRef.current) {
        if (reset) resetInFlightRef.current = false;
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    }
  }, [debouncedSearch, selectedFleet]);

  const loadMore = () => {
    if (
      !hasMore
      || loading
      || loadingMore
      || resetInFlightRef.current
      || loadMoreInFlightRef.current
    ) return;
    void fetchVehicles(false);
  };

  useEffect(() => {
    void fetchFleetIds();
  }, [fetchFleetIds]);

  // Refetch when fleet filter or search changes
  useEffect(() => {
    setVehicles([]);
    offsetRef.current = 0;
    setHasMore(true);
    setLoading(true);
    void fetchVehicles(true);
  }, [fetchVehicles, reloadVersion]);

  // Set header add button
  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={openAddModal}
          style={styles.headerBtn}
          activeOpacity={0.7}
        >
          <Ionicons name="add" size={26} color={colors.onPrimary} />
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  const onRefresh = () => {
    setRefreshing(true);
    setVehicles([]);
    offsetRef.current = 0;
    setHasMore(true);
    void fetchFleetIds();
    void fetchVehicles(true);
  };

  const openAddModal = () => {
    setEditingVehicle(null);
    setForm(EMPTY_FORM);
    setModalVisible(true);
  };

  const openEditModal = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle);
    setForm({
      plate_number: vehicle.plate_number,
      vehicle_type: vehicle.vehicle_type,
      fleet_id: vehicle.fleet_id,
      fleet_manager_email: vehicle.fleet_manager_email,
    });
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setEditingVehicle(null);
    setForm(EMPTY_FORM);
  };

  const handleSave = async () => {
    if (!form.plate_number.trim()) {
      Alert.alert('', t('admin.vehicles.plateNumber'));
      return;
    }
    if (!form.fleet_id.trim()) {
      Alert.alert('', t('admin.vehicles.fleet'));
      return;
    }

    setSaving(true);
    try {
      const payload = {
        plateNumber: form.plate_number.trim(),
        vehicleType: form.vehicle_type,
        fleetId: form.fleet_id.trim(),
        fleetManagerEmail: form.fleet_manager_email.trim() || undefined,
      };
      if (editingVehicle) {
        await apiFetch(`/api/admin/vehicles/${editingVehicle.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        Alert.alert('', t('admin.vehicles.updated'));
      } else {
        await apiFetch('/api/admin/vehicles', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        Alert.alert('', t('admin.vehicles.created'));
      }
      closeModal();
      setLoading(true);
      setReloadVersion((current) => current + 1);
      void fetchFleetIds();
    } catch (err: any) {
      if (err.message?.includes('already exists') || err.message?.includes('Plate number')) {
        Alert.alert('', t('admin.vehicles.duplicatePlate') || 'Plate number already exists');
      } else {
        Alert.alert(t('general.error'), err.message);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (vehicle: Vehicle) => {
    Alert.alert(
      t('admin.vehicles.deleteConfirm'),
      vehicle.plate_number,
      [
        { text: t('admin.cancel'), style: 'cancel' },
        {
          text: t('admin.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await apiFetch(`/api/admin/vehicles/${vehicle.id}`, { method: 'DELETE' });
              Alert.alert('', t('admin.vehicles.deleted'));
              setLoading(true);
              setReloadVersion((current) => current + 1);
              void fetchFleetIds();
            } catch (err: any) {
              if (err.message && (err.message.includes('inspection') || err.message.includes('Cannot delete'))) {
                Alert.alert(t('general.error'), t('admin.vehicles.hasInspections'));
              } else {
                Alert.alert(t('general.error'), err.message || t('general.error'));
              }
            }
          },
        },
      ]
    );
  };

  const renderVehicleRow = ({ item }: { item: Vehicle }) => (
    <View style={styles.vehicleRow}>
      <View style={styles.vehicleIconWrap}>
        <Ionicons
          name={VEHICLE_TYPE_ICONS[item.vehicle_type] ?? 'car-outline'}
          size={22}
          color={colors.textSecondary}
        />
      </View>
      <View style={styles.vehicleInfo}>
        <Text style={styles.plateNumber}>{item.plate_number}</Text>
        <Text style={styles.vehicleMeta}>
          {VEHICLE_TYPE_LABELS[item.vehicle_type] ?? item.vehicle_type}
          {item.fleet_id ? ` · ${item.fleet_id}` : ''}
        </Text>
      </View>
      <TouchableOpacity
        style={styles.editBtn}
        onPress={() => openEditModal(item)}
        activeOpacity={0.7}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="pencil-outline" size={18} color={colors.primary} />
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.deleteBtn}
        onPress={() => handleDelete(item)}
        activeOpacity={0.7}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="trash-outline" size={18} color={colors.accent} />
      </TouchableOpacity>
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyState}>
      <Ionicons name="car-outline" size={48} color={colors.border} />
      <Text style={styles.emptyText}>{t('admin.noResults')}</Text>
    </View>
  );

  const renderHeader = () => (
    <>
      {/* Search bar */}
      <View style={styles.searchRow}>
        <Ionicons name="search-outline" size={18} color={colors.textTertiary} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder={t('admin.search')}
          placeholderTextColor={colors.textTertiary}
          value={search}
          onChangeText={setSearch}
          clearButtonMode="while-editing"
          autoCapitalize="characters"
          returnKeyType="search"
        />
      </View>

      {/* Fleet filter pills */}
      {fleetIds.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.fleetPills}
          style={styles.fleetPillsScroll}
        >
          <TouchableOpacity
            style={[styles.fleetPill, selectedFleet === null && styles.fleetPillActive]}
            onPress={() => setSelectedFleet(null)}
            activeOpacity={0.7}
          >
            <Text style={[styles.fleetPillText, selectedFleet === null && styles.fleetPillTextActive]}>
              All
            </Text>
          </TouchableOpacity>
          {fleetIds.map((fid) => (
            <TouchableOpacity
              key={fid}
              style={[styles.fleetPill, selectedFleet === fid && styles.fleetPillActive]}
              onPress={() => setSelectedFleet(fid)}
              activeOpacity={0.7}
            >
              <Text style={[styles.fleetPillText, selectedFleet === fid && styles.fleetPillTextActive]}>
                {fid}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Count */}
      <Text style={styles.countLabel}>
        {vehicles.length} {t('admin.vehicles')}
      </Text>
    </>
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>{t('general.loading')}</Text>
      </View>
    );
  }

  if (error && vehicles.length === 0) {
    return (
      <View style={styles.centered}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.accent} />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity
          style={styles.retryBtn}
          onPress={() => { setLoading(true); fetchVehicles(); }}
          activeOpacity={0.7}
        >
          <Text style={styles.retryText}>{t('general.retry')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={vehicles}
        keyExtractor={(item) => item.id}
        renderItem={renderVehicleRow}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        onEndReachedThreshold={0.5}
        onEndReached={() => { if (hasMore && !loading) loadMore(); }}
        ListFooterComponent={loadingMore ? <ActivityIndicator style={styles.footerLoader} color={colors.primary} /> : null}
        keyboardShouldPersistTaps="handled"
        removeClippedSubviews
        maxToRenderPerBatch={20}
        windowSize={10}
        initialNumToRender={15}
      />

      {/* Add/Edit Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        statusBarTranslucent
        onRequestClose={closeModal}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalSheet}>
            {/* Modal header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingVehicle ? t('admin.vehicles.edit') : t('admin.vehicles.add')}
              </Text>
              <TouchableOpacity onPress={closeModal} activeOpacity={0.7}>
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Plate number */}
              <Text style={styles.fieldLabel}>{t('admin.vehicles.plateNumber')}</Text>
              <TextInput
                style={styles.fieldInput}
                value={form.plate_number}
                onChangeText={(v) => setForm((f) => ({ ...f, plate_number: v }))}
                placeholder={t('admin.vehicles.plateNumber')}
                placeholderTextColor={colors.textTertiary}
                autoCapitalize="characters"
                autoCorrect={false}
              />

              {/* Vehicle type picker */}
              <Text style={styles.fieldLabel}>{t('admin.vehicles.vehicleType')}</Text>
              <View style={styles.typePicker}>
                {(['car', 'van', 'e_van', 'motorcycle', 'e_bike'] as VehicleType[]).map((vt) => (
                  <TouchableOpacity
                    key={vt}
                    style={[
                      styles.typeBtn,
                      form.vehicle_type === vt && styles.typeBtnActive,
                    ]}
                    onPress={() => setForm((f) => ({ ...f, vehicle_type: vt }))}
                    activeOpacity={0.75}
                  >
                    <Ionicons
                      name={VEHICLE_TYPE_ICONS[vt]}
                      size={18}
                      color={form.vehicle_type === vt ? colors.onPrimary : colors.textSecondary}
                    />
                    <Text
                      style={[
                        styles.typeBtnLabel,
                        form.vehicle_type === vt && styles.typeBtnLabelActive,
                      ]}
                    >
                      {VEHICLE_TYPE_LABELS[vt]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Fleet ID */}
              <Text style={styles.fieldLabel}>{t('admin.vehicles.fleet')}</Text>
              <TextInput
                style={styles.fieldInput}
                value={form.fleet_id}
                onChangeText={(v) => setForm((f) => ({ ...f, fleet_id: v }))}
                placeholder={t('admin.vehicles.fleet')}
                placeholderTextColor={colors.textTertiary}
                autoCapitalize="characters"
                autoCorrect={false}
              />

              {/* Fleet manager email */}
              <Text style={styles.fieldLabel}>{t('admin.vehicles.managerEmail')}</Text>
              <TextInput
                style={styles.fieldInput}
                value={form.fleet_manager_email}
                onChangeText={(v) => setForm((f) => ({ ...f, fleet_manager_email: v }))}
                placeholder={t('admin.vehicles.managerEmail')}
                placeholderTextColor={colors.textTertiary}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />

              {/* Action buttons */}
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={closeModal}
                  activeOpacity={0.7}
                >
                  <Text style={styles.cancelBtnText}>{t('admin.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                  onPress={handleSave}
                  activeOpacity={0.8}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color={colors.onPrimary} />
                  ) : (
                    <Text style={styles.saveBtnText}>{t('admin.save')}</Text>
                  )}
                </TouchableOpacity>
              </View>

              {/* Delete button when editing */}
              {editingVehicle && (
                <TouchableOpacity
                  style={styles.deleteModalBtn}
                  onPress={() => {
                    closeModal();
                    handleDelete(editingVehicle);
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="trash-outline" size={16} color={colors.accent} style={{ marginRight: spacing.xs }} />
                  <Text style={styles.deleteModalBtnText}>{t('admin.delete')}</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

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
    padding: spacing.lg,
  },
  loadingText: {
    marginTop: spacing.sm,
    color: colors.textSecondary,
    fontSize: 14,
  },
  errorText: {
    marginTop: spacing.sm,
    color: colors.accent,
    fontSize: 15,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  retryBtn: {
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
  headerBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  footerLoader: {
    paddingVertical: spacing.md,
  },
  // List
  listContent: {
    paddingBottom: spacing.xl,
  },
  // Search
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: borderRadius.sm,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  searchIcon: {
    marginRight: spacing.xs,
  },
  searchInput: {
    flex: 1,
    height: 44,
    fontSize: 15,
    color: colors.textPrimary,
  },
  // Fleet pills
  fleetPillsScroll: {
    marginBottom: spacing.sm,
  },
  fleetPills: {
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
  },
  fleetPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.full,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.xs,
  },
  fleetPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  fleetPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  fleetPillTextActive: {
    color: colors.onPrimary,
  },
  // Count
  countLabel: {
    fontSize: 12,
    color: colors.textTertiary,
    marginHorizontal: spacing.md,
    marginBottom: spacing.xs,
  },
  // Vehicle row
  vehicleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  vehicleIconWrap: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.inputBackground,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  vehicleInfo: {
    flex: 1,
  },
  plateNumber: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: 0.5,
  },
  vehicleMeta: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  editBtn: {
    padding: spacing.xs,
    marginLeft: spacing.xs,
  },
  deleteBtn: {
    padding: spacing.xs,
    marginLeft: spacing.xs,
  },
  // Empty
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xl + spacing.lg,
  },
  emptyText: {
    marginTop: spacing.sm,
    fontSize: 14,
    color: colors.textTertiary,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl + spacing.md,
    maxHeight: '90%',
    ...shadows.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },
  fieldInput: {
    backgroundColor: colors.inputBackground,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    fontSize: 15,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  // Vehicle type picker
  typePicker: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  typeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.inputBackground,
    gap: spacing.xs,
  },
  typeBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  typeBtnLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  typeBtnLabelActive: {
    color: colors.onPrimary,
  },
  // Modal actions
  modalActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: spacing.sm + 6,
    borderRadius: borderRadius.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  saveBtn: {
    flex: 2,
    paddingVertical: spacing.sm + 6,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.onPrimary,
  },
  deleteModalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
    paddingVertical: spacing.sm + 4,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.accent + '40',
    backgroundColor: colors.accent + '20',
  },
  deleteModalBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.accent,
  },
});

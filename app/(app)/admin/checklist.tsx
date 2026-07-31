import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, spacing, borderRadius, shadows } from '../../../constants/theme';
import { useI18n } from '../../../lib/i18n-context';
import { apiFetch } from '../../../lib/api';
import { type VehicleType, VEHICLE_TYPE_I18N_KEYS } from '../../../lib/types';

type Frequency = 'daily' | 'weekly' | 'post_route';

type ChecklistItem = {
  id: string;
  vehicle_type: VehicleType;
  frequency: Frequency;
  item_name_th: string;
  item_name_en: string;
  sort_order: number;
};

type FormState = {
  itemNameTh: string;
  itemNameEn: string;
  vehicleType: VehicleType;
  frequency: Frequency;
  sortOrder: string;
};

const EMPTY_FORM: FormState = {
  itemNameTh: '',
  itemNameEn: '',
  vehicleType: 'car',
  frequency: 'daily',
  sortOrder: '1',
};

const VEHICLE_TYPES: VehicleType[] = ['car', 'van', 'e_van', 'motorcycle', 'e_bike'];
const FREQUENCIES: Frequency[] = ['daily', 'weekly', 'post_route'];

function vehicleTypeLabel(t: (key: any) => string, vehicleType: VehicleType): string {
  return t(VEHICLE_TYPE_I18N_KEYS[vehicleType]);
}

function vehicleTypeIcon(vehicleType: VehicleType): React.ComponentProps<typeof Ionicons>['name'] {
  if (vehicleType === 'car') return 'car-outline';
  if (vehicleType === 'van' || vehicleType === 'e_van') return 'bus-outline';
  return 'bicycle-outline';
}

function frequencyLabel(t: (k: any) => string, freq: Frequency): string {
  if (freq === 'daily') return t('admin.checklist.daily');
  if (freq === 'weekly') return t('admin.checklist.weekly');
  return t('admin.checklist.postRoute');
}

export default function ChecklistEditorScreen() {
  const { t, locale } = useI18n();

  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [filterVehicleType, setFilterVehicleType] = useState<VehicleType>('car');
  const [filterFrequency, setFilterFrequency] = useState<Frequency>('daily');
  const [search, setSearch] = useState('');

  // Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<ChecklistItem | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const fetchItems = useCallback(async () => {
    try {
      setError(null);
      const data = await apiFetch('/api/admin/checklist');
      setItems(Array.isArray(data) ? data : (data.items ?? []));
    } catch (err: any) {
      setError(err.message || t('general.error'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchItems();
  };

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items
      .filter(
        (item) =>
          item.vehicle_type === filterVehicleType &&
          item.frequency === filterFrequency &&
          (q === '' ||
            item.item_name_th.toLowerCase().includes(q) ||
            item.item_name_en.toLowerCase().includes(q))
      )
      .sort((a, b) => a.sort_order - b.sort_order);
  }, [items, filterVehicleType, filterFrequency, search]);

  const openAdd = () => {
    setEditingItem(null);
    // Pre-populate vehicle_type and frequency from current filters
    setForm({
      ...EMPTY_FORM,
      vehicleType: filterVehicleType,
      frequency: filterFrequency,
      sortOrder: String(filteredItems.length + 1),
    });
    setModalVisible(true);
  };

  const openEdit = (item: ChecklistItem) => {
    setEditingItem(item);
    setForm({
      itemNameTh: item.item_name_th,
      itemNameEn: item.item_name_en,
      vehicleType: item.vehicle_type,
      frequency: item.frequency,
      sortOrder: String(item.sort_order),
    });
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setEditingItem(null);
    setForm(EMPTY_FORM);
  };

  const handleSave = async () => {
    const { itemNameTh, itemNameEn, vehicleType, frequency, sortOrder } = form;

    if (!itemNameTh.trim() || !itemNameEn.trim()) {
      Alert.alert(t('general.error'), `${t('admin.checklist.nameTh')} and ${t('admin.checklist.nameEn')} are required.`);
      return;
    }

    const sortNum = parseInt(sortOrder, 10);
    if (isNaN(sortNum) || sortNum < 1) {
      Alert.alert(t('general.error'), `${t('admin.checklist.sortOrder')} must be a positive number.`);
      return;
    }

    setSaving(true);
    try {
      if (editingItem) {
        const updated = await apiFetch('/api/admin/checklist', {
          method: 'PUT',
          body: JSON.stringify({
            id: editingItem.id,
            itemNameTh: itemNameTh.trim(),
            itemNameEn: itemNameEn.trim(),
            vehicleType,
            frequency,
            sortOrder: sortNum,
          }),
        });
        setItems((prev) =>
          prev.map((item) => (item.id === editingItem.id ? { ...item, ...updated } : item))
        );
        closeModal();
        Alert.alert('', t('admin.checklist.updated'));
      } else {
        const created = await apiFetch('/api/admin/checklist', {
          method: 'POST',
          body: JSON.stringify({
            vehicleType,
            frequency,
            itemNameTh: itemNameTh.trim(),
            itemNameEn: itemNameEn.trim(),
            sortOrder: sortNum,
          }),
        });
        setItems((prev) => [...prev, created]);
        closeModal();
        Alert.alert('', t('admin.checklist.created'));
      }
    } catch (err: any) {
      Alert.alert(t('general.error'), err.message || t('general.error'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (item: ChecklistItem) => {
    const displayName = locale === 'th' ? item.item_name_th : item.item_name_en;
    Alert.alert(
      t('admin.checklist.deleteConfirm'),
      displayName,
      [
        { text: t('admin.cancel'), style: 'cancel' },
        {
          text: t('admin.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await apiFetch(`/api/admin/checklist?id=${item.id}`, { method: 'DELETE' });
              setItems((prev) => prev.filter((i) => i.id !== item.id));
              Alert.alert('', t('admin.checklist.deleted'));
            } catch (err: any) {
              const msg = err.message || '';
              if (msg.includes('inspection') || msg.includes('history') || msg.includes('Cannot delete')) {
                Alert.alert('', t('admin.checklist.hasHistory'));
              } else {
                Alert.alert(t('general.error'), msg);
              }
            }
          },
        },
      ]
    );
  };

  const getItemName = (item: ChecklistItem) =>
    locale === 'th' ? item.item_name_th : item.item_name_en;

  const renderItem = ({ item }: { item: ChecklistItem }) => (
    <View style={styles.itemRow}>
      <View style={styles.sortBadge}>
        <Text style={styles.sortText}>{item.sort_order}</Text>
      </View>
      <Text style={styles.itemName} numberOfLines={2}>
        {getItemName(item)}
      </Text>
      <TouchableOpacity
        style={styles.actionBtn}
        onPress={() => openEdit(item)}
        activeOpacity={0.7}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="pencil-outline" size={18} color={colors.textSecondary} />
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.actionBtn}
        onPress={() => handleDelete(item)}
        activeOpacity={0.7}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="trash-outline" size={18} color={colors.accent} />
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>{t('general.loading')}</Text>
      </View>
    );
  }

  return (
    <>
      <View style={styles.container}>
        {/* Filter tabs */}
        <View style={styles.filtersWrap}>
          {/* Vehicle type toggle */}
          <View style={styles.toggleRow}>
            {VEHICLE_TYPES.map((vt) => {
              const active = filterVehicleType === vt;
              return (
                <TouchableOpacity
                  key={vt}
                  style={[styles.toggleBtn, active && styles.toggleBtnActive]}
                  onPress={() => setFilterVehicleType(vt)}
                  activeOpacity={0.75}
                >
                  <Ionicons
                    name={vehicleTypeIcon(vt)}
                    size={14}
                    color={active ? colors.onPrimary : colors.textSecondary}
                    style={{ marginRight: 4 }}
                  />
                  <Text style={[styles.toggleText, active && styles.toggleTextActive]}>
                    {vehicleTypeLabel(t, vt)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Frequency toggle */}
          <View style={[styles.toggleRow, { marginTop: spacing.xs }]}>
            {FREQUENCIES.map((freq) => {
              const active = filterFrequency === freq;
              return (
                <TouchableOpacity
                  key={freq}
                  style={[styles.toggleBtn, active && styles.toggleBtnActive]}
                  onPress={() => setFilterFrequency(freq)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.toggleText, active && styles.toggleTextActive]}>
                    {frequencyLabel(t, freq)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

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
            autoCapitalize="none"
          />
        </View>

        {/* Add button row */}
        <View style={styles.addRow}>
          <Text style={styles.countText}>
            {filteredItems.length} {locale === 'th' ? 'รายการ' : 'items'}
          </Text>
          <TouchableOpacity style={styles.addButton} onPress={openAdd} activeOpacity={0.8}>
            <Ionicons name="add" size={20} color={colors.onPrimary} />
            <Text style={styles.addButtonText}>{t('admin.checklist.add')}</Text>
          </TouchableOpacity>
        </View>

        {error ? (
          <View style={styles.errorSection}>
            <Ionicons
              name="alert-circle-outline"
              size={48}
              color={colors.accent}
              style={{ marginBottom: spacing.md }}
            />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => {
                setLoading(true);
                fetchItems();
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.retryText}>{t('general.retry')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={filteredItems}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Ionicons
                  name="clipboard-outline"
                  size={48}
                  color={colors.textTertiary}
                  style={{ marginBottom: spacing.sm }}
                />
                <Text style={styles.emptyText}>{t('admin.noResults')}</Text>
              </View>
            }
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.primary}
              />
            }
            initialNumToRender={15}
            maxToRenderPerBatch={10}
            windowSize={10}
            removeClippedSubviews
          />
        )}
      </View>

      {/* Add / Edit Modal */}
      <Modal
        visible={modalVisible}
        transparent
        statusBarTranslucent
        animationType="fade"
        onRequestClose={closeModal}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalCard}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingItem ? t('admin.checklist.edit') : t('admin.checklist.add')}
              </Text>
              <TouchableOpacity
                onPress={closeModal}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Name (Thai) */}
              <Text style={styles.fieldLabel}>{t('admin.checklist.nameTh')}</Text>
              <TextInput
                style={styles.textInput}
                value={form.itemNameTh}
                onChangeText={(v) => setForm((f) => ({ ...f, itemNameTh: v }))}
                placeholder={t('admin.checklist.nameTh')}
                placeholderTextColor={colors.textTertiary}
              />

              {/* Name (English) */}
              <Text style={styles.fieldLabel}>{t('admin.checklist.nameEn')}</Text>
              <TextInput
                style={styles.textInput}
                value={form.itemNameEn}
                onChangeText={(v) => setForm((f) => ({ ...f, itemNameEn: v }))}
                placeholder={t('admin.checklist.nameEn')}
                placeholderTextColor={colors.textTertiary}
                autoCapitalize="sentences"
              />

              {/* Vehicle Type picker */}
              <Text style={styles.fieldLabel}>{t('admin.checklist.vehicleType')}</Text>
              <View style={styles.chipRow}>
                {VEHICLE_TYPES.map((vt) => {
                  const active = form.vehicleType === vt;
                  return (
                    <TouchableOpacity
                      key={vt}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => setForm((f) => ({ ...f, vehicleType: vt }))}
                      activeOpacity={0.75}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>
                        {vehicleTypeLabel(t, vt)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Frequency picker */}
              <Text style={styles.fieldLabel}>{t('admin.checklist.frequency')}</Text>
              <View style={styles.chipRow}>
                {FREQUENCIES.map((freq) => {
                  const active = form.frequency === freq;
                  return (
                    <TouchableOpacity
                      key={freq}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => setForm((f) => ({ ...f, frequency: freq }))}
                      activeOpacity={0.75}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>
                        {frequencyLabel(t, freq)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Sort order */}
              <Text style={styles.fieldLabel}>{t('admin.checklist.sortOrder')}</Text>
              <TextInput
                style={styles.textInput}
                value={form.sortOrder}
                onChangeText={(v) => setForm((f) => ({ ...f, sortOrder: v }))}
                placeholder="1"
                placeholderTextColor={colors.textTertiary}
                keyboardType="number-pad"
              />
            </ScrollView>

            {/* Actions */}
            <View style={styles.modalActions}>
              {editingItem && (
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => {
                    closeModal();
                    // Small delay to let modal close cleanly before showing Alert
                    setTimeout(() => handleDelete(editingItem), 300);
                  }}
                  activeOpacity={0.7}
                  disabled={saving}
                >
                  <Ionicons name="trash-outline" size={16} color={colors.accent} />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={closeModal}
                activeOpacity={0.7}
                disabled={saving}
              >
                <Text style={styles.cancelText}>{t('admin.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                onPress={handleSave}
                activeOpacity={0.8}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color={colors.onPrimary} />
                ) : (
                  <Text style={styles.saveText}>{t('admin.save')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
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
  },
  loadingText: {
    marginTop: spacing.sm,
    color: colors.textSecondary,
  },

  // Filter tabs
  filtersWrap: {
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  toggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.inputBackground,
  },
  toggleBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  toggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  toggleTextActive: {
    color: colors.onPrimary,
  },

  // Search bar
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

  // Add row
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  countText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    ...shadows.sm,
  },
  addButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.onPrimary,
  },

  // List
  listContent: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
    marginLeft: 52,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  sortBadge: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  sortText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  itemName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: colors.textPrimary,
    marginRight: spacing.sm,
  },
  actionBtn: {
    padding: spacing.xs,
    marginLeft: spacing.xs,
  },

  // Empty / Error
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: spacing.xl * 2,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 15,
  },
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

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    maxHeight: '85%',
    ...shadows.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
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
  },
  textInput: {
    backgroundColor: colors.inputBackground,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    fontSize: 15,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },

  // Chip picker
  chipRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  chip: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  chipTextActive: {
    color: colors.onPrimary,
  },

  // Modal actions
  modalActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
    alignItems: 'center',
  },
  deleteButton: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.accent + '40',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: spacing.sm + 4,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  saveButton: {
    flex: 1,
    paddingVertical: spacing.sm + 4,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.onPrimary,
  },
});

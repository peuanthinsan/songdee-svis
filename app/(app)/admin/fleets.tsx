import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, spacing, borderRadius, shadows } from '../../../constants/theme';
import { useI18n } from '../../../lib/i18n-context';
import { apiFetch } from '../../../lib/api';

type Fleet = {
  fleet_id: string;
  vehicle_count: number;
  fleet_manager_email: string | null;
};

export default function FleetsScreen() {
  const { t } = useI18n();
  const [fleets, setFleets] = useState<Fleet[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedFleet, setSelectedFleet] = useState<Fleet | null>(null);
  const [emailInput, setEmailInput] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchFleets = useCallback(async () => {
    try {
      setError(null);
      const data = await apiFetch('/api/admin/fleets');
      setFleets(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message || t('general.error'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchFleets();
  }, [fetchFleets]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchFleets();
  };

  const openEdit = (fleet: Fleet) => {
    setSelectedFleet(fleet);
    setEmailInput(fleet.fleet_manager_email ?? '');
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setSelectedFleet(null);
    setEmailInput('');
  };

  const handleSave = async () => {
    if (!selectedFleet) return;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (emailInput && !emailRegex.test(emailInput.trim())) {
      Alert.alert('', 'Invalid email format');
      return;
    }
    setSaving(true);
    try {
      await apiFetch('/api/admin/fleets', {
        method: 'PUT',
        body: JSON.stringify({
          fleetId: selectedFleet.fleet_id,
          fleetManagerEmail: emailInput.trim() || null,
        }),
      });
      setFleets((prev) =>
        prev.map((f) =>
          f.fleet_id === selectedFleet.fleet_id
            ? { ...f, fleet_manager_email: emailInput.trim() || null }
            : f
        )
      );
      closeModal();
      Alert.alert('', t('admin.fleets.updated'));
    } catch (err: any) {
      Alert.alert(t('general.error'), err.message || t('general.error'));
    } finally {
      setSaving(false);
    }
  };

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
                fetchFleets();
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.retryText}>{t('general.retry')}</Text>
            </TouchableOpacity>
          </View>
        ) : fleets.length === 0 ? (
          <View style={styles.centered}>
            <Text style={styles.emptyText}>{t('admin.noResults')}</Text>
          </View>
        ) : (
          <View style={styles.listCard}>
            {fleets.map((fleet, index) => (
              <TouchableOpacity
                key={fleet.fleet_id}
                style={[
                  styles.fleetRow,
                  index === fleets.length - 1 && styles.fleetRowLast,
                ]}
                onPress={() => openEdit(fleet)}
                activeOpacity={0.7}
              >
                <View style={styles.fleetInfo}>
                  <Text style={styles.fleetId}>{fleet.fleet_id}</Text>
                  <Text style={styles.fleetMeta}>
                    {fleet.vehicle_count} {t('admin.fleets.vehicleCount')}
                  </Text>
                  <Text
                    style={[
                      styles.fleetEmail,
                      !fleet.fleet_manager_email && styles.fleetEmailEmpty,
                    ]}
                    numberOfLines={1}
                  >
                    {fleet.fleet_manager_email || t('admin.fleets.managerEmail')}
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={colors.textTertiary}
                />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

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
                {selectedFleet?.fleet_id}
              </Text>
              <TouchableOpacity onPress={closeModal} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Field */}
            <Text style={styles.fieldLabel}>{t('admin.fleets.managerEmail')}</Text>
            <TextInput
              style={styles.textInput}
              value={emailInput}
              onChangeText={setEmailInput}
              placeholder="manager@example.com"
              placeholderTextColor={colors.textTertiary}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
            />

            {/* Actions */}
            <View style={styles.modalActions}>
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
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xl * 2,
  },
  loadingText: {
    marginTop: spacing.sm,
    color: colors.textSecondary,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 15,
  },
  // List
  listCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  fleetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  fleetRowLast: {
    borderBottomWidth: 0,
  },
  fleetInfo: {
    flex: 1,
    marginRight: spacing.sm,
  },
  fleetId: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  fleetMeta: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  fleetEmail: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  fleetEmailEmpty: {
    color: colors.textTertiary,
    fontStyle: 'italic',
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
    marginBottom: spacing.lg,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.sm,
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

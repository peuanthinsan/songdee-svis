import { useState, useEffect, useCallback, useRef } from 'react';
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
import { colors, spacing, borderRadius, shadows, statusColors } from '../../../constants/theme';
import { useI18n } from '../../../lib/i18n-context';
import { apiFetch } from '../../../lib/api';
import { useDebounce } from '../../../lib/useDebounce';

type Role = 'driver' | 'supervisor' | 'admin';

type User = {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  role: Role;
  fleet_id: string | null;
  created_at?: string;
};

type FormState = {
  username: string;
  firstName: string;
  lastName: string;
  role: Role;
  fleetId: string;
  password: string;
};

const ROLES: Role[] = ['driver', 'supervisor', 'admin'];

const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
  driver: { bg: colors.primary + '30', text: colors.textPrimary },
  supervisor: { bg: statusColors.pass.bg, text: statusColors.pass.text },
  admin: { bg: colors.accent + '20', text: colors.accent },
};

const EMPTY_FORM: FormState = {
  username: '',
  firstName: '',
  lastName: '',
  role: 'driver',
  fleetId: '',
  password: '',
};

export default function UsersManagementScreen() {
  const { t } = useI18n();

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [hasMore, setHasMore] = useState(true);
  const offsetRef = useRef(0);
  const debouncedSearch = useDebounce(search, 300);

  // Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const PAGE_LIMIT = 100;

  const fetchUsers = useCallback(async (reset = false) => {
    try {
      setError(null);
      const currentOffset = reset ? 0 : offsetRef.current;
      const params = new URLSearchParams();
      params.set('limit', String(PAGE_LIMIT));
      params.set('offset', String(currentOffset));
      if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim());
      const data = await apiFetch(`/api/admin/users?${params.toString()}`);
      const fetched: User[] = Array.isArray(data) ? data : [];
      if (reset) {
        setUsers(fetched);
        offsetRef.current = fetched.length;
      } else {
        setUsers((prev) => {
          const existingIds = new Set(prev.map(u => u.id));
          return [...prev, ...fetched.filter(u => !existingIds.has(u.id))];
        });
        offsetRef.current = currentOffset + fetched.length;
      }
      setHasMore(fetched.length >= PAGE_LIMIT);
    } catch (err: any) {
      setError(err.message || t('general.error'));
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [debouncedSearch]);

  useEffect(() => {
    setLoading(true);
    setUsers([]);
    offsetRef.current = 0;
    setHasMore(true);
    fetchUsers(true);
  }, [debouncedSearch]);

  const onRefresh = () => {
    setRefreshing(true);
    setUsers([]);
    offsetRef.current = 0;
    setHasMore(true);
    fetchUsers(true);
  };

  const loadMore = () => {
    if (!hasMore || loading || loadingMore) return;
    setLoadingMore(true);
    fetchUsers(false);
  };

  const openAdd = () => {
    setEditingUser(null);
    setForm(EMPTY_FORM);
    setModalVisible(true);
  };

  const openEdit = (user: User) => {
    setEditingUser(user);
    setForm({
      username: user.username,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role,
      fleetId: user.fleet_id ?? '',
      password: '',
    });
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setEditingUser(null);
    setForm(EMPTY_FORM);
  };

  const handleSave = async () => {
    const { username, firstName, lastName, role, fleetId, password } = form;

    if (!firstName.trim() || !lastName.trim() || !role) {
      Alert.alert(t('general.error'), 'First name, last name, and role are required.');
      return;
    }
    if (!editingUser && (!username.trim() || !password.trim())) {
      Alert.alert(t('general.error'), 'Username and password are required for new users.');
      return;
    }

    setSaving(true);
    try {
      if (editingUser) {
        const body: Record<string, string | undefined> = {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          role,
          fleetId: fleetId.trim() || undefined,
        };
        if (password.trim()) body.password = password.trim();
        const updated = await apiFetch(`/api/admin/users/${editingUser.id}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        });
        setUsers((prev) => prev.map((u) => (u.id === editingUser.id ? { ...u, ...updated } : u)));
        closeModal();
        Alert.alert('', t('admin.users.updated'));
      } else {
        const created = await apiFetch('/api/admin/users', {
          method: 'POST',
          body: JSON.stringify({
            username: username.trim(),
            password: password.trim(),
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            role,
            fleetId: fleetId.trim() || '',
          }),
        });
        setUsers((prev) => [created, ...prev]);
        closeModal();
        Alert.alert('', t('admin.users.created'));
      }
    } catch (err: any) {
      Alert.alert(t('general.error'), err.message || t('general.error'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (user: User) => {
    Alert.alert(
      t('admin.users.deleteConfirm'),
      `${user.first_name} ${user.last_name} (${user.username})`,
      [
        { text: t('admin.cancel'), style: 'cancel' },
        {
          text: t('admin.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await apiFetch(`/api/admin/users/${user.id}`, { method: 'DELETE' });
              setUsers((prev) => prev.filter((u) => u.id !== user.id));
              Alert.alert('', t('admin.users.deleted'));
            } catch (err: any) {
              Alert.alert(t('general.error'), err.message || t('general.error'));
            }
          },
        },
      ]
    );
  };

  const renderItem = ({ item }: { item: User }) => {
    const roleStyle = ROLE_COLORS[item.role] ?? ROLE_COLORS.driver;
    return (
      <TouchableOpacity
        style={styles.userRow}
        onPress={() => openEdit(item)}
        activeOpacity={0.7}
      >
        {/* Avatar */}
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(item.first_name[0] ?? '?').toUpperCase()}
          </Text>
        </View>

        {/* Info */}
        <View style={styles.userInfo}>
          <Text style={styles.userName} numberOfLines={1}>
            {item.first_name} {item.last_name}
          </Text>
          <Text style={styles.userUsername} numberOfLines={1}>
            @{item.username}
            {item.fleet_id ? `  ·  ${item.fleet_id}` : ''}
          </Text>
        </View>

        {/* Role badge */}
        <View style={[styles.roleBadge, { backgroundColor: roleStyle.bg }]}>
          <Text style={[styles.roleText, { color: roleStyle.text }]}>
            {item.role}
          </Text>
        </View>

        {/* Delete */}
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={() => handleDelete(item)}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="trash-outline" size={18} color={colors.accent} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
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
      <View style={styles.container}>
        {/* Search + Add header row */}
        <View style={styles.headerRow}>
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
          <TouchableOpacity style={styles.addButton} onPress={openAdd} activeOpacity={0.8}>
            <Ionicons name="person-add-outline" size={18} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {error ? (
          <View style={styles.errorSection}>
            <Ionicons name="alert-circle-outline" size={48} color={colors.accent} style={{ marginBottom: spacing.md }} />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => { setLoading(true); fetchUsers(); }}
              activeOpacity={0.7}
            >
              <Text style={styles.retryText}>{t('general.retry')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={users}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Ionicons name="people-outline" size={48} color={colors.textTertiary} style={{ marginBottom: spacing.sm }} />
                <Text style={styles.emptyText}>{t('admin.noResults')}</Text>
              </View>
            }
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
            }
            onEndReachedThreshold={0.5}
            onEndReached={() => { if (hasMore && !loading) loadMore(); }}
            ListFooterComponent={loadingMore ? <ActivityIndicator style={styles.footerLoader} color={colors.primary} /> : null}
            initialNumToRender={15}
            maxToRenderPerBatch={10}
            windowSize={10}
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
                {editingUser ? t('admin.users.edit') : t('admin.users.add')}
              </Text>
              <TouchableOpacity onPress={closeModal} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Username — only on create */}
              {!editingUser && (
                <>
                  <Text style={styles.fieldLabel}>{t('admin.users.username')}</Text>
                  <TextInput
                    style={styles.textInput}
                    value={form.username}
                    onChangeText={(v) => setForm((f) => ({ ...f, username: v }))}
                    placeholder="username"
                    placeholderTextColor={colors.textTertiary}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </>
              )}

              {/* First name */}
              <Text style={styles.fieldLabel}>{t('admin.users.firstName')}</Text>
              <TextInput
                style={styles.textInput}
                value={form.firstName}
                onChangeText={(v) => setForm((f) => ({ ...f, firstName: v }))}
                placeholder={t('admin.users.firstName')}
                placeholderTextColor={colors.textTertiary}
              />

              {/* Last name */}
              <Text style={styles.fieldLabel}>{t('admin.users.lastName')}</Text>
              <TextInput
                style={styles.textInput}
                value={form.lastName}
                onChangeText={(v) => setForm((f) => ({ ...f, lastName: v }))}
                placeholder={t('admin.users.lastName')}
                placeholderTextColor={colors.textTertiary}
              />

              {/* Role picker */}
              <Text style={styles.fieldLabel}>{t('admin.users.role')}</Text>
              <View style={styles.roleRow}>
                {ROLES.map((r) => {
                  const active = form.role === r;
                  return (
                    <TouchableOpacity
                      key={r}
                      style={[styles.roleChip, active && styles.roleChipActive]}
                      onPress={() => setForm((f) => ({ ...f, role: r }))}
                      activeOpacity={0.75}
                    >
                      <Text style={[styles.roleChipText, active && styles.roleChipTextActive]}>
                        {r.charAt(0).toUpperCase() + r.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Fleet ID */}
              <Text style={styles.fieldLabel}>{t('admin.users.fleet')}</Text>
              <TextInput
                style={styles.textInput}
                value={form.fleetId}
                onChangeText={(v) => setForm((f) => ({ ...f, fleetId: v }))}
                placeholder="e.g. BKK01"
                placeholderTextColor={colors.textTertiary}
                autoCapitalize="characters"
                autoCorrect={false}
              />

              {/* Password */}
              <Text style={styles.fieldLabel}>
                {editingUser ? t('admin.users.resetPassword') : t('admin.users.password')}
              </Text>
              <TextInput
                style={styles.textInput}
                value={form.password}
                onChangeText={(v) => setForm((f) => ({ ...f, password: v }))}
                placeholder={editingUser ? t('admin.users.resetPassword') : t('admin.users.password')}
                placeholderTextColor={colors.textTertiary}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
              />
            </ScrollView>

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
                  <ActivityIndicator size="small" color={colors.textPrimary} />
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
  // Header row
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  searchWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBackground,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
  },
  searchIcon: {
    marginRight: spacing.xs,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 15,
    color: colors.textPrimary,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.sm,
  },
  footerLoader: {
    paddingVertical: spacing.md,
  },
  // List
  listContent: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
    marginLeft: 68,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    ...shadows.sm,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.primary + '30',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  userInfo: {
    flex: 1,
    marginRight: spacing.sm,
  },
  userName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  userUsername: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  roleBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
    marginRight: spacing.sm,
  },
  roleText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  deleteBtn: {
    padding: spacing.xs,
  },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: spacing.xl * 2,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 15,
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
    color: colors.textPrimary,
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
  // Role picker row
  roleRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  roleChip: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
  },
  roleChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  roleChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  roleChipTextActive: {
    color: colors.textPrimary,
  },
  // Actions
  modalActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
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
    color: colors.textPrimary,
  },
});

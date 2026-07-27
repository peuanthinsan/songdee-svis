import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { colors, spacing, borderRadius, shadows } from '../../../constants/theme';
import { useI18n } from '../../../lib/i18n-context';
import { apiFetch } from '../../../lib/api';

type Settings = {
  unit_status_sheet_url: string;
};

export default function AdminSettingsScreen() {
  const { t } = useI18n();
  const [settings, setSettings] = useState<Settings>({ unit_status_sheet_url: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch('/api/admin/settings') as Settings;
      setSettings({ unit_status_sheet_url: data.unit_status_sheet_url ?? '' });
      setDirty(false);
    } catch (err: any) {
      Alert.alert(t('general.error'), err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    try {
      setSaving(true);
      await apiFetch('/api/admin/settings', {
        method: 'PUT',
        body: JSON.stringify({ key: 'unit_status_sheet_url', value: settings.unit_status_sheet_url.trim() }),
      });
      setDirty(false);
      Alert.alert(t('admin.settings.saved'));
    } catch (err: any) {
      Alert.alert(t('general.error'), err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{t('admin.settings.title')}</Text>

        <View style={styles.card}>
          <Text style={styles.label}>{t('admin.settings.unitStatusSheetLabel')}</Text>
          <Text style={styles.hint}>{t('admin.settings.unitStatusSheetHint')}</Text>
          <TextInput
            style={styles.input}
            value={settings.unit_status_sheet_url}
            onChangeText={v => { setSettings(s => ({ ...s, unit_status_sheet_url: v })); setDirty(true); }}
            placeholder="https://docs.google.com/spreadsheets/d/..."
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
            multiline
            numberOfLines={3}
          />
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, (!dirty || saving) && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={!dirty || saving}
          activeOpacity={0.75}
        >
          {saving
            ? <ActivityIndicator size="small" color={colors.textPrimary} />
            : <Text style={styles.saveBtnText}>{t('admin.settings.save')}</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  title: { fontSize: 22, fontWeight: '800', color: colors.textPrimary, marginBottom: spacing.lg },
  card: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  label: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginBottom: 4 },
  hint: { fontSize: 12, color: colors.textSecondary, marginBottom: spacing.sm },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    fontSize: 13,
    color: colors.textPrimary,
    backgroundColor: colors.background,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  saveBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.sm,
    padding: spacing.md,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.45 },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
});

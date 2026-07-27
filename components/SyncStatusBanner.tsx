import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, spacing, borderRadius } from '../constants/theme';
import { useConnectivity } from '../lib/offline/connectivity';
import { useI18n } from '../lib/i18n-context';

export function SyncStatusBanner() {
  const { isOnline, pendingCount, syncing, triggerSync } = useConnectivity();
  const { t } = useI18n();

  if (isOnline && pendingCount === 0) return null;

  const offline = !isOnline;

  return (
    <TouchableOpacity
      style={[styles.banner, offline ? styles.bannerOffline : syncing ? styles.bannerSyncing : styles.bannerPending]}
      activeOpacity={0.8}
      onPress={isOnline && pendingCount > 0 ? triggerSync : undefined}
    >
      <Ionicons
        name={offline ? 'cloud-offline-outline' : syncing ? 'sync-outline' : 'cloud-upload-outline'}
        size={16}
        color={colors.white}
      />
      <Text style={styles.bannerText}>
        {offline
          ? t('offline.offlineBanner')
          : syncing
          ? t('offline.syncing')
          : `${pendingCount} ${t('offline.pending')}`}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
  },
  bannerOffline: {
    backgroundColor: colors.textSecondary,
  },
  bannerSyncing: {
    backgroundColor: colors.primary,
  },
  bannerPending: {
    backgroundColor: colors.accent,
  },
  bannerText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '600',
  },
});

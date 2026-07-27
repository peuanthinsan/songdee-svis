import { View, Text, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, spacing, borderRadius } from '../constants/theme';

type Status = 'pass' | 'fail' | 'pending' | 'open' | 'in_progress' | 'completed';

const STATUS_CONFIG: Record<Status, { bg: string; text: string; icon: keyof typeof Ionicons.glyphMap; label: string }> = {
  pass: { bg: colors.statusPass + '20', text: colors.statusPass, icon: 'checkmark-circle', label: 'Pass' },
  fail: { bg: '#FFEBEE', text: '#C62828', icon: 'close-circle', label: 'Fail' },
  pending: { bg: colors.primary + '30', text: '#F57F17', icon: 'time-outline', label: 'Pending' },
  open: { bg: '#FFEBEE', text: '#C62828', icon: 'alert-circle', label: 'Open' },
  in_progress: { bg: '#E3F2FD', text: '#1565C0', icon: 'build-outline', label: 'In Progress' },
  completed: { bg: colors.statusPass + '20', text: colors.statusPass, icon: 'checkmark-circle', label: 'Completed' },
};

type Props = {
  status: Status;
  label?: string;
  size?: 'sm' | 'md';
};

export function StatusBadge({ status, label, size = 'sm' }: Props) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  const isMd = size === 'md';

  return (
    <View style={[styles.badge, { backgroundColor: config.bg }, isMd && styles.badgeMd]}>
      <Ionicons name={config.icon} size={isMd ? 14 : 12} color={config.text} />
      <Text style={[styles.label, { color: config.text }, isMd && styles.labelMd]}>
        {label || config.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    gap: 3,
  },
  badgeMd: {
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
  },
  labelMd: {
    fontSize: 13,
  },
});

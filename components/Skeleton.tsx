import { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, type ViewStyle } from 'react-native';
import { colors, borderRadius, spacing } from '../constants/theme';

type Props = {
  width?: number | string;
  height?: number;
  radius?: number;
  style?: ViewStyle;
};

export function Skeleton({ width = '100%', height = 16, radius = borderRadius.sm, style }: Props) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, []);

  return (
    <Animated.View
      style={[
        { width: width as any, height, borderRadius: radius, backgroundColor: colors.border, opacity },
        style,
      ]}
    />
  );
}

export function SkeletonRow() {
  return (
    <View style={skStyles.row}>
      <Skeleton width={24} height={24} radius={12} />
      <View style={skStyles.rowContent}>
        <Skeleton width="60%" height={16} />
        <Skeleton width="40%" height={12} style={{ marginTop: 6 }} />
      </View>
      <Skeleton width={18} height={18} radius={9} />
    </View>
  );
}

export function SkeletonVehicleList() {
  return (
    <View style={skStyles.container}>
      {/* Search bar skeleton */}
      <View style={skStyles.searchBar}>
        <Skeleton width="100%" height={40} radius={borderRadius.sm} />
      </View>
      {/* Summary card skeleton */}
      <View style={skStyles.summaryCard}>
        <Skeleton width={120} height={32} />
        <Skeleton width="100%" height={6} radius={3} style={{ marginTop: spacing.sm }} />
      </View>
      {/* Row skeletons */}
      {Array.from({ length: 8 }).map((_, i) => (
        <SkeletonRow key={i} />
      ))}
    </View>
  );
}

export function SkeletonDashboard() {
  return (
    <View style={skStyles.container}>
      {/* Donut placeholder */}
      <View style={skStyles.donutCard}>
        <Skeleton width={160} height={160} radius={80} style={{ alignSelf: 'center' }} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginTop: spacing.md }}>
          <Skeleton width={60} height={40} />
          <Skeleton width={60} height={40} />
        </View>
      </View>
      {/* Fleet rows */}
      {Array.from({ length: 5 }).map((_, i) => (
        <View key={i} style={skStyles.fleetRow}>
          <Skeleton width="30%" height={14} />
          <Skeleton width="100%" height={10} radius={5} style={{ marginTop: 8 }} />
        </View>
      ))}
    </View>
  );
}

const skStyles = StyleSheet.create({
  container: { padding: spacing.md },
  searchBar: { marginBottom: spacing.sm },
  summaryCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.md,
  },
  rowContent: { flex: 1 },
  donutCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  fleetRow: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
});

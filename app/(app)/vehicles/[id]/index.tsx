import { useLocalSearchParams, Stack } from 'expo-router';
import { useEffect, useState, useCallback } from 'react';
import { PhotoViewer } from '../../../../components/PhotoViewer';
import { getTodayThai } from '../../../../lib/format-date';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, spacing, borderRadius, shadows } from '../../../../constants/theme';
import { useI18n } from '../../../../lib/i18n-context';
import { apiFetch } from '../../../../lib/api';
import { vehicleTypeLabel } from '../../../../lib/types';

export default function VehicleDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, locale } = useI18n();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [vehicle, setVehicle] = useState<any>(null);
  const [inspection, setInspection] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  const today = getTodayThai();

  const fetchData = useCallback(async () => {
    if (!id) return;
    try {
      const v = await apiFetch(`/api/vehicles?id=${id}`);
      setVehicle(v);

      const logs = await apiFetch(
        `/api/inspections?vehicleId=${id}&date=${today}&frequency=daily`
      );
      setInspection(logs.length > 0 ? logs[0] : null);
    } catch (err) {
      console.error('Failed to load vehicle detail:', err);
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id, today]);

  useEffect(() => {
    if (id) fetchData();
  }, [id, fetchData]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.accent} style={{ marginBottom: spacing.sm }} />
        <Text style={styles.errorText}>{t('general.error')}</Text>
        <TouchableOpacity
          style={{ marginTop: spacing.md, backgroundColor: colors.primary, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: borderRadius.sm }}
          onPress={() => { setError(false); setLoading(true); fetchData(); }}
          activeOpacity={0.7}
        >
          <Text style={{ fontWeight: '600', color: colors.onPrimary }}>{t('general.retry')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const nameKey = locale === 'th' ? 'item_name_th' : 'item_name_en';

  return (
    <>
      <Stack.Screen options={{ title: vehicle?.plate_number || t('vehicles.title') }} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />}
      >
        {/* Vehicle info */}
        <View style={styles.infoCard}>
          <Text style={styles.plateNumber}>{vehicle?.plate_number}</Text>
          <Text style={styles.fleetText}>{vehicle?.fleet_id}</Text>
          <Text style={styles.typeText}>
            {vehicleTypeLabel(vehicle?.vehicle_type || '')}
          </Text>
        </View>

        {/* Inspection status */}
        {!inspection ? (
          <View style={styles.statusRow}>
            <Ionicons name="time-outline" size={20} color={colors.statusPending} />
            <Text style={[styles.statusText, { color: colors.statusPending }]}>
              {t('inspection.notInspectedYet')}
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.statusRow}>
              <Ionicons
                name={inspection.overall_status === 'pass' ? 'checkmark-circle' : 'close-circle'}
                size={20}
                color={inspection.overall_status === 'pass' ? colors.statusPass : colors.statusFail}
              />
              <Text style={[
                styles.statusText,
                { color: inspection.overall_status === 'pass' ? colors.statusPass : colors.statusFail }
              ]}>
                {inspection.overall_status === 'pass' ? t('inspection.pass') : t('inspection.fail')}
              </Text>
              <View style={{ flex: 1 }} />
              <View style={styles.inspectorBadge}>
                <Ionicons name="person-outline" size={14} color={colors.textSecondary} />
                <Text style={styles.inspectorName}>{inspection.inspector_name}</Text>
              </View>
            </View>

            {/* Checklist results */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('inspection.checklistResults')}</Text>
              {inspection.results?.map((r: any, i: number) => {
                const itemPhotos: string[] = Array.isArray(r.photo_urls)
                  ? r.photo_urls.filter((u: string) => u && !u.includes('placeholder'))
                  : [];
                return (
                  <View key={i} style={styles.checkRow}>
                    <Ionicons
                      name={r.result === 'pass' ? 'checkmark-circle' : 'close-circle'}
                      size={20}
                      color={r.result === 'pass' ? colors.statusPass : colors.statusFail}
                      style={{ marginTop: 2 }}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.checkText, r.result === 'fail' && styles.checkTextFail]}>
                        {r[nameKey]}
                      </Text>
                      {!!r.notes && (
                        <Text style={styles.resultNote}>{r.notes}</Text>
                      )}
                      {itemPhotos.length > 0 && (
                        <View style={styles.resultPhotoRow}>
                          {itemPhotos.map((uri, idx) => (
                            <Image
                              key={idx}
                              source={{ uri }}
                              style={styles.resultPhoto}
                              contentFit="cover"
                            />
                          ))}
                        </View>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>

            {/* Defect photos */}
            {inspection.photo_urls?.filter((u: string) => u && !u.includes('placeholder')).length > 0 && (() => {
              const validPhotos = inspection.photo_urls.filter((url: string) => url && !url.includes('placeholder'));
              return (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>{t('issues.defectPhotos')}</Text>
                  <View style={styles.photoGrid}>
                    {validPhotos.map((url: string, i: number) => (
                      <TouchableOpacity key={i} onPress={() => { setViewerIndex(i); setViewerVisible(true); }}>
                        <Image
                          source={{ uri: url }}
                          style={styles.photo}
                          resizeMode="cover"
                        />
                      </TouchableOpacity>
                    ))}
                  </View>
                  <PhotoViewer
                    photos={validPhotos}
                    visible={viewerVisible}
                    initialIndex={viewerIndex}
                    onClose={() => setViewerVisible(false)}
                  />
                </View>
              );
            })()}
          </>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: { paddingBottom: spacing.xl },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background, padding: spacing.lg },
  errorText: { fontSize: 16, color: colors.textSecondary, textAlign: 'center' },
  // Vehicle info
  infoCard: {
    margin: 12,
    padding: 12,
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  plateNumber: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  fleetText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  typeText: {
    fontSize: 13,
    color: colors.textTertiary,
    marginTop: 2,
  },
  // Status row
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 12,
    marginHorizontal: 12,
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '700',
  },
  inspectorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  inspectorName: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  // Section
  section: {
    marginHorizontal: 12,
    marginTop: spacing.sm,
    padding: 12,
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  // Checklist row
  checkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.md,
  },
  checkText: {
    fontSize: 14,
    color: colors.textPrimary,
  },
  checkTextFail: {
    fontWeight: '600',
  },
  resultNote: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
    fontStyle: 'italic',
  },
  resultPhotoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: 6,
  },
  resultPhoto: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.inputBackground,
  },
  // Photos
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  photo: {
    width: 100,
    height: 100,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.inputBackground,
  },
});

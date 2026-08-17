import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { colors, spacing, borderRadius, shadows } from '../../../constants/theme';
import { useI18n } from '../../../lib/i18n-context';
import { useRole } from '../../../lib/useRole';
import { apiFetch, API_BASE, getAuthToken } from '../../../lib/api';
import { formatDateThai, formatDateTimeThai as formatDate } from '../../../lib/format-date';
import { PhotoViewer } from '../../../components/PhotoViewer';
import { vehicleTypeLabel, type IssueStatus } from '../../../lib/types';

type IssueDetail = {
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

const STATUS_COLORS: Record<IssueStatus, string> = {
  open: colors.statusFail,
  in_progress: colors.statusPending,
  completed: colors.statusPass,
};

const STATUS_ICONS: Record<IssueStatus, keyof typeof Ionicons.glyphMap> = {
  open: 'alert-circle',
  in_progress: 'time-outline',
  completed: 'checkmark-circle',
};

export default function IssueDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useI18n();
  const { isSupervisor, isAdmin } = useRole();
  const canManage = isSupervisor || isAdmin;

  const [issue, setIssue] = useState<IssueDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [completionPhotos, setCompletionPhotos] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [defectViewerVisible, setDefectViewerVisible] = useState(false);
  const [defectViewerIndex, setDefectViewerIndex] = useState(0);
  const [completionViewerVisible, setCompletionViewerVisible] = useState(false);
  const [completionViewerIndex, setCompletionViewerIndex] = useState(0);

  const fetchIssue = useCallback(async () => {
    try {
      setError(null);
      const data = await apiFetch(`/api/issues/${id}`);
      setIssue(data);
    } catch (err: any) {
      setError(err.message || t('general.error'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchIssue();
  }, [fetchIssue]);

  const statusLabel = (status: IssueStatus) => {
    switch (status) {
      case 'open': return t('issues.statusOpen');
      case 'in_progress': return t('issues.statusInProgress');
      case 'completed': return t('issues.statusCompleted');
    }
  };

  async function takePhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('', t('general.cameraPermission'));
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });
    if (!result.canceled) {
      setCompletionPhotos(prev => [...prev, result.assets[0].uri]);
    }
  }

  async function pickPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });
    if (!result.canceled) {
      setCompletionPhotos(prev => [...prev, result.assets[0].uri]);
    }
  }

  function removePhoto(index: number) {
    setCompletionPhotos(prev => prev.filter((_, i) => i !== index));
  }

  async function uploadPhotos(): Promise<string[]> {
    // Upload photos in parallel, but never close an issue with incomplete evidence.
    const uploadPromises = completionPhotos.map(async (photoUri) => {
      try {
        const formData = new FormData();
        const filename = `completion-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.jpg`;
        formData.append('file', {
          uri: photoUri,
          type: 'image/jpeg',
          name: filename,
        } as any);

        const token = await getAuthToken();
        const uploadRes = await fetch(`${API_BASE}/api/upload?filename=${filename}`, {
          method: 'POST',
          body: formData,
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
        if (!uploadRes.ok) throw new Error('Upload failed');
        const uploadData = await uploadRes.json();
        return uploadData.url as string;
      } catch {
        return null; // Mark failed uploads
      }
    });
    const results = await Promise.all(uploadPromises);
    if (results.some((url) => url === null)) {
      throw new Error(t('issues.uploadFailed'));
    }
    return results as string[];
  }

  async function handleStartRepair() {
    if (!issue) return;
    setUpdating(true);
    try {
      await apiFetch(`/api/issues/${issue.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'in_progress' }),
      });
      setIssue({ ...issue, status: 'in_progress' });
    } catch (err: any) {
      Alert.alert(t('general.error'), err.message);
    } finally {
      setUpdating(false);
    }
  }

  async function handleCompleteRepair() {
    if (!issue) return;
    if (completionPhotos.length === 0) {
      Alert.alert(t('issues.completionPhotoRequired'));
      return;
    }
    setUpdating(true);
    try {
      let photoUrls: string[] = [];
      if (completionPhotos.length > 0) {
        photoUrls = await uploadPhotos();
      }
      await apiFetch(`/api/issues/${issue.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'completed', completionPhotoUrls: photoUrls.length > 0 ? photoUrls : undefined }),
      });
      setIssue({ ...issue, status: 'completed', completion_photo_urls: photoUrls });
      setCompletionPhotos([]);
    } catch (err: any) {
      Alert.alert(t('general.error'), err.message);
    } finally {
      setUpdating(false);
    }
  }

  // formatDate imported from lib/format-date

  if (loading) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ title: t('issues.title') }} />
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>{t('general.loading')}</Text>
      </View>
    );
  }

  if (error || !issue) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ title: t('issues.title') }} />
        <Ionicons name="alert-circle-outline" size={48} color={colors.accent} style={{ marginBottom: spacing.md }} />
        <Text style={styles.errorText}>{error || t('general.error')}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => { setLoading(true); fetchIssue(); }} activeOpacity={0.7}>
          <Text style={styles.retryText}>{t('general.retry')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: `${issue.plate_number}` }} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Vehicle info rows */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t('inspection.plateNumber')}</Text>
            <Text style={styles.infoValue}>{issue.plate_number}</Text>
          </View>
          <View style={styles.infoDivider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t('admin.vehicles.vehicleType')}</Text>
            <Text style={styles.infoValue}>
              {vehicleTypeLabel(issue.vehicle_type)}
            </Text>
          </View>
          <View style={styles.infoDivider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t('dashboard.allFleets')}</Text>
            <Text style={styles.infoValue}>{issue.fleet_id}</Text>
          </View>
          <View style={styles.infoDivider} />
          {issue.inspector_name && (
            <>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>{t('inspection.inspector')}</Text>
                <Text style={styles.infoValue}>{issue.inspector_name}</Text>
              </View>
              <View style={styles.infoDivider} />
            </>
          )}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t('inspection.date')}</Text>
            <Text style={styles.infoValue}>
              {issue.inspection_date ? formatDateThai(issue.inspection_date) : formatDate(issue.created_at)}
            </Text>
          </View>
          <View style={styles.infoDivider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Status</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons
                name={STATUS_ICONS[issue.status]}
                size={20}
                color={STATUS_COLORS[issue.status]}
                style={{ marginRight: 6 }}
              />
              <Text style={[styles.infoValue, { color: STATUS_COLORS[issue.status] }]}>
                {statusLabel(issue.status)}
              </Text>
            </View>
          </View>
        </View>

        {/* Defect photos */}
        {issue.defect_photo_urls && issue.defect_photo_urls.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('issues.defectPhotos')}</Text>
            <View style={styles.photoGrid}>
              {issue.defect_photo_urls.map((url, i) => (
                <TouchableOpacity key={`defect-${i}`} onPress={() => { setDefectViewerIndex(i); setDefectViewerVisible(true); }}>
                  <Image source={{ uri: url }} style={styles.photo} />
                </TouchableOpacity>
              ))}
            </View>
            <PhotoViewer
              photos={issue.defect_photo_urls}
              visible={defectViewerVisible}
              initialIndex={defectViewerIndex}
              onClose={() => setDefectViewerVisible(false)}
            />
          </View>
        )}

        {/* Action: Start repair */}
        {canManage && issue.status === 'open' && (
          <View style={styles.actionSection}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleStartRepair}
              disabled={updating}
              activeOpacity={0.8}
            >
              {updating ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.primaryButtonText}>{t('issues.startRepair')}</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Action: Complete repair */}
        {canManage && issue.status === 'in_progress' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('issues.uploadCompletion')}</Text>

            <View style={styles.photoButtons}>
              <TouchableOpacity style={styles.photoBtn} onPress={takePhoto} activeOpacity={0.7}>
                <Ionicons name="camera-outline" size={20} color={colors.accent} style={{ marginRight: 6 }} />
                <Text style={styles.photoBtnText}>{t('inspection.takePhoto')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.photoBtn} onPress={pickPhoto} activeOpacity={0.7}>
                <Ionicons name="images-outline" size={20} color={colors.accent} style={{ marginRight: 6 }} />
                <Text style={styles.photoBtnText}>{t('inspection.pickPhoto')}</Text>
              </TouchableOpacity>
            </View>

            {completionPhotos.length > 0 && (
              <View style={styles.photoGrid}>
                {completionPhotos.map((uri, idx) => (
                  <View key={idx} style={styles.photoThumb}>
                    <Image source={{ uri }} style={styles.photoImage} />
                    <TouchableOpacity
                      style={styles.photoRemove}
                      onPress={() => removePhoto(idx)}
                    >
                      <Ionicons name="close" size={14} color={colors.white} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            <TouchableOpacity
              style={[
                styles.primaryButton,
                { marginTop: spacing.md },
              ]}
              onPress={handleCompleteRepair}
              disabled={updating}
              activeOpacity={0.8}
            >
              {updating ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.primaryButtonText}>{t('issues.completeRepair')}</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Before/After comparison */}
        {issue.status === 'completed' &&
          issue.defect_photo_urls && issue.defect_photo_urls.length > 0 &&
          issue.completion_photo_urls && issue.completion_photo_urls.length > 0 && (
          <View style={styles.section}>
            <View style={styles.compareRow}>
              <View style={styles.compareColumn}>
                <Text style={styles.compareLabelBefore}>{t('issues.beforeRepair')}</Text>
                {issue.defect_photo_urls.map((url, i) => (
                  <TouchableOpacity key={`before-${i}`} onPress={() => { setDefectViewerIndex(i); setDefectViewerVisible(true); }}>
                    <Image source={{ uri: url }} style={styles.comparePhoto} />
                  </TouchableOpacity>
                ))}
              </View>
              <View style={{ width: spacing.sm }} />
              <View style={styles.compareColumn}>
                <Text style={styles.compareLabelAfter}>{t('issues.afterRepair')}</Text>
                {issue.completion_photo_urls.map((url, i) => (
                  <TouchableOpacity key={`after-${i}`} onPress={() => { setCompletionViewerIndex(i); setCompletionViewerVisible(true); }}>
                    <Image source={{ uri: url }} style={styles.comparePhoto} />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <PhotoViewer
              photos={issue.defect_photo_urls}
              visible={defectViewerVisible}
              initialIndex={defectViewerIndex}
              onClose={() => setDefectViewerVisible(false)}
            />
            <PhotoViewer
              photos={issue.completion_photo_urls}
              visible={completionViewerVisible}
              initialIndex={completionViewerIndex}
              onClose={() => setCompletionViewerVisible(false)}
            />
          </View>
        )}

        {/* Completion photos only (no defect photos to compare) */}
        {issue.status === 'completed' &&
          issue.completion_photo_urls && issue.completion_photo_urls.length > 0 &&
          (!issue.defect_photo_urls || issue.defect_photo_urls.length === 0) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('issues.completionPhotos')}</Text>
            <View style={styles.photoGrid}>
              {issue.completion_photo_urls.map((url, i) => (
                <TouchableOpacity key={`completion-${i}`} onPress={() => { setCompletionViewerIndex(i); setCompletionViewerVisible(true); }}>
                  <Image source={{ uri: url }} style={styles.photo} />
                </TouchableOpacity>
              ))}
            </View>
            <PhotoViewer
              photos={issue.completion_photo_urls}
              visible={completionViewerVisible}
              initialIndex={completionViewerIndex}
              onClose={() => setCompletionViewerVisible(false)}
            />
          </View>
        )}
      </ScrollView>
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
  },
  loadingText: {
    marginTop: spacing.sm,
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
  scrollContent: {
    paddingBottom: spacing.xl,
  },
  // Info card with rows
  infoCard: {
    margin: 12,
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 9,
  },
  infoDivider: {
    height: 1,
    backgroundColor: colors.border,
  },
  infoLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  // Sections
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
  actionSection: {
    marginHorizontal: 12,
    marginTop: spacing.sm,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  // Photos
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  photo: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.inputBackground,
  },
  // Buttons
  primaryButton: {
    backgroundColor: colors.accent,
    paddingVertical: 13,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.white,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  photoButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  photoBtn: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 12,
    borderRadius: borderRadius.md,
    backgroundColor: colors.inputBackground,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  photoBtnText: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '600',
  },
  photoThumb: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
    position: 'relative',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  photoRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Compare
  compareRow: {
    flexDirection: 'row',
  },
  compareColumn: {
    flex: 1,
  },
  compareLabelBefore: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.statusFail,
    marginBottom: spacing.sm,
  },
  compareLabelAfter: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.statusPass,
    marginBottom: spacing.sm,
  },
  comparePhoto: {
    width: '100%',
    height: 140,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.sm,
    backgroundColor: colors.inputBackground,
  },
});

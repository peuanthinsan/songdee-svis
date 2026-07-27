import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useAuth } from '../../../../lib/auth-context';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { colors, spacing, borderRadius, shadows, statusColors } from '../../../../constants/theme';
import { useI18n } from '../../../../lib/i18n-context';
import { apiFetch, API_BASE, getAuthToken } from '../../../../lib/api';
import { useConnectivity } from '../../../../lib/offline/connectivity';
import { cacheVehicles, getCachedVehicle, cacheChecklist, getCachedChecklist } from '../../../../lib/offline/cache-service';
import { queueInspection } from '../../../../lib/offline/sync-service';
import { SyncStatusBanner } from '../../../../components/SyncStatusBanner';
import { getTodayThai, getMondayOfWeekThai } from '../../../../lib/format-date';
import { ZONE_SECTIONS, VEHICLE_TYPE_I18N_KEYS, type ChecklistItem, type ChecklistSection, type InspectionZone, type Vehicle } from '../../../../lib/types';
import { useRole } from '../../../../lib/useRole';
import VehicleMap from '../../../../components/VehicleMap';

type ItemResult = 'pass' | 'fail';
type Frequency = 'daily' | 'weekly' | 'post_route';

const SECTION_ORDER: ChecklistSection[] = [
  'front', 'rear', 'sides', 'top', 'underbody', 'cabin', 'cargo', 'documents', 'supplies',
];

const ZONE_ORDER: InspectionZone[] = ['front', 'cabin', 'cargo_supplies', 'exterior_tires'];

const FREQUENCY_TABS: Frequency[] = ['daily', 'weekly', 'post_route'];

export default function InspectScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const { isAdmin } = useRole();
  const { isOnline, refreshPendingCount } = useConnectivity();

  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [results, setResults] = useState<Record<string, ItemResult>>({});
  const [photosByItem, setPhotosByItem] = useState<Record<string, string[]>>({});
  const [notesByItem, setNotesByItem] = useState<Record<string, string>>({});
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
  const [activeZone, setActiveZone] = useState<InspectionZone | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [frequency, setFrequency] = useState<Frequency>('daily');
  const [mileage, setMileage] = useState('');
  const [odometerPhoto, setOdometerPhoto] = useState<string | null>(null);
  const [vehicleUsable, setVehicleUsable] = useState<boolean | null>(null);
  const [carryoverItems, setCarryoverItems] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [existingInspectionId, setExistingInspectionId] = useState<string | null>(null);
  const [readOnly, setReadOnly] = useState(false);
  const [readOnlyInspector, setReadOnlyInspector] = useState('');
  const [checklistError, setChecklistError] = useState(false);
  const [diagramVisible, setDiagramVisible] = useState(true);

  const failCount = Object.values(results).filter(r => r === 'fail').length;
  const hasFailures = failCount > 0;
  const allItemsAnswered = checklistItems.length > 0 && checklistItems.every(it => results[it.id] === 'pass' || results[it.id] === 'fail');
  const mileageValid = /^\d+$/.test(mileage.trim()) && parseInt(mileage.trim(), 10) >= 0;
  const odometerProvided = !!odometerPhoto;
  const canSubmit = !submitting && checklistItems.length > 0 && allItemsAnswered && mileageValid && odometerProvided && vehicleUsable !== null;

  const presentSections = SECTION_ORDER.filter((s) =>
    checklistItems.some((ci) => ci.section === s)
  );

  // Zone-based filtering: active zone maps to multiple sections
  const activeZoneSections = activeZone ? ZONE_SECTIONS[activeZone] : null;
  const visibleItems = activeZoneSections
    ? checklistItems.filter((ci) => activeZoneSections.includes(ci.section))
    : checklistItems;

  // Per-zone fail counts and statuses
  const zoneFailCounts: Record<InspectionZone, number> = { front: 0, cabin: 0, cargo_supplies: 0, exterior_tires: 0 };
  const zoneStatuses: Record<InspectionZone, 'pending' | 'pass' | 'fail'> = {
    front: 'pending', cabin: 'pending', cargo_supplies: 'pending', exterior_tires: 'pending',
  };
  for (const zone of ZONE_ORDER) {
    const sections = ZONE_SECTIONS[zone];
    const zoneItems = checklistItems.filter((ci) => sections.includes(ci.section));
    if (zoneItems.length === 0) continue;
    let fails = 0;
    let allChecked = true;
    for (const ci of zoneItems) {
      if (results[ci.id] === 'fail') fails++;
      if (!results[ci.id]) allChecked = false;
    }
    zoneFailCounts[zone] = fails;
    if (fails > 0) zoneStatuses[zone] = 'fail';
    else if (allChecked && zoneItems.length > 0) zoneStatuses[zone] = 'pass';
  }

  const zoneLabels: Record<InspectionZone, string> = {
    front: t('zone.front' as any),
    cabin: t('zone.cabin' as any),
    cargo_supplies: t('zone.cargo_supplies' as any),
    exterior_tires: t('zone.exterior_tires' as any),
  };

  useEffect(() => {
    loadData();
  }, [id]);

  useEffect(() => {
    if (vehicle) {
      loadChecklist(vehicle.vehicle_type);
    }
  }, [frequency]);

  // getMondayOfWeekThai imported from lib/format-date

  async function loadChecklist(vehicleType: string) {
    try {
      setChecklistError(false);
      const checklistType = vehicleType === 'e_van' ? 'e_van' : vehicleType;
      let items: ChecklistItem[];
      try {
        items = await apiFetch(
          `/api/checklist?vehicleType=${checklistType}&frequency=${frequency}`
        );
        // Cache for offline use
        cacheChecklist(checklistType, frequency, items);
      } catch {
        // Offline fallback
        const cached = await getCachedChecklist(checklistType, frequency);
        if (!cached) throw new Error('No cached checklist');
        items = cached;
      }
      setChecklistItems(items);

      // Pick initial active zone = first zone that has items
      const firstZone = ZONE_ORDER.find((z) =>
        ZONE_SECTIONS[z].some((s) => items.some((ci: ChecklistItem) => ci.section === s))
      );
      setActiveZone(firstZone ?? null);

      // Default to NO selection so the driver explicitly marks every item.
      setResults({});
      setPhotosByItem({});
      setNotesByItem({});
      setExpandedItems({});

      // Reset edit/readOnly state when frequency changes
      setEditMode(false);
      setExistingInspectionId(null);
      setReadOnly(false);
      setReadOnlyInspector('');
      setPhotos([]);
      setNotes('');
      setMileage('');
      setOdometerPhoto(null);
      setVehicleUsable(null);
      setCarryoverItems(new Set());

      // Check for existing inspection
      try {
        let logs;
        if (frequency === 'weekly') {
          const monday = getMondayOfWeekThai();
          logs = await apiFetch(`/api/inspections?vehicleId=${id}&since=${monday}`);
        } else {
          const today = getTodayThai();
          logs = await apiFetch(`/api/inspections?vehicleId=${id}&date=${today}`);
        }

        // Filter logs to only match current frequency's checklist items
        const itemNames = new Set(items.map((ci: ChecklistItem) => ci.item_name_en));
        const matchingLogs = logs.filter((log: any) =>
          log.results?.some((r: any) => itemNames.has(r.item_name_en))
        );

        if (matchingLogs.length > 0) {
          const existing = matchingLogs[0];
          if (existing.inspector_id === user?.id || isAdmin) {
            // This driver's own inspection or admin editing — load in edit mode
            setEditMode(true);
            setExistingInspectionId(existing.id);
            setNotes(existing.notes || '');
            // Pre-fill results from existing inspection
            if (existing.results) {
              const savedResults: Record<string, ItemResult> = {};
              const savedPhotos: Record<string, string[]> = {};
              const savedNotes: Record<string, string> = {};
              for (const r of existing.results) {
                const matchingItem = items.find((ci: ChecklistItem) =>
                  ci.item_name_th === r.item_name_th || ci.item_name_en === r.item_name_en
                );
                if (matchingItem) {
                  savedResults[matchingItem.id] = r.result as ItemResult;
                  if (Array.isArray(r.photo_urls) && r.photo_urls.length > 0) {
                    savedPhotos[matchingItem.id] = r.photo_urls.filter(
                      (u: string) => u && !u.includes('placeholder')
                    );
                  }
                  if (r.notes) savedNotes[matchingItem.id] = r.notes;
                }
              }
              setResults(prev => ({ ...prev, ...savedResults }));
              setPhotosByItem(savedPhotos);
              setNotesByItem(savedNotes);
            }
            // Load existing photos
            if (existing.photo_urls) {
              setPhotos(existing.photo_urls.filter((u: string) => u && !u.includes('placeholder')));
            }
            // Load existing mileage / odometer photo
            if (typeof existing.mileage === 'number') {
              setMileage(String(existing.mileage));
            }
            if (existing.odometer_photo_url) {
              setOdometerPhoto(existing.odometer_photo_url);
            }
            if (typeof existing.vehicle_usable === 'boolean') {
              setVehicleUsable(existing.vehicle_usable);
            }
          } else {
            // Different driver inspected — show read-only message
            setReadOnly(true);
            setReadOnlyInspector(existing.inspector_name);
          }
        } else {
          // Fresh inspection: defects still open from earlier inspections default to
          // fail until resolved (client request) — the driver flips them to pass once fixed.
          try {
            const carry = await apiFetch(`/api/inspections?vehicleId=${id}&carryover=1`);
            const preFilled: Record<string, ItemResult> = {};
            const ids = new Set<string>();
            for (const c of carry?.items ?? []) {
              const match = items.find((ci: ChecklistItem) => ci.id === c.checklist_item_id);
              if (match) {
                preFilled[match.id] = 'fail';
                ids.add(match.id);
              }
            }
            if (ids.size > 0) {
              setResults(prev => ({ ...prev, ...preFilled }));
              setExpandedItems(prev => {
                const next = { ...prev };
                ids.forEach(itemId => { next[itemId] = true; });
                return next;
              });
              setCarryoverItems(ids);
            }
          } catch {
            // Offline or endpoint unavailable — the driver marks items manually.
          }
        }
      } catch (err) {
        console.error('Failed to check existing inspection:', err);
      }
    } catch (err) {
      console.error('Failed to load checklist:', err);
      setChecklistError(true);
    }
  }

  async function loadData() {
    try {
      let found;
      try {
        found = await apiFetch(`/api/vehicles?id=${id}`);
        // Cache for offline
        if (found) cacheVehicles([found]);
      } catch {
        // Offline fallback
        found = await getCachedVehicle(id!);
      }
      if (found) {
        setVehicle(found);
        await loadChecklist(found.vehicle_type);
      }
    } catch (err) {
      console.error('Failed to load inspection data:', err);
    } finally {
      setLoading(false);
    }
  }

  const toggleResult = useCallback((itemId: string, value: ItemResult) => {
    Haptics.impactAsync(value === 'fail' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
    setResults(prev => ({ ...prev, [itemId]: value }));
    // Auto-expand the row when user marks it as failed so they can immediately add photo/notes.
    if (value === 'fail') {
      setExpandedItems(prev => ({ ...prev, [itemId]: true }));
    }
  }, []);

  const toggleExpanded = useCallback((itemId: string) => {
    setExpandedItems(prev => ({ ...prev, [itemId]: !prev[itemId] }));
  }, []);

  const setItemNote = useCallback((itemId: string, value: string) => {
    setNotesByItem(prev => ({ ...prev, [itemId]: value }));
  }, []);

  async function addItemPhotoFromCamera(itemId: string) {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) { Alert.alert('', t('general.cameraPermission')); return; }
      const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
      if (!result.canceled && result.assets?.[0]?.uri) {
        const uri = result.assets[0].uri;
        setPhotosByItem(prev => ({ ...prev, [itemId]: [...(prev[itemId] || []), uri] }));
      }
    } catch (err: any) {
      Alert.alert('Camera Error', err.message || 'Could not take photo');
    }
  }

  async function addItemPhotoFromLibrary(itemId: string) {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.7 });
      if (!result.canceled && result.assets?.[0]?.uri) {
        const uri = result.assets[0].uri;
        setPhotosByItem(prev => ({ ...prev, [itemId]: [...(prev[itemId] || []), uri] }));
      }
    } catch (err: any) {
      Alert.alert('Gallery Error', err.message || 'Could not pick photo');
    }
  }

  function removeItemPhoto(itemId: string, index: number) {
    setPhotosByItem(prev => {
      const list = prev[itemId] || [];
      return { ...prev, [itemId]: list.filter((_, i) => i !== index) };
    });
  }

  async function takePhoto() {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('', t('general.cameraPermission'));
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        quality: 0.7,
      });
      if (!result.canceled && result.assets?.[0]?.uri) {
        setPhotos(prev => [...prev, result.assets[0].uri]);
      }
    } catch (err: any) {
      Alert.alert('Camera Error', err.message || 'Could not take photo');
    }
  }

  async function pickPhoto() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        quality: 0.7,
      });
      if (!result.canceled && result.assets?.[0]?.uri) {
        setPhotos(prev => [...prev, result.assets[0].uri]);
      }
    } catch (err: any) {
      Alert.alert('Gallery Error', err.message || 'Could not pick photo');
    }
  }

  function removePhoto(index: number) {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  }

  async function takeOdometerPhoto() {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('', t('general.cameraPermission'));
        return;
      }
      const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
      if (!result.canceled && result.assets?.[0]?.uri) {
        setOdometerPhoto(result.assets[0].uri);
      }
    } catch (err: any) {
      Alert.alert('Camera Error', err.message || 'Could not take photo');
    }
  }

  async function pickOdometerPhoto() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.7 });
      if (!result.canceled && result.assets?.[0]?.uri) {
        setOdometerPhoto(result.assets[0].uri);
      }
    } catch (err: any) {
      Alert.alert('Gallery Error', err.message || 'Could not pick photo');
    }
  }

  async function handleClearInspection() {
    if (!existingInspectionId) return;
    Alert.alert(
      t('inspection.clearTitle'),
      t('inspection.clearConfirm'),
      [
        { text: t('admin.cancel'), style: 'cancel' },
        {
          text: t('admin.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await apiFetch(`/api/inspections?inspectionId=${existingInspectionId}`, {
                method: 'DELETE',
              });
              Alert.alert('', t('inspection.cleared'), [
                { text: 'OK', onPress: () => router.replace('/(app)/vehicles') },
              ]);
            } catch (err: any) {
              Alert.alert(t('general.error'), err.message);
            }
          },
        },
      ]
    );
  }

  async function handleSubmit() {
    if (!vehicle || !user?.id) return;

    // Validation: every item must have an explicit pass/fail selection (no defaults).
    const unanswered = checklistItems.filter((it) => results[it.id] !== 'pass' && results[it.id] !== 'fail');
    if (unanswered.length > 0) {
      const firstUnanswered = unanswered[0];
      const unansweredZone = ZONE_ORDER.find((z) => ZONE_SECTIONS[z].includes(firstUnanswered.section));
      if (unansweredZone) setActiveZone(unansweredZone);
      Alert.alert(
        t('inspection.allItemsRequired'),
        `${locale === 'th' ? firstUnanswered.item_name_th : firstUnanswered.item_name_en}`,
      );
      return;
    }

    // Validation: every failed item must have at least one photo.
    const missingPhotoItems = checklistItems.filter(
      (it) => results[it.id] === 'fail' && (photosByItem[it.id]?.length ?? 0) === 0
    );
    if (missingPhotoItems.length > 0) {
      const firstMissing = missingPhotoItems[0];
      // Jump to the zone containing the first missing item so the user sees it.
      const missingZone = ZONE_ORDER.find((z) => ZONE_SECTIONS[z].includes(firstMissing.section));
      if (missingZone) setActiveZone(missingZone);
      Alert.alert(t('inspection.itemPhotoRequired'),
        `${locale === 'th' ? firstMissing.item_name_th : firstMissing.item_name_en}`);
      return;
    }

    // Validation: mileage + odometer photo are mandatory.
    const mileageStr = mileage.trim();
    if (!/^\d+$/.test(mileageStr)) {
      Alert.alert(t('inspection.mileageRequired'), '');
      return;
    }
    const mileageNum = parseInt(mileageStr, 10);
    if (!odometerPhoto) {
      Alert.alert(t('inspection.odometerPhotoRequired'), '');
      return;
    }

    // Validation: the final usable question must be answered (drives Out of Service).
    if (vehicleUsable === null) {
      Alert.alert(t('inspection.vehicleUsableRequired'), '');
      return;
    }

    setSubmitting(true);

    const today = getTodayThai();
    const inspectorName = user
      ? `${user.firstName} ${user.lastName}`.trim()
      : 'Unknown';

    // Offline: queue for later sync — photos (global + per-item) persisted locally.
    if (!isOnline && !editMode) {
      try {
        const resultsPayload = checklistItems.map(item => ({
          checklistItemId: item.id,
          result: results[item.id]!,
          photoUrls: [] as string[], // filled during sync
          notes: notesByItem[item.id] || '',
        }));
        const payload = {
          vehicleId: vehicle.id,
          inspectionDate: today,
          inspectorId: user?.id,
          inspectorName,
          fleetId: vehicle.fleet_id,
          results: resultsPayload,
          photoUrls: [],
          notes,
          frequency,
          mileage: mileageNum,
          odometerPhotoLocal: odometerPhoto,
          vehicleUsable,
        };
        await queueInspection(payload, photos, photosByItem);
        await refreshPendingCount();
        Alert.alert('', t('offline.savedOffline'), [
          { text: 'OK', onPress: () => router.replace('/(app)/vehicles') },
        ]);
      } catch (err: any) {
        Alert.alert(t('general.error'), err.message);
      } finally {
        setSubmitting(false);
      }
      return;
    }

    try {
      const uploadOne = async (photoUri: string): Promise<string> => {
        if (photoUri.startsWith('http')) return photoUri;
        const formData = new FormData();
        const filename = `inspection-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.jpg`;
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
            'Content-Type': 'multipart/form-data',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
        if (!uploadRes.ok) throw new Error('Photo upload failed');
        const uploadData = await uploadRes.json();
        return uploadData.url as string;
      };

      // Upload inspection-level photos
      const photoUrls = await Promise.all(photos.map(uploadOne));

      // Upload odometer photo
      const odometerPhotoUrl = await uploadOne(odometerPhoto);

      // Upload per-item photos in parallel across all items
      const itemEntries = Object.entries(photosByItem);
      const uploadedByItemEntries = await Promise.all(
        itemEntries.map(async ([itemId, uris]) => {
          const urls = await Promise.all(uris.map(uploadOne));
          return [itemId, urls] as const;
        })
      );
      const uploadedByItem: Record<string, string[]> = Object.fromEntries(uploadedByItemEntries);

      const resultsPayload = checklistItems.map(item => ({
        checklistItemId: item.id,
        result: results[item.id]!,
        photoUrls: uploadedByItem[item.id] ?? [],
        notes: notesByItem[item.id] || '',
      }));

      if (editMode && existingInspectionId) {
        await apiFetch('/api/inspections', {
          method: 'PUT',
          body: JSON.stringify({
            inspectionId: existingInspectionId,
            results: resultsPayload,
            photoUrls,
            notes,
            mileage: mileageNum,
            odometerPhotoUrl,
            vehicleUsable,
          }),
        });
      } else {
        const payload = {
          vehicleId: vehicle.id,
          inspectionDate: today,
          inspectorId: user?.id,
          inspectorName,
          fleetId: vehicle.fleet_id,
          results: resultsPayload,
          photoUrls,
          notes,
          frequency,
          mileage: mileageNum,
          odometerPhotoUrl,
          vehicleUsable,
        };

        await apiFetch('/api/inspections', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }

      Alert.alert('', t('inspection.success'), [
        { text: 'OK', onPress: () => router.replace('/(app)/vehicles') },
      ]);
    } catch (err: any) {
      if (err.message?.includes('Already inspected by')) {
        Alert.alert('', err.message);
      } else if (err.message?.includes('already inspected')) {
        Alert.alert('', t('inspection.alreadyInspected'));
      } else {
        Alert.alert(t('general.error'), err.message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (!vehicle) {
    return (
      <View style={styles.center}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.textSecondary} style={{ marginBottom: spacing.sm }} />
        <Text style={styles.errorText}>{t('general.error')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: editMode ? t('inspection.editTitle') : t('inspection.daily'),
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.replace('/(app)/vehicles')} style={{ paddingRight: spacing.sm }}>
              <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
          ),
        }}
      />

      <SyncStatusBanner />

      {/* Read-only state: another driver already inspected */}
      {readOnly && (
        <View style={styles.readOnlyContainer}>
          <Ionicons name="information-circle-outline" size={48} color={colors.accent} style={{ marginBottom: spacing.md }} />
          <Text style={styles.readOnlyTitle}>
            {t('inspection.alreadyCheckedBy')}
          </Text>
          <Text style={styles.readOnlyName}>{readOnlyInspector}</Text>
          <TouchableOpacity
            style={styles.readOnlyBackBtn}
            onPress={() => router.replace('/(app)/vehicles')}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={18} color={colors.white} style={{ marginRight: 6 }} />
            <Text style={styles.readOnlyBackText}>{t('nav.vehicles')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Vehicle header */}
      {!readOnly && (
      <>
      <View style={styles.vehicleHeader}>
        <View>
          <Text style={styles.plateNumber}>{vehicle.plate_number}</Text>
          <Text style={styles.fleetText}>
            {vehicle.fleet_id} {' \u2022 '}
            {t(VEHICLE_TYPE_I18N_KEYS[vehicle.vehicle_type])}
          </Text>
          <Text style={styles.dateText}>
            {(() => {
              const d = new Date();
              const dd = String(d.getDate()).padStart(2, '0');
              const mm = String(d.getMonth() + 1).padStart(2, '0');
              const yyyy = d.getFullYear();
              return `${dd}/${mm}/${yyyy}`;
            })()}
          </Text>
        </View>
        {editMode && (
          <View style={styles.editBadge}>
            <Ionicons name="create-outline" size={14} color={colors.accent} style={{ marginRight: 4 }} />
            <Text style={styles.editBadgeText}>{t('inspection.editing')}</Text>
          </View>
        )}
      </View>

      {/* Frequency toggle */}
      <View style={styles.frequencyRow}>
        {FREQUENCY_TABS.map((freq) => (
          <TouchableOpacity
            key={freq}
            style={[styles.frequencyBtn, frequency === freq && styles.frequencyBtnActive]}
            onPress={() => setFrequency(freq)}
            activeOpacity={0.7}
          >
            <Text style={[styles.frequencyText, frequency === freq && styles.frequencyTextActive]}>
              {freq === 'daily'
                ? t('inspection.dailyEvent')
                : freq === 'weekly'
                ? t('inspection.weeklyEvent')
                : t('inspection.postRouteEvent')}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Interactive vehicle zone map */}
      {checklistItems.length > 0 && vehicle && (
        <VehicleMap
          vehicleType={vehicle.vehicle_type}
          zoneStatuses={zoneStatuses}
          zoneFailCounts={zoneFailCounts}
          activeZone={activeZone}
          onZonePress={setActiveZone}
          zoneLabels={zoneLabels}
          diagramVisible={diagramVisible}
          onToggleDiagram={() => setDiagramVisible(v => !v)}
        />
      )}

      {/* Checklist */}
      <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent}>
        {carryoverItems.size > 0 && (
          <View style={styles.carryoverBanner}>
            <Ionicons name="alert-circle" size={18} color={colors.accent} style={{ marginRight: 6 }} />
            <Text style={styles.carryoverText}>{t('inspection.carryoverNotice')}</Text>
          </View>
        )}
        {checklistError && (
          <View style={{ padding: spacing.lg, alignItems: 'center' }}>
            <Ionicons name="alert-circle-outline" size={48} color={colors.accent} />
            <Text style={{ color: colors.textSecondary, marginTop: spacing.sm }}>{t('general.error')}</Text>
            <TouchableOpacity
              style={{ marginTop: spacing.md, backgroundColor: colors.primary, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: borderRadius.sm }}
              onPress={() => vehicle && loadChecklist(vehicle.vehicle_type)}
              activeOpacity={0.7}
            >
              <Text style={{ fontWeight: '600' }}>{t('general.retry')}</Text>
            </TouchableOpacity>
          </View>
        )}
        {visibleItems.map((item) => {
          const itemResult = results[item.id];
          const itemPhotos = photosByItem[item.id] || [];
          const itemNote = notesByItem[item.id] || '';
          const needsPhoto = itemResult === 'fail' && itemPhotos.length === 0;
          // Expanded when: user manually expanded, item is failed, or details already exist.
          const expanded =
            expandedItems[item.id] ||
            itemResult === 'fail' ||
            itemPhotos.length > 0 ||
            !!itemNote;
          return (
            <View key={item.id} style={styles.checkCard}>
              <View style={styles.checkCardHeader}>
                <TouchableOpacity
                  style={styles.checkLabelWrap}
                  onPress={() => toggleExpanded(item.id)}
                  activeOpacity={0.6}
                >
                  <Text style={styles.checkLabel}>
                    {locale === 'th' ? item.item_name_th : item.item_name_en}
                  </Text>
                  {/* Collapsed-state indicators */}
                  <View style={styles.indicatorRow}>
                    {itemPhotos.length > 0 && (
                      <View style={styles.indicatorChip}>
                        <Ionicons name="camera" size={11} color={colors.accent} />
                        <Text style={styles.indicatorText}>{itemPhotos.length}</Text>
                      </View>
                    )}
                    {!!itemNote && (
                      <Ionicons
                        name="chatbubble-ellipses"
                        size={12}
                        color={colors.accent}
                        style={{ marginLeft: 6 }}
                      />
                    )}
                    <Ionicons
                      name={expanded ? 'chevron-up' : 'chevron-down'}
                      size={14}
                      color={colors.textTertiary}
                      style={{ marginLeft: 6 }}
                    />
                  </View>
                </TouchableOpacity>
                <View style={styles.toggleRow}>
                  <TouchableOpacity
                    style={[styles.toggleBtn, itemResult === 'pass' && styles.togglePass]}
                    onPress={() => toggleResult(item.id, 'pass')}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={`${locale === 'th' ? item.item_name_th : item.item_name_en} - ${t('inspection.pass')}`}
                    accessibilityState={{ selected: itemResult === 'pass' }}
                  >
                    <Text style={[styles.toggleText, itemResult === 'pass' && styles.toggleTextActive]}>
                      {t('inspection.pass')}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.toggleBtn, itemResult === 'fail' && styles.toggleFail]}
                    onPress={() => toggleResult(item.id, 'fail')}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={`${locale === 'th' ? item.item_name_th : item.item_name_en} - ${t('inspection.fail')}`}
                    accessibilityState={{ selected: itemResult === 'fail' }}
                  >
                    <Text style={[styles.toggleText, itemResult === 'fail' && styles.toggleTextActive]}>
                      {t('inspection.fail')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {expanded && (
                <>
                  {/* Per-item photos */}
                  <View style={styles.itemPhotoRow}>
                    {itemPhotos.map((uri, idx) => (
                      <View key={idx} style={styles.itemPhotoThumb}>
                        <Image source={{ uri }} style={styles.itemPhotoImage} />
                        <TouchableOpacity
                          style={styles.itemPhotoRemove}
                          onPress={() => removeItemPhoto(item.id, idx)}
                        >
                          <Ionicons name="close" size={12} color={colors.white} />
                        </TouchableOpacity>
                      </View>
                    ))}
                    <TouchableOpacity
                      style={[styles.itemPhotoAdd, needsPhoto && styles.itemPhotoAddRequired]}
                      onPress={() => addItemPhotoFromCamera(item.id)}
                      onLongPress={() => addItemPhotoFromLibrary(item.id)}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name="camera-outline"
                        size={20}
                        color={needsPhoto ? colors.statusFail : colors.accent}
                      />
                    </TouchableOpacity>
                  </View>

                  {needsPhoto && (
                    <Text style={styles.itemPhotoRequired}>
                      {t('inspection.itemPhotoRequired')}
                    </Text>
                  )}

                  {/* Per-item note */}
                  <TextInput
                    style={styles.itemNoteInput}
                    placeholder={t('inspection.itemNotesPlaceholder')}
                    placeholderTextColor={colors.textTertiary}
                    value={itemNote}
                    onChangeText={(v) => setItemNote(item.id, v)}
                  />
                </>
              )}
            </View>
          );
        })}

        {/* Photo section */}
        {checklistItems.length > 0 && (
          <View style={styles.photoSection}>
            <Text style={styles.photoSectionTitle}>
              {t('inspection.addPhotos')}
            </Text>
            {hasFailures && (
              <Text style={styles.failCountText}>
                {t('inspection.failCount').replace('{count}', String(failCount))}
              </Text>
            )}

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

            {photos.length > 0 && (
              <View style={styles.photoGrid}>
                {photos.map((uri, idx) => (
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
          </View>
        )}

        {/* All pass */}
        {!hasFailures && checklistItems.length > 0 && (
          <View style={styles.allPassRow}>
            <Ionicons name="checkmark-circle" size={20} color={colors.statusPass} style={{ marginRight: spacing.sm }} />
            <Text style={styles.allPassText}>{t('inspection.allPass')}</Text>
          </View>
        )}

        {/* Mileage section */}
        <View style={styles.mileageSection}>
          <Text style={styles.mileageSectionTitle}>
            {t('inspection.currentMileage')}
            <Text style={styles.mileageRequiredMark}> *</Text>
          </Text>
          <TextInput
            style={[styles.mileageInput, !mileageValid && mileage.length > 0 && styles.mileageInputInvalid]}
            placeholder={t('inspection.mileagePlaceholder')}
            placeholderTextColor={colors.textTertiary}
            value={mileage}
            onChangeText={(v) => setMileage(v.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            maxLength={9}
          />
          <Text style={styles.mileageHint}>
            {t('inspection.odometerPhoto')}
            <Text style={styles.mileageRequiredMark}> *</Text>
          </Text>
          <View style={styles.odometerPhotoRow}>
            {odometerPhoto ? (
              <View style={styles.odometerPhotoThumb}>
                <Image source={{ uri: odometerPhoto }} style={styles.odometerPhotoImage} />
                <TouchableOpacity
                  style={styles.odometerPhotoRemove}
                  onPress={() => setOdometerPhoto(null)}
                >
                  <Ionicons name="close" size={14} color={colors.white} />
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <TouchableOpacity style={styles.photoBtn} onPress={takeOdometerPhoto} activeOpacity={0.7}>
                  <Ionicons name="camera-outline" size={20} color={colors.accent} style={{ marginRight: 6 }} />
                  <Text style={styles.photoBtnText}>{t('inspection.takePhoto')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.photoBtn} onPress={pickOdometerPhoto} activeOpacity={0.7}>
                  <Ionicons name="images-outline" size={20} color={colors.accent} style={{ marginRight: 6 }} />
                  <Text style={styles.photoBtnText}>{t('inspection.pickPhoto')}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        {/* Final question: is the vehicle usable? (drives the Out of Service card) */}
        <View style={styles.usableSection}>
          <Text style={styles.usableSectionTitle}>
            {t('inspection.vehicleUsable')}
            <Text style={styles.mileageRequiredMark}> *</Text>
          </Text>
          <View style={styles.usableRow}>
            <TouchableOpacity
              style={[styles.usableBtn, vehicleUsable === true && styles.usableBtnYes]}
              onPress={() => setVehicleUsable(true)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={t('inspection.vehicleUsableYes')}
              accessibilityState={{ selected: vehicleUsable === true }}
            >
              <Text style={[styles.usableText, vehicleUsable === true && styles.toggleTextActive]}>
                {t('inspection.vehicleUsableYes')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.usableBtn, vehicleUsable === false && styles.usableBtnNo]}
              onPress={() => setVehicleUsable(false)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={t('inspection.vehicleUsableNo')}
              accessibilityState={{ selected: vehicleUsable === false }}
            >
              <Text style={[styles.usableText, vehicleUsable === false && styles.toggleTextActive]}>
                {t('inspection.vehicleUsableNo')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Notes section */}
        <View style={styles.notesSection}>
          <Text style={styles.notesSectionTitle}>{t('inspection.notes')}</Text>
          <TextInput
            style={styles.notesInput}
            placeholder={t('inspection.notesPlaceholder')}
            placeholderTextColor={colors.textTertiary}
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Fixed submit button */}
      <View style={styles.submitBar}>
        {editMode && existingInspectionId && (
          <TouchableOpacity
            style={styles.clearBtn}
            onPress={handleClearInspection}
            activeOpacity={0.7}
          >
            <Ionicons name="trash-outline" size={16} color={colors.accent} style={{ marginRight: 4 }} />
            <Text style={styles.clearBtnText}>{t('inspection.clearInspection')}</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[
            styles.submitBtn,
            !hasFailures && styles.submitBtnPass,
            !canSubmit && styles.submitBtnDisabled,
          ]}
          onPress={handleSubmit}
          disabled={!canSubmit}
          activeOpacity={0.8}
        >
          {submitting ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.submitBtnText}>
              {editMode
                ? t('inspection.updateInspection')
                : hasFailures
                ? t('inspection.submitFail')
                : t('inspection.submitPass')}
            </Text>
          )}
        </TouchableOpacity>
      </View>
      </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  errorText: { fontSize: 16, color: colors.textSecondary },

  // Read-only state
  readOnlyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  readOnlyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  readOnlyName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.accent,
    marginBottom: spacing.lg,
  },
  readOnlyBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent,
    paddingVertical: 12,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
  },
  readOnlyBackText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '600',
  },

  // Edit badge
  editBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    backgroundColor: statusColors.fail.bg,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: borderRadius.sm,
    alignSelf: 'flex-start',
  },
  editBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.accent,
  },

  // Vehicle header
  vehicleHeader: {
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  plateNumber: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  fleetText: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  dateText: {
    fontSize: 13,
    color: colors.textTertiary,
    marginTop: 2,
  },

  // Frequency toggle
  frequencyRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.md,
  },
  frequencyBtn: {
    paddingBottom: 6,
  },
  frequencyBtnActive: {
    borderBottomWidth: 2,
    borderBottomColor: colors.accent,
  },
  frequencyText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  frequencyTextActive: {
    color: colors.accent,
    fontWeight: '700',
  },

  // Carryover banner
  carryoverBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: statusColors.fail.bg,
  },
  carryoverText: {
    flex: 1,
    fontSize: 13,
    color: colors.accent,
    fontWeight: '600',
  },

  // Vehicle usable question
  usableSection: {
    padding: spacing.md,
    marginTop: spacing.sm,
    marginHorizontal: spacing.md,
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    ...shadows.sm,
  },
  usableSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  usableRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  usableBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    alignItems: 'center',
  },
  usableBtnYes: {
    backgroundColor: colors.statusPass,
    borderColor: colors.statusPass,
  },
  usableBtnNo: {
    backgroundColor: colors.statusFail,
    borderColor: colors.statusFail,
  },
  usableText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textSecondary,
  },

  // Notes
  notesSection: {
    padding: spacing.md,
    marginTop: spacing.sm,
    marginHorizontal: spacing.md,
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    ...shadows.sm,
  },
  notesSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },

  // Mileage / odometer
  mileageSection: {
    padding: spacing.md,
    marginTop: spacing.sm,
    marginHorizontal: spacing.md,
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    ...shadows.sm,
  },
  mileageSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  mileageRequiredMark: {
    color: colors.statusFail,
    fontWeight: '700',
  },
  mileageInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    fontSize: 17,
    fontWeight: '600',
    color: colors.textPrimary,
    backgroundColor: colors.inputBackground,
    marginBottom: spacing.md,
  },
  mileageInputInvalid: {
    borderColor: colors.statusFail,
  },
  mileageHint: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  odometerPhotoRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  odometerPhotoThumb: {
    width: 120,
    height: 90,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
    position: 'relative',
  },
  odometerPhotoImage: {
    width: 120,
    height: 90,
    resizeMode: 'cover',
  },
  odometerPhotoRemove: {
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
  notesInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    fontSize: 14,
    color: colors.textPrimary,
    backgroundColor: colors.inputBackground,
    minHeight: 80,
  },

  // Checklist
  scrollArea: { flex: 1 },
  scrollContent: { paddingBottom: spacing.md },
  checkCard: {
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    ...shadows.sm,
  },
  checkCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  checkLabelWrap: {
    flex: 1,
    marginRight: spacing.sm,
  },
  checkLabel: {
    fontSize: 15,
    color: colors.textPrimary,
  },
  indicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  indicatorChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: colors.inputBackground,
  },
  indicatorText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.accent,
  },
  itemPhotoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: 4,
  },
  itemPhotoThumb: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
    position: 'relative',
  },
  itemPhotoImage: { width: 56, height: 56, resizeMode: 'cover' },
  itemPhotoRemove: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemPhotoAdd: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.inputBackground,
  },
  itemPhotoAddRequired: {
    borderColor: colors.statusFail,
    backgroundColor: statusColors.fail.bg,
  },
  itemPhotoRequired: {
    fontSize: 12,
    color: colors.statusFail,
    marginTop: 6,
    fontWeight: '600',
  },
  itemNoteInput: {
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: colors.textPrimary,
    backgroundColor: colors.inputBackground,
  },

  // Toggle buttons
  toggleRow: { flexDirection: 'row', gap: spacing.xs },
  toggleBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  togglePass: {
    backgroundColor: colors.statusPass,
    borderColor: colors.statusPass,
  },
  toggleFail: {
    backgroundColor: colors.statusFail,
    borderColor: colors.statusFail,
  },
  toggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  toggleTextActive: {
    color: colors.white,
  },

  // Photo section
  photoSection: {
    padding: spacing.md,
    marginTop: spacing.sm,
    marginHorizontal: spacing.md,
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    ...shadows.sm,
  },
  photoSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  failCountText: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
    marginBottom: spacing.md,
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
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  photoThumb: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
    position: 'relative',
  },
  photoImage: {
    width: 80,
    height: 80,
    resizeMode: 'cover',
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

  // All pass
  allPassRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm,
    marginHorizontal: spacing.md,
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
  },
  allPassText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.statusPass,
  },

  // Submit bar
  submitBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.md,
    paddingBottom: spacing.lg,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  submitBtn: {
    backgroundColor: colors.accent,
    paddingVertical: 16,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  submitBtnPass: {
    backgroundColor: colors.statusPass,
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    marginBottom: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.accent + '40',
    backgroundColor: colors.accent + '08',
  },
  clearBtnText: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '600',
  },
  submitBtnText: {
    color: colors.white,
    fontSize: 17,
    fontWeight: '700',
  },
});

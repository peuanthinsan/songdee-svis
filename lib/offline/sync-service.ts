import * as FileSystem from 'expo-file-system/legacy';
import { getDb } from './database';
import { apiFetch, API_BASE, getAuthToken } from '../api';

type PendingInspection = {
  id: string;
  payload: string;
  photo_uris: string;
  status: string;
  error: string | null;
  created_at: number;
  attempts: number;
};

async function persistUri(uri: string): Promise<string> {
  if (uri.startsWith('http')) return uri; // already remote
  if (!uri.startsWith('file://') && !uri.startsWith('/')) return uri;
  if (!FileSystem.documentDirectory) throw new Error('Local document directory not available');
  const filename = `offline-photo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.jpg`;
  const dest = `${FileSystem.documentDirectory}${filename}`;
  await FileSystem.copyAsync({ from: uri, to: dest });
  return dest;
}

export async function queueInspection(
  payload: any,
  photoUris: string[],
  photosByItem?: Record<string, string[]>
): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error('Offline storage not available');
  const id = `offline-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  // Copy inspection-level photos to persistent directory.
  const persistedUris: string[] = [];
  for (const uri of photoUris) {
    persistedUris.push(await persistUri(uri));
  }

  // Copy per-item photos too — stash the persisted map on the payload itself.
  if (photosByItem) {
    const persistedByItem: Record<string, string[]> = {};
    for (const [itemId, uris] of Object.entries(photosByItem)) {
      const list: string[] = [];
      for (const uri of uris) list.push(await persistUri(uri));
      persistedByItem[itemId] = list;
    }
    payload._persistedPhotosByItem = persistedByItem;
  }

  // Persist the odometer photo locally so it survives until upload.
  if (typeof payload.odometerPhotoLocal === 'string' && payload.odometerPhotoLocal) {
    payload._persistedOdometerPhoto = await persistUri(payload.odometerPhotoLocal);
    delete payload.odometerPhotoLocal;
  }

  await db.runAsync(
    'INSERT INTO pending_inspections (id, payload, photo_uris, status, created_at) VALUES (?, ?, ?, ?, ?)',
    id, JSON.stringify(payload), JSON.stringify(persistedUris), 'pending', Date.now()
  );

  return id;
}

export async function getPendingCount(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const row = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM pending_inspections WHERE status IN ('pending', 'failed')"
  );
  return row?.count ?? 0;
}

export async function getPendingInspections(): Promise<PendingInspection[]> {
  const db = await getDb();
  if (!db) return [];
  return db.getAllAsync<PendingInspection>(
    "SELECT * FROM pending_inspections WHERE status IN ('pending', 'failed') ORDER BY created_at ASC"
  );
}

async function uploadPhoto(uri: string): Promise<string> {
  // Remote URLs don't need uploading
  if (uri.startsWith('http')) return uri;

  const filename = `inspection-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.jpg`;
  const formData = new FormData();
  formData.append('file', {
    uri,
    type: 'image/jpeg',
    name: filename,
  } as any);

  const token = await getAuthToken();
  const res = await fetch(`${API_BASE}/api/upload?filename=${filename}`, {
    method: 'POST',
    body: formData,
    headers: {
      'Content-Type': 'multipart/form-data',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) throw new Error('Photo upload failed');
  const data = await res.json();
  return data.url;
}

export async function processSyncQueue(): Promise<{ synced: number; failed: number }> {
  const pending = await getPendingInspections();
  let synced = 0;
  let failed = 0;
  const db = await getDb();
  if (!db || pending.length === 0) return { synced, failed };

  for (const item of pending) {
    if (item.attempts >= 5) {
      await db.runAsync(
        "UPDATE pending_inspections SET status = 'permanently_failed' WHERE id = ?",
        item.id
      );
      failed++;
      continue;
    }

    try {
      const payload = JSON.parse(item.payload);
      const photoUris: string[] = JSON.parse(item.photo_uris);

      // Upload inspection-level photos
      const photoUrls = await Promise.all(photoUris.map(uploadPhoto));
      payload.photoUrls = photoUrls;

      // Upload odometer photo if it was queued offline.
      const persistedOdometer: string | undefined = payload._persistedOdometerPhoto;
      if (persistedOdometer) {
        payload.odometerPhotoUrl = await uploadPhoto(persistedOdometer);
        delete payload._persistedOdometerPhoto;
      }

      // Upload per-item photos, map back into results[].photoUrls
      const persistedByItem: Record<string, string[]> | undefined = payload._persistedPhotosByItem;
      const perItemFilesToCleanup: string[] = [];
      if (persistedByItem && Array.isArray(payload.results)) {
        const uploadedByItem: Record<string, string[]> = {};
        for (const [itemId, uris] of Object.entries(persistedByItem)) {
          const uploaded: string[] = [];
          for (const uri of uris) {
            uploaded.push(await uploadPhoto(uri));
            perItemFilesToCleanup.push(uri);
          }
          uploadedByItem[itemId] = uploaded;
        }
        payload.results = payload.results.map((r: any) => ({
          ...r,
          photoUrls: uploadedByItem[r.checklistItemId] ?? r.photoUrls ?? [],
        }));
        delete payload._persistedPhotosByItem;
      }

      // Submit inspection
      await apiFetch('/api/inspections', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      // Clean up local photos
      const odometerToCleanup = persistedOdometer ? [persistedOdometer] : [];
      for (const uri of [...photoUris, ...perItemFilesToCleanup, ...odometerToCleanup]) {
        if (uri.startsWith(FileSystem.documentDirectory ?? '')) {
          await FileSystem.deleteAsync(uri, { idempotent: true });
        }
      }

      await db.runAsync(
        "UPDATE pending_inspections SET status = 'synced' WHERE id = ?",
        item.id
      );
      synced++;
    } catch (err: any) {
      const errorMsg = err.message || 'Unknown error';
      // If it's a conflict (already inspected), mark as synced — someone else got there first
      if (errorMsg.includes('already inspected') || errorMsg.includes('Already inspected')) {
        await db.runAsync(
          "UPDATE pending_inspections SET status = 'conflict', error = ? WHERE id = ?",
          errorMsg, item.id
        );
        synced++;
      } else {
        await db.runAsync(
          "UPDATE pending_inspections SET status = 'failed', error = ?, attempts = attempts + 1 WHERE id = ?",
          errorMsg, item.id
        );
        failed++;
      }
    }
  }

  return { synced, failed };
}

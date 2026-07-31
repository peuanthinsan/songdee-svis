import * as FileSystem from 'expo-file-system/legacy';
import { getDb } from './database';
import { apiFetch, API_BASE, isAuthTokenCurrent } from '../api';

type PendingInspection = {
  id: string;
  owner_scope: string;
  payload: string;
  photo_uris: string;
  status: string;
  error: string | null;
  created_at: number;
  attempts: number;
};

class SyncCancelledError extends Error {
  constructor() {
    super('Sync cancelled because the authenticated session changed');
    this.name = 'SyncCancelledError';
  }
}

function assertSyncSession(expectedToken: string, signal?: AbortSignal): void {
  if (signal?.aborted || !isAuthTokenCurrent(expectedToken)) {
    throw new SyncCancelledError();
  }
}

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
  ownerScope: string,
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
    'INSERT INTO pending_inspections (id, owner_scope, payload, photo_uris, status, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    id, ownerScope, JSON.stringify(payload), JSON.stringify(persistedUris), 'pending', Date.now()
  );

  return id;
}

export async function getPendingCount(ownerScope: string): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const row = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM pending_inspections WHERE owner_scope = ? AND status IN ('pending', 'failed')",
    ownerScope
  );
  return row?.count ?? 0;
}

export async function getPendingInspections(ownerScope: string): Promise<PendingInspection[]> {
  const db = await getDb();
  if (!db) return [];
  return db.getAllAsync<PendingInspection>(
    "SELECT * FROM pending_inspections WHERE owner_scope = ? AND status IN ('pending', 'failed') ORDER BY created_at ASC",
    ownerScope
  );
}

async function adoptLegacyPendingInspections(
  ownerScope: string,
  userId: string,
  expectedToken: string,
  signal?: AbortSignal
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const legacyRows = await db.getAllAsync<Pick<PendingInspection, 'id' | 'payload'>>(
    "SELECT id, payload FROM pending_inspections WHERE owner_scope = '' AND status IN ('pending', 'failed')"
  );

  for (const item of legacyRows) {
    try {
      assertSyncSession(expectedToken, signal);
      const payload = JSON.parse(item.payload);
      if (!payload.vehicleId || payload.inspectorId !== userId) continue;
      // The company-scoped API returns this vehicle only when it belongs to the
      // active tenant. Adopt legacy rows before any photo upload or submission.
      await apiFetch(`/api/vehicles?id=${encodeURIComponent(payload.vehicleId)}`, {
        authToken: expectedToken,
        signal,
      });
      assertSyncSession(expectedToken, signal);
      await db.runAsync(
        "UPDATE pending_inspections SET owner_scope = ? WHERE id = ? AND owner_scope = ''",
        ownerScope,
        item.id
      );
    } catch (error) {
      if (error instanceof SyncCancelledError || signal?.aborted) throw error;
      // This row may belong to another user or company. Leave it unscoped for
      // its original inspector's next authenticated sync.
    }
  }
}

async function uploadPhoto(
  uri: string,
  expectedToken: string,
  signal?: AbortSignal
): Promise<string> {
  assertSyncSession(expectedToken, signal);
  // Remote URLs don't need uploading
  if (uri.startsWith('http')) return uri;

  const filename = `inspection-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.jpg`;
  const formData = new FormData();
  formData.append('file', {
    uri,
    type: 'image/jpeg',
    name: filename,
  } as any);

  const res = await fetch(`${API_BASE}/api/upload?filename=${filename}`, {
    method: 'POST',
    body: formData,
    signal,
    headers: {
      'Content-Type': 'multipart/form-data',
      Authorization: `Bearer ${expectedToken}`,
    },
  });
  assertSyncSession(expectedToken, signal);
  if (!res.ok) throw new Error('Photo upload failed');
  const data = await res.json();
  return data.url;
}

export async function processSyncQueue(
  ownerScope: string,
  userId: string,
  expectedToken: string,
  signal?: AbortSignal
): Promise<{ synced: number; failed: number }> {
  assertSyncSession(expectedToken, signal);
  await adoptLegacyPendingInspections(ownerScope, userId, expectedToken, signal);
  const pending = await getPendingInspections(ownerScope);
  let synced = 0;
  let failed = 0;
  const db = await getDb();
  if (!db || pending.length === 0) return { synced, failed };

  for (const item of pending) {
    assertSyncSession(expectedToken, signal);
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
      const photoUrls = await Promise.all(
        photoUris.map((uri) => uploadPhoto(uri, expectedToken, signal))
      );
      payload.photoUrls = photoUrls;

      // Upload odometer photo if it was queued offline.
      const persistedOdometer: string | undefined = payload._persistedOdometerPhoto;
      if (persistedOdometer) {
        payload.odometerPhotoUrl = await uploadPhoto(persistedOdometer, expectedToken, signal);
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
            uploaded.push(await uploadPhoto(uri, expectedToken, signal));
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
        authToken: expectedToken,
        signal,
      });
      assertSyncSession(expectedToken, signal);

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
      if (err instanceof SyncCancelledError || signal?.aborted) {
        return { synced, failed };
      }
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

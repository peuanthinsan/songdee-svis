const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type InspectionResultInput = {
  checklistItemId?: unknown;
  result?: unknown;
  photoUrls?: unknown;
  notes?: unknown;
};

export function validateInspectionResults(results: unknown): string | null {
  if (!Array.isArray(results) || results.length === 0) return 'At least one checklist result is required';
  const ids = new Set<string>();
  for (const raw of results as InspectionResultInput[]) {
    if (!raw || typeof raw !== 'object' || typeof raw.checklistItemId !== 'string' || !UUID_RE.test(raw.checklistItemId)) return 'Invalid checklist result';
    const id = raw.checklistItemId;
    if (ids.has(id)) return 'Duplicate checklist item';
    ids.add(id);
    if (raw.result !== 'pass' && raw.result !== 'fail') return 'Invalid checklist result';
    if (raw.photoUrls !== undefined && !Array.isArray(raw.photoUrls)) return 'Invalid checklist photos';
    if (Array.isArray(raw.photoUrls) && !raw.photoUrls.every((url) => typeof url === 'string')) return 'Invalid checklist photos';
    if (raw.result === 'fail' && (!Array.isArray(raw.photoUrls) || raw.photoUrls.length === 0)) return 'A photo is required for every failed checklist item';
    if (raw.notes !== undefined && typeof raw.notes !== 'string') return 'Invalid checklist notes';
  }
  return null;
}

export function validateMileage(mileage: unknown): mileage is number {
  return typeof mileage === 'number' && Number.isSafeInteger(mileage) && mileage >= 0;
}

export function validatePhotoUrls(value: unknown): value is string[] | undefined {
  return value === undefined || (Array.isArray(value) && value.every((url) => typeof url === 'string'));
}

export function validateInspectionDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function validateInspectionFrequency(value: unknown): value is 'daily' | 'weekly' | 'post_route' {
  return value === 'daily' || value === 'weekly' || value === 'post_route';
}

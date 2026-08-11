export type InspectionFrequency = 'daily' | 'weekly' | 'post_route';
export type InspectionResult = 'pass' | 'fail';
export type InspectionZone = 'front' | 'cabin' | 'cargo_supplies' | 'exterior_tires';

export type ChecklistSection =
  | 'front'
  | 'rear'
  | 'sides'
  | 'top'
  | 'underbody'
  | 'cabin'
  | 'cargo'
  | 'documents'
  | 'supplies';

export type InspectionChecklistItem = {
  id: string;
  section?: ChecklistSection | null;
};

export const INSPECTION_ZONES: InspectionZone[] = [
  'front',
  'cabin',
  'cargo_supplies',
  'exterior_tires',
];

export const ZONE_SECTIONS: Record<InspectionZone, ChecklistSection[]> = {
  front: ['front'],
  cabin: ['cabin', 'rear'],
  cargo_supplies: ['cargo', 'documents', 'supplies'],
  exterior_tires: ['sides', 'top', 'underbody'],
};

export function itemsForZone<T extends InspectionChecklistItem>(items: T[], zone: InspectionZone | null): T[] {
  if (!zone) return items;
  const sections = ZONE_SECTIONS[zone];
  return items.filter((item) => item.section != null && sections.includes(item.section));
}

function thaiDateParts(now: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
  };
}

export function getTodayThai(now = new Date()): string {
  const { year, month, day } = thaiDateParts(now);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function getMondayOfWeekThai(now = new Date()): string {
  const { year, month, day } = thaiDateParts(now);
  const localCalendarDate = new Date(Date.UTC(year, month - 1, day));
  const weekday = localCalendarDate.getUTCDay();
  const daysSinceMonday = weekday === 0 ? 6 : weekday - 1;
  localCalendarDate.setUTCDate(localCalendarDate.getUTCDate() - daysSinceMonday);
  return localCalendarDate.toISOString().slice(0, 10);
}

export function activeInspectionQuery(
  vehicleId: string,
  frequency: InspectionFrequency,
  now = new Date(),
): URLSearchParams {
  const params = new URLSearchParams({ vehicleId, frequency });
  if (frequency === 'weekly') params.set('since', getMondayOfWeekThai(now));
  else params.set('date', getTodayThai(now));
  return params;
}

export type InspectionDraftValidation =
  | { valid: true }
  | { valid: false; reason: 'empty' | 'unanswered' | 'failure-photo' | 'mileage' | 'odometer' | 'usable'; itemId?: string };

export function validateInspectionDraft(args: {
  items: InspectionChecklistItem[];
  results: Record<string, InspectionResult>;
  photoCountByItem: Record<string, number>;
  mileage: string;
  hasOdometerPhoto: boolean;
  vehicleUsable: boolean | null;
}): InspectionDraftValidation {
  const { items, results, photoCountByItem, mileage, hasOdometerPhoto, vehicleUsable } = args;
  if (items.length === 0) return { valid: false, reason: 'empty' };

  const unanswered = items.find((item) => results[item.id] !== 'pass' && results[item.id] !== 'fail');
  if (unanswered) return { valid: false, reason: 'unanswered', itemId: unanswered.id };

  const failureWithoutPhoto = items.find(
    (item) => results[item.id] === 'fail' && (photoCountByItem[item.id] ?? 0) === 0,
  );
  if (failureWithoutPhoto) return { valid: false, reason: 'failure-photo', itemId: failureWithoutPhoto.id };

  if (!/^\d+$/.test(mileage.trim())) return { valid: false, reason: 'mileage' };
  if (!hasOdometerPhoto) return { valid: false, reason: 'odometer' };
  if (vehicleUsable === null) return { valid: false, reason: 'usable' };
  return { valid: true };
}

import type { ChecklistItem, VehicleTypeKey } from './api';

export type ChecklistFrequency = ChecklistItem['frequency'];

export const CHECKLIST_FREQUENCIES: readonly ChecklistFrequency[] = [
  'daily',
  'weekly',
  'post_route',
];

export const CHECKLIST_VEHICLE_TYPES: readonly VehicleTypeKey[] = [
  'car', 'van', 'e_van', 'motorcycle', 'e_bike', 'light_truck', 'six_wheel_truck',
];

export type ChecklistFrequencyGroup = {
  frequency: ChecklistFrequency;
  itemCount: number;
  vehicleGroups: Array<{
    vehicleType: VehicleTypeKey;
    items: ChecklistItem[];
  }>;
};

type ChecklistFilters = {
  vehicleType?: VehicleTypeKey | '';
  frequency?: ChecklistFrequency | '';
  search?: string;
};

export function groupChecklistItems(
  items: readonly ChecklistItem[],
  filters: ChecklistFilters = {},
): ChecklistFrequencyGroup[] {
  const query = filters.search?.trim().toLowerCase() ?? '';
  const buckets = new Map<string, ChecklistItem[]>();

  for (const item of items) {
    if (filters.vehicleType && item.vehicle_type !== filters.vehicleType) continue;
    if (filters.frequency && item.frequency !== filters.frequency) continue;
    if (
      query
      && !item.item_name_th.toLowerCase().includes(query)
      && !item.item_name_en.toLowerCase().includes(query)
    ) {
      continue;
    }

    const key = `${item.frequency}:${item.vehicle_type}`;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(item);
    else buckets.set(key, [item]);
  }

  const groups: ChecklistFrequencyGroup[] = [];
  for (const frequency of CHECKLIST_FREQUENCIES) {
    const vehicleGroups: ChecklistFrequencyGroup['vehicleGroups'] = [];
    let itemCount = 0;

    for (const vehicleType of CHECKLIST_VEHICLE_TYPES) {
      const bucket = buckets.get(`${frequency}:${vehicleType}`);
      if (!bucket) continue;
      bucket.sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id));
      itemCount += bucket.length;
      vehicleGroups.push({ vehicleType, items: bucket });
    }

    if (vehicleGroups.length > 0) {
      groups.push({ frequency, itemCount, vehicleGroups });
    }
  }

  return groups;
}

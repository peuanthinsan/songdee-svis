export const CHECKLIST_IMPORT_LIMIT = 1000;

const VALID_FREQUENCIES = new Set(['daily', 'weekly', 'post_route']);
const VALID_VEHICLE_TYPES = new Set(['car', 'van', 'e_van', 'motorcycle', 'e_bike', 'light_truck', 'six_wheel_truck']);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class ChecklistInputError extends Error {}

export type BulkChecklistItem = {
  vehicleType: string;
  frequency: string;
  itemNameTh: string;
  itemNameEn: string;
  sortOrder: number;
};

export type ChecklistOrderUpdate = {
  id: string;
  sortOrder: number;
};

function recordAt(value: unknown, index: number): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ChecklistInputError(`Row ${index + 1} must be an object`);
  }
  return value as Record<string, unknown>;
}

function requiredText(value: unknown, field: string, index: number) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) throw new ChecklistInputError(`Row ${index + 1}: ${field} is required`);
  if (text.length > 500) throw new ChecklistInputError(`Row ${index + 1}: ${field} is too long`);
  return text;
}

function validateBatch(value: unknown, noun: string) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new ChecklistInputError(`${noun} must contain at least one row`);
  }
  if (value.length > CHECKLIST_IMPORT_LIMIT) {
    throw new ChecklistInputError(`${noun} cannot exceed ${CHECKLIST_IMPORT_LIMIT} rows`);
  }
  return value;
}

export function normalizeChecklistImport(value: unknown): BulkChecklistItem[] {
  return validateBatch(value, 'Import').map((entry, index) => {
    const row = recordAt(entry, index);
    const vehicleType = requiredText(row.vehicleType, 'vehicleType', index);
    const frequency = requiredText(row.frequency, 'frequency', index);
    const sortOrder = Number(row.sortOrder);

    if (!VALID_VEHICLE_TYPES.has(vehicleType)) {
      throw new ChecklistInputError(`Row ${index + 1}: invalid vehicleType`);
    }
    if (!VALID_FREQUENCIES.has(frequency)) {
      throw new ChecklistInputError(`Row ${index + 1}: invalid frequency`);
    }
    if (!Number.isInteger(sortOrder) || sortOrder < 1 || sortOrder > 1_000_000) {
      throw new ChecklistInputError(`Row ${index + 1}: sortOrder must be a positive integer`);
    }

    return {
      vehicleType,
      frequency,
      itemNameTh: requiredText(row.itemNameTh, 'itemNameTh', index),
      itemNameEn: requiredText(row.itemNameEn, 'itemNameEn', index),
      sortOrder,
    };
  });
}

export function normalizeChecklistOrder(value: unknown): ChecklistOrderUpdate[] {
  const seen = new Set<string>();
  return validateBatch(value, 'Reorder').map((entry, index) => {
    const row = recordAt(entry, index);
    const id = requiredText(row.id, 'id', index);
    const sortOrder = Number(row.sortOrder);

    if (!UUID_PATTERN.test(id)) throw new ChecklistInputError(`Row ${index + 1}: invalid id`);
    if (seen.has(id)) throw new ChecklistInputError(`Row ${index + 1}: duplicate id`);
    if (!Number.isInteger(sortOrder) || sortOrder < 1 || sortOrder > 1_000_000) {
      throw new ChecklistInputError(`Row ${index + 1}: sortOrder must be a positive integer`);
    }
    seen.add(id);
    return { id, sortOrder };
  });
}

import type { ChecklistItem, VehicleTypeKey } from './api';
import type { ChecklistFrequency } from './checklist-groups';

export const CHECKLIST_IMPORT_LIMIT = 1000;
export const CHECKLIST_IMPORT_MAX_BYTES = 5 * 1024 * 1024;

export type ChecklistImportIssue =
  | 'missing_thai_name'
  | 'missing_english_name'
  | 'invalid_frequency'
  | 'invalid_vehicle_type'
  | 'name_too_long';

export type ChecklistImportRow = {
  rowNumber: number;
  itemNameTh: string;
  itemNameEn: string;
  frequency: ChecklistFrequency;
  vehicleType: VehicleTypeKey;
  frequencyDisplay: string;
  vehicleTypeDisplay: string;
  issues: ChecklistImportIssue[];
};

export type ChecklistImportDefaults = {
  frequency: ChecklistFrequency;
  vehicleType: VehicleTypeKey;
};

export type ChecklistImportPayloadItem = {
  itemNameTh: string;
  itemNameEn: string;
  frequency: ChecklistFrequency;
  vehicleType: VehicleTypeKey;
  sortOrder: number;
};

export class ChecklistImportError extends Error {}

const HEADER_ALIASES = {
  itemNameTh: new Set(['item_name_th', 'name_th', 'name_thai', 'thai_name', 'thai', 'ชื่อภาษาไทย', 'ชื่อไทย']),
  itemNameEn: new Set(['item_name_en', 'name_en', 'name_english', 'english_name', 'english', 'ชื่อภาษาอังกฤษ', 'ชื่ออังกฤษ']),
  frequency: new Set(['frequency', 'inspection_frequency', 'ความถี่']),
  vehicleType: new Set(['vehicle_type', 'vehicletype', 'vehicle', 'type', 'ประเภทรถ']),
};

const FREQUENCY_ALIASES: Record<string, ChecklistFrequency> = {
  daily: 'daily',
  pre_route: 'daily',
  preroute: 'daily',
  'รายวัน': 'daily',
  weekly: 'weekly',
  'รายสัปดาห์': 'weekly',
  post_route: 'post_route',
  postroute: 'post_route',
  after_route: 'post_route',
  'หลังออกรถ': 'post_route',
  'หลังวิ่งงาน': 'post_route',
};

const VEHICLE_TYPE_ALIASES: Record<string, VehicleTypeKey> = {
  car: 'car',
  pickup: 'car',
  'รถยนต์': 'car',
  van: 'van',
  'แวน': 'van',
  e_van: 'e_van',
  evan: 'e_van',
  electric_van: 'e_van',
  'รถตู้ไฟฟ้า': 'e_van',
  'อีแวน': 'e_van',
  motorcycle: 'motorcycle',
  motorbike: 'motorcycle',
  'มอเตอร์ไซค์': 'motorcycle',
  e_bike: 'e_bike',
  ebike: 'e_bike',
  electric_bike: 'e_bike',
  'จักรยานยนต์ไฟฟ้า': 'e_bike',
  light_truck: 'light_truck',
  lighttruck: 'light_truck',
  'light truck': 'light_truck',
  six_wheel_truck: 'six_wheel_truck',
  sixwheeltruck: 'six_wheel_truck',
  '6_wheel_truck': 'six_wheel_truck',
  '6-wheel truck': 'six_wheel_truck',
};

function normalizeToken(value: string) {
  return value
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .replace(/[()]/g, '')
    .replace(/[\s\-/]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function cellText(value: unknown) {
  return value == null ? '' : String(value).trim();
}

function findColumn(headers: string[], aliases: Set<string>) {
  return headers.findIndex((header) => aliases.has(header));
}

export function parseCsvMatrix(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') quoted = true;
    else if (char === ',') {
      row.push(cell);
      cell = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[index + 1] === '\n') index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }

  if (cell || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

export function parseChecklistImportMatrix(
  matrix: readonly (readonly unknown[])[],
  defaults: ChecklistImportDefaults,
): ChecklistImportRow[] {
  const headerIndex = matrix.findIndex((row) => row.some((cell) => cellText(cell)));
  if (headerIndex < 0) throw new ChecklistImportError('The file is empty');

  const headers = matrix[headerIndex].map((cell) => normalizeToken(cellText(cell)));
  const thIndex = findColumn(headers, HEADER_ALIASES.itemNameTh);
  const enIndex = findColumn(headers, HEADER_ALIASES.itemNameEn);
  const frequencyIndex = findColumn(headers, HEADER_ALIASES.frequency);
  const vehicleTypeIndex = findColumn(headers, HEADER_ALIASES.vehicleType);

  if (thIndex < 0 || enIndex < 0) {
    throw new ChecklistImportError('Missing required columns: item_name_th and item_name_en');
  }

  const dataRows = matrix
    .slice(headerIndex + 1)
    .filter((row) => row.some((cell) => cellText(cell)));
  if (dataRows.length === 0) throw new ChecklistImportError('The file has no checklist rows');
  if (dataRows.length > CHECKLIST_IMPORT_LIMIT) {
    throw new ChecklistImportError(`A file can contain at most ${CHECKLIST_IMPORT_LIMIT} rows`);
  }

  return dataRows.map((row, index) => {
    const itemNameTh = cellText(row[thIndex]);
    const itemNameEn = cellText(row[enIndex]);
    const rawFrequency = frequencyIndex >= 0 ? cellText(row[frequencyIndex]) : '';
    const rawVehicleType = vehicleTypeIndex >= 0 ? cellText(row[vehicleTypeIndex]) : '';
    const frequency = rawFrequency
      ? FREQUENCY_ALIASES[normalizeToken(rawFrequency)]
      : defaults.frequency;
    const vehicleType = rawVehicleType
      ? VEHICLE_TYPE_ALIASES[normalizeToken(rawVehicleType)]
      : defaults.vehicleType;
    const issues: ChecklistImportIssue[] = [];

    if (!itemNameTh) issues.push('missing_thai_name');
    if (!itemNameEn) issues.push('missing_english_name');
    if (itemNameTh.length > 500 || itemNameEn.length > 500) issues.push('name_too_long');
    if (!frequency) issues.push('invalid_frequency');
    if (!vehicleType) issues.push('invalid_vehicle_type');

    return {
      rowNumber: headerIndex + index + 2,
      itemNameTh,
      itemNameEn,
      frequency: frequency ?? defaults.frequency,
      vehicleType: vehicleType ?? defaults.vehicleType,
      frequencyDisplay: rawFrequency || defaults.frequency,
      vehicleTypeDisplay: rawVehicleType || defaults.vehicleType,
      issues,
    };
  });
}

export async function parseChecklistImportFile(
  file: File,
  defaults: ChecklistImportDefaults,
): Promise<ChecklistImportRow[]> {
  if (file.size > CHECKLIST_IMPORT_MAX_BYTES) {
    throw new ChecklistImportError('The file is larger than 5 MB');
  }
  const extension = file.name.toLowerCase().split('.').pop();
  if (extension === 'csv') {
    return parseChecklistImportMatrix(parseCsvMatrix(await file.text()), defaults);
  }
  if (extension !== 'xlsx') {
    throw new ChecklistImportError('Choose a CSV or XLSX file');
  }

  const { readSheet } = await import('read-excel-file/browser');
  const matrix = await readSheet(file);
  return parseChecklistImportMatrix(matrix, defaults);
}

export function buildChecklistImportPayload(
  rows: readonly ChecklistImportRow[],
  existingItems: readonly ChecklistItem[],
): ChecklistImportPayloadItem[] {
  const groupOrder = new Map<string, number>();
  for (const item of existingItems) {
    const key = `${item.frequency}:${item.vehicle_type}`;
    groupOrder.set(key, Math.max(groupOrder.get(key) ?? 0, item.sort_order));
  }

  return rows.flatMap((row) => {
    if (row.issues.length > 0) return [];
    const key = `${row.frequency}:${row.vehicleType}`;
    const sortOrder = (groupOrder.get(key) ?? 0) + 1;
    groupOrder.set(key, sortOrder);
    return [{
      itemNameTh: row.itemNameTh,
      itemNameEn: row.itemNameEn,
      frequency: row.frequency,
      vehicleType: row.vehicleType,
      sortOrder,
    }];
  });
}

export function checklistCsvTemplate(defaults: ChecklistImportDefaults) {
  return [
    'item_name_th,item_name_en,frequency,vehicle_type',
    `ตรวจสอบตัวอย่าง,Example checklist item,${defaults.frequency},${defaults.vehicleType}`,
  ].join('\r\n');
}

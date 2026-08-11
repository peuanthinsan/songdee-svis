import { getToken } from './auth';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function parseJson(res: Response) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { error: text };
  }
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(path, { ...init, headers });
  const data = await parseJson(res);

  if (!res.ok) {
    throw new ApiError(data?.error || `Request failed (${res.status})`, res.status);
  }
  return data as T;
}

export type LoginResponse = {
  token: string;
  user: {
    id: string;
    username: string;
    firstName: string;
    lastName: string;
    role: 'driver' | 'supervisor' | 'admin';
    fleetId: string;
    companyId: string;
    companySlug: string;
    companyName: string;
    primaryColor: string;
    accentColor: string;
  };
};

export type Company = {
  slug: string;
  name: string;
  shortName: string;
  primaryColor: string;
  accentColor: string;
};

export function fetchCompanies() {
  return apiFetch<{ defaultCompanySlug: string; companies: Company[] }>('/api/companies');
}

export type FleetStat = {
  fleetId: string;
  total: number;
  checked: number;
  pending: number;
};

export type VehicleTypeKey = 'car' | 'van' | 'e_van' | 'motorcycle' | 'e_bike';
export const VEHICLE_TYPE_LABELS: Record<VehicleTypeKey, string> = {
  car: 'Car',
  van: 'Van',
  e_van: 'E-Van',
  motorcycle: 'Motorcycle',
  e_bike: 'E-Bike',
};
export const VEHICLE_TYPE_I18N_KEYS: Record<VehicleTypeKey, string> = {
  car: 'typeCar',
  van: 'typeVan',
  e_van: 'typeEvan',
  motorcycle: 'typeMotorcycle',
  e_bike: 'typeEbike',
};
export type TypeBreakdown = Record<VehicleTypeKey, number>;

export type CompletionStat = {
  checked: number;
  total: number;
  pending: number;
  percentage: number;
  byType: TypeBreakdown;
  /** Per-type denominators (Active vehicles when telematics is configured). */
  totalByType: TypeBreakdown;
};

export type DefectVehicle = {
  issueId: string;
  plate: string;
  fleetId: string;
  status: string;
  ageDays: number;
  vendorNotifiedAt: string | null;
  hasVendorEmail: boolean;
};

export type DashboardData = {
  date: string;
  fleetId: string | null;
  totalVehicles: number;
  byType: TypeBreakdown;
  /** True when the GPS sheet is configured, i.e. Active/denominators are telematics-based. */
  telematics: boolean;
  /** GPS counters and rows from the same scoped telematics snapshot as the metrics. */
  unitStatus: UnitStatusData | null;
  active: CompletionStat;
  preDeparture: CompletionStat;
  postRoute: CompletionStat;
  weekly: CompletionStat;
  outOfService: { total: number; today: number };
  withDefect: { total: number; today: number; vehicles: DefectVehicle[] };
  fleets: FleetStat[];
  // Back-compat alias (= pre-departure / daily completion).
  overall: { total: number; checked: number; pending: number; percentage: number };
};

export type InspectionDetail = {
  id: string;
  plate_number: string;
  overall_status: string;
  inspection_date: string;
  inspector_name?: string;
  mileage?: number;
  photo_urls?: string[];
  odometer_photo_url?: string | null;
  results?: Array<{
    id: string;
    result: string;
    photo_urls?: string[];
    notes?: string;
    item_name_th: string;
    item_name_en: string;
  }>;
};

export type HistoryData = {
  total: number;
  passed: number;
  failed: number;
  inspections: InspectionDetail[];
};

export type IssueRow = {
  id: string;
  status: string;
  plate_number: string;
  vehicle_fleet?: string;
  fleet_id?: string;
  inspector_name?: string;
  inspection_date?: string;
  created_at: string;
  defect_photo_urls?: string[];
  completion_photo_urls?: string[];
};

export function login(username: string, password: string, companySlug = 'dhl') {
  return apiFetch<LoginResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password, companySlug }),
  });
}

export function fetchDashboard(fleetId?: string, signal?: AbortSignal) {
  const qs = fleetId ? `?fleetId=${encodeURIComponent(fleetId)}` : '';
  return apiFetch<DashboardData>(`/api/dashboard${qs}`, { signal });
}

export function fetchHistory(startDate: string, endDate: string, fleetId?: string) {
  const params = new URLSearchParams({ startDate, endDate });
  if (fleetId) params.set('fleetId', fleetId);
  return apiFetch<HistoryData>(`/api/history?${params}`);
}

export type IssuesResponse = {
  issues: IssueRow[];
  limit: number;
  offset: number;
};

export function fetchIssues(status?: string, fleetId?: string) {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (fleetId) params.set('fleetId', fleetId);
  const qs = params.toString();
  return apiFetch<IssuesResponse>(`/api/issues${qs ? `?${qs}` : ''}`).then((r) => r.issues);
}

export function fetchInspectionDetail(id: string) {
  return apiFetch<InspectionDetail>(`/api/inspections/${encodeURIComponent(id)}`);
}

export type GpsStatus = 'running' | 'stopped' | 'offline';

export type InspectionFlags = {
  preRoute: boolean;
  postRoute: boolean;
  weekly: boolean;
};

export type UnitStatusVehicle = {
  plateNumber: string;
  fleet: string;
  driverName: string;
  gpsStatus: GpsStatus;
  ignition: boolean;
  speed: number;
  lastFixTime: string;
  updatedAt: string;
  inspections: InspectionFlags;
  needsAttention: boolean;
};

export type UnitStatusData = {
  configured: boolean;
  date?: string;
  vehicles: UnitStatusVehicle[];
  summary?: {
    total: number;
    running: number;
    stopped: number;
    offline: number;
    needsAttention: number;
  };
};

export function fetchUnitStatus(fleetId?: string) {
  const qs = fleetId ? `?fleetId=${encodeURIComponent(fleetId)}` : '';
  return apiFetch<UnitStatusData>(`/api/unit-status${qs}`);
}

// ─── Preventive Maintenance ──────────────────────────────────────────────────

export type MaintenanceCategoryStatus = 'ok' | 'due' | 'overdue' | 'noData';

export type MaintenanceCategory = {
  status: MaintenanceCategoryStatus;
  dueAtKm?: number;
  kmRemaining?: number;
  dueDate?: string;
};

export type MaintenanceVehicle = {
  vehicleId: string;
  plate: string;
  fleetId: string;
  vehicleType: VehicleTypeKey;
  region: 'metro' | 'provincial';
  latestMileage: number | null;
  kmPerDay: number | null;
  lastServiceDate: string | null;
  lastServiceMileage: number | null;
  lastTireChangeDate: string | null;
  lastTireChangeMileage: number | null;
  lastBatteryChangeDate: string | null;
  checkup: MaintenanceCategory;
  tires: MaintenanceCategory;
  battery: MaintenanceCategory;
};

export type MaintenanceSummaryEntry = { due: number; overdue: number; noData: number };

export type MaintenanceData = {
  date: string;
  horizonDays: number;
  vehicles: MaintenanceVehicle[];
  summary: {
    checkup: MaintenanceSummaryEntry;
    tires: MaintenanceSummaryEntry;
    battery: MaintenanceSummaryEntry;
  };
};

export function fetchMaintenance(fleetId?: string, signal?: AbortSignal) {
  const qs = fleetId ? `?fleetId=${encodeURIComponent(fleetId)}` : '';
  return apiFetch<MaintenanceData>(`/api/maintenance${qs}`, { signal });
}

export function saveMaintenance(data: {
  vehicleId: string;
  region?: 'metro' | 'provincial';
  lastServiceDate?: string | null;
  lastServiceMileage?: number | null;
  lastTireChangeDate?: string | null;
  lastTireChangeMileage?: number | null;
  lastBatteryChangeDate?: string | null;
}) {
  return apiFetch<{ ok: boolean }>('/api/maintenance', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function exportDashboardUrl(params: URLSearchParams) {
  const token = getToken();
  const qs = params.toString();
  const url = `/api/dashboard/export${qs ? `?${qs}` : ''}`;
  if (!token) return url;
  return `${url}${qs ? '&' : '?'}token=${encodeURIComponent(token)}`;
}

export async function downloadExport(path: string, filename: string) {
  const token = getToken();
  const res = await fetch(path, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new ApiError('Export failed', res.status);
  const blob = await res.blob();
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(href);
}


// ─── Admin Types ─────────────────────────────────────────────────────────────

export type AdminUser = {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  role: 'driver' | 'supervisor' | 'admin';
  fleet_id?: string;
  created_at: string;
};

export type AdminVehicle = {
  id: string;
  plate_number: string;
  vehicle_type: VehicleTypeKey;
  fleet_id: string;
  fleet_manager_email?: string;
  vendor_email?: string;
  created_at: string;
};

export type AdminFleet = {
  fleet_id: string;
  vehicle_count: number;
  fleet_manager_email?: string;
};

export type AdminSettings = {
  unit_status_sheet_url?: string;
};

export type ChecklistItem = {
  id: string;
  item_name_th: string;
  item_name_en: string;
  vehicle_type: VehicleTypeKey;
  frequency: 'daily' | 'weekly' | 'post_route';
  sort_order: number;
};

export type AnalyticsData = {
  topFailingVehicles: Array<{ plate_number: string; fleet_id: string; fail_count: number }>;
  topFailingItems: Array<{ item_name_th: string; item_name_en: string; fail_count: number }>;
  fleetStats: Array<{ fleet_id: string; total: number; passed: number; failed: number }>;
  dailyTrend: Array<{ date: string; passed: number; failed: number }>;
  period: { days: number; since: string };
};

// ─── Admin API Functions ──────────────────────────────────────────────────────

export function fetchAdminSettings() {
  return apiFetch<AdminSettings>('/api/admin/settings');
}

export function saveAdminSetting(key: string, value: string) {
  return apiFetch<{ ok: boolean }>('/api/admin/settings', {
    method: 'PUT',
    body: JSON.stringify({ key, value }),
  });
}

export function fetchAdminUsers(params?: { limit?: number; offset?: number; search?: string; role?: string }) {
  const qs = new URLSearchParams();
  if (params?.limit) qs.set('limit', String(params.limit));
  if (params?.offset) qs.set('offset', String(params.offset));
  if (params?.search) qs.set('search', params.search);
  if (params?.role) qs.set('role', params.role);
  const q = qs.toString();
  return apiFetch<AdminUser[]>(`/api/admin/users${q ? `?${q}` : ''}`);
}

export function createAdminUser(data: {
  username: string;
  password: string;
  firstName: string;
  lastName: string;
  role: string;
  fleetId?: string;
}) {
  return apiFetch<AdminUser>('/api/admin/users', { method: 'POST', body: JSON.stringify(data) });
}

export function updateAdminUser(id: string, data: { password?: string; firstName?: string; lastName?: string; role?: string; fleetId?: string }) {
  return apiFetch<AdminUser>(`/api/admin/users/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export function deleteAdminUser(id: string) {
  return apiFetch<{ deleted: boolean }>(`/api/admin/users/${id}`, { method: 'DELETE' });
}

export function fetchAdminVehicles(params?: { limit?: number; offset?: number; search?: string; fleetId?: string }) {
  const qs = new URLSearchParams();
  if (params?.limit) qs.set('limit', String(params.limit));
  if (params?.offset) qs.set('offset', String(params.offset));
  if (params?.search) qs.set('search', params.search);
  if (params?.fleetId) qs.set('fleetId', params.fleetId);
  const q = qs.toString();
  return apiFetch<AdminVehicle[]>(`/api/admin/vehicles${q ? `?${q}` : ''}`);
}

export function createAdminVehicle(data: { plateNumber: string; vehicleType: string; fleetId: string; fleetManagerEmail?: string; vendorEmail?: string }) {
  return apiFetch<AdminVehicle>('/api/admin/vehicles', { method: 'POST', body: JSON.stringify(data) });
}

export function updateAdminVehicle(id: string, data: { plateNumber?: string; vehicleType?: string; fleetId?: string; fleetManagerEmail?: string; vendorEmail?: string }) {
  return apiFetch<AdminVehicle>(`/api/admin/vehicles/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export function notifyVendor(issueId: string) {
  return apiFetch<{ notifiedAt: string; vendorEmail: string }>(`/api/issues/${encodeURIComponent(issueId)}/notify-vendor`, { method: 'POST' });
}

export function deleteAdminVehicle(id: string) {
  return apiFetch<{ deleted: boolean }>(`/api/admin/vehicles/${id}`, { method: 'DELETE' });
}

export function fetchAdminFleets() {
  return apiFetch<AdminFleet[]>('/api/admin/fleets');
}

export function updateAdminFleet(fleetId: string, fleetManagerEmail: string) {
  return apiFetch<{ updated: boolean }>('/api/admin/fleets', {
    method: 'PUT',
    body: JSON.stringify({ fleetId, fleetManagerEmail }),
  });
}

export function fetchAdminChecklist(params?: { vehicleType?: string; frequency?: string }) {
  const qs = new URLSearchParams({ all: '1' });
  if (params?.vehicleType) qs.set('vehicleType', params.vehicleType);
  if (params?.frequency) qs.set('frequency', params.frequency);
  return apiFetch<ChecklistItem[]>(`/api/admin/checklist?${qs}`);
}

export function createChecklistItem(data: { itemNameTh: string; itemNameEn: string; vehicleType: string; frequency: string; sortOrder?: number }) {
  return apiFetch<ChecklistItem>('/api/admin/checklist', { method: 'POST', body: JSON.stringify(data) });
}

export function updateChecklistItem(data: { id: string; itemNameTh?: string; itemNameEn?: string; vehicleType?: string; frequency?: string; sortOrder?: number }) {
  return apiFetch<ChecklistItem>('/api/admin/checklist', { method: 'PUT', body: JSON.stringify(data) });
}

export function deleteChecklistItem(id: string) {
  return apiFetch<{ deleted: boolean }>(`/api/admin/checklist?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export function fetchAdminAnalytics(days: 7 | 30 | 90) {
  return apiFetch<AnalyticsData>(`/api/admin/analytics?days=${days}`);
}

export function updateIssueStatus(id: string, status: string) {
  return apiFetch<{ ok: boolean }>(`/api/issues/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

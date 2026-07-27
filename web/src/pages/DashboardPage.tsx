import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
  downloadExport,
  fetchDashboard,
  fetchMaintenance,
  fetchUnitStatus,
  notifyVendor,
  type CompletionStat,
  type DashboardData,
  type DefectVehicle,
  type MaintenanceCategory,
  type MaintenanceData,
  type TypeBreakdown,
  type UnitStatusData,
  type UnitStatusVehicle,
  type VehicleTypeKey,
  VEHICLE_TYPE_I18N_KEYS,
} from '../api';
import { useAuth } from '../AuthContext';
import { DonutChart, type DonutSegment } from '../components/DonutChart';
import { t } from '../i18n';

const GPS_COLOR: Record<string, string> = {
  running: '#22c55e',
  stopped: '#f59e0b',
  offline: '#94a3b8',
};

function gpsLabel(status: string) {
  if (status === 'running') return t('unitStatusRunning');
  if (status === 'stopped') return t('unitStatusStopped');
  return t('unitStatusOffline');
}

function UnitStatusBadge({ status }: { status: string }) {
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: 999,
      fontSize: 11,
      fontWeight: 700,
      color: '#fff',
      backgroundColor: GPS_COLOR[status] ?? '#94a3b8',
      textTransform: 'uppercase',
      letterSpacing: '0.03em',
    }}>
      {gpsLabel(status)}
    </span>
  );
}

function InspectionCell({ done }: { done: boolean }) {
  return done
    ? <span style={{ color: '#22c55e', fontWeight: 700 }}>✓ {t('unitStatusChecked')}</span>
    : <span style={{ color: '#ef4444', fontWeight: 700 }}>⚠ {t('unitStatusPending')}</span>;
}

function UnitStatusSection({ unitData }: { unitData: UnitStatusData }) {
  const [filter, setFilter] = useState<'all' | 'attention'>('attention');

  const displayed = useMemo<UnitStatusVehicle[]>(() => {
    if (!unitData.configured) return [];
    return filter === 'attention'
      ? unitData.vehicles.filter(v => v.needsAttention)
      : unitData.vehicles;
  }, [unitData, filter]);

  if (!unitData.configured) {
    return (
      <section>
        <h2>{t('unitStatus')}</h2>
        <div className="panel" style={{ color: 'var(--color-muted)', fontSize: 14 }}>
          {t('unitStatusNotConfigured')}
        </div>
      </section>
    );
  }

  const { summary } = unitData;

  return (
    <section>
      <h2>{t('unitStatus')}</h2>

      {summary && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          {([
            { label: t('unitStatusRunning'), value: summary.running, color: '#22c55e' },
            { label: t('unitStatusStopped'), value: summary.stopped, color: '#f59e0b' },
            { label: t('unitStatusOffline'), value: summary.offline, color: '#94a3b8' },
          ] as const).map(s => (
            <div key={s.label} className="panel" style={{ flex: '1 0 120px', textAlign: 'center', padding: '12px 8px' }}>
              <div style={{ fontSize: 26, fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button
          type="button"
          className={`btn btn--sm ${filter === 'attention' ? 'btn--accent' : 'btn--secondary'}`}
          onClick={() => setFilter('attention')}
        >
          {t('unitStatusNeedsAttention')} ({summary?.needsAttention ?? 0})
        </button>
        <button
          type="button"
          className={`btn btn--sm ${filter === 'all' ? 'btn--accent' : 'btn--secondary'}`}
          onClick={() => setFilter('all')}
        >
          {t('unitStatusAllVehicles')} ({summary?.total ?? 0})
        </button>
      </div>

      {displayed.length === 0 ? (
        <div className="panel" style={{ color: 'var(--color-muted)', fontSize: 14 }}>
          {filter === 'attention' ? t('unitStatusNoPending') : t('unitStatusNoVehicles')}
        </div>
      ) : (
        <div className="panel panel--flush">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                {([
                  t('unitStatusColNo'),
                  t('unitStatusColPlate'),
                  t('unitStatusColFleet'),
                  t('unitStatusColGps'),
                  t('statusPreDeparture'),
                  t('statusPostRoute'),
                  t('statusWeekly'),
                ] as const).map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: 'var(--color-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayed.map((v, i) => (
                <tr
                  key={v.plateNumber}
                  style={{
                    borderBottom: '1px solid var(--color-border)',
                    backgroundColor: v.needsAttention ? 'rgba(239,68,68,0.05)' : undefined,
                  }}
                >
                  <td style={{ padding: '10px 12px', color: 'var(--color-muted)', fontWeight: 700 }}>{i + 1}</td>
                  <td style={{ padding: '10px 12px', fontWeight: 700 }}>{v.plateNumber}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--color-muted)' }}>{v.fleet}</td>
                  <td style={{ padding: '10px 12px' }}><UnitStatusBadge status={v.gpsStatus} /></td>
                  <td style={{ padding: '10px 12px' }}><InspectionCell done={v.inspections.preRoute} /></td>
                  <td style={{ padding: '10px 12px' }}><InspectionCell done={v.inspections.postRoute} /></td>
                  <td style={{ padding: '10px 12px' }}><InspectionCell done={v.inspections.weekly} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

const MAINT_CATEGORIES = [
  { key: 'checkup', labelKey: 'maintenanceCheckup', ruleKey: 'maintenanceCheckupRule' },
  { key: 'tires', labelKey: 'maintenanceTires', ruleKey: 'maintenanceTiresRule' },
  { key: 'battery', labelKey: 'maintenanceBattery', ruleKey: 'maintenanceBatteryRule' },
] as const;

function maintDetail(info: MaintenanceCategory): string {
  const parts: string[] = [];
  if (info.kmRemaining !== undefined && info.kmRemaining !== null) {
    parts.push(t('maintenanceKmLeft', { km: info.kmRemaining.toLocaleString() }));
  }
  if (info.dueDate) {
    parts.push(t('maintenanceDueOn', { date: info.dueDate }));
  }
  return parts.join(' · ');
}

function MaintenanceSection({ maintData }: { maintData: MaintenanceData }) {
  const days = String(maintData.horizonDays);

  // One row per vehicle-category that is due or overdue, overdue first.
  const dueList = maintData.vehicles
    .flatMap((v) =>
      MAINT_CATEGORIES
        .map((c) => ({ vehicle: v, category: c, info: v[c.key] }))
        .filter((e) => e.info.status === 'due' || e.info.status === 'overdue'),
    )
    .sort((a, b) =>
      (a.info.status === 'overdue' ? 0 : 1) - (b.info.status === 'overdue' ? 0 : 1),
    );

  const missingBaselines = maintData.vehicles.filter((v) =>
    v.checkup.status === 'noData' && v.tires.status === 'noData' && v.battery.status === 'noData',
  ).length;

  return (
    <section>
      <h2>{t('maintenance')}</h2>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        {MAINT_CATEGORIES.map((c) => {
          const s = maintData.summary[c.key];
          const dueCount = s.due + s.overdue;
          return (
            <div key={c.key} className="panel" style={{ flex: '1 0 180px', padding: '14px 16px' }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{t(c.labelKey)}</div>
              <div style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: 8 }}>{t(c.ruleKey)}</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: dueCount > 0 ? '#ef4444' : '#22c55e' }}>
                {dueCount}
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>
                {t('maintenanceDueSoon', { days })}
                {s.overdue > 0 && (
                  <span style={{ color: '#ef4444', fontWeight: 700 }}> · {t('maintenanceOverdue')} {s.overdue}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {dueList.length === 0 ? (
        <div className="panel" style={{ color: 'var(--color-muted)', fontSize: 14 }}>
          {t('maintenanceNoneDue', { days })}
        </div>
      ) : (
        <div className="panel">
          <div className="defect-list" style={{ marginTop: 0 }}>
            {dueList.slice(0, 10).map((e) => (
              <div className="defect-row" key={`${e.vehicle.vehicleId}-${e.category.key}`}>
                <span>{e.vehicle.plate} · {e.vehicle.fleetId}</span>
                <span className="muted">
                  {t(e.category.labelKey)}
                  {e.info.status === 'overdue' && (
                    <strong style={{ color: '#ef4444' }}> · {t('maintenanceOverdue')}</strong>
                  )}
                  {maintDetail(e.info) && ` · ${maintDetail(e.info)}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {missingBaselines > 0 && (
        <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>
          {t('maintenanceMissingBaselines', { count: String(missingBaselines) })}
        </p>
      )}
    </section>
  );
}

const TYPE_ORDER: VehicleTypeKey[] = ['car', 'van', 'e_van', 'motorcycle', 'e_bike'];

const TYPE_COLOR: Record<VehicleTypeKey, string> = {
  car: '#2563eb',
  van: '#ea580c',
  e_van: '#16a34a',
  motorcycle: '#7c3aed',
  e_bike: '#0891b2',
};

function typeLabel(k: VehicleTypeKey): string {
  return t(VEHICLE_TYPE_I18N_KEYS[k] as any);
}

/**
 * Inspection-status donut with vehicle-type colour slices.
 * Completion donuts (showChecked=true): coloured slices = checked per type, gray = pending.
 * Active donut (showChecked=false): coloured slices = fleet composition, center shows active %.
 */
function StatusDonutCard({
  label,
  stat,
  composition,
  showChecked,
}: {
  label: string;
  stat: CompletionStat;
  composition: TypeBreakdown;
  showChecked: boolean;
}) {
  const segments: DonutSegment[] = TYPE_ORDER.map((k) => ({
    value: showChecked ? stat.byType[k] : composition[k],
    color: TYPE_COLOR[k],
  }));

  return (
    <div className="donut-card">
      <div className="donut-card__title">{label}</div>
      <DonutChart
        segments={segments}
        pending={showChecked ? stat.pending : 0}
        total={stat.total}
        centerChecked={showChecked ? undefined : stat.checked}
        size={132}
      />
      <div className="donut-card__types">
        {TYPE_ORDER.filter((k) => composition[k] > 0).map((k, i) => (
          <span key={k} style={{ whiteSpace: 'nowrap' }}>
            {i > 0 ? ' · ' : ''}
            <span style={{
              display: 'inline-block', width: 7, height: 7, borderRadius: '50%',
              background: TYPE_COLOR[k], verticalAlign: 'middle', marginRight: 2,
            }} />
            {typeLabel(k)}{showChecked ? ` ${stat.byType[k]}/${(stat.totalByType ?? composition)[k]}` : ` ${composition[k]}`}
          </span>
        ))}
      </div>
    </div>
  );
}

export function DashboardPage() {
  const { user, isDashboardUser } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [data, setData] = useState<DashboardData | null>(null);
  const [unitData, setUnitData] = useState<UnitStatusData | null>(null);
  const [maintData, setMaintData] = useState<MaintenanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [selectedFleet, setSelectedFleet] = useState<string | undefined>(undefined);
  const [allFleets, setAllFleets] = useState<string[]>([]);
  const [notifyingId, setNotifyingId] = useState<string | null>(null);
  const [notifiedIds, setNotifiedIds] = useState<Record<string, string>>({});

  const fleetScope = isAdmin ? selectedFleet : user?.fleetId;

  // Monotonic guard so only the latest load() applies its results: drops out-of-order
  // 60s-poll/fleet-switch responses and post-unmount state writes (last-resolved-wins bug).
  const loadGenRef = useRef(0);

  const load = useCallback(async () => {
    const myGen = ++loadGenRef.current;
    setError(null);
    try {
      const [result, unit, maint] = await Promise.all([
        fetchDashboard(fleetScope),
        fetchUnitStatus().catch(() => null),
        fetchMaintenance(fleetScope).catch(() => null),
      ]);
      if (loadGenRef.current !== myGen) return;
      setData(result);
      setUnitData(unit);
      setMaintData(maint);
      // Capture the full fleet list from an unscoped admin load to populate the filter dropdown.
      if (isAdmin && !fleetScope) {
        setAllFleets(result.fleets.map((f) => f.fleetId));
      }
    } catch {
      if (loadGenRef.current !== myGen) return;
      setError(t('error'));
    } finally {
      if (loadGenRef.current === myGen) setLoading(false);
    }
  }, [fleetScope, isAdmin]);

  useEffect(() => {
    load();
    const id = window.setInterval(load, 60_000);
    return () => {
      window.clearInterval(id);
      loadGenRef.current++; // invalidate any in-flight load on unmount / dependency change
    };
  }, [load]);

  if (!user) return <Navigate to="/login" replace />;
  if (!isDashboardUser) return <Navigate to="/login" replace />;

  async function onExport() {
    try {
      setExporting(true);
      const params = new URLSearchParams();
      if (fleetScope) params.set('fleetId', fleetScope);
      await downloadExport(`/api/dashboard/export?${params.toString()}`, `dashboard-${data?.date || 'report'}.xlsx`);
    } catch {
      alert(t('exportFailed'));
    } finally {
      setExporting(false);
    }
  }

  async function onNotifyVendor(v: DefectVehicle) {
    setNotifyingId(v.issueId);
    try {
      const res = await notifyVendor(v.issueId);
      setNotifiedIds((prev) => ({ ...prev, [v.issueId]: res.notifiedAt }));
    } catch {
      alert(t('error'));
    } finally {
      setNotifyingId(null);
    }
  }

  if (loading) return <div className="panel centered">{t('signingIn')}</div>;
  if (error) {
    return (
      <div className="panel centered">
        <p>{error}</p>
        <button type="button" className="btn btn--secondary" onClick={() => { setLoading(true); load(); }}>
          {t('retry')}
        </button>
      </div>
    );
  }
  if (!data) return <div className="panel centered">{t('noData')}</div>;

  const defects = data.withDefect.vehicles;

  return (
    <div className="stack">
      <div className="page-header">
        <div>
          <h1>{t('greeting', { name: user.firstName })}</h1>
          <p className="muted">{t('today')} {data.date}</p>
        </div>
        <div className="header-actions">
          {isAdmin && (
            <select
              className="fleet-select"
              value={selectedFleet ?? ''}
              onChange={(e) => setSelectedFleet(e.target.value || undefined)}
              aria-label={t('fleet')}
            >
              <option value="">{t('allFleets')}</option>
              {allFleets.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          )}
          <button type="button" className="btn btn--accent" onClick={onExport} disabled={exporting}>
            {exporting ? '…' : t('export')}
          </button>
        </div>
      </div>

      <section>
        <div className="section-label">{t('inspectionStatusToday')}</div>
        <div className="donut-grid">
          {/* With telematics the Active ring shows online-per-type vs fleet size;
              without it we fall back to the legacy composition ring. */}
          <StatusDonutCard label={t('statusActive')} stat={data.active} composition={data.byType} showChecked={data.telematics} />
          <StatusDonutCard label={t('statusPreDeparture')} stat={data.preDeparture} composition={data.byType} showChecked />
          <StatusDonutCard label={t('statusPostRoute')} stat={data.postRoute} composition={data.byType} showChecked />
          <StatusDonutCard label={t('statusWeekly')} stat={data.weekly} composition={data.byType} showChecked />
        </div>
      </section>

      <div className="attention-grid">
        <section className="panel">
          <div className="section-head">
            <h2>{t('outOfService')}</h2>
          </div>
          <div className="metric-grid">
            <div className="metric"><strong>{data.outOfService.total}</strong><span>{t('metricTotal')}</span></div>
            <div className="metric"><strong>{data.outOfService.today}</strong><span>{t('today')}</span></div>
          </div>
        </section>

        <section className="panel">
          <div className="section-head">
            <h2>{t('withDefect')}</h2>
          </div>
          <div className="metric-grid">
            <div className="metric"><strong className="text-fail">{data.withDefect.total}</strong><span>{t('metricTotal')}</span></div>
            <div className="metric"><strong>{data.withDefect.today}</strong><span>{t('today')}</span></div>
          </div>
          {defects.length > 0 ? (
            <div className="defect-list">
              {defects.slice(0, 5).map((v) => {
                const alreadyNotified = v.vendorNotifiedAt || notifiedIds[v.issueId];
                const isNotifying = notifyingId === v.issueId;
                return (
                  <div className="defect-row" key={v.issueId}>
                    <span>{v.plate} · {v.fleetId}</span>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span className="muted">{t(v.status === 'in_progress' ? 'inProgress' : 'open')} · {v.ageDays}d</span>
                      {alreadyNotified ? (
                        <span className="tag tag--success">{t('notifyVendorSent')}</span>
                      ) : v.hasVendorEmail ? (
                        <button type="button" className="btn btn--sm btn--secondary" disabled={isNotifying} onClick={() => onNotifyVendor(v)}>
                          {isNotifying ? '…' : t('notifyVendor')}
                        </button>
                      ) : (
                        <span className="tag">{t('notifyVendorNoEmail')}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="muted" style={{ fontSize: 13, marginTop: 12, marginBottom: 0 }}>{t('noDefects')}</p>
          )}
        </section>
      </div>

      {unitData && <UnitStatusSection unitData={unitData} />}

      {maintData && <MaintenanceSection maintData={maintData} />}
    </div>
  );
}

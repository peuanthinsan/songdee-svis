import { useEffect, useState } from 'react';
import { fetchMaintenance, saveMaintenance, MaintenanceVehicle } from '../../api';
import { t } from '../../i18n';
import { formatDateThai } from '../../lib/format-date';

type FormState = {
  region: 'metro' | 'provincial';
  lastServiceDate: string;
  lastServiceMileage: string;
  lastTireChangeDate: string;
  lastTireChangeMileage: string;
  lastBatteryChangeDate: string;
};

const inputStyle = {
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '6px 10px',
  fontSize: 13,
  width: '100%',
} as const;

/**
 * Baseline editor for the preventive-maintenance schedule: per vehicle, the date and
 * odometer reading of the last check-up / tire change / battery change plus its
 * region (metro vs provincial tire interval). The dashboard projects due dates
 * from these values and the mileage recorded on inspections.
 */
export function MaintenanceTab() {
  const [vehicles, setVehicles] = useState<MaintenanceVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  function load() {
    setLoading(true);
    fetchMaintenance()
      .then((data) => { setVehicles(data.vehicles); setLoading(false); })
      .catch(() => { setError(t('error')); setLoading(false); });
  }
  useEffect(load, []);

  function startEdit(v: MaintenanceVehicle) {
    setEditing(v.vehicleId);
    setForm({
      region: v.region,
      lastServiceDate: v.lastServiceDate ?? '',
      lastServiceMileage: v.lastServiceMileage === null ? '' : String(v.lastServiceMileage),
      lastTireChangeDate: v.lastTireChangeDate ?? '',
      lastTireChangeMileage: v.lastTireChangeMileage === null ? '' : String(v.lastTireChangeMileage),
      lastBatteryChangeDate: v.lastBatteryChangeDate ?? '',
    });
  }

  async function save(vehicleId: string) {
    if (!form) return;
    setSaving(true);
    setError('');
    try {
      await saveMaintenance({
        vehicleId,
        region: form.region,
        lastServiceDate: form.lastServiceDate || null,
        lastServiceMileage: form.lastServiceMileage ? parseInt(form.lastServiceMileage, 10) : null,
        lastTireChangeDate: form.lastTireChangeDate || null,
        lastTireChangeMileage: form.lastTireChangeMileage ? parseInt(form.lastTireChangeMileage, 10) : null,
        lastBatteryChangeDate: form.lastBatteryChangeDate || null,
      });
      setEditing(null);
      setForm(null);
      load();
    } catch (e: any) {
      setError(e.message || t('error'));
    } finally {
      setSaving(false);
    }
  }

  const displayed = vehicles.filter((v) =>
    !search || v.plate.toLowerCase().includes(search.toLowerCase()) || v.fleetId.toLowerCase().includes(search.toLowerCase()),
  );

  const setField = (key: keyof FormState) => (value: string) =>
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));

  return (
    <div className="panel panel--flush">
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0 }}>{t('adminMaintenance')}</h2>
        <input
          type="search"
          placeholder={t('search')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ ...inputStyle, width: 220 }}
        />
      </div>
      {error && <div className="alert alert--error" style={{ margin: 12 }}>{error}</div>}
      {loading ? (
        <p className="muted" style={{ padding: 20 }}>{t('loading')}</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('plate')}</th>
                <th>{t('fleet')}</th>
                <th>{t('region')}</th>
                <th>{t('latestMileage')}</th>
                <th>{t('lastServiceDate')}</th>
                <th>{t('lastServiceMileage')}</th>
                <th>{t('lastTireDate')}</th>
                <th>{t('lastTireMileage')}</th>
                <th>{t('lastBatteryDate')}</th>
                <th className="maintenance-table__actions"></th>
              </tr>
            </thead>
            <tbody>
              {displayed.map((v) => {
                const isEditing = editing === v.vehicleId && form !== null;
                return (
                  <tr key={v.vehicleId}>
                    <td><strong>{v.plate}</strong></td>
                    <td className="muted">{v.fleetId}</td>
                    <td>
                      {isEditing ? (
                        <select
                          value={form!.region}
                          onChange={(e) => setField('region')(e.target.value)}
                          style={inputStyle}
                        >
                          <option value="metro">{t('regionMetro')}</option>
                          <option value="provincial">{t('regionProvincial')}</option>
                        </select>
                      ) : (
                        <span className="muted">{v.region === 'metro' ? t('regionMetro') : t('regionProvincial')}</span>
                      )}
                    </td>
                    <td className="muted">{v.latestMileage === null ? '—' : v.latestMileage.toLocaleString()}</td>
                    {isEditing ? (
                      <>
                        <td><input type="date" value={form!.lastServiceDate} onChange={(e) => setField('lastServiceDate')(e.target.value)} style={inputStyle} /></td>
                        <td><input type="number" min={0} value={form!.lastServiceMileage} onChange={(e) => setField('lastServiceMileage')(e.target.value)} style={inputStyle} /></td>
                        <td><input type="date" value={form!.lastTireChangeDate} onChange={(e) => setField('lastTireChangeDate')(e.target.value)} style={inputStyle} /></td>
                        <td><input type="number" min={0} value={form!.lastTireChangeMileage} onChange={(e) => setField('lastTireChangeMileage')(e.target.value)} style={inputStyle} /></td>
                        <td><input type="date" value={form!.lastBatteryChangeDate} onChange={(e) => setField('lastBatteryChangeDate')(e.target.value)} style={inputStyle} /></td>
                      </>
                    ) : (
                      <>
                        <td className="muted">{formatDateThai(v.lastServiceDate)}</td>
                        <td className="muted">{v.lastServiceMileage === null ? '—' : v.lastServiceMileage.toLocaleString()}</td>
                        <td className="muted">{formatDateThai(v.lastTireChangeDate)}</td>
                        <td className="muted">{v.lastTireChangeMileage === null ? '—' : v.lastTireChangeMileage.toLocaleString()}</td>
                        <td className="muted">{formatDateThai(v.lastBatteryChangeDate)}</td>
                      </>
                    )}
                    <td className="maintenance-table__actions" style={{ whiteSpace: 'nowrap' }}>
                      {isEditing ? (
                        <>
                          <button type="button" className="btn btn--accent" style={{ padding: '6px 12px', marginRight: 6 }} onClick={() => save(v.vehicleId)} disabled={saving}>
                            {saving ? t('saving') : t('save')}
                          </button>
                          <button type="button" className="btn btn--secondary" style={{ padding: '6px 12px' }} onClick={() => { setEditing(null); setForm(null); }}>
                            {t('cancel')}
                          </button>
                        </>
                      ) : (
                        <button type="button" className="btn btn--secondary" style={{ padding: '6px 12px' }} onClick={() => startEdit(v)}>
                          {t('editAction')}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

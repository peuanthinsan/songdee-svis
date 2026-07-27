import { useEffect, useState } from 'react';
import { AdminFleet, fetchAdminFleets, updateAdminFleet } from '../../api';
import { t } from '../../i18n';

export function FleetsTab() {
  const [fleets, setFleets] = useState<AdminFleet[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [emailVal, setEmailVal] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function load() {
    setLoading(true);
    fetchAdminFleets()
      .then((data) => { setFleets(data); setLoading(false); })
      .catch(() => { setError(t('error')); setLoading(false); });
  }
  useEffect(load, []);

  function startEdit(f: AdminFleet) {
    setEditing(f.fleet_id);
    setEmailVal(f.fleet_manager_email || '');
  }

  async function saveEmail(fleetId: string) {
    setSaving(true);
    try {
      await updateAdminFleet(fleetId, emailVal);
      setFleets((prev) => prev.map((f) => f.fleet_id === fleetId ? { ...f, fleet_manager_email: emailVal } : f));
      setEditing(null);
    } catch (e: any) {
      setError(e.message || t('error'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="panel panel--flush">
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
        <h2 style={{ margin: 0 }}>{t('adminFleets')}</h2>
      </div>
      {error && <div className="alert alert--error" style={{ margin: 12 }}>{error}</div>}
      {loading ? (
        <p className="muted" style={{ padding: 20 }}>{t('loading')}</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>{t('fleet')}</th>
              <th>{t('vehicleCount')}</th>
              <th>{t('managerEmail')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {fleets.map((f) => (
              <tr key={f.fleet_id}>
                <td><strong>{f.fleet_id}</strong></td>
                <td>{f.vehicle_count}</td>
                <td>
                  {editing === f.fleet_id ? (
                    <input
                      type="email"
                      value={emailVal}
                      onChange={(e) => setEmailVal(e.target.value)}
                      style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', fontSize: 14, width: '100%' }}
                    />
                  ) : (
                    <span className="muted">{f.fleet_manager_email || '—'}</span>
                  )}
                </td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  {editing === f.fleet_id ? (
                    <>
                      <button type="button" className="btn btn--accent" style={{ padding: '6px 12px', marginRight: 6 }} onClick={() => saveEmail(f.fleet_id)} disabled={saving}>
                        {saving ? t('saving') : t('save')}
                      </button>
                      <button type="button" className="btn btn--secondary" style={{ padding: '6px 12px' }} onClick={() => setEditing(null)}>
                        {t('cancel')}
                      </button>
                    </>
                  ) : (
                    <button type="button" className="btn btn--secondary" style={{ padding: '6px 12px' }} onClick={() => startEdit(f)}>
                      {t('editAction')}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

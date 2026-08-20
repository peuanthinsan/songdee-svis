import { useEffect, useRef, useState } from 'react';
import { AdminFleet, fetchAdminFleets, updateAdminFleet, importAdminFleets } from '../../api';
import { t } from '../../i18n';
import { downloadCsv } from '../../data-export';
import { parseFleetImportFile } from '../../admin-import';

export function FleetsTab() {
  const [fleets, setFleets] = useState<AdminFleet[]>([]);
  const [loading, setLoading] = useState(true);
  const importInput = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
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

  function exportFleets() {
    downloadCsv('fleets.csv', ['fleet_id', 'vehicle_count', 'fleet_manager_email'], fleets.map((f) => [f.fleet_id, f.vehicle_count, f.fleet_manager_email || '']));
  }
  async function importFleets(file?: File) {
    if (!file) return;
    setImporting(true);
    try {
      const rows = await parseFleetImportFile(file);
      const errors = rows.filter((row) => !row.fleetId).map((row) => `Row ${row.rowNumber}: Fleet ID is required`);
      if (errors.length) throw new Error(errors.slice(0, 5).join(' · '));
      const result = await importAdminFleets(rows.map(({ rowNumber, ...row }) => row));
      alert(`Imported ${result.imported} fleet rows`);
      fetchAdminFleets().then(setFleets).catch(() => {});
    } catch (e: any) { alert(e.message || t('importFailed')); }
    finally { setImporting(false); if (importInput.current) importInput.current.value = ''; }
  }

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
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><h2 style={{ margin: 0, flex: 1 }}>{t('adminFleets')}</h2><input ref={importInput} type="file" accept=".csv,.xlsx" hidden onChange={(e) => void importFleets(e.target.files?.[0])} /><button type="button" className="btn btn--secondary" onClick={() => importInput.current?.click()} disabled={importing}>{importing ? '…' : t('importFile')}</button><button type="button" className="btn btn--secondary" onClick={exportFleets} disabled={loading || fleets.length === 0}>{t('export')}</button></div>
        <details style={{ marginTop: 10, fontSize: 12 }}><summary style={{ cursor: 'pointer', fontWeight: 600 }}>{t('supportedImportColumns')} / {t('supportedExportColumns')}</summary><span className="muted">{t('required')}: <strong>Fleet ID</strong>. {t('optional')}: Fleet Manager Email. Import updates manager email for vehicles in each fleet. {t('exportColumns')}: <strong>Fleet ID</strong>, <strong>Vehicle Count</strong>, <strong>Fleet Manager Email</strong>.</span></details>
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

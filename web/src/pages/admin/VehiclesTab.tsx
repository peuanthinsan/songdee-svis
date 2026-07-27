import { useEffect, useState } from 'react';
import { AdminVehicle, fetchAdminVehicles, createAdminVehicle, updateAdminVehicle, deleteAdminVehicle } from '../../api';
import { t } from '../../i18n';

type Form = { plateNumber: string; vehicleType: string; fleetId: string; fleetManagerEmail: string; vendorEmail: string };
const BLANK: Form = { plateNumber: '', vehicleType: 'car', fleetId: '', fleetManagerEmail: '', vendorEmail: '' };

export function VehiclesTab() {
  const [vehicles, setVehicles] = useState<AdminVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<'create' | AdminVehicle | null>(null);
  const [form, setForm] = useState<Form>(BLANK);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Bulk vendor-email state
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkEmail, setBulkEmail] = useState('');
  const [bulkSaving, setBulkSaving] = useState(false);

  function load() {
    setLoading(true);
    fetchAdminVehicles({ limit: 500 })
      .then((data) => { setVehicles(data); setLoading(false); })
      .catch(() => { setError(t('error')); setLoading(false); });
  }
  useEffect(load, []);

  function openCreate() { setForm(BLANK); setModal('create'); setError(''); }
  function openEdit(v: AdminVehicle) {
    setForm({ plateNumber: v.plate_number, vehicleType: v.vehicle_type, fleetId: v.fleet_id, fleetManagerEmail: v.fleet_manager_email || '', vendorEmail: v.vendor_email || '' });
    setModal(v); setError('');
  }

  async function handleSave() {
    setSaving(true); setError('');
    try {
      if (modal === 'create') {
        const v = await createAdminVehicle({ ...form, fleetManagerEmail: form.fleetManagerEmail || undefined, vendorEmail: form.vendorEmail || undefined });
        setVehicles((prev) => [v, ...prev]);
      } else if (modal) {
        const updated = await updateAdminVehicle(modal.id, { plateNumber: form.plateNumber, vehicleType: form.vehicleType, fleetId: form.fleetId, fleetManagerEmail: form.fleetManagerEmail, vendorEmail: form.vendorEmail });
        setVehicles((prev) => prev.map((v) => v.id === updated.id ? { ...v, ...updated } : v));
      }
      setModal(null);
    } catch (e: any) {
      setError(e.message || t('error'));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(v: AdminVehicle) {
    if (!window.confirm(`${t('confirmDelete')} ${v.plate_number}?`)) return;
    try {
      await deleteAdminVehicle(v.id);
      setVehicles((prev) => prev.filter((x) => x.id !== v.id));
    } catch (e: any) {
      alert(e.message || t('error'));
    }
  }

  async function handleBulkApply() {
    if (!bulkEmail || selected.size === 0) return;
    setBulkSaving(true);
    try {
      const ids = [...selected];
      const settled = await Promise.allSettled(
        ids.map((id) => updateAdminVehicle(id, { vendorEmail: bulkEmail }))
      );
      // Apply every row that DID persist, even if some failed — a rejected update must not
      // discard the successful ones from the UI. Keep only the failures selected for retry.
      const updates = new Map<string, Awaited<ReturnType<typeof updateAdminVehicle>>>();
      const failedIds = new Set<string>();
      settled.forEach((r, i) => {
        if (r.status === 'fulfilled') updates.set(r.value.id, r.value);
        else failedIds.add(ids[i]);
      });
      setVehicles((prev) => prev.map((v) => {
        const updated = updates.get(v.id);
        return updated ? { ...v, ...updated } : v;
      }));
      setSelected(failedIds);
      if (failedIds.size > 0) {
        alert(`${t('error')} (${failedIds.size}/${ids.length})`);
      } else {
        setBulkEmail('');
      }
    } finally {
      setBulkSaving(false);
    }
  }

  const typeLabel: Record<string, string> = { car: t('car'), van: t('van'), e_van: t('eVan'), motorcycle: t('motorcycle'), e_bike: t('eBike') };
  const filtered = vehicles.filter((v) =>
    !search || [v.plate_number, v.fleet_id, v.vendor_email || ''].some((x) => x.toLowerCase().includes(search.toLowerCase()))
  );

  const allFilteredSelected = filtered.length > 0 && filtered.every((v) => selected.has(v.id));

  function toggleAll() {
    if (allFilteredSelected) {
      setSelected((prev) => { const s = new Set(prev); filtered.forEach((v) => s.delete(v.id)); return s; });
    } else {
      setSelected((prev) => { const s = new Set(prev); filtered.forEach((v) => s.add(v.id)); return s; });
    }
  }

  function toggleOne(id: string) {
    setSelected((prev) => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  }

  return (
    <div className="panel panel--flush">
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 12, alignItems: 'center' }}>
        <h2 style={{ margin: 0, flex: 1 }}>{t('adminVehicles')}</h2>
        <input
          placeholder={t('search')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '7px 12px', fontSize: 14 }}
        />
        <button type="button" className="btn btn--accent" style={{ padding: '8px 16px' }} onClick={openCreate}>
          + {t('add')}
        </button>
      </div>

      {selected.size > 0 && (
        <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--border)', background: '#fffbeb', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>{selected.size} {t('selected')}</span>
          <input
            type="email"
            placeholder={t('vendorEmail')}
            value={bulkEmail}
            onChange={(e) => setBulkEmail(e.target.value)}
            style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', fontSize: 13, flex: '1 0 200px', minWidth: 0 }}
          />
          <button type="button" className="btn btn--accent" style={{ padding: '6px 14px', fontSize: 13 }} onClick={handleBulkApply} disabled={bulkSaving || !bulkEmail}>
            {bulkSaving ? '…' : t('applyToSelected')}
          </button>
          <button type="button" className="btn btn--secondary" style={{ padding: '6px 14px', fontSize: 13 }} onClick={() => setSelected(new Set())}>
            {t('clearSelection')}
          </button>
        </div>
      )}

      {loading ? (
        <p className="muted" style={{ padding: 20 }}>{t('loading')}</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: 36 }}>
                <input type="checkbox" checked={allFilteredSelected} onChange={toggleAll} />
              </th>
              <th>{t('plateNumber')}</th>
              <th>{t('vehicleType')}</th>
              <th>{t('fleet')}</th>
              <th>{t('vendorEmail')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={6} className="table-empty">{t('noResults')}</td></tr>}
            {filtered.map((v) => (
              <tr key={v.id}>
                <td>
                  <input type="checkbox" checked={selected.has(v.id)} onChange={() => toggleOne(v.id)} />
                </td>
                <td><strong>{v.plate_number}</strong></td>
                <td>{typeLabel[v.vehicle_type] || v.vehicle_type}</td>
                <td>{v.fleet_id}</td>
                <td className="muted" style={{ fontSize: 13 }}>{v.vendor_email || '—'}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button type="button" className="btn btn--secondary" style={{ padding: '5px 10px', marginRight: 6 }} onClick={() => openEdit(v)}>{t('editAction')}</button>
                  <button type="button" className="btn" style={{ padding: '5px 10px', background: '#fde', color: '#c00' }} onClick={() => handleDelete(v)}>{t('deleteAction')}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {modal !== null && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'grid', placeItems: 'center', zIndex: 100 }}>
          <div style={{ background: 'var(--panel)', borderRadius: 16, padding: 28, width: 'min(420px, 95vw)', display: 'grid', gap: 14 }}>
            <h3 style={{ margin: 0 }}>{modal === 'create' ? `+ ${t('adminVehicles')}` : `${t('editAction')} ${(modal as AdminVehicle).plate_number}`}</h3>
            {error && <div className="alert alert--error">{error}</div>}
            <label style={{ display: 'grid', gap: 4, fontSize: 13, fontWeight: 600 }}>
              {t('plateNumber')}
              <input value={form.plateNumber} onChange={(e) => setForm((f) => ({ ...f, plateNumber: e.target.value }))}
                style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', fontSize: 14 }} />
            </label>
            <label style={{ display: 'grid', gap: 4, fontSize: 13, fontWeight: 600 }}>
              {t('vehicleType')}
              <select value={form.vehicleType} onChange={(e) => setForm((f) => ({ ...f, vehicleType: e.target.value }))}
                style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', fontSize: 14 }}>
                <option value="car">{t('car')}</option>
                <option value="van">{t('van')}</option>
                <option value="e_van">{t('eVan')}</option>
                <option value="motorcycle">{t('motorcycle')}</option>
                <option value="e_bike">{t('eBike')}</option>
              </select>
            </label>
            <label style={{ display: 'grid', gap: 4, fontSize: 13, fontWeight: 600 }}>
              {t('fleetId')}
              <input value={form.fleetId} onChange={(e) => setForm((f) => ({ ...f, fleetId: e.target.value }))}
                style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', fontSize: 14 }} />
            </label>
            <label style={{ display: 'grid', gap: 4, fontSize: 13, fontWeight: 600 }}>
              {t('managerEmail')}
              <input type="text" value={form.fleetManagerEmail} onChange={(e) => setForm((f) => ({ ...f, fleetManagerEmail: e.target.value }))}
                placeholder="manager@company.com, backup@company.com"
                style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', fontSize: 14 }} />
            </label>
            <label style={{ display: 'grid', gap: 4, fontSize: 13, fontWeight: 600 }}>
              {t('vendorEmail')}
              <input type="text" value={form.vendorEmail} onChange={(e) => setForm((f) => ({ ...f, vendorEmail: e.target.value }))}
                placeholder="vendor@repair.com, parts@repair.com"
                style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', fontSize: 14 }} />
            </label>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn--secondary" onClick={() => setModal(null)}>{t('cancel')}</button>
              <button type="button" className="btn btn--accent" onClick={handleSave} disabled={saving}>{saving ? t('saving') : t('save')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

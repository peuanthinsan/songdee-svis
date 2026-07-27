import { useEffect, useState } from 'react';
import { ChecklistItem, fetchAdminChecklist, createChecklistItem, updateChecklistItem, deleteChecklistItem } from '../../api';
import { getLang, t } from '../../i18n';

type Form = { itemNameTh: string; itemNameEn: string; vehicleType: string; frequency: string; sortOrder: string };
const BLANK: Form = { itemNameTh: '', itemNameEn: '', vehicleType: 'car', frequency: 'daily', sortOrder: '0' };

export function ChecklistTab() {
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('');
  const [filterFreq, setFilterFreq] = useState('');
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<'create' | ChecklistItem | null>(null);
  const [form, setForm] = useState<Form>(BLANK);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const lang = getLang();

  function load() {
    setLoading(true);
    fetchAdminChecklist()
      .then((data) => { setItems(data); setLoading(false); })
      .catch(() => { setError(t('error')); setLoading(false); });
  }
  useEffect(load, []);

  function openCreate() { setForm(BLANK); setModal('create'); setError(''); }
  function openEdit(item: ChecklistItem) {
    setForm({ itemNameTh: item.item_name_th, itemNameEn: item.item_name_en, vehicleType: item.vehicle_type, frequency: item.frequency, sortOrder: String(item.sort_order) });
    setModal(item); setError('');
  }

  async function handleSave() {
    setSaving(true); setError('');
    try {
      const sortOrder = parseInt(form.sortOrder) || 0;
      if (modal === 'create') {
        const item = await createChecklistItem({ ...form, sortOrder });
        setItems((prev) => [...prev, item]);
      } else if (modal) {
        const updated = await updateChecklistItem({ id: (modal as ChecklistItem).id, ...form, sortOrder });
        setItems((prev) => prev.map((i) => i.id === updated.id ? updated : i));
      }
      setModal(null);
    } catch (e: any) {
      setError(e.message || t('error'));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(item: ChecklistItem) {
    if (!window.confirm(`${t('confirmDelete')} "${lang === 'th' ? item.item_name_th : item.item_name_en}"?`)) return;
    try {
      await deleteChecklistItem(item.id);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
    } catch (e: any) {
      alert(e.message || t('error'));
    }
  }

  const typeLabel: Record<string, string> = { car: t('car'), van: t('van'), e_van: t('eVan'), motorcycle: t('motorcycle'), e_bike: t('eBike') };
  const freqLabel: Record<string, string> = { daily: t('daily'), weekly: t('weekly'), post_route: t('postRoute') };
  const vTypes = ['car', 'van', 'e_van', 'motorcycle', 'e_bike'];
  const freqs = ['daily', 'weekly', 'post_route'];

  const filtered = items.filter((i) => {
    if (filterType && i.vehicle_type !== filterType) return false;
    if (filterFreq && i.frequency !== filterFreq) return false;
    if (search && ![i.item_name_th, i.item_name_en].some((s) => s.toLowerCase().includes(search.toLowerCase()))) return false;
    return true;
  });

  return (
    <div className="panel panel--flush">
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <h2 style={{ margin: 0, flex: 1 }}>{t('adminChecklist')}</h2>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
          style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '7px 10px', fontSize: 13 }}>
          <option value="">{t('all')} {t('vehicleType')}</option>
          {vTypes.map((v) => <option key={v} value={v}>{typeLabel[v]}</option>)}
        </select>
        <select value={filterFreq} onChange={(e) => setFilterFreq(e.target.value)}
          style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '7px 10px', fontSize: 13 }}>
          <option value="">{t('all')} {t('frequency')}</option>
          {freqs.map((f) => <option key={f} value={f}>{freqLabel[f]}</option>)}
        </select>
        <input placeholder={t('search')} value={search} onChange={(e) => setSearch(e.target.value)}
          style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '7px 10px', fontSize: 13 }} />
        <button type="button" className="btn btn--accent" style={{ padding: '8px 16px' }} onClick={openCreate}>
          + {t('add')}
        </button>
      </div>
      {loading ? <p className="muted" style={{ padding: 20 }}>{t('loading')}</p> : (
        <table className="data-table">
          <thead>
            <tr><th>#</th><th>{lang === 'th' ? t('nameTh') : t('nameEn')}</th><th>{t('vehicleType')}</th><th>{t('frequency')}</th><th>{t('sortOrder')}</th><th></th></tr>
          </thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={6} className="table-empty">{t('noResults')}</td></tr>}
            {filtered.map((item, i) => (
              <tr key={item.id}>
                <td className="muted">{i + 1}</td>
                <td>{lang === 'th' ? item.item_name_th : item.item_name_en}</td>
                <td>{typeLabel[item.vehicle_type]}</td>
                <td>{freqLabel[item.frequency]}</td>
                <td className="muted">{item.sort_order}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button type="button" className="btn btn--secondary" style={{ padding: '5px 10px', marginRight: 6 }} onClick={() => openEdit(item)}>{t('editAction')}</button>
                  <button type="button" className="btn" style={{ padding: '5px 10px', background: '#fde', color: '#c00' }} onClick={() => handleDelete(item)}>{t('deleteAction')}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {modal !== null && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'grid', placeItems: 'center', zIndex: 100 }}>
          <div style={{ background: 'var(--panel)', borderRadius: 16, padding: 28, width: 'min(460px, 95vw)', display: 'grid', gap: 14 }}>
            <h3 style={{ margin: 0 }}>{modal === 'create' ? `+ ${t('adminChecklist')}` : t('editAction')}</h3>
            {error && <div className="alert alert--error">{error}</div>}
            {([['itemNameTh', 'nameTh'], ['itemNameEn', 'nameEn']] as [keyof Form, 'nameTh' | 'nameEn'][]).map(([field, key]) => (
              <label key={field} style={{ display: 'grid', gap: 4, fontSize: 13, fontWeight: 600 }}>
                {t(key)}
                <input value={form[field]} onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
                  style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', fontSize: 14 }} />
              </label>
            ))}
            <label style={{ display: 'grid', gap: 4, fontSize: 13, fontWeight: 600 }}>
              {t('vehicleType')}
              <select value={form.vehicleType} onChange={(e) => setForm((f) => ({ ...f, vehicleType: e.target.value }))}
                style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', fontSize: 14 }}>
                {vTypes.map((v) => <option key={v} value={v}>{typeLabel[v]}</option>)}
              </select>
            </label>
            <label style={{ display: 'grid', gap: 4, fontSize: 13, fontWeight: 600 }}>
              {t('frequency')}
              <select value={form.frequency} onChange={(e) => setForm((f) => ({ ...f, frequency: e.target.value }))}
                style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', fontSize: 14 }}>
                {freqs.map((f) => <option key={f} value={f}>{freqLabel[f]}</option>)}
              </select>
            </label>
            <label style={{ display: 'grid', gap: 4, fontSize: 13, fontWeight: 600 }}>
              {t('sortOrder')}
              <input type="number" value={form.sortOrder} onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
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

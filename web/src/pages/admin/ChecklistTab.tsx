import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../AuthContext';
import { ApiError, ChecklistItem, fetchAdminChecklist, createChecklistItem, updateChecklistItem, deleteChecklistItem } from '../../api';
import {
  CHECKLIST_FREQUENCIES,
  CHECKLIST_VEHICLE_TYPES,
  groupChecklistItems,
  type ChecklistFrequency,
} from '../../checklist-groups';
import { getLang, t } from '../../i18n';

type VehicleType = ChecklistItem['vehicle_type'];
type Form = { itemNameTh: string; itemNameEn: string; vehicleType: VehicleType; frequency: ChecklistFrequency; sortOrder: string };
const BLANK: Form = { itemNameTh: '', itemNameEn: '', vehicleType: 'car', frequency: 'daily', sortOrder: '0' };

export function ChecklistTab() {
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<VehicleType | ''>('');
  const [filterFreq, setFilterFreq] = useState<ChecklistFrequency | ''>('');
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<'create' | ChecklistItem | null>(null);
  const [form, setForm] = useState<Form>(BLANK);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const loadRequestRef = useRef(0);
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const lang = getLang();

  const load = useCallback(async () => {
    const requestId = ++loadRequestRef.current;
    setLoading(true);
    setLoadError('');
    try {
      const data = await fetchAdminChecklist();
      if (requestId === loadRequestRef.current) setItems(data);
    } catch (e: unknown) {
      if (requestId !== loadRequestRef.current) return;
      if (e instanceof ApiError && e.status === 401) {
        signOut();
        navigate('/login', { replace: true });
        return;
      }
      setLoadError(e instanceof Error ? e.message : t('error'));
    } finally {
      if (requestId === loadRequestRef.current) setLoading(false);
    }
  }, [navigate, signOut]);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate(vehicleTypeOverride?: VehicleType, frequencyOverride?: ChecklistFrequency) {
    const vehicleType = vehicleTypeOverride ?? (filterType || BLANK.vehicleType);
    const frequency = frequencyOverride ?? (filterFreq || BLANK.frequency);
    const nextSortOrder = items
      .filter((item) => item.vehicle_type === vehicleType && item.frequency === frequency)
      .reduce((max, item) => Math.max(max, item.sort_order), 0) + 1;
    setForm({ ...BLANK, vehicleType, frequency, sortOrder: String(nextSortOrder) });
    setModal('create');
    setError('');
  }
  function openEdit(item: ChecklistItem) {
    setForm({ itemNameTh: item.item_name_th, itemNameEn: item.item_name_en, vehicleType: item.vehicle_type, frequency: item.frequency, sortOrder: String(item.sort_order) });
    setModal(item); setError('');
  }

  async function handleSave() {
    setSaving(true); setError('');
    try {
      const sortOrder = parseInt(form.sortOrder) || 0;
      if (modal === 'create') {
        await createChecklistItem({ ...form, sortOrder });
      } else if (modal) {
        await updateChecklistItem({ id: (modal as ChecklistItem).id, ...form, sortOrder });
      }
      setModal(null);
      await load();
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
      await load();
    } catch (e: any) {
      alert(e.message || t('error'));
    }
  }

  const typeLabel: Record<VehicleType, string> = { car: t('car'), van: t('van'), e_van: t('eVan'), motorcycle: t('motorcycle'), e_bike: t('eBike') };
  const freqLabel: Record<ChecklistFrequency, string> = { daily: t('daily'), weekly: t('weekly'), post_route: t('postRoute') };
  const groupedItems = useMemo(
    () => groupChecklistItems(items, {
      vehicleType: filterType,
      frequency: filterFreq,
      search,
    }),
    [filterFreq, filterType, items, search],
  );

  return (
    <div className="panel panel--flush">
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <h2 style={{ margin: 0, flex: 1 }}>{t('adminChecklist')}</h2>
        <select value={filterFreq} onChange={(e) => setFilterFreq(e.target.value as ChecklistFrequency | '')}
          style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '7px 10px', fontSize: 13 }}>
          <option value="">{t('all')} {t('frequency')}</option>
          {CHECKLIST_FREQUENCIES.map((frequency) => <option key={frequency} value={frequency}>{freqLabel[frequency]}</option>)}
        </select>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value as VehicleType | '')}
          style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '7px 10px', fontSize: 13 }}>
          <option value="">{t('all')} {t('vehicleType')}</option>
          {CHECKLIST_VEHICLE_TYPES.map((vehicleType) => <option key={vehicleType} value={vehicleType}>{typeLabel[vehicleType]}</option>)}
        </select>
        <input placeholder={t('search')} value={search} onChange={(e) => setSearch(e.target.value)}
          style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '7px 10px', fontSize: 13 }} />
        <button type="button" className="btn btn--accent" style={{ padding: '8px 16px' }} onClick={() => openCreate()} disabled={loading}>
          + {t('add')}
        </button>
      </div>
      {loadError && <div className="alert alert--error" style={{ margin: '16px 20px 0' }}>{loadError}</div>}
      {loading ? <p className="muted" style={{ padding: 20 }}>{t('loading')}</p> : groupedItems.length === 0 ? (
        <div className="table-empty">{t('noResults')}</div>
      ) : (
        <div className="checklist-groups">
          {groupedItems.map((frequencyGroup) => (
            <section className="checklist-frequency-group" key={frequencyGroup.frequency}>
              <header className="checklist-frequency-group__header">
                <div>
                  <span className="checklist-group-kicker">{t('frequency')}</span>
                  <h3>{freqLabel[frequencyGroup.frequency]}</h3>
                </div>
                <span className="checklist-count">{t('itemCount', { count: String(frequencyGroup.itemCount) })}</span>
              </header>
              <div className="checklist-vehicle-groups">
                {frequencyGroup.vehicleGroups.map((vehicleGroup) => (
                  <section className="checklist-vehicle-group" key={vehicleGroup.vehicleType}>
                    <header className="checklist-vehicle-group__header">
                      <div>
                        <span className="checklist-group-kicker">{t('vehicleType')}</span>
                        <h4>{typeLabel[vehicleGroup.vehicleType]}</h4>
                      </div>
                      <div className="checklist-vehicle-group__actions">
                        <span className="checklist-count">{t('itemCount', { count: String(vehicleGroup.items.length) })}</span>
                        <button
                          type="button"
                          className="btn btn--secondary btn--sm"
                          onClick={() => openCreate(vehicleGroup.vehicleType, frequencyGroup.frequency)}
                        >
                          + {t('add')}
                        </button>
                      </div>
                    </header>
                    <div className="table-scroll">
                      <table className="data-table checklist-group-table">
                        <thead>
                          <tr><th>#</th><th>{lang === 'th' ? t('nameTh') : t('nameEn')}</th><th>{t('sortOrder')}</th><th></th></tr>
                        </thead>
                        <tbody>
                          {vehicleGroup.items.map((item, index) => (
                            <tr key={item.id}>
                              <td className="muted">{index + 1}</td>
                              <td className="checklist-item-name">{lang === 'th' ? item.item_name_th : item.item_name_en}</td>
                              <td className="muted">{item.sort_order}</td>
                              <td className="checklist-row-actions">
                                <button type="button" className="btn btn--secondary btn--sm" onClick={() => openEdit(item)}>{t('editAction')}</button>
                                <button type="button" className="btn btn--sm checklist-delete-button" onClick={() => handleDelete(item)}>{t('deleteAction')}</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                ))}
              </div>
            </section>
          ))}
        </div>
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
              {t('frequency')}
              <select value={form.frequency} onChange={(e) => setForm((f) => ({ ...f, frequency: e.target.value as ChecklistFrequency }))}
                style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', fontSize: 14 }}>
                {CHECKLIST_FREQUENCIES.map((frequency) => <option key={frequency} value={frequency}>{freqLabel[frequency]}</option>)}
              </select>
            </label>
            <label style={{ display: 'grid', gap: 4, fontSize: 13, fontWeight: 600 }}>
              {t('vehicleType')}
              <select value={form.vehicleType} onChange={(e) => setForm((f) => ({ ...f, vehicleType: e.target.value as VehicleType }))}
                style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', fontSize: 14 }}>
                {CHECKLIST_VEHICLE_TYPES.map((vehicleType) => <option key={vehicleType} value={vehicleType}>{typeLabel[vehicleType]}</option>)}
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

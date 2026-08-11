import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../AuthContext';
import {
  ApiError,
  ChecklistItem,
  createChecklistItem,
  deleteChecklistItem,
  fetchAdminChecklist,
  reorderChecklistItems,
  updateChecklistItem,
} from '../../api';
import {
  CHECKLIST_FREQUENCIES,
  CHECKLIST_VEHICLE_TYPES,
  groupChecklistItems,
  type ChecklistFrequency,
} from '../../checklist-groups';
import { getLang, t } from '../../i18n';
import { ChecklistImportDialog } from './ChecklistImportDialog';

type VehicleType = ChecklistItem['vehicle_type'];
type Form = { itemNameTh: string; itemNameEn: string; vehicleType: VehicleType; frequency: ChecklistFrequency; sortOrder: string };
const BLANK: Form = { itemNameTh: '', itemNameEn: '', vehicleType: 'car', frequency: 'daily', sortOrder: '0' };

function SearchIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="10.5" cy="10.5" r="6.5" /><path d="m15.5 15.5 4 4" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 16V4" /><path d="m7.5 8.5 4.5-4.5 4.5 4.5" /><path d="M5 14.5v3.25A2.25 2.25 0 0 0 7.25 20h9.5A2.25 2.25 0 0 0 19 17.75V14.5" />
    </svg>
  );
}

function DragHandleIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 18 24" width="16" height="20" fill="currentColor">
      <circle cx="5" cy="6" r="1.5" /><circle cx="13" cy="6" r="1.5" />
      <circle cx="5" cy="12" r="1.5" /><circle cx="13" cy="12" r="1.5" />
      <circle cx="5" cy="18" r="1.5" /><circle cx="13" cy="18" r="1.5" />
    </svg>
  );
}

export function ChecklistTab() {
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFrequency, setActiveFrequency] = useState<ChecklistFrequency>('daily');
  const [activeVehicleType, setActiveVehicleType] = useState<VehicleType>('car');
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<'create' | ChecklistItem | null>(null);
  const [form, setForm] = useState<Form>(BLANK);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dragOverItemId, setDragOverItemId] = useState<string | null>(null);
  const [orderStatus, setOrderStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [notice, setNotice] = useState('');
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

  function openCreate() {
    const vehicleType = activeVehicleType;
    const frequency = activeFrequency;
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
      let sortOrder = parseInt(form.sortOrder) || 0;
      if (
        modal !== 'create'
        && modal
        && (modal.frequency !== form.frequency || modal.vehicle_type !== form.vehicleType)
      ) {
        sortOrder = items
          .filter((item) => item.vehicle_type === form.vehicleType && item.frequency === form.frequency)
          .reduce((max, item) => Math.max(max, item.sort_order), 0) + 1;
      }
      if (modal === 'create') {
        await createChecklistItem({ ...form, sortOrder });
      } else if (modal) {
        await updateChecklistItem({ id: (modal as ChecklistItem).id, ...form, sortOrder });
      }
      setModal(null);
      setActiveFrequency(form.frequency);
      setActiveVehicleType(form.vehicleType);
      await load();
      setNotice(t('saved'));
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
    () => groupChecklistItems(items, { search }),
    [items, search],
  );
  const activeFrequencyGroup = groupedItems.find((group) => group.frequency === activeFrequency);
  const activeItems = activeFrequencyGroup?.vehicleGroups.find((group) => group.vehicleType === activeVehicleType)?.items ?? [];
  const canReorder = search.trim() === '' && orderStatus !== 'saving';

  async function commitOrder(nextItems: ChecklistItem[]) {
    const previousItems = items;
    const orderById = new Map(nextItems.map((item, index) => [item.id, index + 1]));
    setItems((current) => current.map((item) => {
      const sortOrder = orderById.get(item.id);
      return sortOrder ? { ...item, sort_order: sortOrder } : item;
    }));
    setOrderStatus('saving');
    setNotice('');
    try {
      await reorderChecklistItems(nextItems.map((item, index) => ({ id: item.id, sortOrder: index + 1 })));
      setOrderStatus('saved');
    } catch {
      setItems(previousItems);
      setOrderStatus('error');
    }
  }

  function moveItem(sourceId: string, targetId: string) {
    if (!canReorder || sourceId === targetId) return;
    const sourceIndex = activeItems.findIndex((item) => item.id === sourceId);
    const targetIndex = activeItems.findIndex((item) => item.id === targetId);
    if (sourceIndex < 0 || targetIndex < 0) return;
    const nextItems = [...activeItems];
    const [moved] = nextItems.splice(sourceIndex, 1);
    nextItems.splice(targetIndex, 0, moved);
    void commitOrder(nextItems);
  }

  function moveItemByOffset(itemId: string, offset: -1 | 1) {
    if (!canReorder) return;
    const sourceIndex = activeItems.findIndex((item) => item.id === itemId);
    const target = activeItems[sourceIndex + offset];
    if (sourceIndex < 0 || !target) return;
    moveItem(itemId, target.id);
  }

  function handleDragStart(event: DragEvent<HTMLButtonElement>, itemId: string) {
    if (!canReorder) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', itemId);
    setDraggedItemId(itemId);
    setOrderStatus('idle');
  }

  function handleDrop(event: DragEvent<HTMLTableRowElement>, targetId: string) {
    event.preventDefault();
    const sourceId = draggedItemId || event.dataTransfer.getData('text/plain');
    setDraggedItemId(null);
    setDragOverItemId(null);
    if (sourceId) moveItem(sourceId, targetId);
  }

  function selectAdjacentTab<T extends string>(
    event: React.KeyboardEvent<HTMLButtonElement>,
    values: readonly T[],
    currentValue: T,
    onSelect: (value: T) => void,
  ) {
    const currentIndex = values.indexOf(currentValue);
    let nextIndex: number | undefined;
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % values.length;
    if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + values.length) % values.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = values.length - 1;
    if (nextIndex === undefined) return;

    event.preventDefault();
    onSelect(values[nextIndex]);
    event.currentTarget.parentElement
      ?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[nextIndex]
      ?.focus();
  }

  const orderMessage = search.trim()
    ? t('reorderSearchHint')
    : orderStatus === 'saving'
      ? t('orderSaving')
      : orderStatus === 'saved'
        ? t('orderSaved')
        : orderStatus === 'error'
          ? t('reorderFailed')
          : t('reorderHint');

  return (
    <div className="panel panel--flush checklist-manager">
      <header className="checklist-manager__toolbar">
        <h2>{t('adminChecklist')}</h2>
        <div className="checklist-manager__actions">
          <label className="checklist-manager__search">
            <SearchIcon />
            <input
              aria-label={t('searchChecklistItems')}
              placeholder={t('searchChecklistItems')}
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setOrderStatus('idle');
              }}
            />
          </label>
          <button type="button" className="btn btn--secondary checklist-manager__button" onClick={() => setImportOpen(true)} disabled={loading}>
            <UploadIcon /> {t('importFile')}
          </button>
          <button type="button" className="btn btn--accent checklist-manager__button" onClick={openCreate} disabled={loading}>
            <span aria-hidden="true">+</span> {t('addItem')}
          </button>
        </div>
      </header>

      {loadError && <div className="alert alert--error checklist-manager__alert">{loadError}</div>}
      {notice && <div className="checklist-manager__notice" role="status">✓ {notice}</div>}

      {loading ? <p className="muted checklist-manager__loading">{t('loading')}</p> : (
        <div className="checklist-tab-layout">
          <div className="checklist-tab-section">
            <span className="checklist-group-kicker">{t('frequency')}</span>
            <div className="checklist-tablist" role="tablist" aria-label={t('frequency')}>
              {CHECKLIST_FREQUENCIES.map((frequency) => {
                const count = groupedItems.find((group) => group.frequency === frequency)?.itemCount ?? 0;
                const isActive = frequency === activeFrequency;
                return (
                  <button
                    type="button"
                    role="tab"
                    id={`checklist-frequency-${frequency}`}
                    aria-controls="checklist-tab-panel"
                    aria-selected={isActive}
                    tabIndex={isActive ? 0 : -1}
                    className={`checklist-tab${isActive ? ' checklist-tab--active' : ''}`}
                    key={frequency}
                    onClick={() => { setActiveFrequency(frequency); setOrderStatus('idle'); }}
                    onKeyDown={(event) => selectAdjacentTab(event, CHECKLIST_FREQUENCIES, activeFrequency, (value) => {
                      setActiveFrequency(value);
                      setOrderStatus('idle');
                    })}
                  >
                    <span>{freqLabel[frequency]}</span>
                    <span className="checklist-tab__count">{count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="checklist-tab-section">
            <span className="checklist-group-kicker">{t('vehicleType')}</span>
            <div className="checklist-tablist checklist-tablist--secondary" role="tablist" aria-label={t('vehicleType')}>
              {CHECKLIST_VEHICLE_TYPES.map((vehicleType) => {
                const count = activeFrequencyGroup?.vehicleGroups.find((group) => group.vehicleType === vehicleType)?.items.length ?? 0;
                const isActive = vehicleType === activeVehicleType;
                return (
                  <button
                    type="button"
                    role="tab"
                    id={`checklist-vehicle-${vehicleType}`}
                    aria-controls="checklist-tab-panel"
                    aria-selected={isActive}
                    tabIndex={isActive ? 0 : -1}
                    className={`checklist-tab checklist-tab--secondary${isActive ? ' checklist-tab--active' : ''}`}
                    key={vehicleType}
                    onClick={() => { setActiveVehicleType(vehicleType); setOrderStatus('idle'); }}
                    onKeyDown={(event) => selectAdjacentTab(event, CHECKLIST_VEHICLE_TYPES, activeVehicleType, (value) => {
                      setActiveVehicleType(value);
                      setOrderStatus('idle');
                    })}
                  >
                    <span>{typeLabel[vehicleType]}</span>
                    <span className="checklist-tab__count">{count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <section
            className="checklist-tab-panel"
            id="checklist-tab-panel"
            role="tabpanel"
            aria-labelledby={`checklist-frequency-${activeFrequency} checklist-vehicle-${activeVehicleType}`}
          >
            {activeItems.length === 0 ? <div className="table-empty">{t('noResults')}</div> : (
              <div className="table-scroll">
                <table className="data-table checklist-manager-table">
                  <thead>
                    <tr><th>{t('order')}</th><th>{t('checklistItem')}</th><th>{t('actions')}</th></tr>
                  </thead>
                  <tbody>
                    {activeItems.map((item, index) => (
                      <tr
                        className={`${draggedItemId === item.id ? 'checklist-manager-row--dragging ' : ''}${dragOverItemId === item.id ? 'checklist-manager-row--drop-target' : ''}`.trim()}
                        key={item.id}
                        onDragOver={(event) => {
                          if (!draggedItemId || draggedItemId === item.id) return;
                          event.preventDefault();
                          event.dataTransfer.dropEffect = 'move';
                          setDragOverItemId(item.id);
                        }}
                        onDrop={(event) => handleDrop(event, item.id)}
                      >
                        <td className="checklist-manager-table__order">
                          <button
                            type="button"
                            className="checklist-drag-handle"
                            aria-label={`${t('dragToReorder')}: ${lang === 'th' ? item.item_name_th : item.item_name_en}`}
                            title={canReorder ? t('dragToReorder') : t('reorderSearchHint')}
                            draggable={canReorder}
                            disabled={!canReorder}
                            onDragStart={(event) => handleDragStart(event, item.id)}
                            onDragEnd={() => { setDraggedItemId(null); setDragOverItemId(null); }}
                            onKeyDown={(event) => {
                              if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
                                event.preventDefault();
                                moveItemByOffset(item.id, event.key === 'ArrowUp' ? -1 : 1);
                              }
                            }}
                          >
                            <DragHandleIcon />
                          </button>
                          <span>{index + 1}</span>
                        </td>
                        <td className="checklist-item-name">
                          <strong>{lang === 'th' ? item.item_name_th : item.item_name_en}</strong>
                          <span>{lang === 'th' ? item.item_name_en : item.item_name_th}</span>
                        </td>
                        <td className="checklist-row-actions">
                          <button type="button" className="btn btn--secondary btn--sm" onClick={() => openEdit(item)}>{t('editAction')}</button>
                          <button type="button" className="btn btn--sm checklist-delete-button" onClick={() => handleDelete(item)}>{t('deleteAction')}</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          <div className={`checklist-manager__status checklist-manager__status--${orderStatus}`} aria-live="polite">
            <span aria-hidden="true">{orderStatus === 'error' ? '!' : '✓'}</span> {orderMessage}
          </div>
        </div>
      )}

      <ChecklistImportDialog
        open={importOpen}
        defaults={{ frequency: activeFrequency, vehicleType: activeVehicleType }}
        existingItems={items}
        frequencyLabel={(frequency) => freqLabel[frequency]}
        vehicleTypeLabel={(vehicleType) => typeLabel[vehicleType]}
        onClose={() => setImportOpen(false)}
        onImported={async (count, firstRow) => {
          setImportOpen(false);
          setActiveFrequency(firstRow.frequency);
          setActiveVehicleType(firstRow.vehicleType);
          await load();
          setNotice(t('importSuccess', { count: String(count) }));
        }}
      />

      {modal !== null && (
        <div className="checklist-modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !saving) setModal(null);
        }}>
          <section className="checklist-item-dialog" role="dialog" aria-modal="true" aria-labelledby="checklist-item-dialog-title">
            <h3 id="checklist-item-dialog-title">{modal === 'create' ? t('addItem') : t('editAction')}</h3>
            {error && <div className="alert alert--error">{error}</div>}
            {([['itemNameTh', 'nameTh'], ['itemNameEn', 'nameEn']] as [keyof Form, 'nameTh' | 'nameEn'][]).map(([field, key]) => (
              <label className="checklist-form-field" key={field}>
                <span>{t(key)}</span>
                <input value={form[field]} onChange={(event) => setForm((current) => ({ ...current, [field]: event.target.value }))} />
              </label>
            ))}
            <div className="checklist-item-dialog__grid">
              <label className="checklist-form-field">
                <span>{t('frequency')}</span>
                <select value={form.frequency} onChange={(event) => setForm((current) => ({ ...current, frequency: event.target.value as ChecklistFrequency }))}>
                  {CHECKLIST_FREQUENCIES.map((frequency) => <option key={frequency} value={frequency}>{freqLabel[frequency]}</option>)}
                </select>
              </label>
              <label className="checklist-form-field">
                <span>{t('vehicleType')}</span>
                <select value={form.vehicleType} onChange={(event) => setForm((current) => ({ ...current, vehicleType: event.target.value as VehicleType }))}>
                  {CHECKLIST_VEHICLE_TYPES.map((vehicleType) => <option key={vehicleType} value={vehicleType}>{typeLabel[vehicleType]}</option>)}
                </select>
              </label>
            </div>
            <footer>
              <button type="button" className="btn btn--secondary" onClick={() => setModal(null)}>{t('cancel')}</button>
              <button type="button" className="btn btn--accent" onClick={() => void handleSave()} disabled={saving || !form.itemNameTh.trim() || !form.itemNameEn.trim()}>{saving ? t('saving') : t('save')}</button>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}

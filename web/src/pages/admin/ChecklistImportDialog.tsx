import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import type { ChecklistItem } from '../../api';
import { importChecklistItems } from '../../api';
import {
  buildChecklistImportPayload,
  checklistCsvTemplate,
  ChecklistImportError,
  parseChecklistImportFile,
  type ChecklistImportDefaults,
  type ChecklistImportIssue,
  type ChecklistImportRow,
} from '../../checklist-import';
import { t, type MessageKey } from '../../i18n';

type Props = {
  open: boolean;
  defaults: ChecklistImportDefaults;
  existingItems: readonly ChecklistItem[];
  frequencyLabel: (frequency: ChecklistImportDefaults['frequency']) => string;
  vehicleTypeLabel: (vehicleType: ChecklistImportDefaults['vehicleType']) => string;
  onClose: () => void;
  onImported: (count: number, firstRow: ChecklistImportRow) => Promise<void> | void;
};

const ISSUE_KEYS: Record<ChecklistImportIssue, MessageKey> = {
  missing_thai_name: 'missingThaiName',
  missing_english_name: 'missingEnglishName',
  invalid_frequency: 'invalidFrequency',
  invalid_vehicle_type: 'invalidVehicleType',
  name_too_long: 'nameTooLong',
};

function UploadIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 16V4" /><path d="m7.5 8.5 4.5-4.5 4.5 4.5" /><path d="M5 14.5v3.25A2.25 2.25 0 0 0 7.25 20h9.5A2.25 2.25 0 0 0 19 17.75V14.5" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 3.5h6l4 4V20.5H7z" /><path d="M13 3.5v4h4" /><path d="M9.5 13h5M9.5 16h5" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  );
}

export function ChecklistImportDialog({
  open,
  defaults,
  existingItems,
  frequencyLabel,
  vehicleTypeLabel,
  onClose,
  onImported,
}: Props) {
  const [rows, setRows] = useState<ChecklistImportRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [reading, setReading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validRows = useMemo(() => rows.filter((row) => row.issues.length === 0), [rows]);
  const attentionRows = rows.length - validRows.length;

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !importing) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [importing, onClose, open]);

  if (!open) return null;

  function resetFile() {
    setRows([]);
    setFileName('');
    setError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function loadFile(file?: File) {
    if (!file) return;
    setReading(true);
    setError('');
    try {
      const parsed = await parseChecklistImportFile(file, defaults);
      setRows(parsed);
      setFileName(file.name);
    } catch (caught) {
      resetFile();
      setError(caught instanceof ChecklistImportError ? caught.message : t('importFailed'));
    } finally {
      setReading(false);
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragActive(false);
    void loadFile(event.dataTransfer.files[0]);
  }

  function downloadTemplate() {
    const blob = new Blob([`\uFEFF${checklistCsvTemplate(defaults)}`], { type: 'text/csv;charset=utf-8' });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.download = `checklist-${defaults.frequency}-${defaults.vehicleType}.csv`;
    anchor.click();
    URL.revokeObjectURL(href);
  }

  async function handleImport() {
    const payload = buildChecklistImportPayload(validRows, existingItems);
    if (payload.length === 0) return;
    setImporting(true);
    setError('');
    try {
      const result = await importChecklistItems(payload);
      const firstRow = validRows[0];
      resetFile();
      await onImported(result.imported, firstRow);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('importFailed'));
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="checklist-modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !importing) onClose();
    }}>
      <section className="checklist-import-dialog" role="dialog" aria-modal="true" aria-labelledby="checklist-import-title">
        <header className="checklist-import-dialog__header">
          <div>
            <h3 id="checklist-import-title">{t('importChecklist')}</h3>
            <p>{t('importDescription')}</p>
          </div>
          <button type="button" className="icon-button" aria-label={t('cancel')} onClick={onClose} disabled={importing}>
            <CloseIcon />
          </button>
        </header>

        <div
          className={`checklist-import-dropzone${dragActive ? ' checklist-import-dropzone--active' : ''}`}
          onDragEnter={(event) => { event.preventDefault(); setDragActive(true); }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragActive(false);
          }}
          onDrop={handleDrop}
        >
          <UploadIcon />
          <strong>{t('dropFile')}</strong>
          <span>{t('importFormats')}</span>
          <button type="button" className="btn btn--secondary btn--sm" onClick={() => fileInputRef.current?.click()} disabled={reading || importing}>
            {reading ? t('loading') : t('chooseFile')}
          </button>
          <input
            ref={fileInputRef}
            className="visually-hidden"
            type="file"
            accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(event) => void loadFile(event.target.files?.[0])}
          />
        </div>

        <button type="button" className="checklist-template-link" onClick={downloadTemplate}>
          <UploadIcon /> {t('downloadTemplate')}
        </button>
        <details style={{ fontSize: 12 }}>
          <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Supported import columns</summary>
          <div className="muted" style={{ paddingTop: 6 }}>Required: <strong>item_name_th</strong>, <strong>item_name_en</strong>. Optional: <strong>frequency</strong>, <strong>vehicle_type</strong>. The exported checklist uses these columns plus <strong>sort_order</strong>.</div>
        </details>

        {fileName && (
          <div className="checklist-import-file">
            <FileIcon />
            <span>{fileName}</span>
            <button type="button" className="btn btn--secondary btn--sm" onClick={resetFile} disabled={importing}>{t('removeFile')}</button>
          </div>
        )}

        {error && <div className="alert alert--error">{error}</div>}

        {rows.length > 0 && (
          <>
            <div className="checklist-import-summary" aria-live="polite">
              <span className="checklist-import-summary__valid">✓ {t('validRows', { count: String(validRows.length) })}</span>
              {attentionRows > 0 && <span className="checklist-import-summary__attention">! {t('rowsNeedAttention', { count: String(attentionRows) })}</span>}
            </div>
            <div className="checklist-import-preview table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t('row')}</th>
                    <th>{t('thaiName')}</th>
                    <th>{t('englishName')}</th>
                    <th>{t('frequency')}</th>
                    <th>{t('vehicleType')}</th>
                    <th>{t('status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr className={row.issues.length > 0 ? 'checklist-import-preview__invalid' : ''} key={row.rowNumber}>
                      <td>{row.rowNumber}</td>
                      <td>{row.itemNameTh || '—'}</td>
                      <td>{row.itemNameEn || '—'}</td>
                      <td>{row.issues.includes('invalid_frequency') ? row.frequencyDisplay : frequencyLabel(row.frequency)}</td>
                      <td>{row.issues.includes('invalid_vehicle_type') ? row.vehicleTypeDisplay : vehicleTypeLabel(row.vehicleType)}</td>
                      <td className={row.issues.length > 0 ? 'checklist-import-status--error' : 'checklist-import-status--ready'}>
                        {row.issues.length > 0 ? row.issues.map((issue) => t(ISSUE_KEYS[issue])).join(', ') : t('ready')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <footer className="checklist-import-dialog__footer">
          <span>{frequencyLabel(defaults.frequency)} · {vehicleTypeLabel(defaults.vehicleType)}</span>
          <div>
            <button type="button" className="btn btn--secondary" onClick={onClose} disabled={importing}>{t('cancel')}</button>
            <button type="button" className="btn btn--accent" onClick={() => void handleImport()} disabled={validRows.length === 0 || reading || importing}>
              {importing ? t('importingItems') : t('importItems', { count: String(validRows.length) })}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}

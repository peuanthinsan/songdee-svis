import { useEffect, useRef, useState } from 'react';
import { downloadExport, IssueRow, fetchIssues, updateIssueStatus, uploadInspectionPhoto, importIssues } from '../../api';
import { t } from '../../i18n';
import { formatDateThai, formatDateTimeThai } from '../../lib/format-date';
import { parseIssueImportFile } from '../../admin-import';

const STATUSES = ['open', 'in_progress', 'completed'];

export function IssuesMgmtTab() {
  const [issues, setIssues] = useState<IssueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('open');
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [completionIssue, setCompletionIssue] = useState<IssueRow | null>(null);
  const [uploadingCompletion, setUploadingCompletion] = useState(false);
  const completionInput = useRef<HTMLInputElement>(null);
  const importInput = useRef<HTMLInputElement>(null);

  function load(status: string) {
    setLoading(true);
    fetchIssues(status === 'all' ? undefined : status)
      .then((data) => { setIssues(data); setLoading(false); })
      .catch(() => { setError(t('error')); setLoading(false); });
  }
  useEffect(() => load(filter), [filter]);

  async function exportIssues() {
    setExporting(true);
    try { await downloadExport(`/api/issues/export?status=${encodeURIComponent(filter === 'all' ? '' : filter)}`, 'issues.xlsx'); }
    catch (e: any) { setError(e.message || t('exportFailed')); }
    finally { setExporting(false); }
  }

  async function importIssueStatuses(file?: File) {
    if (!file) return;
    setImporting(true); setError('');
    try {
      const rows = await parseIssueImportFile(file);
      const errors = rows.flatMap((row) => !row.issueId || !['open', 'in_progress', 'completed'].includes(row.status) ? [`Row ${row.rowNumber}: Issue ID and valid Status are required`] : []);
      if (errors.length) throw new Error(errors.slice(0, 5).join(' · '));
      const result = await importIssues(rows.map(({ rowNumber, ...row }) => row));
      alert(`Imported ${result.imported} issue statuses`);
      load(filter);
    } catch (e: any) { setError(e.message || t('importFailed')); }
    finally { setImporting(false); if (importInput.current) importInput.current.value = ''; }
  }

  async function changeStatus(issue: IssueRow, newStatus: string) {
    if (newStatus === 'completed') {
      setCompletionIssue(issue);
      completionInput.current?.click();
      return;
    }

    setUpdating(issue.id);
    try {
      await updateIssueStatus(issue.id, newStatus);
      setIssues((prev) => filter === 'all'
        ? prev.map((i) => i.id === issue.id ? { ...i, status: newStatus } : i)
        : prev.filter((i) => i.id !== issue.id));
    } catch (e: any) {
      alert(e.message || t('error'));
    } finally {
      setUpdating(null);
    }
  }

  async function completeWithPhoto(file: File) {
    if (!completionIssue) return;
    setUploadingCompletion(true);
    try {
      const { url } = await uploadInspectionPhoto(file);
      await updateIssueStatus(completionIssue.id, 'completed', [url]);
      setIssues((prev) => filter === 'all'
        ? prev.map((i) => i.id === completionIssue.id ? { ...i, status: 'completed', completion_photo_urls: [url] } : i)
        : prev.filter((i) => i.id !== completionIssue.id));
    } catch (e: any) {
      alert(e.message || t('error'));
    } finally {
      setUploadingCompletion(false);
      setCompletionIssue(null);
    }
  }

  const statusLabel: Record<string, string> = { open: t('open'), in_progress: t('inProgress'), completed: t('completed'), all: t('all') };
  const nextStatus: Record<string, string | null> = { open: 'in_progress', in_progress: 'completed', completed: null };

  return (
    <div className="panel panel--flush">
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, flex: 1 }}>{t('adminIssuesMgmt')}</h2>
        <input ref={importInput} type="file" accept=".csv,.xlsx" hidden onChange={(e) => void importIssueStatuses(e.target.files?.[0])} />
        <button type="button" className="btn btn--secondary" onClick={() => importInput.current?.click()} disabled={importing}>{importing ? '…' : t('importFile')}</button>
        <button type="button" className="btn btn--secondary" onClick={() => void exportIssues()} disabled={exporting}>{exporting ? '…' : t('export')}</button>
        <div className="chip-row">
          {['all', ...STATUSES].map((s) => (
            <button key={s} type="button" className={`chip${filter === s ? ' chip--active' : ''}`} onClick={() => setFilter(s)}>
              {statusLabel[s]}
            </button>
          ))}
        </div>
      </div>
      <details style={{ padding: '0 20px 12px', fontSize: 12 }}><summary style={{ cursor: 'pointer', fontWeight: 600 }}>{t('supportedImportColumns')} / {t('supportedExportColumns')}</summary><span className="muted">{t('required')}: <strong>Issue ID</strong>, <strong>Status</strong> (open, in_progress, completed). Import updates existing issue statuses. {t('exportColumns')}: <strong>#, Plate Number, Fleet, Vehicle Type, Status, Inspector, Inspection Date, Created, Defect 1–3, Repair 1–3</strong>.</span></details>
      <input ref={completionInput} type="file" accept="image/jpeg,image/png" hidden disabled={uploadingCompletion} onChange={(event) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (file) void completeWithPhoto(file);
      }} />
      {uploadingCompletion && <div className="alert" style={{ margin: 12 }}>{t('uploading')}</div>}
      {error && <div className="alert alert--error" style={{ margin: 12 }}>{error}</div>}
      {loading ? (
        <p className="muted" style={{ padding: 20 }}>{t('loading')}</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr><th>{t('plate')}</th><th>{t('fleet')}</th><th>{t('inspector')}</th><th>{t('date')}</th><th>{t('status')}</th><th>{t('updateStatus')}</th></tr>
          </thead>
          <tbody>
            {issues.length === 0 && <tr><td colSpan={6} className="table-empty">{t('noResults')}</td></tr>}
            {issues.map((issue) => {
              const next = nextStatus[issue.status];
              return (
                <tr key={issue.id}>
                  <td><strong>{issue.plate_number}</strong></td>
                  <td className="muted">{issue.fleet_id || issue.vehicle_fleet || '—'}</td>
                  <td className="muted">{issue.inspector_name || '—'}</td>
                  <td className="muted">{issue.inspection_date ? formatDateThai(issue.inspection_date) : formatDateTimeThai(issue.created_at)}</td>
                  <td><span className={`badge badge--${issue.status}`}>{statusLabel[issue.status]}</span></td>
                  <td>
                    {next && (
                      <button
                        type="button"
                        className="btn btn--secondary"
                        style={{ padding: '5px 10px', fontSize: 13 }}
                        disabled={updating === issue.id}
                        onClick={() => changeStatus(issue, next)}
                      >
                        → {statusLabel[next]}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { downloadExport, IssueRow, fetchIssues, updateIssueStatus } from '../../api';
import { t } from '../../i18n';
import { formatDateThai, formatDateTimeThai } from '../../lib/format-date';

const STATUSES = ['open', 'in_progress', 'completed'];

export function IssuesMgmtTab() {
  const [issues, setIssues] = useState<IssueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('open');
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

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

  async function changeStatus(issue: IssueRow, newStatus: string) {
    // The dashboard does not have a completion-photo upload flow yet. Keep the
    // client from sending an inevitably invalid request (and from showing a
    // misleading status transition if an older API is deployed).
    if (newStatus === 'completed') {
      alert('Completion photo required to close an issue');
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

  const statusLabel: Record<string, string> = { open: t('open'), in_progress: t('inProgress'), completed: t('completed'), all: t('all') };
  const nextStatus: Record<string, string | null> = { open: 'in_progress', in_progress: 'completed', completed: null };

  return (
    <div className="panel panel--flush">
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, flex: 1 }}>{t('adminIssuesMgmt')}</h2>
        <button type="button" className="btn btn--secondary" onClick={() => void exportIssues()} disabled={exporting}>{exporting ? '…' : t('export')}</button>
        <div className="chip-row">
          {['all', ...STATUSES].map((s) => (
            <button key={s} type="button" className={`chip${filter === s ? ' chip--active' : ''}`} onClick={() => setFilter(s)}>
              {statusLabel[s]}
            </button>
          ))}
        </div>
      </div>
      <details style={{ padding: '0 20px 12px', fontSize: 12 }}><summary style={{ cursor: 'pointer', fontWeight: 600 }}>Supported export columns</summary><span className="muted">Plate Number, Fleet, Vehicle Type, Status, Inspector, Inspection Date, Created, Defect 1–3, Repair 1–3.</span></details>
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

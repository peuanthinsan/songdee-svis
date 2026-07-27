import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { fetchIssues, type IssueRow } from '../api';
import { useAuth } from '../AuthContext';
import { t } from '../i18n';
import { PhotoGrid } from '../components/PhotoGrid';

const statuses = ['', 'open', 'in_progress', 'completed'] as const;

function statusLabel(status: string) {
  if (status === 'open') return t('open');
  if (status === 'in_progress') return t('inProgress');
  if (status === 'completed') return t('completed');
  return status;
}

function IssueModal({ issue, onClose }: { issue: IssueRow; onClose: () => void }) {
  const hasPhotos = (issue.defect_photo_urls?.length ?? 0) + (issue.completion_photo_urls?.length ?? 0) > 0;
  return (
    <div
      onClick={onClose}
      style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background:'var(--surface)', borderRadius:16, padding:24, maxWidth:680, width:'100%', maxHeight:'90vh', overflowY:'auto', boxShadow:'0 20px 60px rgba(0,0,0,0.3)' }}
      >
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20 }}>
          <div>
            <h2 style={{ margin:0, fontSize:20 }}>{issue.plate_number}</h2>
            <div style={{ color:'var(--text-secondary)', fontSize:14, marginTop:4 }}>
              {issue.vehicle_fleet || issue.fleet_id || '—'} &bull; {issue.inspection_date || issue.created_at?.slice(0,10)}
              {issue.inspector_name ? ` • ${issue.inspector_name}` : ''}
            </div>
          </div>
          <span className={`badge badge--${issue.status}`} style={{ marginLeft:12 }}>{statusLabel(issue.status)}</span>
        </div>

        {!hasPhotos && (
          <div style={{ color:'var(--text-secondary)', textAlign:'center', padding:'32px 0', fontSize:14 }}>{t('noData')}</div>
        )}

        {(issue.defect_photo_urls?.length ?? 0) > 0 && (
          <div style={{ marginBottom:20 }}>
            <PhotoGrid urls={issue.defect_photo_urls!} label={t('defectPhotos') || 'Defect Photos'} maxThumb={160} />
          </div>
        )}

        {(issue.completion_photo_urls?.length ?? 0) > 0 && (
          <div>
            <PhotoGrid urls={issue.completion_photo_urls!} label={t('completionPhotos') || 'Completion Photos'} maxThumb={160} />
          </div>
        )}

        <div style={{ marginTop:24, display:'flex', justifyContent:'flex-end' }}>
          <button type="button" className="btn btn--ghost" onClick={onClose}>{t('cancel')}</button>
        </div>
      </div>
    </div>
  );
}

export function IssuesPage() {
  const { user, isDashboardUser } = useAuth();
  const [status, setStatus] = useState<(typeof statuses)[number]>('open');
  const [issues, setIssues] = useState<IssueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<IssueRow | null>(null);

  const fleetScope = user?.role === 'admin' ? undefined : user?.fleetId;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const rows = await fetchIssues(status || undefined, fleetScope);
        if (!cancelled) setIssues(rows);
      } catch {
        if (!cancelled) setIssues([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [status, fleetScope]);

  if (!user) return <Navigate to="/login" replace />;
  if (!isDashboardUser) return <Navigate to="/login" replace />;

  return (
    <div className="stack">
      <div className="page-header">
        <h1>{t('issues')}</h1>
      </div>

      <div className="chip-row">
        {statuses.map((s) => (
          <button
            key={s || 'all'}
            type="button"
            className={`chip${status === s ? ' chip--active' : ''}`}
            onClick={() => setStatus(s)}
          >
            {s ? statusLabel(s) : t('all')}
          </button>
        ))}
      </div>

      <div className="panel panel--flush">
        {loading ? (
          <div className="table-empty">{t('signingIn')}</div>
        ) : issues.length === 0 ? (
          <div className="table-empty">{t('noData')}</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('plate')}</th>
                <th>{t('fleet')}</th>
                <th>{t('status')}</th>
                <th>{t('date')}</th>
                <th style={{ textAlign:'center' }}>{t('photos') || '📷'}</th>
              </tr>
            </thead>
            <tbody>
              {issues.map((issue) => {
                const photoCount = (issue.defect_photo_urls?.length ?? 0) + (issue.completion_photo_urls?.length ?? 0);
                return (
                  <tr
                    key={issue.id}
                    onClick={() => setSelected(issue)}
                    style={{ cursor:'pointer' }}
                  >
                    <td>{issue.plate_number}</td>
                    <td>{issue.vehicle_fleet || issue.fleet_id || '—'}</td>
                    <td><span className={`badge badge--${issue.status}`}>{statusLabel(issue.status)}</span></td>
                    <td>{issue.inspection_date || issue.created_at?.slice(0, 10)}</td>
                    <td style={{ textAlign:'center', color: photoCount > 0 ? 'var(--brand-primary)' : 'var(--text-secondary)' }}>
                      {photoCount > 0 ? `📷 ${photoCount}` : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {selected && <IssueModal issue={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

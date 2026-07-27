import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { fetchHistory, fetchInspectionDetail, type HistoryData, type InspectionDetail } from '../api';
import { useAuth } from '../AuthContext';
import { t } from '../i18n';
import { PhotoGrid } from '../components/PhotoGrid';

type Range = 'today' | 'week' | 'month';

function pad2(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

function getDateRange(range: Range) {
  const now = new Date(new Date().getTime() + 7 * 60 * 60 * 1000);
  const endDate = now.toISOString().split('T')[0];
  if (range === 'today') return { startDate: endDate, endDate };
  if (range === 'week') {
    const weekAgo = new Date(now);
    weekAgo.setUTCDate(weekAgo.getUTCDate() - 7);
    return { startDate: weekAgo.toISOString().split('T')[0], endDate };
  }
  const monthAgo = new Date(now);
  monthAgo.setUTCMonth(monthAgo.getUTCMonth() - 1);
  return { startDate: monthAgo.toISOString().split('T')[0], endDate };
}

function InspectionModal({ inspection, onClose }: { inspection: InspectionDetail; onClose: () => void }) {
  const [detail, setDetail] = useState<InspectionDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  async function loadFullDetail() {
    setLoadingDetail(true);
    try {
      const d = await fetchInspectionDetail(inspection.id);
      setDetail(d);
    } catch {
      /* ignore */
    } finally {
      setLoadingDetail(false);
    }
  }

  const globalPhotos = inspection.photo_urls ?? [];
  const odometerPhoto = inspection.odometer_photo_url;
  const itemResults = detail?.results ?? [];
  const failedItems = itemResults.filter((r) => r.result === 'fail');

  return (
    <div
      onClick={onClose}
      style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background:'var(--surface)', borderRadius:16, padding:24, maxWidth:720, width:'100%', maxHeight:'90vh', overflowY:'auto', boxShadow:'0 20px 60px rgba(0,0,0,0.3)' }}
      >
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20 }}>
          <div>
            <h2 style={{ margin:0, fontSize:20 }}>{inspection.plate_number}</h2>
            <div style={{ color:'var(--text-secondary)', fontSize:14, marginTop:4 }}>
              {inspection.inspection_date}
              {inspection.inspector_name ? ` • ${inspection.inspector_name}` : ''}
              {inspection.mileage ? ` • ${inspection.mileage.toLocaleString()} km` : ''}
            </div>
          </div>
          <span className="badge badge--open">{t('failed')}</span>
        </div>

        {globalPhotos.length > 0 && (
          <div style={{ marginBottom:20 }}>
            <PhotoGrid urls={globalPhotos} label={t('photos') || 'Inspection Photos'} maxThumb={140} />
          </div>
        )}

        {odometerPhoto && (
          <div style={{ marginBottom:20 }}>
            <PhotoGrid urls={[odometerPhoto]} label={t('odometerPhoto') || 'Odometer'} maxThumb={200} />
          </div>
        )}

        {!detail ? (
          <div style={{ marginTop:8 }}>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={loadFullDetail}
              disabled={loadingDetail}
              style={{ fontSize:13 }}
            >
              {loadingDetail ? t('signingIn') : (t('viewDetails') || 'Load per-item details')}
            </button>
          </div>
        ) : (
          <div style={{ marginTop:8 }}>
            {failedItems.length > 0 ? (
              <div>
                <div style={{ fontSize:12, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', color:'var(--text-secondary)', marginBottom:12 }}>
                  {t('failedItems') || 'Failed Items'}
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
                  {failedItems.map((item) => (
                    <div key={item.id} style={{ borderLeft:'3px solid var(--color-fail, #ef4444)', paddingLeft:12 }}>
                      <div style={{ fontWeight:600, marginBottom:4 }}>{item.item_name_th} / {item.item_name_en}</div>
                      {item.notes && <div style={{ color:'var(--text-secondary)', fontSize:13, marginBottom:8 }}>{item.notes}</div>}
                      {(item.photo_urls?.length ?? 0) > 0 && (
                        <PhotoGrid urls={item.photo_urls!} maxThumb={100} />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ color:'var(--text-secondary)', fontSize:13 }}>{t('noData')}</div>
            )}
          </div>
        )}

        <div style={{ marginTop:24, display:'flex', justifyContent:'flex-end' }}>
          <button type="button" className="btn btn--ghost" onClick={onClose}>{t('cancel')}</button>
        </div>
      </div>
    </div>
  );
}

export function HistoryPage() {
  const { user, isDashboardUser } = useAuth();
  const [range, setRange] = useState<Range>('today');
  const [history, setHistory] = useState<HistoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<InspectionDetail | null>(null);

  const fleetScope = user?.role === 'admin' ? undefined : user?.fleetId;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { startDate, endDate } = getDateRange(range);
        const data = await fetchHistory(startDate, endDate, fleetScope);
        if (!cancelled) setHistory(data);
      } catch {
        if (!cancelled) setHistory(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [range, fleetScope]);

  if (!user) return <Navigate to="/login" replace />;
  if (!isDashboardUser) return <Navigate to="/login" replace />;

  const failed = history?.inspections.filter((i) => i.overall_status === 'fail').slice(0, 20) || [];

  return (
    <div className="stack">
      <div className="page-header">
        <h1>{t('history')}</h1>
      </div>

      <div className="chip-row">
        {(['today', 'week', 'month'] as Range[]).map((key) => (
          <button
            key={key}
            type="button"
            className={`chip${range === key ? ' chip--active' : ''}`}
            onClick={() => setRange(key)}
          >
            {key === 'today' ? t('today') : key === 'week' ? t('thisWeek') : t('thisMonth')}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="panel centered">{t('signingIn')}</div>
      ) : history ? (
        <>
          <div className="stats panel">
            <div><span>{t('totalInspections')}</span><strong>{history.total}</strong></div>
            <div><span>{t('passed')}</span><strong className="text-pass">{history.passed}</strong></div>
            <div><span>{t('failed')}</span><strong className="text-fail">{history.failed}</strong></div>
          </div>

          <section>
            <h2>{t('failed')}</h2>
            <div className="panel panel--flush">
              {failed.length === 0 ? (
                <div className="table-empty">{t('noInspections')}</div>
              ) : (
                failed.map((ins) => {
                  const photoCount = (ins.photo_urls?.length ?? 0) + (ins.odometer_photo_url ? 1 : 0);
                  return (
                    <div
                      key={ins.id}
                      className="fail-row"
                      onClick={() => setSelected(ins)}
                      style={{ cursor:'pointer' }}
                    >
                      <div>
                        <strong>{ins.plate_number}</strong>
                        <div className="muted">
                          {ins.inspector_name ? `${ins.inspector_name} • ` : ''}
                          {ins.inspection_date}
                          {photoCount > 0 && (
                            <span style={{ marginLeft:8, color:'var(--brand-primary)' }}>
                              {'📷'} {photoCount}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="badge badge--open">{t('failed')}</span>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </>
      ) : (
        <div className="panel centered">{t('noData')}</div>
      )}

      {selected && <InspectionModal inspection={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

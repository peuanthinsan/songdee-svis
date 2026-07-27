import { useEffect, useState } from 'react';
import { AnalyticsData, fetchAdminAnalytics } from '../../api';
import { getLang, t } from '../../i18n';

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 10, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 99, transition: 'width 0.3s' }} />
      </div>
      <span style={{ minWidth: 28, fontSize: 13, textAlign: 'right', fontWeight: 700 }}>{value}</span>
    </div>
  );
}

export function AnalyticsTab() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const lang = getLang();

  useEffect(() => {
    setLoading(true);
    fetchAdminAnalytics(days)
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => { setError(t('error')); setLoading(false); });
  }, [days]);

  const dayOpts: { val: 7 | 30 | 90; label: string }[] = [
    { val: 7, label: t('days7') }, { val: 30, label: t('days30') }, { val: 90, label: t('days90') },
  ];

  return (
    <div className="stack">
      <div className="panel">
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0, flex: 1 }}>{t('adminAnalytics')}</h2>
          <div className="chip-row">
            {dayOpts.map((o) => (
              <button key={o.val} type="button" className={`chip${days === o.val ? ' chip--active' : ''}`} onClick={() => setDays(o.val)}>
                {o.label}
              </button>
            ))}
          </div>
        </div>
        {loading && <p className="muted">{t('loading')}</p>}
        {error && <div className="alert alert--error">{error}</div>}
      </div>

      {data && !loading && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
            <div className="panel">
              <h3 style={{ marginBottom: 16 }}>{t('topFailingVehicles')}</h3>
              {data.topFailingVehicles.length === 0 && <p className="muted">{t('noData')}</p>}
              {data.topFailingVehicles.map((v) => (
                <div key={v.plate_number} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                    <strong>{v.plate_number}</strong>
                    <span className="muted">{v.fleet_id}</span>
                  </div>
                  <Bar value={v.fail_count} max={data.topFailingVehicles[0]?.fail_count || 1} color="var(--status-fail)" />
                </div>
              ))}
            </div>

            <div className="panel">
              <h3 style={{ marginBottom: 16 }}>{t('topFailingItems')}</h3>
              {data.topFailingItems.length === 0 && <p className="muted">{t('noData')}</p>}
              {data.topFailingItems.map((item) => (
                <div key={item.item_name_en} style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 13, marginBottom: 4 }}>
                    <strong>{lang === 'th' ? item.item_name_th : item.item_name_en}</strong>
                  </div>
                  <Bar value={item.fail_count} max={data.topFailingItems[0]?.fail_count || 1} color="#f97316" />
                </div>
              ))}
            </div>
          </div>

          <div className="panel">
            <h3 style={{ marginBottom: 16 }}>{t('fleetComparison')}</h3>
            {data.fleetStats.length === 0 && <p className="muted">{t('noData')}</p>}
            <table className="data-table">
              <thead>
                <tr><th>{t('fleet')}</th><th>{t('totalInspections')}</th><th>{t('passed')}</th><th>{t('failed')}</th><th>%</th></tr>
              </thead>
              <tbody>
                {data.fleetStats.map((f) => (
                  <tr key={f.fleet_id}>
                    <td><strong>{f.fleet_id}</strong></td>
                    <td>{f.total}</td>
                    <td className="text-pass">{f.passed}</td>
                    <td className="text-fail">{f.failed}</td>
                    <td>{f.total > 0 ? Math.round((f.passed / f.total) * 100) : 0}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="panel">
            <h3 style={{ marginBottom: 16 }}>{t('dailyTrend')}</h3>
            {data.dailyTrend.length === 0 && <p className="muted">{t('noData')}</p>}
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr><th>{t('date')}</th><th>{t('passed')}</th><th>{t('failed')}</th><th>{t('totalInspections')}</th></tr>
                </thead>
                <tbody>
                  {data.dailyTrend.slice(-14).map((d) => (
                    <tr key={d.date}>
                      <td>{d.date}</td>
                      <td className="text-pass">{d.passed}</td>
                      <td className="text-fail">{d.failed}</td>
                      <td>{d.passed + d.failed}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

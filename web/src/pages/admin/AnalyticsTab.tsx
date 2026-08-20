import { useEffect, useState } from 'react';
import { AnalyticsData, fetchAdminAnalytics } from '../../api';
import { getLang, t } from '../../i18n';
import { downloadCsv } from '../../data-export';

type AnalyticsPeriod = 'all' | 'today' | 'week' | 'month' | 'custom';

function localDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function periodDates(period: AnalyticsPeriod, customStart: string, customEnd: string) {
  if (period === 'all') return { allTime: true as const };
  const today = new Date();
  const end = localDate(today);
  if (period === 'today') return { dateStart: end, dateEnd: end };
  if (period === 'custom') return { dateStart: customStart, dateEnd: customEnd };
  const start = new Date(today);
  if (period === 'week') start.setDate(start.getDate() - 7);
  if (period === 'month') start.setMonth(start.getMonth() - 1);
  return { dateStart: localDate(start), dateEnd: end };
}

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

function MetricCard({ value, label, help, tone }: { value: string | number; label: string; help: string; tone?: 'pass' | 'fail' }) {
  return (
    <div className="metric" title={help}>
      <strong className={tone ? `text-${tone}` : undefined}>{value}</strong>
      <span>{label}</span>
      <small className="muted" style={{ display: 'block', marginTop: 5, fontSize: 11, lineHeight: 1.35, textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>{help}</small>
    </div>
  );
}

export function AnalyticsTab() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [period, setPeriod] = useState<AnalyticsPeriod>('month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const lang = getLang();

  function exportAnalytics() {
    if (!data) return;
    downloadCsv(`analytics-${period}.csv`, ['section', 'name', 'fleet', 'passed', 'failed', 'total', 'rate', 'date'], [
      ...data.topFailingVehicles.map((v) => ['Top failing vehicle', v.plate_number, v.fleet_id, '', v.fail_count, v.inspection_count, `${v.fail_rate}%`, v.last_failed_date || '']),
      ...data.topFailingItems.map((v) => ['Top failing checklist item', v.item_name_en, '', '', v.fail_count, '', '', '']),
      ...data.fleetStats.map((v) => ['Fleet comparison', '', v.fleet_id, v.passed, v.failed, v.total, v.total > 0 ? `${Math.round((v.passed / v.total) * 100)}%` : '0%', '']),
      ...data.dailyTrend.map((v) => ['Daily trend', '', '', v.passed, v.failed, v.passed + v.failed, v.passed + v.failed > 0 ? `${Math.round((v.passed / (v.passed + v.failed)) * 100)}%` : '0%', v.date]),
    ]);
  }

  useEffect(() => {
    setLoading(true);
    const dates = periodDates(period, customStart, customEnd);
    if (period === 'custom' && (!dates.dateStart || !dates.dateEnd || dates.dateStart > dates.dateEnd)) return;
    fetchAdminAnalytics(dates)
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => { setError(t('error')); setLoading(false); });
  }, [period, customStart, customEnd]);

  const periodOpts: { val: AnalyticsPeriod; label: string }[] = [
    { val: 'all', label: t('allTime') },
    { val: 'today', label: t('today') },
    { val: 'week', label: t('thisWeek') },
    { val: 'month', label: t('thisMonth') },
    { val: 'custom', label: t('customRange') },
  ];

  return (
    <div className="stack">
      <div className="panel">
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0, flex: 1 }}>{t('adminAnalytics')}</h2>
          <button type="button" className="btn btn--secondary" onClick={exportAnalytics} disabled={loading || !data}>{t('export')}</button>
          <div className="chip-row">
            {periodOpts.map((o) => (
              <button key={o.val} type="button" className={`chip${period === o.val ? ' chip--active' : ''}`} onClick={() => setPeriod(o.val)}>
                {o.label}
              </button>
            ))}
          </div>
        </div>
        {period === 'custom' && (
          <div style={{ display: 'flex', gap: 12, alignItems: 'end', flexWrap: 'wrap', marginBottom: 16 }}>
            <label className="maintenance-editor-field">{t('startDate')}<input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} /></label>
            <label className="maintenance-editor-field">{t('endDate')}<input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} /></label>
            {customStart && customEnd && customStart > customEnd && <span className="text-fail">{t('startAfterEnd')}</span>}
          </div>
        )}
        <details style={{ fontSize: 12, marginBottom: 12 }}><summary style={{ cursor: 'pointer', fontWeight: 600 }}>{t('analyticsHowToRead')}</summary><span className="muted">{t('analyticsHowToReadText')}</span></details>
        {loading && <p className="muted">{t('loading')}</p>}
        {error && <div className="alert alert--error">{error}</div>}
      </div>

      {data && !loading && (
        <>
          <div className="panel">
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0 }}>{t('analyticsSummary')}</h3>
              <span className="muted">{t('denominatorNote')}</span>
            </div>
            <div className="metric-grid">
              <MetricCard value={data.summary.totalInspections} label={t('totalInspections')} help={t('totalInspectionsHelp')} />
              <MetricCard value={`${data.summary.passRate}%`} label={t('passRate')} help={t('passRateHelp')} tone="pass" />
              <MetricCard value={data.summary.openIssues} label={t('openIssues')} help={t('openIssuesHelp')} tone="fail" />
              <MetricCard value={data.summary.activeVehicles} label={t('activeVehicles')} help={t('activeVehiclesHelp')} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
            <div className="panel">
              <h3 style={{ marginBottom: 16 }}>{t('topFailingVehicles')}</h3>
              <p className="muted" style={{ marginTop: -8, fontSize: 12 }}>{t('topFailingVehiclesHelp')}</p>
              {data.topFailingVehicles.length === 0 && <p className="muted">{t('noData')}</p>}
              {data.topFailingVehicles.map((v) => (
                <div key={v.plate_number} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                    <strong>{v.plate_number}</strong>
                    <span className="muted">{v.fleet_id}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                    <span className="text-fail">{v.fail_rate}% {t('failureRate').toLowerCase()}</span>
                    <span className="muted">{v.fail_count}/{v.inspection_count} · {v.last_failed_date || '—'}</span>
                  </div>
                  <Bar value={v.fail_rate} max={100} color="var(--status-fail)" />
                </div>
              ))}
            </div>

            <div className="panel">
              <h3 style={{ marginBottom: 16 }}>{t('topFailingItems')}</h3>
              <p className="muted" style={{ marginTop: -8, fontSize: 12 }}>{t('topFailingItemsHelp')}</p>
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
            <p className="muted" style={{ marginTop: -8, fontSize: 12 }}>{t('fleetComparisonHelp')}</p>
            {data.fleetStats.length === 0 && <p className="muted">{t('noData')}</p>}
            <table className="data-table">
              <thead>
                <tr><th>{t('fleet')}</th><th>{t('activeVehicles')}</th><th>{t('totalInspections')}</th><th>{t('passed')}</th><th>{t('failed')}</th><th>{t('passRate')}</th></tr>
              </thead>
              <tbody>
                {data.fleetStats.map((f) => (
                  <tr key={f.fleet_id}>
                    <td><strong>{f.fleet_id}</strong></td>
                    <td>{f.active_vehicles}</td>
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
            <p className="muted" style={{ marginTop: -8, fontSize: 12 }}>{t('dailyTrendHelp')}</p>
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

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
            <div className="panel">
              <h3 style={{ marginBottom: 16 }}>{t('completionTrend')}</h3>
              <p className="muted" style={{ marginTop: -8, fontSize: 12 }}>{t('completionTrendHelp')}</p>
              {data.completionTrend.length === 0 && <p className="muted">{t('noData')}</p>}
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table">
                  <thead><tr><th>{t('date')}</th><th>{t('checked')}</th><th>{t('activeVehicles')}</th><th>%</th></tr></thead>
                  <tbody>{data.completionTrend.slice(-14).map((d) => <tr key={d.date}><td>{d.date}</td><td>{d.inspected}</td><td>{d.total}</td><td>{d.rate}%</td></tr>)}</tbody>
                </table>
              </div>
            </div>
            <div className="panel">
              <h3 style={{ marginBottom: 16 }}>{t('resolutionTrend')}</h3>
              <p className="muted" style={{ marginTop: -8, fontSize: 12 }}>{t('resolutionTrendHelp')}</p>
              {data.resolutionTrend.length === 0 && <p className="muted">{t('noData')}</p>}
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table">
                  <thead><tr><th>{t('date')}</th><th>{t('resolutionTrend')}</th><th>{t('completed')}</th></tr></thead>
                  <tbody>{data.resolutionTrend.slice(-8).map((d) => <tr key={d.period}><td>{d.period}</td><td>{Number(d.avg_hours).toFixed(1)}h</td><td>{d.count}</td></tr>)}</tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

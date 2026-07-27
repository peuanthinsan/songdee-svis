import type { FleetStat } from '../api';

export function FleetRow({ fleet }: { fleet: FleetStat }) {
  const pct = fleet.total > 0 ? Math.round((fleet.checked / fleet.total) * 100) : 0;
  const isComplete = pct === 100;
  const isZero = pct === 0;
  const barColor = isComplete ? 'var(--status-pass)' : isZero ? 'var(--status-fail)' : 'var(--brand-primary)';

  return (
    <div className={`fleet-row${isComplete ? ' fleet-row--complete' : ''}`}>
      <div className="fleet-row__info">
        <div className={`fleet-row__code${isZero ? ' fleet-row__code--urgent' : ''}`}>{fleet.fleetId}</div>
        <div className="fleet-row__bar">
          <div className="fleet-row__bar-fill" style={{ width: `${pct}%`, backgroundColor: barColor }} />
        </div>
      </div>
      <div className="fleet-row__numbers">{fleet.checked}/{fleet.total}</div>
      <div
        className="fleet-row__pct"
        style={{ color: isComplete ? 'var(--status-pass)' : isZero ? 'var(--status-fail)' : 'var(--text-primary)' }}
      >
        {pct}%
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';

type DateRangePickerProps = {
  start: string;
  end: string;
  onChange: (range: { start: string; end: string }) => void;
  startLabel: string;
  endLabel: string;
  placeholder: string;
};

export function DateRangePicker({ start, end, onChange, startLabel, endLabel, placeholder }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  const label = start && end ? `${start} – ${end}` : placeholder;

  return (
    <div className="date-range-picker" ref={rootRef}>
      <button type="button" className={`date-range-picker__trigger${start && end ? ' date-range-picker__trigger--active' : ''}`} onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 10h18" /></svg>
        <span>{label}</span><span aria-hidden="true">⌄</span>
      </button>
      {open && (
        <div className="date-range-picker__popover" role="dialog" aria-label={placeholder}>
          <div className="date-range-picker__fields">
            <label><span>{startLabel}</span><input type="date" value={start} onChange={(event) => onChange({ start: event.target.value, end })} /></label>
            <span className="date-range-picker__dash" aria-hidden="true">–</span>
            <label><span>{endLabel}</span><input type="date" value={end} min={start || undefined} onChange={(event) => onChange({ start, end: event.target.value })} /></label>
          </div>
          <button type="button" className="date-range-picker__clear" onClick={() => { onChange({ start: '', end: '' }); setOpen(false); }}>Clear</button>
        </div>
      )}
    </div>
  );
}

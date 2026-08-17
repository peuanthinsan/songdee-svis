const THAI_OFFSET_MS = 7 * 60 * 60 * 1000;

function parseDateOnly(value: string): { day: number; month: number; year: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

/** Format a calendar date as DD/MM/YYYY using the app's Thai display convention. */
export function formatDateThai(value: string | Date | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'string') {
    const dateOnly = parseDateOnly(value);
    if (dateOnly) {
      return `${String(dateOnly.day).padStart(2, '0')}/${String(dateOnly.month).padStart(2, '0')}/${dateOnly.year + 543}`;
    }
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const thai = new Date(date.getTime() + THAI_OFFSET_MS);
  return `${String(thai.getUTCDate()).padStart(2, '0')}/${String(thai.getUTCMonth() + 1).padStart(2, '0')}/${thai.getUTCFullYear() + 543}`;
}

/** Format a timestamp as DD/MM/YYYY HH:mm in Thailand time. */
export function formatDateTimeThai(value: string | Date | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const thai = new Date(date.getTime() + THAI_OFFSET_MS);
  return `${formatDateThai(date)} ${String(thai.getUTCHours()).padStart(2, '0')}:${String(thai.getUTCMinutes()).padStart(2, '0')}`;
}

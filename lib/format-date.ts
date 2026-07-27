/**
 * Get today's date in Thailand timezone (UTC+7) as YYYY-MM-DD string.
 * Works on both client and server.
 */
export function getTodayThai(): string {
  const now = new Date();
  const thai = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  return thai.toISOString().split('T')[0];
}

/**
 * Get Monday of the current week in Thailand timezone as YYYY-MM-DD string.
 */
export function getMondayOfWeekThai(): string {
  const now = new Date();
  const thai = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const day = thai.getUTCDay();
  const diff = day === 0 ? 6 : day - 1;
  thai.setUTCDate(thai.getUTCDate() - diff);
  return thai.toISOString().split('T')[0];
}

/**
 * Format a date string to Thai format: DD/MM/YYYY
 * Accepts ISO strings, date strings (YYYY-MM-DD), or Date objects
 */
export function formatDate(dateStr: string | Date): string {
  const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  if (isNaN(d.getTime())) return String(dateStr);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Format a date string to Thai format with Buddhist year: DD/MM/BBBB
 */
export function formatDateThai(dateStr: string | Date): string {
  const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  if (isNaN(d.getTime())) return String(dateStr);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const buddhistYear = d.getFullYear() + 543;
  return `${day}/${month}/${buddhistYear}`;
}

/**
 * Format a datetime string to Thai format with time: DD/MM/BBBB HH:MM
 * Shows time in Thailand timezone (UTC+7)
 */
export function formatDateTimeThai(dateStr: string | Date): string {
  const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  if (isNaN(d.getTime())) return String(dateStr);
  // Convert to Thai timezone
  const thai = new Date(d.getTime() + 7 * 60 * 60 * 1000);
  const day = String(thai.getUTCDate()).padStart(2, '0');
  const month = String(thai.getUTCMonth() + 1).padStart(2, '0');
  const buddhistYear = thai.getUTCFullYear() + 543;
  const hours = String(thai.getUTCHours()).padStart(2, '0');
  const minutes = String(thai.getUTCMinutes()).padStart(2, '0');
  return `${day}/${month}/${buddhistYear} ${hours}:${minutes}`;
}

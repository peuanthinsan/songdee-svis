/**
 * Get today's date in Thailand timezone (UTC+7) as YYYY-MM-DD string.
 * Used server-side to ensure inspection dates match Bangkok time.
 */
export function getTodayThai(): string {
  const now = new Date();
  // Thailand is UTC+7
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

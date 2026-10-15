import type { DateFormat } from '../types';

export const DEFAULT_DATE_FORMAT: DateFormat = 'dmy';

export const DATE_FORMATS: { id: DateFormat; label: string }[] = [
  { id: 'dmy', label: '15/10/2026 (day first)' },
  { id: 'mdy', label: '10/15/2026 (month first)' },
  { id: 'long', label: '15 Oct 2026' },
  { id: 'ymd', label: '2026-10-15' },
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Formats a date the same way on every device, whatever its regional settings.
 * Calendar dates (issued, due, delivery) are stored as UTC midnight, so they are read in UTC;
 * otherwise a phone behind UTC would show the previous day. Pass `{ moment: true }` for
 * real timestamps (payment times, backups), which are read in local time.
 */
export function formatDate(date: Date | string | number, format: DateFormat = DEFAULT_DATE_FORMAT, { moment = false } = {}): string {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  const year = moment ? d.getFullYear() : d.getUTCFullYear();
  const month = moment ? d.getMonth() : d.getUTCMonth();
  const day = moment ? d.getDate() : d.getUTCDate();
  switch (format) {
    case 'mdy': return `${pad(month + 1)}/${pad(day)}/${year}`;
    case 'ymd': return `${year}-${pad(month + 1)}-${pad(day)}`;
    case 'long': return `${day} ${MONTHS[month]} ${year}`;
    default: return `${pad(day)}/${pad(month + 1)}/${year}`;
  }
}

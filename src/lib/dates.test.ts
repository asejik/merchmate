import { describe, expect, it } from 'vitest';
import { formatDate } from './dates';

describe('formatDate', () => {
  const issued = new Date('2026-10-05T00:00:00Z'); // calendar dates are stored as UTC midnight

  it('supports each format, day first by default', () => {
    expect(formatDate(issued)).toBe('05/10/2026');
    expect(formatDate(issued, 'mdy')).toBe('10/05/2026');
    expect(formatDate(issued, 'ymd')).toBe('2026-10-05');
    expect(formatDate(issued, 'long')).toBe('5 Oct 2026');
  });

  it('reads calendar dates in UTC so they never shift a day', () => {
    expect(formatDate('2026-12-31T00:00:00.000Z', 'ymd')).toBe('2026-12-31');
  });

  it('reads timestamps in local time', () => {
    const late = new Date(2026, 9, 5, 23, 30); // 11:30pm local
    expect(formatDate(late, 'ymd', { moment: true })).toBe('2026-10-05');
  });

  it('returns empty text for invalid dates', () => {
    expect(formatDate('nonsense')).toBe('');
  });
});

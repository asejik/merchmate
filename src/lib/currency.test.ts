import { describe, expect, it } from 'vitest';
import { formatMoney } from './currency';

describe('formatMoney', () => {
  it('always shows two decimals by default', () => {
    expect(formatMoney(1000, 'NGN')).toBe('₦1,000.00');
    expect(formatMoney(1234.5, 'USD')).toBe('$1,234.50');
  });

  it('uses the ISO code for PDFs', () => {
    expect(formatMoney(1000, 'NGN', { code: true })).toBe('NGN 1,000.00');
  });

  it('can drop the zeros of a whole amount, and only then', () => {
    expect(formatMoney(205000, 'NGN', { trimZeros: true })).toBe('₦205,000');
    expect(formatMoney(205000.5, 'NGN', { trimZeros: true })).toBe('₦205,000.50');
    expect(formatMoney(0, 'GBP', { trimZeros: true })).toBe('£0');
    expect(formatMoney(-1500, 'EUR', { trimZeros: true })).toBe('-€1,500');
    expect(formatMoney(0.999, 'NGN', { trimZeros: true })).toBe('₦1');
  });

  it('shows zero for a value that is not a number', () => {
    expect(formatMoney(Number.NaN, 'NGN')).toBe('₦0.00');
  });
});

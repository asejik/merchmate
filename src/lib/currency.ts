import type { CurrencyCode } from '../types';

export const CURRENCY_CODES: CurrencyCode[] = ['NGN', 'USD', 'GBP', 'EUR'];

export const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
  NGN: '₦',
  USD: '$',
  GBP: '£',
  EUR: '€',
};

const numberFormat = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const wholeFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

interface FormatOptions {
  /** Use the ISO code ("NGN 1,000.00") instead of the symbol. Required in PDFs: Helvetica has no ₦ glyph. */
  code?: boolean;
  /** Drop the ".00" when there are no kobo or cents ("₦1,000"). For overviews; documents and lists keep both digits. */
  trimZeros?: boolean;
}

/** Amount without currency, e.g. "1,234.50" (for table cells). */
export function formatAmount(amount: number): string {
  return numberFormat.format(Number.isFinite(amount) ? amount : 0);
}

export function formatMoney(amount: number, currency: CurrencyCode, { code = false, trimZeros = false }: FormatOptions = {}): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  const sign = safe < 0 ? '-' : '';
  const hundredths = Math.round(Math.abs(safe) * 100);
  const digits = trimZeros && hundredths % 100 === 0 ? wholeFormat.format(hundredths / 100) : formatAmount(Math.abs(safe));
  return code ? `${sign}${currency} ${digits}` : `${sign}${CURRENCY_SYMBOLS[currency]}${digits}`;
}

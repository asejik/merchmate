export const DEFAULT_BRAND_COLOR = '#4F46E5';

export function isHexColor(value: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(value);
}

/** Relative luminance (WCAG). */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map(i => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** White or near-black text, whichever contrasts more with the background. */
export function readableTextColor(background: string): '#FFFFFF' | '#111827' {
  const bg = isHexColor(background) ? background : DEFAULT_BRAND_COLOR;
  const l = luminance(bg);
  const contrastWhite = 1.05 / (l + 0.05);
  const contrastDark = (l + 0.05) / (luminance('#111827') + 0.05);
  return contrastWhite >= contrastDark ? '#FFFFFF' : '#111827';
}

/** Brand colour mixed with white, for light tints (table headers, boxes). */
export function tint(hex: string, amount: number): string {
  const base = isHexColor(hex) ? hex : DEFAULT_BRAND_COLOR;
  const mix = [1, 3, 5].map(i => {
    const c = parseInt(base.slice(i, i + 2), 16);
    return Math.round(c + (255 - c) * amount).toString(16).padStart(2, '0');
  });
  return `#${mix.join('')}`;
}

export interface PdfTheme {
  accent: string;
  onAccent: string; // text colour on an accent background
  tint: string; // very light accent for table headers and boxes
  modern: boolean;
}

export function pdfTheme(business: { brandColor?: string; invoiceTemplate?: string }): PdfTheme {
  const accent = business.brandColor && isHexColor(business.brandColor) ? business.brandColor : DEFAULT_BRAND_COLOR;
  return { accent, onAccent: readableTextColor(accent), tint: tint(accent, 0.92), modern: business.invoiceTemplate === 'modern' };
}

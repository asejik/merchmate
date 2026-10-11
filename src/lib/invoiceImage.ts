import type { BusinessProfile, Customer, Invoice } from '../types';
import { formatMoney } from './currency';
import { getBalance, isQuote } from './invoice';
import { pdfTheme } from './color';

// A phone-shaped PNG of the invoice. WhatsApp previews images inline, unlike PDFs.
// Drawn on a canvas (no extra library, works offline); unlike the PDF, system fonts have the ₦ glyph.

const WIDTH = 1080;
const PAD = 64;
const MAX_ITEMS = 14;
const FONT = 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const INK = '#111827';
const MUTED = '#6B7280';
const RULE = '#E5E7EB';

const formatDay = (date: Date | string) =>
  new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null); // a broken logo should never block the invoice
    img.src = src;
  });
}

/** Shortens text with an ellipsis to fit maxWidth. */
function fit(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let end = text.length;
  while (end > 0 && ctx.measureText(`${text.slice(0, end)}…`).width > maxWidth) end--;
  return `${text.slice(0, end)}…`;
}

/** Draws the whole invoice and returns the height used. Called once to measure, once to paint. */
function draw(ctx: CanvasRenderingContext2D, invoice: Invoice, business: BusinessProfile, customer: Customer, logo: HTMLImageElement | null): number {
  const quote = isQuote(invoice);
  const theme = pdfTheme(business);
  const money = (value: number) => formatMoney(value, invoice.currency);
  const balance = getBalance(invoice);
  const right = WIDTH - PAD;

  /** Largest font size (down to min) at which the text fits maxWidth. */
  const fittingSize = (value: string, size: number, min: number, maxWidth: number, bold = true) => {
    for (; size > min; size -= 2) {
      ctx.font = `${bold ? 700 : 400} ${size}px ${FONT}`;
      if (ctx.measureText(value).width <= maxWidth) break;
    }
    return size;
  };
  const text = (value: string, x: number, y: number, size: number, opts: { color?: string; bold?: boolean; align?: CanvasTextAlign; maxWidth?: number } = {}) => {
    ctx.font = `${opts.bold ? 700 : 400} ${size}px ${FONT}`;
    ctx.fillStyle = opts.color ?? INK;
    ctx.textAlign = opts.align ?? 'left';
    ctx.fillText(opts.maxWidth ? fit(ctx, value, opts.maxWidth) : value, x, y);
  };
  const rule = (y: number) => {
    ctx.fillStyle = RULE;
    ctx.fillRect(PAD, y, WIDTH - PAD * 2, 2);
  };

  // Header band in the brand colour
  const logoSize = logo ? 120 : 0;
  const bandHeight = 215 + (logo ? logoSize - 40 : 0);
  ctx.fillStyle = theme.accent;
  ctx.fillRect(0, 0, WIDTH, bandHeight);
  let y = 72;
  if (logo) {
    const scale = Math.min(logoSize / logo.width, logoSize / logo.height);
    ctx.drawImage(logo, PAD, y - 16, logo.width * scale, logo.height * scale);
    y += logoSize - 16;
  }
  const nameWidth = WIDTH * 0.58;
  text(business.businessName, PAD, y + 40, fittingSize(business.businessName, 46, 30, nameWidth), { color: theme.onAccent, bold: true, maxWidth: nameWidth });
  text(business.phone, PAD, y + 92, 30, { color: theme.onAccent });
  text(quote ? 'QUOTE' : 'INVOICE', right, 112, 54, { color: theme.onAccent, bold: true, align: 'right' });
  text(`#${invoice.invoiceNumber}`, right, 164, 32, { color: theme.onAccent, align: 'right', maxWidth: WIDTH * 0.35 });

  // Who and when
  y = bandHeight + 76;
  text(quote ? 'PREPARED FOR' : 'BILLED TO', PAD, y, 24, { color: MUTED, bold: true });
  text(customer.name, PAD, y + 48, 38, { bold: true, maxWidth: WIDTH * 0.5 });
  const dates: [string, Date][] = [[quote ? 'Date' : 'Issued', invoice.dateIssued]];
  if (invoice.dueDate && (quote || balance > 0)) dates.push([quote ? 'Valid until' : 'Due', invoice.dueDate]);
  if (invoice.deliveryDate) dates.push([quote ? 'Est. delivery' : 'Delivery', invoice.deliveryDate]);
  dates.forEach(([label, date], i) => {
    text(`${label}: ${formatDay(date)}`, right, y + i * 42, 28, { color: i === 0 ? MUTED : INK, align: 'right' });
  });
  y += Math.max(72, dates.length * 42) + 40;

  // Items
  rule(y);
  y += 24;
  const shown = invoice.items.slice(0, MAX_ITEMS);
  for (const item of shown) {
    text(item.description, PAD, y + 36, 32, { maxWidth: WIDTH * 0.58 });
    text(money(item.total), right, y + 36, 32, { bold: true, align: 'right' });
    if (item.quantity !== 1) {
      text(`${Number(item.quantity.toFixed(4))} × ${money(item.unitPrice)}`, PAD, y + 76, 26, { color: MUTED });
      y += 40;
    }
    y += 64;
  }
  const hidden = invoice.items.length - shown.length;
  if (hidden > 0) {
    text(`+ ${hidden} more item${hidden === 1 ? '' : 's'} (see the PDF)`, PAD, y + 36, 28, { color: MUTED });
    y += 64;
  }
  y += 12;
  rule(y);
  y += 24;

  // Totals
  const totalRow = (label: string, value: string, opts: { bold?: boolean; size?: number; color?: string } = {}) => {
    const size = opts.size ?? 30;
    text(label, right - 470, y + size + 6, size, { color: opts.color ?? MUTED, bold: opts.bold });
    text(value, right, y + size + 6, size, { color: opts.color ?? INK, bold: opts.bold, align: 'right' });
    y += size + 24;
  };
  if (invoice.discount > 0 || invoice.tax > 0) totalRow('Subtotal', money(invoice.subtotal));
  if (invoice.discount > 0) totalRow('Discount', `-${money(invoice.discount)}`);
  if (invoice.tax > 0) totalRow(`${invoice.taxLabel || 'Tax'} (${invoice.taxRate ?? 0}%)`, money(invoice.tax));
  totalRow('Total', money(invoice.grandTotal), { bold: true, size: 36, color: INK });
  if (!quote && invoice.depositAmount > 0) totalRow('Paid', money(Math.min(invoice.depositAmount, invoice.grandTotal)));

  // Balance (or paid) banner
  if (!quote) {
    y += 16;
    const paid = balance <= 0;
    ctx.fillStyle = paid ? '#DCFCE7' : theme.tint;
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(PAD, y, WIDTH - PAD * 2, 110, 20);
      ctx.fill();
    } else {
      ctx.fillRect(PAD, y, WIDTH - PAD * 2, 110); // Safari < 16
    }
    text(paid ? 'PAID IN FULL' : 'Balance due', PAD + 36, y + 68, 34, { bold: true, color: paid ? '#15803D' : INK });
    if (!paid) text(money(balance), right - 36, y + 70, 44, { bold: true, align: 'right', color: INK });
    y += 110;

    // Payment details, large enough to read off a phone
    if (!paid && business.bankName && business.accountNumber) {
      y += 56;
      text('PAY TO', PAD, y, 24, { color: MUTED, bold: true });
      text(business.accountNumber, PAD, y + 60, 48, { bold: true });
      text(`${business.bankName} · ${business.accountName}`, PAD, y + 108, 30, { color: MUTED, maxWidth: WIDTH - PAD * 2 });
      y += 120;
    }
  }

  if (invoice.notes) {
    y += 56;
    text(invoice.notes.replace(/\s+/g, ' '), PAD, y, 28, { color: MUTED, maxWidth: WIDTH - PAD * 2 });
  }

  return y + PAD;
}

export async function renderInvoiceImage(invoice: Invoice, business: BusinessProfile, customer: Customer): Promise<Blob> {
  const logo = business.logoUrl ? await loadImage(business.logoUrl) : null;
  await document.fonts?.ready;

  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = 4000; // generous scratch height for measuring
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser cannot draw images.');
  const height = Math.ceil(draw(ctx, invoice, business, customer, logo));

  canvas.height = height; // resizing clears the canvas
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, WIDTH, height);
  draw(ctx, invoice, business, customer, logo);

  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error('Could not create the image.'))), 'image/png');
  });
}

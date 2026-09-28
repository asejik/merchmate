import type { DiscountType, Invoice, InvoiceStatus, PaymentRecord } from '../types';

export const DEFAULT_INVOICE_TERMS = 'Payment is due by the date shown on this invoice.\nThank you for your business.';

/** Rounds to 2 decimal places so floating point noise (0.1 + 0.2) never reaches stored totals. */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Coerces form input (string, NaN, undefined) to a finite number, defaulting to 0. */
export function toNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function lineTotal(quantity: unknown, unitPrice: unknown): number {
  return round2(toNumber(quantity) * toNumber(unitPrice));
}

export interface TotalsInput {
  items: { quantity: unknown; unitPrice: unknown }[];
  discountType: DiscountType;
  discountRate: unknown;
  amountPaid: unknown;
}

export interface Totals {
  subtotal: number;
  discount: number;
  grandTotal: number;
  balance: number;
}

export function calculateTotals({ items, discountType, discountRate, amountPaid }: TotalsInput): Totals {
  const subtotal = round2(items.reduce((sum, item) => sum + lineTotal(item.quantity, item.unitPrice), 0));
  const rate = Math.max(0, toNumber(discountRate));

  const discount = discountType === 'fixed'
    ? Math.min(round2(rate), subtotal)
    : round2(subtotal * (Math.min(rate, 100) / 100));

  const grandTotal = round2(subtotal - discount);
  const balance = Math.max(0, round2(grandTotal - toNumber(amountPaid)));

  return { subtotal, discount, grandTotal, balance };
}

export function deriveStatus(grandTotal: number, amountPaid: number): InvoiceStatus {
  if (amountPaid >= grandTotal) return 'paid';
  if (amountPaid > 0) return 'partial';
  return 'pending';
}

export function getBalance(invoice: Pick<Invoice, 'grandTotal' | 'depositAmount'>): number {
  return Math.max(0, round2(invoice.grandTotal - invoice.depositAmount));
}

/** Cash actually received against this invoice (overpayments are not counted as revenue). */
export function getAmountCollected(invoice: Pick<Invoice, 'grandTotal' | 'depositAmount'>): number {
  return Math.min(invoice.depositAmount, invoice.grandTotal);
}

/**
 * Invoices created before payment tracking have a depositAmount but no payments array.
 * Synthesize a single record for them so every screen shows the same history.
 */
export function getPaymentHistory(invoice: Pick<Invoice, 'payments' | 'depositAmount' | 'dateIssued'>): PaymentRecord[] {
  if (invoice.payments) return invoice.payments;
  if (invoice.depositAmount <= 0) return [];
  return [{
    id: 'legacy',
    date: new Date(invoice.dateIssued).toISOString(),
    amount: invoice.depositAmount,
    note: 'Initial Deposit',
  }];
}

export function applyPayment(
  invoice: Invoice,
  amount: number,
  note: string,
  now: Date = new Date(),
): Pick<Invoice, 'depositAmount' | 'payments' | 'status' | 'updatedAt'> {
  const depositAmount = round2(invoice.depositAmount + amount);
  const payment: PaymentRecord = {
    id: crypto.randomUUID(),
    date: now.toISOString(),
    amount: round2(amount),
    note: note.trim() || 'Payment',
  };

  return {
    depositAmount,
    payments: [...getPaymentHistory(invoice), payment],
    status: deriveStatus(invoice.grandTotal, depositAmount),
    updatedAt: now,
  };
}

/** Dexie v2 upgrade: invoices saved before v2 have no createdAt. */
export function backfillCreatedAt(invoice: Partial<Pick<Invoice, 'createdAt' | 'updatedAt' | 'dateIssued'>>): void {
  if (!invoice.createdAt) {
    invoice.createdAt = invoice.updatedAt ?? invoice.dateIssued ?? new Date();
  }
}

/** Next number after the highest trailing number in use, e.g. ["INV-009", "INV-010"] -> "INV-011". */
export function nextInvoiceNumber(existingNumbers: string[], prefix = 'INV-'): string {
  const highest = existingNumbers.reduce((max, value) => {
    const match = value.match(/(\d+)\s*$/);
    return match ? Math.max(max, parseInt(match[1], 10)) : max;
  }, 0);
  return `${prefix}${String(highest + 1).padStart(3, '0')}`;
}

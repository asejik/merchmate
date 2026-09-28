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
  taxRate?: unknown;
  amountPaid: unknown;
}

export interface Totals {
  subtotal: number;
  discount: number;
  tax: number;
  grandTotal: number;
  balance: number;
}

const clampPercent = (value: unknown) => Math.min(100, Math.max(0, toNumber(value)));

/** subtotal -> discount (capped at subtotal) -> tax on the discounted amount -> grand total. */
export function calculateTotals({ items, discountType, discountRate, taxRate, amountPaid }: TotalsInput): Totals {
  const subtotal = round2(items.reduce((sum, item) => sum + lineTotal(item.quantity, item.unitPrice), 0));
  const rate = Math.max(0, toNumber(discountRate));

  const discount = discountType === 'fixed'
    ? Math.min(round2(rate), subtotal)
    : round2(subtotal * (Math.min(rate, 100) / 100));

  const taxable = round2(subtotal - discount);
  const tax = round2(taxable * (clampPercent(taxRate) / 100));
  const grandTotal = round2(taxable + tax);
  const balance = Math.max(0, round2(grandTotal - toNumber(amountPaid)));

  return { subtotal, discount, tax, grandTotal, balance };
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

// ---------- Dates ----------
// Dates entered in forms are calendar days ("YYYY-MM-DD"), stored as UTC midnight.

/** Date -> "YYYY-MM-DD" for <input type="date">. */
export function toDateInputValue(date: Date | string): string {
  return new Date(date).toISOString().slice(0, 10);
}

/** Today's calendar date in the user's local timezone, as "YYYY-MM-DD". */
export function todayInputValue(now: Date = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

export function addDays(dateInput: string, days: number): string {
  const date = new Date(dateInput);
  date.setUTCDate(date.getUTCDate() + days);
  return toDateInputValue(date);
}

export function daysBetween(fromInput: string, toInput: string): number {
  return Math.round((new Date(toInput).getTime() - new Date(fromInput).getTime()) / 86_400_000);
}

export type DisplayStatus = InvoiceStatus | 'overdue';

export function isOverdue(invoice: Pick<Invoice, 'status' | 'dueDate'>, today: string = todayInputValue()): boolean {
  return invoice.status !== 'paid' && !!invoice.dueDate && toDateInputValue(invoice.dueDate) < today;
}

/** Overdue is derived from dueDate at read time, never stored. */
export function getDisplayStatus(invoice: Pick<Invoice, 'status' | 'dueDate'>, today?: string): DisplayStatus {
  return isOverdue(invoice, today) ? 'overdue' : invoice.status;
}

// ---------- Invoice form <-> stored invoice ----------

export interface InvoiceDraft {
  customerId: string;
  invoiceNumber: string;
  currency: Invoice['currency'];
  dateIssued: string;
  dueDate: string; // '' = no due date
  items: { description: string; quantity: number; unitPrice: number }[];
  discountType: DiscountType;
  discountRate: number;
  taxRate: number;
  taxLabel: string;
  notes: string;
  depositAmount: number; // Only used when creating; edits keep the recorded payments
}

/** Builds the invoice to store. With `existing`, keeps its identity and payment history. */
export function composeInvoice(draft: InvoiceDraft, existing?: Invoice, now: Date = new Date()): Invoice {
  const amountPaid = existing ? existing.depositAmount : round2(Math.max(0, toNumber(draft.depositAmount)));
  const totals = calculateTotals({ ...draft, amountPaid });

  const payments: PaymentRecord[] = existing
    ? getPaymentHistory(existing)
    : amountPaid > 0
      ? [{ id: crypto.randomUUID(), date: new Date(draft.dateIssued).toISOString(), amount: amountPaid, note: 'Initial Deposit' }]
      : [];

  return {
    ...existing,
    id: existing?.id ?? crypto.randomUUID(),
    customerId: draft.customerId,
    invoiceNumber: draft.invoiceNumber.trim(),
    items: draft.items.map(item => ({
      id: crypto.randomUUID(),
      description: item.description.trim(),
      quantity: toNumber(item.quantity),
      unitPrice: toNumber(item.unitPrice),
      total: lineTotal(item.quantity, item.unitPrice),
    })),
    subtotal: totals.subtotal,
    discount: totals.discount,
    discountRate: toNumber(draft.discountRate),
    discountType: draft.discountType,
    tax: totals.tax,
    taxRate: clampPercent(draft.taxRate),
    taxLabel: draft.taxLabel.trim() || 'Tax',
    grandTotal: totals.grandTotal,
    depositAmount: amountPaid,
    payments,
    currency: draft.currency,
    status: deriveStatus(totals.grandTotal, amountPaid),
    dateIssued: new Date(draft.dateIssued),
    dueDate: draft.dueDate ? new Date(draft.dueDate) : undefined,
    notes: draft.notes.trim() || undefined,
    isSynced: false,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
}

/** Form values for editing an existing invoice. */
export function invoiceToDraft(invoice: Invoice): InvoiceDraft {
  return {
    customerId: invoice.customerId,
    invoiceNumber: invoice.invoiceNumber,
    currency: invoice.currency,
    dateIssued: toDateInputValue(invoice.dateIssued),
    dueDate: invoice.dueDate ? toDateInputValue(invoice.dueDate) : '',
    items: invoice.items.map(({ description, quantity, unitPrice }) => ({ description, quantity, unitPrice })),
    discountType: invoice.discountType ?? 'percentage',
    discountRate: invoice.discountRate ?? 0,
    taxRate: invoice.taxRate ?? 0,
    taxLabel: invoice.taxLabel ?? 'Tax',
    notes: invoice.notes ?? '',
    depositAmount: invoice.depositAmount,
  };
}

/** Form values for a copy: new number, issued today, unpaid, same payment terms length. */
export function duplicateDraft(invoice: Invoice, invoiceNumber: string, today: string = todayInputValue()): InvoiceDraft {
  const draft = invoiceToDraft(invoice);
  const termDays = draft.dueDate ? daysBetween(draft.dateIssued, draft.dueDate) : null;
  return {
    ...draft,
    invoiceNumber,
    dateIssued: today,
    dueDate: termDays === null ? '' : addDays(today, termDays),
    depositAmount: 0,
  };
}

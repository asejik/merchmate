import { describe, expect, it } from 'vitest';
import {
  addDays,
  applyPayment,
  backfillCreatedAt,
  composeInvoice,
  duplicateDraft,
  getDisplayStatus,
  invoiceToDraft,
  todayInputValue,
  type InvoiceDraft,
  calculateTotals,
  deriveStatus,
  getAmountCollected,
  getBalance,
  getPaymentHistory,
  nextInvoiceNumber,
  round2,
  confirmPayment,
  getConfirmedPayments,
  getReceiptInfo,
  getUnconfirmedAmount,
  removeUnconfirmedPayment,
} from './invoice';
import { formatMoney } from './currency';
import type { Invoice } from '../types';

const baseInvoice = (overrides: Partial<Invoice> = {}): Invoice => ({
  id: 'inv-1',
  customerId: 'c-1',
  invoiceNumber: 'INV-001',
  items: [],
  subtotal: 1000,
  discount: 0,
  tax: 0,
  grandTotal: 1000,
  depositAmount: 0,
  currency: 'NGN',
  status: 'pending',
  dateIssued: new Date('2026-01-15T00:00:00Z'),
  isSynced: false,
  createdAt: new Date('2026-01-15T00:00:00Z'),
  updatedAt: new Date('2026-01-15T00:00:00Z'),
  ...overrides,
});

describe('calculateTotals', () => {
  it('sums line items including decimal quantities', () => {
    const t = calculateTotals({
      items: [{ quantity: 3.5, unitPrice: 2000 }, { quantity: '2', unitPrice: '150.25' }],
      discountType: 'percentage', discountRate: 0, amountPaid: 0,
    });
    expect(t.subtotal).toBe(7300.5);
    expect(t.grandTotal).toBe(7300.5);
    expect(t.balance).toBe(7300.5);
  });

  it('treats empty/NaN inputs as 0', () => {
    const t = calculateTotals({
      items: [{ quantity: '', unitPrice: NaN }], discountType: 'fixed', discountRate: undefined, amountPaid: '',
    });
    expect(t).toEqual({ subtotal: 0, discount: 0, tax: 0, grandTotal: 0, balance: 0 });
  });

  it('applies a decimal percentage discount', () => {
    const t = calculateTotals({
      items: [{ quantity: 1, unitPrice: 10000 }], discountType: 'percentage', discountRate: 12.5, amountPaid: 0,
    });
    expect(t.discount).toBe(1250);
    expect(t.grandTotal).toBe(8750);
  });

  it('applies a fixed discount, capped at the subtotal', () => {
    const items = [{ quantity: 1, unitPrice: 5000 }];
    expect(calculateTotals({ items, discountType: 'fixed', discountRate: 1500.5, amountPaid: 0 }).grandTotal).toBe(3499.5);
    const capped = calculateTotals({ items, discountType: 'fixed', discountRate: 9000, amountPaid: 0 });
    expect(capped.discount).toBe(5000);
    expect(capped.grandTotal).toBe(0);
  });

  it('never returns a negative balance on overpayment', () => {
    const t = calculateTotals({ items: [{ quantity: 1, unitPrice: 100 }], discountType: 'fixed', discountRate: 0, amountPaid: 150 });
    expect(t.balance).toBe(0);
  });

  it('avoids floating point drift', () => {
    const t = calculateTotals({ items: [{ quantity: 3, unitPrice: 0.1 }], discountType: 'fixed', discountRate: 0, amountPaid: 0 });
    expect(t.subtotal).toBe(0.3);
  });
});

describe('deriveStatus', () => {
  it('maps amount paid to status', () => {
    expect(deriveStatus(1000, 0)).toBe('pending');
    expect(deriveStatus(1000, 400)).toBe('partial');
    expect(deriveStatus(1000, 1000)).toBe('paid');
    expect(deriveStatus(1000, 1200)).toBe('paid');
  });
});

describe('balance helpers', () => {
  it('computes balance and collected cash', () => {
    const inv = baseInvoice({ depositAmount: 250.1 });
    expect(getBalance(inv)).toBe(749.9);
    expect(getAmountCollected(inv)).toBe(250.1);
    expect(getAmountCollected(baseInvoice({ depositAmount: 1500 }))).toBe(1000);
  });
});

describe('getPaymentHistory', () => {
  it('returns stored payments as-is', () => {
    const payments = [{ id: 'p1', date: '2026-02-01T00:00:00.000Z', amount: 100 }];
    expect(getPaymentHistory(baseInvoice({ payments }))).toBe(payments);
  });

  it('synthesizes a legacy deposit record with an ISO string date', () => {
    const history = getPaymentHistory(baseInvoice({ depositAmount: 300 }));
    expect(history).toHaveLength(1);
    expect(history[0].date).toBe('2026-01-15T00:00:00.000Z');
    expect(typeof history[0].date).toBe('string');
  });

  it('returns nothing when there is no deposit', () => {
    expect(getPaymentHistory(baseInvoice())).toEqual([]);
  });
});

describe('applyPayment', () => {
  const now = new Date('2026-03-01T10:00:00Z');

  it('adds a partial payment and keeps the legacy deposit in history', () => {
    const result = applyPayment(baseInvoice({ depositAmount: 200, status: 'partial' }), 300, '  Cash ', now);
    expect(result.depositAmount).toBe(500);
    expect(result.status).toBe('partial');
    expect(result.payments?.map(p => p.amount)).toEqual([200, 300]);
    expect(result.payments?.[1]).toMatchObject({ note: 'Cash', date: now.toISOString() });
  });

  it('marks the invoice paid when the balance is cleared', () => {
    const result = applyPayment(baseInvoice({ depositAmount: 600, payments: [] }), 400, '', now);
    expect(result.status).toBe('paid');
    expect(result.payments?.[0].note).toBe('Payment');
  });
});

describe('nextInvoiceNumber', () => {
  it('starts at INV-001', () => {
    expect(nextInvoiceNumber([])).toBe('INV-001');
  });

  it('continues from the most recent number so a sequence can be restarted', () => {
    // Legacy timestamp-style numbers from the old numbering bug, then the user typed INV-001
    expect(nextInvoiceNumber(['INV-4821', 'INV-7310', 'INV-001'])).toBe('INV-002');
    expect(nextInvoiceNumber(['INV-009', 'INV-010'])).toBe('INV-011');
  });

  it('skips numbers already in use', () => {
    expect(nextInvoiceNumber(['INV-002', 'INV-003', 'INV-001'])).toBe('INV-004');
  });

  it('keeps custom formats and widths', () => {
    expect(nextInvoiceNumber(['2026/INV/07'])).toBe('2026/INV/08');
    expect(nextInvoiceNumber(['A12-B'])).toBe('A13-B');
    expect(nextInvoiceNumber(['INV-999'])).toBe('INV-1000');
    expect(nextInvoiceNumber(['no-number'])).toBe('INV-001');
    expect(nextInvoiceNumber([], 'QUO-')).toBe('QUO-001');
  });
});

describe('formatMoney / round2', () => {
  it('formats with symbol or code', () => {
    expect(formatMoney(1234.5, 'NGN')).toBe('₦1,234.50');
    expect(formatMoney(1234.5, 'NGN', { code: true })).toBe('NGN 1,234.50');
    expect(formatMoney(-50, 'USD')).toBe('-$50.00');
    expect(formatMoney(NaN, 'GBP')).toBe('£0.00');
  });

  it('rounds half up to cents', () => {
    expect(round2(1.005)).toBe(1.01);
  });
});

describe('backfillCreatedAt (Dexie v2 upgrade)', () => {
  it('uses updatedAt, then dateIssued, and never overwrites an existing value', () => {
    const updatedAt = new Date('2026-01-02');
    const dateIssued = new Date('2026-01-01');
    const a: { createdAt?: Date; updatedAt?: Date; dateIssued?: Date } = { updatedAt, dateIssued };
    backfillCreatedAt(a);
    expect(a.createdAt).toBe(updatedAt);

    const b: { createdAt?: Date; dateIssued?: Date } = { dateIssued };
    backfillCreatedAt(b);
    expect(b.createdAt).toBe(dateIssued);

    const existing = new Date('2025-12-31');
    const c = { createdAt: existing, updatedAt };
    backfillCreatedAt(c);
    expect(c.createdAt).toBe(existing);
  });
});

describe('tax', () => {
  it('applies tax after the discount', () => {
    const t = calculateTotals({
      items: [{ quantity: 1, unitPrice: 10000 }], discountType: 'percentage', discountRate: 10, taxRate: 7.5, amountPaid: 0,
    });
    expect(t.discount).toBe(1000);
    expect(t.tax).toBe(675);
    expect(t.grandTotal).toBe(9675);
  });

  it('defaults to no tax for invoices saved before tax existed', () => {
    const t = calculateTotals({ items: [{ quantity: 2, unitPrice: 50 }], discountType: 'fixed', discountRate: 0, amountPaid: 0 });
    expect(t.tax).toBe(0);
    expect(t.grandTotal).toBe(100);
  });
});

describe('dates and overdue', () => {
  it('formats local today and adds days across month ends', () => {
    expect(todayInputValue(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05');
    expect(addDays('2026-01-25', 14)).toBe('2026-02-08');
  });

  it('marks unpaid invoices past their due date as overdue', () => {
    const due = new Date('2026-03-10');
    expect(getDisplayStatus({ status: 'pending', dueDate: due }, '2026-03-10')).toBe('pending');
    expect(getDisplayStatus({ status: 'partial', dueDate: due }, '2026-03-11')).toBe('overdue');
    expect(getDisplayStatus({ status: 'paid', dueDate: due }, '2026-04-01')).toBe('paid');
    expect(getDisplayStatus({ status: 'pending' }, '2030-01-01')).toBe('pending');
  });
});

describe('composeInvoice', () => {
  const now = new Date('2026-05-01T09:00:00Z');
  const draft: InvoiceDraft = {
    customerId: 'c-1', invoiceNumber: ' INV-004 ', currency: 'NGN', dateIssued: '2026-05-01', dueDate: '2026-05-15',
    items: [{ description: 'Consulting ', quantity: 2, unitPrice: 5000 }],
    discountType: 'fixed', discountRate: 0, taxRate: 7.5, taxLabel: 'VAT', notes: '  Thanks! ', deliveryDate: '2026-05-20', plan: [], costs: [], depositAmount: 3000,
  };

  it('creates a new invoice with the deposit recorded as a payment', () => {
    const inv = composeInvoice(draft, undefined, now);
    expect(inv.invoiceNumber).toBe('INV-004');
    expect(inv.grandTotal).toBe(10750);
    expect(inv.tax).toBe(750);
    expect(inv.status).toBe('partial');
    expect(inv.payments).toHaveLength(1);
    expect(inv.payments?.[0]).toMatchObject({ amount: 3000, note: 'Initial Deposit' });
    expect(inv.notes).toBe('Thanks!');
    expect(inv.dueDate?.toISOString().slice(0, 10)).toBe('2026-05-15');
    expect(inv.createdAt).toBe(now);
  });

  it('editing keeps id, createdAt and payments, and recomputes status against the new total', () => {
    const original = composeInvoice(draft, undefined, new Date('2026-04-01'));
    const later = new Date('2026-05-02');
    const edited = composeInvoice(
      { ...draft, items: [{ description: 'Consulting', quantity: 1, unitPrice: 2000 }], taxRate: 0, depositAmount: 999999 },
      original,
      later,
    );
    expect(edited.id).toBe(original.id);
    expect(edited.createdAt).toBe(original.createdAt);
    expect(edited.payments).toEqual(original.payments);
    expect(edited.depositAmount).toBe(3000); // the form's deposit field is ignored on edit
    expect(edited.status).toBe('paid');
    expect(edited.updatedAt).toBe(later);
  });

  it('round-trips through invoiceToDraft', () => {
    const inv = composeInvoice(draft, undefined, now);
    const again = composeInvoice(invoiceToDraft(inv), inv, now);
    expect(again.grandTotal).toBe(inv.grandTotal);
    expect(again.dueDate?.getTime()).toBe(inv.dueDate?.getTime());
  });

  it('duplicates as a fresh unpaid invoice keeping the payment terms length', () => {
    const inv = composeInvoice(draft, undefined, now);
    const copy = duplicateDraft(inv, 'INV-005', '2026-06-10');
    expect(copy).toMatchObject({ invoiceNumber: 'INV-005', dateIssued: '2026-06-10', dueDate: '2026-06-24', depositAmount: 0 });
    expect(composeInvoice(copy, undefined, now).payments).toEqual([]);
  });
});

describe('unconfirmed transfers', () => {
  const now = new Date('2026-06-01T10:00:00Z');
  const inv = baseInvoice({ grandTotal: 1000, depositAmount: 200, payments: [{ id: 'p1', date: '2026-05-01T00:00:00.000Z', amount: 200, note: 'Cash' }] });

  it('are recorded without reducing the balance', () => {
    const changes = applyPayment(inv, 800, 'Transfer', now, { unconfirmed: true });
    expect(changes.depositAmount).toBe(200);
    expect(changes.status).toBe('partial');
    expect(changes.payments?.at(-1)).toMatchObject({ amount: 800, unconfirmed: true });
    const updated = { ...inv, ...changes };
    expect(getUnconfirmedAmount(updated)).toBe(800);
    expect(getConfirmedPayments(updated)).toHaveLength(1);
  });

  it('confirming counts the money, clears the flag and keeps earlier receipt numbers', () => {
    const pending = { ...inv, ...applyPayment(inv, 300, 'Transfer', now, { unconfirmed: true }) };
    const pendingId = pending.payments!.at(-1)!.id;
    const withCash = { ...pending, ...applyPayment(pending, 100, 'Cash', now) };
    const cashId = withCash.payments!.at(-1)!.id;
    expect(getReceiptInfo(withCash, cashId)?.receiptNumber).toBe('INV-001-R2');
    expect(getReceiptInfo(withCash, pendingId)).toBeNull();

    const confirmed = { ...withCash, ...confirmPayment(withCash, pendingId, now) };
    expect(confirmed.depositAmount).toBe(600);
    expect(getUnconfirmedAmount(confirmed)).toBe(0);
    expect(confirmed.payments?.find(p => p.id === pendingId)).not.toHaveProperty('unconfirmed');
    expect(getReceiptInfo(confirmed, cashId)?.receiptNumber).toBe('INV-001-R2');
    expect(getReceiptInfo(confirmed, pendingId)).toMatchObject({ receiptNumber: 'INV-001-R3', paidToDate: 600, balanceAfter: 400 });
  });

  it('a transfer that never arrived can be removed; confirmed payments cannot', () => {
    const pending = { ...inv, ...applyPayment(inv, 300, 'Transfer', now, { unconfirmed: true }) };
    const removed = removeUnconfirmedPayment(pending, pending.payments!.at(-1)!.id, now);
    expect(removed?.payments).toHaveLength(1);
    expect(removed?.depositAmount).toBe(200);
    expect(removeUnconfirmedPayment(pending, 'p1', now)).toBeNull();
    expect(confirmPayment(pending, 'p1', now)).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import {
  applyPayment,
  backfillCreatedAt,
  calculateTotals,
  deriveStatus,
  getAmountCollected,
  getBalance,
  getPaymentHistory,
  nextInvoiceNumber,
  round2,
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
    expect(t).toEqual({ subtotal: 0, discount: 0, grandTotal: 0, balance: 0 });
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

  it('continues from the highest number, not the most recent', () => {
    expect(nextInvoiceNumber(['INV-009', 'INV-012', 'INV-010'])).toBe('INV-013');
  });

  it('handles custom and legacy timestamp-style numbers', () => {
    expect(nextInvoiceNumber(['2026/INV/7', 'no-number'])).toBe('INV-008');
    expect(nextInvoiceNumber(['INV-999'])).toBe('INV-1000');
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

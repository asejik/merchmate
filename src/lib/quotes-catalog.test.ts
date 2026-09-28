import { describe, expect, it } from 'vitest';
import { composeInvoice, convertQuoteDraft, getDisplayStatus, isOverdue, type InvoiceDraft } from './invoice';
import { findCatalogItem, learnFromItems, sortCatalog } from './catalog';
import type { CatalogItem } from '../types';

const draft: InvoiceDraft = {
  customerId: 'c-1', invoiceNumber: 'QUO-001', currency: 'NGN', dateIssued: '2026-05-01', dueDate: '2026-05-31',
  items: [{ description: 'Logo design', quantity: 1, unitPrice: 50000 }],
  discountType: 'percentage', discountRate: 0, taxRate: 0, taxLabel: 'VAT', notes: '', depositAmount: 20000,
};

describe('quotes', () => {
  const now = new Date('2026-05-01T09:00:00Z');

  it('never records payments on a quote, even if a deposit was entered', () => {
    const quote = composeInvoice(draft, undefined, now, 'quote');
    expect(quote.kind).toBe('quote');
    expect(quote.depositAmount).toBe(0);
    expect(quote.payments).toEqual([]);
    expect(quote.status).toBe('pending');
  });

  it('editing keeps the kind', () => {
    const quote = composeInvoice(draft, undefined, now, 'quote');
    expect(composeInvoice(draft, quote, now).kind).toBe('quote');
  });

  it('derives open / expired / converted, and is never overdue', () => {
    const quote = composeInvoice(draft, undefined, now, 'quote');
    expect(getDisplayStatus(quote, '2026-05-31')).toBe('open');
    expect(getDisplayStatus(quote, '2026-06-01')).toBe('expired');
    expect(isOverdue(quote, '2026-07-01')).toBe(false);
    expect(getDisplayStatus({ ...quote, convertedInvoiceId: 'inv-9' }, '2026-06-01')).toBe('converted');
  });

  it('converts to an invoice draft with invoice numbering and default terms', () => {
    const quote = composeInvoice(draft, undefined, now, 'quote');
    const converted = convertQuoteDraft(quote, 'INV-007', 14, '2026-06-02');
    expect(converted).toMatchObject({ invoiceNumber: 'INV-007', dateIssued: '2026-06-02', dueDate: '2026-06-16', depositAmount: 0 });
    expect(converted.items).toEqual(draft.items);
    const invoice = composeInvoice(converted, undefined, now);
    expect(invoice.kind).toBe('invoice');
    expect(invoice.grandTotal).toBe(50000);
    expect(convertQuoteDraft(quote, 'INV-008', undefined, '2026-06-02').dueDate).toBe('');
  });
});

describe('catalog', () => {
  const now = new Date('2026-05-01T00:00:00Z');
  const existing: CatalogItem[] = [
    { id: 'a', name: 'Logo Design', unitPrice: 40000, currency: 'NGN', usageCount: 3, updatedAt: new Date('2026-01-01') },
    { id: 'b', name: 'Logo Design', unitPrice: 100, currency: 'USD', usageCount: 1, updatedAt: new Date('2026-01-01') },
  ];

  it('updates the price of a known item (case/space-insensitive) in the same currency only', () => {
    const changes = learnFromItems(existing, [{ description: '  logo   design ', unitPrice: 50000 }], 'NGN', now);
    expect(changes).toEqual([{ ...existing[0], unitPrice: 50000, usageCount: 4, updatedAt: now }]);
  });

  it('adds new items and skips blank or free lines', () => {
    const changes = learnFromItems(existing, [
      { description: 'Business cards', unitPrice: 15000 },
      { description: '', unitPrice: 100 },
      { description: 'Free consult', unitPrice: 0 },
    ], 'NGN', now);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ name: 'Business cards', unitPrice: 15000, currency: 'NGN', usageCount: 1 });
  });

  it('merges duplicates within one document', () => {
    const changes = learnFromItems([], [
      { description: 'Delivery', unitPrice: 2000 },
      { description: 'delivery', unitPrice: 2500 },
    ], 'NGN', now);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ name: 'Delivery', unitPrice: 2500, usageCount: 2 });
  });

  it('finds exact matches per currency and sorts by usage', () => {
    expect(findCatalogItem(existing, 'LOGO DESIGN', 'USD')?.unitPrice).toBe(100);
    expect(findCatalogItem(existing, 'Logo', 'NGN')).toBeUndefined();
    expect(sortCatalog(existing).map(c => c.id)).toEqual(['a', 'b']);
  });
});

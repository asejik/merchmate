import { describe, expect, it } from 'vitest';
import { compactNumber, monthlyCollections, niceMax, topClients } from './reports';
import { csvFile, invoicesCsv, paymentsCsv, toCsv } from './csv';
import { buildStatement } from './statement';
import { isHexColor, readableTextColor, tint } from './color';
import type { Customer, Invoice } from '../types';

const make = (o: Partial<Invoice>): Invoice => ({
  id: crypto.randomUUID(), customerId: 'c1', invoiceNumber: 'INV-001', items: [], subtotal: 1000, discount: 0, tax: 0,
  grandTotal: 1000, depositAmount: 0, payments: [], currency: 'NGN', status: 'pending',
  dateIssued: new Date('2026-03-01T00:00:00Z'), isSynced: false,
  createdAt: new Date('2026-03-01T00:00:00Z'), updatedAt: new Date('2026-03-01T00:00:00Z'), ...o,
});
const customers: Customer[] = [
  { id: 'c1', name: 'Ada', phone: '1', createdAt: new Date() },
  { id: 'c2', name: '=HYPERLINK("x")', phone: '2', createdAt: new Date() },
];

const invoices = [
  make({ invoiceNumber: 'INV-001', grandTotal: 1000, depositAmount: 1000, status: 'paid',
    payments: [{ id: 'a', date: new Date(2026, 2, 5).toISOString(), amount: 400 }, { id: 'b', date: new Date(2026, 4, 2).toISOString(), amount: 600, note: 'Cash, "final"' }] }),
  make({ customerId: 'c2', invoiceNumber: 'INV-002', grandTotal: 5000, depositAmount: 1000, status: 'partial', dueDate: new Date('2026-04-01T00:00:00Z'),
    payments: [{ id: 'c', date: new Date(2026, 4, 20).toISOString(), amount: 1000 }] }),
  make({ invoiceNumber: 'INV-003', currency: 'USD', grandTotal: 50, dateIssued: new Date('2026-02-01T00:00:00Z') }),
  make({ kind: 'quote', invoiceNumber: 'QUO-001', grandTotal: 99999 }),
];

describe('monthlyCollections', () => {
  it('buckets payments by month, ending with the current month, per currency', () => {
    const buckets = monthlyCollections(invoices, 'NGN', 6, new Date(2026, 4, 25));
    expect(buckets.map(b => b.key)).toEqual(['2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05']);
    expect(buckets.map(b => b.amount)).toEqual([0, 0, 0, 400, 0, 1600]);
    expect(buckets[5].label).toBe('May');
  });
});

describe('topClients', () => {
  it('ranks by invoiced, excluding quotes and other currencies', () => {
    const ranks = topClients(invoices, customers, 'NGN');
    expect(ranks.map(r => [r.customerId, r.invoiced, r.outstanding, r.count])).toEqual([['c2', 5000, 4000, 1], ['c1', 1000, 0, 1]]);
  });
});

describe('axis helpers', () => {
  it('rounds to clean maxima and compacts numbers', () => {
    expect([0, 7, 180, 2300, 41000].map(niceMax)).toEqual([1, 10, 200, 2500, 50000]);
    expect(compactNumber(1500)).toBe('1.5K');
    expect(compactNumber(2000000)).toBe('2M');
  });
});

describe('csv', () => {
  it('quotes special characters and neutralizes formulas', () => {
    expect(toCsv([['a,b', 'say "hi"', '=1+1', -5, null]])).toBe('"a,b","say ""hi""",\'=1+1,-5,');
  });

  it('exports invoices and payments', () => {
    const rows = invoicesCsv(invoices, customers, '2026-05-25').split('\r\n');
    expect(rows[0]).toContain('Type,Number,Client');
    expect(rows).toHaveLength(5);
    expect(rows.find(r => r.includes('INV-002'))).toContain(`'=HYPERLINK`);
    expect(rows.find(r => r.includes('INV-002'))).toMatch(/,overdue$/);
    expect(rows.find(r => r.includes('QUO-001'))).toMatch(/^Quote,/);

    const pay = paymentsCsv(invoices, customers).split('\r\n');
    expect(pay).toHaveLength(4);
    expect(pay[2]).toContain('"Cash, ""final"""');
  });

  it('prefixes a BOM for Excel', async () => {
    // Blob.text() strips a BOM when decoding, so check the raw bytes (EF BB BF)
    const bytes = new Uint8Array(await csvFile('a,b', 'x.csv').arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  });
});

describe('buildStatement', () => {
  it('groups per currency, oldest first, with totals and overdue', () => {
    const groups = buildStatement(invoices, '2026-05-25');
    expect(groups.map(g => g.currency)).toEqual(['USD', 'NGN']);
    const ngn = groups[1];
    expect(ngn.rows.map(r => r.invoiceNumber)).toEqual(['INV-001', 'INV-002']);
    expect(ngn).toMatchObject({ invoiced: 6000, paid: 2000, balance: 4000, overdue: 4000 });
  });
});

describe('color', () => {
  it('validates hex and picks readable text', () => {
    expect(isHexColor('#4f46e5')).toBe(true);
    expect(isHexColor('red')).toBe(false);
    expect(readableTextColor('#4F46E5')).toBe('#FFFFFF');
    expect(readableTextColor('#FDE047')).toBe('#111827');
    expect(tint('#000000', 0.5)).toBe('#808080');
  });
});

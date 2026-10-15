import { describe, expect, it } from 'vitest';
import type { Invoice } from '../types';
import { composeInvoice, duplicateDraft, invoiceToDraft, type InvoiceDraft } from './invoice';
import { computeProfit, getJobProfit, monthProfit } from './profit';
import { buildInvoiceText } from './whatsapp';

const draft: InvoiceDraft = {
  customerId: 'c-1', invoiceNumber: 'INV-030', currency: 'NGN', dateIssued: '2026-10-03', dueDate: '',
  items: [{ description: 'Agbada', quantity: 1, unitPrice: 100000 }],
  discountType: 'percentage', discountRate: 0, taxRate: 7.5, taxLabel: 'VAT', notes: '', deliveryDate: '', plan: [],
  costs: [{ description: ' Fabric ', amount: 40000 }, { description: '', amount: 15000 }, { description: 'Blank row', amount: 0 }],
  depositAmount: 0,
};
const now = new Date('2026-10-03T09:00:00Z');

describe('profit per job', () => {
  const inv = composeInvoice(draft, undefined, now);

  it('stores the costs entered, dropping empty rows', () => {
    expect(inv.costs?.map(c => [c.description, c.amount])).toEqual([['Fabric', 40000], ['Cost', 15000]]);
    expect(composeInvoice({ ...draft, costs: [{ description: 'x', amount: 0 }] }, undefined, now).costs).toBeUndefined();
  });

  it('profit excludes tax, which is not the seller\'s money', () => {
    expect(inv.grandTotal).toBe(107500);
    expect(getJobProfit(inv)).toEqual({ revenue: 100000, cost: 55000, profit: 45000, margin: 45 });
  });

  it('is unknown (not 100%) when no costs were entered, and can be a loss', () => {
    expect(getJobProfit({ ...inv, costs: undefined })).toBeNull();
    expect(computeProfit(10000, 0, [{ amount: 12500 }])).toMatchObject({ profit: -2500, margin: -25 });
    expect(computeProfit(0, 0, [{ amount: 100 }]).margin).toBeNull();
  });

  it('keeps costs through edits and duplicates', () => {
    expect(invoiceToDraft(inv).costs).toEqual([{ description: 'Fabric', amount: 40000 }, { description: 'Cost', amount: 15000 }]);
    expect(duplicateDraft(inv, 'INV-031').costs).toHaveLength(2);
  });

  it('never appears in what the client sees', () => {
    const text = buildInvoiceText(inv, { name: 'Ada' }, { businessName: 'Biz', bankName: '', accountNumber: '', accountName: '' });
    expect(text).not.toContain('Fabric');
    expect(text).not.toContain('40,000');
  });

  it('adds up the month, counting jobs without costs separately', () => {
    const other = (o: Partial<Invoice>): Invoice => ({ ...inv, id: crypto.randomUUID(), ...o });
    const invoices = [
      inv,
      other({ costs: [{ id: 'k', description: 'Thread', amount: 5000 }], tax: 0, grandTotal: 20000 }),
      other({ costs: undefined }), // costs unknown
      other({ dateIssued: new Date('2026-09-30T00:00:00Z') }), // last month
      other({ currency: 'USD' }),
      other({ kind: 'quote' }),
    ];
    expect(monthProfit(invoices, 'NGN', '2026-10-15')).toEqual({
      revenue: 120000, cost: 60000, profit: 60000, margin: 50, jobs: 2, jobsWithoutCosts: 1,
    });
  });
});

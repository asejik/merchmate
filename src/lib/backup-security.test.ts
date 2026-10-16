import { describe, expect, it } from 'vitest';
import { composeInvoice, type InvoiceDraft } from './invoice';
import { MAX_BACKUP_BYTES, parseBackup, serializeBackup } from './backup';
import type { BusinessProfile, Customer, Invoice } from '../types';

// A backup file is the one way untrusted data enters this app (someone can send you a "backup").
// Restoring replaces everything, so a hostile or corrupt file must be rejected before it is stored.

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const draft: InvoiceDraft = {
  customerId: 'c-1', invoiceNumber: 'INV-001', currency: 'NGN', dateIssued: '2026-09-01', dueDate: '2026-09-10',
  items: [{ description: 'Aso Oke', quantity: 2, unitPrice: 5000 }], discountType: 'percentage', discountRate: 10,
  taxRate: 7.5, taxLabel: 'VAT', notes: 'Thanks', deliveryDate: '2026-09-05',
  plan: [{ label: 'Deposit', percent: 50, dueDate: '2026-09-01' }, { label: 'Balance', percent: 50, dueDate: '' }],
  costs: [{ description: 'Thread', amount: 1000 }], depositAmount: 3000,
};
const customer: Customer = { id: 'c-1', name: 'Ada', phone: '0800', createdAt: new Date('2026-09-01') };
const profile: BusinessProfile = {
  id: 1, businessName: 'Demo', address: '1 Road', phone: '0800', bankName: 'Bank', accountNumber: '0000', accountName: 'Demo',
  logoUrl: PNG, brandColor: '#4f46e5', invoiceTemplate: 'modern', dateFormat: 'long', defaultDueDays: 14, defaultTaxRate: 7.5, taxLabel: 'VAT', defaultCountryCode: '234',
};

const goodInvoice = (): Invoice => composeInvoice(draft, undefined, new Date('2026-09-01T10:00:00Z'));
const backupWith = (change: (b: ReturnType<typeof base>) => void): string => {
  const b = base();
  change(b);
  return JSON.stringify(b);
};
const base = () => JSON.parse(serializeBackup({
  businessProfile: [profile], customers: [customer],
  invoices: [goodInvoice(), { ...composeInvoice({ ...draft, invoiceNumber: 'QUO-001' }, undefined, new Date(), 'quote') }],
  catalog: [{ id: 'k1', name: 'Aso Oke', unitPrice: 5000, currency: 'NGN', usageCount: 2, updatedAt: new Date() }],
})) as { data: { businessProfile: Record<string, unknown>[]; customers: Record<string, unknown>[]; invoices: Record<string, unknown>[]; catalog: Record<string, unknown>[] } };

describe('a genuine backup', () => {
  it('is accepted with everything the app can store', () => {
    const { data } = parseBackup(backupWith(() => undefined));
    expect(data.invoices).toHaveLength(2);
    expect(data.businessProfile[0].logoUrl).toBe(PNG);
  });
});

describe('hostile or corrupt backups are rejected', () => {
  const rejected: [string, (b: ReturnType<typeof base>) => void][] = [
    ['payments that are not a list (crashes every screen)', b => { b.data.invoices[0].payments = 5; }],
    ['items that are not a list', b => { b.data.invoices[0].items = 'x'; }],
    ['a payment with a text amount', b => { b.data.invoices[0].payments = [{ id: 'p', date: '2026-09-01', amount: '1000' }]; }],
    ['an unknown currency', b => { b.data.invoices[0].currency = 'XXX'; }],
    ['an unknown status', b => { b.data.invoices[0].status = 'hacked'; }],
    ['a total that is not a number', b => { b.data.invoices[0].grandTotal = 'lots'; }],
    ['costs that are not a list', b => { b.data.invoices[0].costs = {}; }],
    ['a payment plan with a text percentage', b => { b.data.invoices[0].paymentPlan = [{ id: 'a', label: 'x', percent: '50' }]; }],
    ['an unknown order stage', b => { b.data.invoices[0].orderStage = 'teleported'; }],
    ['a logo that loads from another website (tracking)', b => { b.data.businessProfile[0].logoUrl = 'https://tracker.example/pixel.png'; }],
    ['a logo that is a script address', b => { b.data.businessProfile[0].logoUrl = 'javascript:alert(1)'; }],
    ['a logo that is not an image', b => { b.data.businessProfile[0].logoUrl = 'data:text/html;base64,PHNjcmlwdD4='; }],
    ['a brand colour that injects styles', b => { b.data.businessProfile[0].brandColor = 'red;background:url(//x)'; }],
    ['an unknown date format', b => { b.data.businessProfile[0].dateFormat = 'whenever'; }],
    ['a client name that is not text', b => { b.data.customers[0].name = { a: 1 }; }],
    ['a saved item with a text price', b => { b.data.catalog[0].unitPrice = '5'; }],
  ];

  for (const [name, change] of rejected) {
    it(`rejects ${name}`, () => {
      expect(() => parseBackup(backupWith(change))).toThrow(/damaged or incomplete|not a MerchMate backup/);
    });
  }

  it('rejects a file larger than any real backup', () => {
    expect(() => parseBackup(' '.repeat(MAX_BACKUP_BYTES + 1))).toThrow(/too large/);
  });
});

describe('older backups still restore', () => {
  it('accepts an invoice from before payments, tax and order tracking existed', () => {
    const text = backupWith(b => {
      const old = b.data.invoices[0];
      for (const key of ['payments', 'taxRate', 'taxLabel', 'discountRate', 'discountType', 'orderStage', 'costs', 'paymentPlan', 'kind', 'createdAt', 'deliveryDate', 'isSynced']) delete old[key];
      b.data.businessProfile = [{ businessName: 'Old Business' }];
    });
    expect(parseBackup(text).data.invoices).toHaveLength(2);
  });
});

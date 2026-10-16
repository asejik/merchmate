import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from './index';
import { eraseAllData, exportAllData, restoreAllData } from './backup';
import {
  confirmTransfer, deleteCustomer, deleteInvoice, discardTransfer, DocumentGoneError, NumberInUseError, recordPayment, reinstateInvoice, saveDocument, voidInvoice,
} from './mutations';
import { parseBackup, serializeBackup } from '../lib/backup';
import { composeInvoice, getBalance, type InvoiceDraft } from '../lib/invoice';
import type { Customer, Invoice } from '../types';

const draft = (overrides: Partial<InvoiceDraft> = {}): InvoiceDraft => ({
  customerId: 'c-1',
  invoiceNumber: 'INV-001',
  currency: 'NGN',
  dateIssued: '2026-10-01',
  dueDate: '',
  items: [{ description: 'Aso Oke set', quantity: 1, unitPrice: 10000 }],
  discountType: 'percentage',
  discountRate: 0,
  taxRate: 0,
  taxLabel: 'VAT',
  notes: '',
  deliveryDate: '',
  plan: [],
  costs: [],
  depositAmount: 0,
  ...overrides,
});

const customer = (id = 'c-1'): Customer => ({ id, name: 'Ada', phone: '0800', createdAt: new Date('2026-10-01') });

async function seedInvoice(overrides: Partial<InvoiceDraft> = {}): Promise<Invoice> {
  const doc = composeInvoice(draft(overrides), undefined, new Date('2026-10-01T10:00:00Z'));
  await db.invoices.put(doc);
  return doc;
}

beforeEach(async () => {
  await Promise.all([db.businessProfile.clear(), db.customers.clear(), db.invoices.clear(), db.catalog.clear()]);
});

describe('payments are applied to the stored invoice, not a stale copy', () => {
  it('keeps a payment recorded from another tab', async () => {
    const invoice = await seedInvoice();
    // Tab B records 3000 while tab A still holds the original copy
    await recordPayment(invoice.id!, 3000, 'Cash', false);
    // Tab A, still on the stale copy, records 2000
    const saved = await recordPayment(invoice.id!, 2000, 'Cash', false);

    expect(saved?.depositAmount).toBe(5000);
    expect(saved?.payments).toHaveLength(2);
    expect(getBalance((await db.invoices.get(invoice.id!))!)).toBe(5000);
  });

  it('confirms and discards transfers against the latest history', async () => {
    const invoice = await seedInvoice();
    const first = await recordPayment(invoice.id!, 4000, 'Transfer', true);
    const second = await recordPayment(invoice.id!, 1000, 'Transfer', true);
    const [a, b] = first!.payments!.concat(second!.payments!.slice(1)).map(p => p.id);

    expect((await confirmTransfer(invoice.id!, a))?.depositAmount).toBe(4000);
    expect((await discardTransfer(invoice.id!, b))?.depositAmount).toBe(4000);
    expect((await db.invoices.get(invoice.id!))?.payments).toHaveLength(1);
  });

  it('returns null for an invoice that no longer exists or a payment that is not pending', async () => {
    expect(await recordPayment('missing', 100, '', false)).toBeNull();
    const invoice = await seedInvoice();
    expect(await confirmTransfer(invoice.id!, 'nope')).toBeNull();
  });
});

describe('saveDocument', () => {
  it('rejects a number another document already uses, but not the document own number', async () => {
    const existing = await seedInvoice();
    await expect(saveDocument(draft(), undefined, 'invoice')).rejects.toBeInstanceOf(NumberInUseError);
    await expect(saveDocument(draft({ notes: 'edited' }), existing, 'invoice')).resolves.toMatchObject({ id: existing.id, notes: 'edited' });
  });

  it('keeps payments recorded after the form was opened', async () => {
    const existing = await seedInvoice();
    await recordPayment(existing.id!, 2500, 'Cash', false);

    const saved = await saveDocument(draft({ notes: 'edited' }), existing, 'invoice');
    expect(saved.depositAmount).toBe(2500);
    expect(saved.payments).toHaveLength(1);
    expect(saved.status).toBe('partial');
  });

  it('does not resurrect an invoice deleted while it was being edited', async () => {
    const existing = await seedInvoice();
    await deleteInvoice(existing.id!);
    await expect(saveDocument(draft(), existing, 'invoice')).rejects.toBeInstanceOf(DocumentGoneError);
    expect(await db.invoices.count()).toBe(0);
  });

  it('links a converted quote and learns the items in the same save', async () => {
    const quote = composeInvoice(draft({ invoiceNumber: 'QUO-001' }), undefined, new Date(), 'quote');
    await db.invoices.put(quote);
    const invoice = await saveDocument(draft(), undefined, 'invoice', quote.id);

    expect((await db.invoices.get(quote.id!))?.convertedInvoiceId).toBe(invoice.id);
    expect(await db.catalog.count()).toBe(1);
  });
});

describe('deletes keep records consistent', () => {
  it('reopens a quote whose invoice was deleted', async () => {
    const quote = composeInvoice(draft({ invoiceNumber: 'QUO-001' }), undefined, new Date(), 'quote');
    await db.invoices.put(quote);
    const invoice = await saveDocument(draft(), undefined, 'invoice', quote.id);

    await deleteInvoice(invoice.id!);
    const reopened = await db.invoices.get(quote.id!);
    expect(reopened).toBeDefined();
    expect('convertedInvoiceId' in reopened!).toBe(false);
  });

  it('refuses to delete a client that still has documents', async () => {
    await db.customers.put(customer());
    await seedInvoice();
    expect(await deleteCustomer('c-1')).toBe(1);
    expect(await db.customers.get('c-1')).toBeDefined();

    await db.invoices.clear();
    expect(await deleteCustomer('c-1')).toBe(0);
    expect(await db.customers.get('c-1')).toBeUndefined();
  });
});

describe('invoices with payments are voided, not deleted', () => {
  it('refuses to delete an invoice with confirmed payments, but deletes one without', async () => {
    const paid = await seedInvoice({ depositAmount: 2000 });
    expect(await deleteInvoice(paid.id!)).toBe(false);
    expect(await db.invoices.get(paid.id!)).toBeDefined();

    const unpaid = await seedInvoice({ invoiceNumber: 'INV-002' });
    expect(await deleteInvoice(unpaid.id!)).toBe(true);
    expect(await db.invoices.get(unpaid.id!)).toBeUndefined();
  });

  it('voids and reinstates while keeping the payment history', async () => {
    const invoice = await seedInvoice({ depositAmount: 2000 });
    expect(await voidInvoice(invoice.id!)).toBe('voided');
    const stored = (await db.invoices.get(invoice.id!))!;
    expect(stored.voidedAt).toBeInstanceOf(Date);
    expect(stored.payments).toHaveLength(1);

    await reinstateInvoice(invoice.id!);
    expect('voidedAt' in (await db.invoices.get(invoice.id!))!).toBe(false);
  });

  it('will not void while a transfer is unconfirmed, or void a quote', async () => {
    const invoice = await seedInvoice();
    await recordPayment(invoice.id!, 500, 'Transfer', true);
    expect(await voidInvoice(invoice.id!)).toBe('unconfirmed-transfers');

    const quote = composeInvoice(draft({ invoiceNumber: 'QUO-001' }), undefined, new Date(), 'quote');
    await db.invoices.put(quote);
    expect(await voidInvoice(quote.id!)).toBe('not-an-invoice');
  });
});

describe('backup and restore', () => {
  it('round-trips through a backup file and replaces what was there', async () => {
    await db.customers.put(customer());
    const invoice = await seedInvoice();
    await recordPayment(invoice.id!, 1000, 'Cash', false);
    const file = serializeBackup(await exportAllData());

    await db.invoices.clear();
    await db.customers.put(customer('stale'));
    await restoreAllData(parseBackup(file).data);

    expect((await db.customers.toArray()).map(c => c.id)).toEqual(['c-1']);
    const restored = await db.invoices.get(invoice.id!);
    expect(restored?.depositAmount).toBe(1000);
    expect(restored?.dateIssued).toBeInstanceOf(Date);
  });
});

describe('erase this device', () => {
  it('deletes every table and the app lock, then lets a backup be restored', async () => {
    await db.customers.put(customer());
    const invoice = await seedInvoice();
    await db.businessProfile.put({ id: 1, businessName: 'Demo', address: '', phone: '', bankName: '', accountNumber: '', accountName: '' });
    const backup = serializeBackup(await exportAllData());
    const store = new Map<string, string>([['appLock', '{"v":1}'], ['lastBackupAt', '2026-10-01']]);
    vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) });

    await eraseAllData();
    expect(await db.invoices.count() + await db.customers.count() + await db.businessProfile.count() + await db.catalog.count()).toBe(0);
    expect(store.has('appLock')).toBe(false);
    expect(store.has('lastBackupAt')).toBe(false);

    await restoreAllData(parseBackup(backup).data);
    expect((await db.invoices.get(invoice.id!))?.invoiceNumber).toBe('INV-001');
    vi.unstubAllGlobals();
  });
});

describe('schema upgrade', () => {
  it('backfills createdAt on invoices saved under schema v1', async () => {
    db.close();
    await Dexie.delete('AsoOkeInvoiceDB');

    const v1 = new Dexie('AsoOkeInvoiceDB');
    v1.version(1).stores({
      businessProfile: '++id',
      customers: '&id, name, phone',
      invoices: '&id, customerId, status, dateIssued, isSynced',
    });
    await v1.table('invoices').put({ id: 'old', invoiceNumber: 'INV-001', dateIssued: new Date('2026-01-05'), customerId: 'c' });
    v1.close();

    await db.open();
    expect((await db.invoices.get('old'))?.createdAt).toEqual(new Date('2026-01-05'));
    expect((await db.invoices.where('invoiceNumber').equals('INV-001').first())?.id).toBe('old');
  });
});

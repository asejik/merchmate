import { describe, expect, it } from 'vitest';
import { backupFileName, parseBackup, serializeBackup, type BackupData } from './backup';
import { buildReminderMessage, toWhatsAppNumber, whatsAppLink } from './whatsapp';
import { getReceiptInfo } from './invoice';
import type { Invoice } from '../types';

const invoice: Invoice = {
  id: 'inv-1',
  customerId: 'c-1',
  invoiceNumber: 'INV-004',
  items: [{ id: 'i1', description: 'Work', quantity: 1, unitPrice: 10000, total: 10000 }],
  subtotal: 10000,
  discount: 0,
  tax: 0,
  grandTotal: 10000,
  depositAmount: 7000,
  payments: [
    { id: 'p1', date: '2026-05-01T00:00:00.000Z', amount: 4000, note: 'Initial Deposit' },
    { id: 'p2', date: '2026-05-10T00:00:00.000Z', amount: 3000, note: 'Transfer' },
  ],
  currency: 'NGN',
  status: 'partial',
  dateIssued: new Date('2026-05-01T00:00:00Z'),
  dueDate: new Date('2026-05-15T00:00:00Z'),
  isSynced: false,
  createdAt: new Date('2026-05-01T08:00:00Z'),
  updatedAt: new Date('2026-05-10T08:00:00Z'),
};

const business = { businessName: 'Acme Ltd', bankName: 'GTBank', accountNumber: '0123456789', accountName: 'Acme Ltd' };

describe('backup', () => {
  const data: BackupData = {
    businessProfile: [{ id: 1, ...business, address: '1 Road', phone: '08030000000' }],
    customers: [{ id: 'c-1', name: 'Ada Obi', phone: '08031234567', createdAt: new Date('2026-04-01T00:00:00Z') }],
    invoices: [invoice],
    catalog: [{ id: 'k1', name: 'Work', unitPrice: 10000, currency: 'NGN', usageCount: 2, updatedAt: new Date('2026-04-02T00:00:00Z') }],
  };

  it('round-trips data and revives dates', () => {
    const { data: restored, summary } = parseBackup(serializeBackup(data, new Date('2026-06-01T00:00:00Z')));
    expect(summary).toMatchObject({ customers: 1, invoices: 1, hasProfile: true });
    expect(summary.exportedAt.toISOString()).toBe('2026-06-01T00:00:00.000Z');
    const inv = restored.invoices[0];
    expect(inv.dateIssued).toBeInstanceOf(Date);
    expect(inv.dueDate?.getTime()).toBe(invoice.dueDate?.getTime());
    expect(inv.payments).toEqual(invoice.payments);
    expect(restored.customers[0].createdAt).toBeInstanceOf(Date);
    expect(restored.catalog[0].updatedAt).toBeInstanceOf(Date);
  });

  it('accepts backups made before the catalog existed', () => {
    const old = JSON.parse(serializeBackup(data));
    delete old.data.catalog;
    expect(parseBackup(JSON.stringify(old)).data.catalog).toEqual([]);
  });

  it('fills createdAt for invoices exported before v2', () => {
    const legacy = JSON.parse(serializeBackup(data));
    delete legacy.data.invoices[0].createdAt;
    const { data: restored } = parseBackup(JSON.stringify(legacy));
    expect(restored.invoices[0].createdAt.getTime()).toBe(invoice.updatedAt.getTime());
  });

  it('rejects non-backup and damaged files with readable messages', () => {
    expect(() => parseBackup('not json')).toThrow(/not a MerchMate backup/);
    expect(() => parseBackup('{"hello":1}')).toThrow(/not a MerchMate backup/);
    const broken = JSON.parse(serializeBackup(data));
    delete broken.data.invoices[0].grandTotal;
    expect(() => parseBackup(JSON.stringify(broken))).toThrow(/damaged or incomplete/);
    const future = JSON.parse(serializeBackup(data));
    future.version = 99;
    expect(() => parseBackup(JSON.stringify(future))).toThrow(/newer version/);
  });

  it('names files by date', () => {
    expect(backupFileName(new Date('2026-06-01T12:00:00Z'))).toBe('merchmate-backup-2026-06-01.json');
  });
});

describe('toWhatsAppNumber', () => {
  it('converts local numbers using the default country code', () => {
    expect(toWhatsAppNumber('0803 123 4567')).toBe('2348031234567');
    expect(toWhatsAppNumber('07700 900123', '44')).toBe('447700900123');
    expect(toWhatsAppNumber('8031234567')).toBe('2348031234567');
  });

  it('keeps explicit international numbers', () => {
    expect(toWhatsAppNumber('+44 7700 900123')).toBe('447700900123');
    expect(toWhatsAppNumber('0044 7700 900123')).toBe('447700900123');
    expect(toWhatsAppNumber('2348031234567')).toBe('2348031234567');
  });

  it('returns empty for no digits', () => {
    expect(toWhatsAppNumber(' - ')).toBe('');
  });
});

describe('buildReminderMessage', () => {
  it('mentions the balance, due state and bank details', () => {
    const msg = buildReminderMessage(invoice, { name: 'Ada Obi' }, business, '2026-05-20');
    expect(msg).toContain('Hello Ada,');
    expect(msg).toContain('invoice #INV-004 was due on 15 May 2026');
    expect(msg).toContain('Balance due: *₦3,000.00*');
    expect(msg).toContain('0123456789');
  });

  it('handles due today, future and no due date', () => {
    expect(buildReminderMessage(invoice, { name: 'Ada' }, business, '2026-05-15')).toContain('is due today');
    expect(buildReminderMessage(invoice, { name: 'Ada' }, business, '2026-05-12')).toContain('is due on 15 May 2026');
    expect(buildReminderMessage({ ...invoice, dueDate: undefined }, { name: 'Ada' }, business)).toContain('is still outstanding');
  });

  it('builds an encoded wa.me link', () => {
    expect(whatsAppLink('2348031234567', 'Hi & bye')).toBe('https://wa.me/2348031234567?text=Hi%20%26%20bye');
  });
});

describe('getReceiptInfo', () => {
  it('reports totals as of that payment', () => {
    expect(getReceiptInfo(invoice, 'p1')).toMatchObject({ receiptNumber: 'INV-004-R1', paidToDate: 4000, balanceAfter: 6000 });
    expect(getReceiptInfo(invoice, 'p2')).toMatchObject({ receiptNumber: 'INV-004-R2', paidToDate: 7000, balanceAfter: 3000 });
  });

  it('works for legacy deposits and unknown ids', () => {
    const legacy = { ...invoice, payments: undefined, depositAmount: 2500 };
    expect(getReceiptInfo(legacy, 'legacy')).toMatchObject({ paidToDate: 2500, balanceAfter: 7500 });
    expect(getReceiptInfo(invoice, 'nope')).toBeNull();
  });
});

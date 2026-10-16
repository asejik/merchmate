import { describe, expect, it } from 'vitest';
import { composeInvoice, getAmountToRequest, getBalance, getDisplayStatus, isOverdue, type InvoiceDraft } from './invoice';
import { followUpReasons } from './followups';
import { isOpenOrder } from './orders';
import { buildStatement } from './statement';
import { topClients } from './reports';
import { monthProfit } from './profit';
import { parseBackup, serializeBackup } from './backup';
import type { Invoice } from '../types';

const draft: InvoiceDraft = {
  customerId: 'c-1', invoiceNumber: 'INV-001', currency: 'NGN', dateIssued: '2026-09-01', dueDate: '2026-09-10',
  items: [{ description: 'Aso Oke', quantity: 1, unitPrice: 10000 }], discountType: 'percentage', discountRate: 0,
  taxRate: 0, taxLabel: 'VAT', notes: '', deliveryDate: '2026-09-05', plan: [], costs: [{ description: 'Thread', amount: 4000 }], depositAmount: 3000,
};
const today = '2026-10-16';
const live = (): Invoice => composeInvoice(draft, undefined, new Date('2026-09-01T10:00:00Z'));
const voided = (): Invoice => ({ ...live(), voidedAt: new Date('2026-10-01') });

describe('voided invoices', () => {
  it('start out overdue, owed and chased when live', () => {
    const inv = live();
    expect(getDisplayStatus(inv, today)).toBe('overdue');
    expect(getBalance(inv)).toBe(7000);
    expect(followUpReasons(inv, today).length).toBeGreaterThan(0);
  });

  it('owe nothing, are never overdue, and are not chased or requested', () => {
    const inv = voided();
    expect(getDisplayStatus(inv, today)).toBe('void');
    expect(getBalance(inv)).toBe(0);
    expect(isOverdue(inv, today)).toBe(false);
    expect(getAmountToRequest(inv, today)).toBe(0);
    expect(followUpReasons(inv, today)).toEqual([]);
    expect(isOpenOrder(inv)).toBe(false);
  });

  it('keep their payments on record', () => {
    expect(voided().payments).toHaveLength(1);
    expect(voided().depositAmount).toBe(3000);
  });

  it('are left out of statements, client ranking and profit', () => {
    expect(buildStatement([voided()], today)).toEqual([]);
    expect(topClients([voided()], [], 'NGN')).toEqual([]);
    expect(monthProfit([voided()], 'NGN', '2026-09-20').jobs).toBe(0);
    expect(monthProfit([live()], 'NGN', '2026-09-20').jobs).toBe(1);
  });

  it('survive a backup round trip', () => {
    const file = serializeBackup({ businessProfile: [], customers: [], invoices: [voided()], catalog: [] });
    const restored = parseBackup(file).data.invoices[0];
    expect(restored.voidedAt).toBeInstanceOf(Date);
  });
});

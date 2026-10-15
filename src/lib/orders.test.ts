import { describe, expect, it } from 'vitest';
import type { Invoice } from '../types';
import { composeInvoice, convertQuoteDraft, duplicateDraft, invoiceToDraft, type InvoiceDraft } from './invoice';
import { isDeliveryLate, isOpenOrder, nextStage } from './orders';
import { buildClientMessage, buildReadyMessage } from './whatsapp';

const now = new Date('2026-05-01T09:00:00Z');
const draft: InvoiceDraft = {
  customerId: 'c-1', invoiceNumber: 'INV-010', currency: 'NGN', dateIssued: '2026-05-01', dueDate: '',
  items: [{ description: 'Agbada', quantity: 1, unitPrice: 50000 }],
  discountType: 'percentage', discountRate: 0, taxRate: 0, taxLabel: 'VAT', notes: '', deliveryDate: '2026-05-20', plan: [], costs: [], depositAmount: 20000,
};
const business = { businessName: 'Tailor Co', bankName: 'GTBank', accountNumber: '0123456789', accountName: 'Tailor Co' };
const customer = { name: 'Ada Obi' };

describe('order tracking', () => {
  it('new invoices start in progress with the delivery date; quotes are not orders', () => {
    const inv = composeInvoice(draft, undefined, now);
    expect(inv.orderStage).toBe('in_progress');
    expect(inv.deliveryDate?.toISOString().slice(0, 10)).toBe('2026-05-20');
    expect(composeInvoice(draft, undefined, now, 'quote').orderStage).toBeUndefined();
  });

  it('editing keeps the stage, and invoices saved before tracking stay untracked', () => {
    const inv = { ...composeInvoice(draft, undefined, now), orderStage: 'ready' as const };
    expect(composeInvoice(invoiceToDraft(inv), inv, now).orderStage).toBe('ready');
    const legacy: Invoice = { ...inv, orderStage: undefined };
    expect(composeInvoice(invoiceToDraft(legacy), legacy, now).orderStage).toBeUndefined();
  });

  it('a converted quote becomes an order in progress; a duplicate drops the delivery date', () => {
    const quote = composeInvoice(draft, undefined, now, 'quote');
    const converted = composeInvoice(convertQuoteDraft(quote, 'INV-011', undefined, '2026-05-02'), undefined, now);
    expect(converted.orderStage).toBe('in_progress');
    expect(converted.deliveryDate?.toISOString().slice(0, 10)).toBe('2026-05-20');
    expect(duplicateDraft(converted, 'INV-012').deliveryDate).toBe('');
  });

  it('advances through the stages', () => {
    expect(nextStage('in_progress')).toBe('ready');
    expect(nextStage('ready')).toBe('delivered');
    expect(nextStage('delivered')).toBeNull();
  });

  it('flags late deliveries only for open orders', () => {
    const inv = composeInvoice(draft, undefined, now);
    expect(isOpenOrder(inv)).toBe(true);
    expect(isDeliveryLate(inv, '2026-05-20')).toBe(false);
    expect(isDeliveryLate(inv, '2026-05-21')).toBe(true);
    expect(isDeliveryLate({ ...inv, orderStage: 'delivered' }, '2026-05-21')).toBe(false);
    expect(isDeliveryLate({ ...inv, orderStage: undefined }, '2026-05-21')).toBe(false);
  });
});

describe('order ready message', () => {
  const inv = composeInvoice(draft, undefined, now);

  it('asks for the balance with payment details', () => {
    const message = buildReadyMessage(inv, customer, business);
    expect(message).toContain('Hello Ada,');
    expect(message).toContain('invoice #INV-010) is ready');
    expect(message).toContain('*₦30,000.00*');
    expect(message).toContain('0123456789');
  });

  it('omits the balance once paid', () => {
    const paid = { ...inv, depositAmount: 50000, status: 'paid' as const };
    expect(buildReadyMessage(paid, customer, business)).not.toContain('Balance');
  });

  it('the WhatsApp button sends the ready message only when the order is ready', () => {
    expect(buildClientMessage(inv, customer, business)).toContain('friendly reminder');
    expect(buildClientMessage({ ...inv, orderStage: 'ready' }, customer, business)).toContain('is ready');
  });
});

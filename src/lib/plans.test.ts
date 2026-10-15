import { describe, expect, it } from 'vitest';
import type { Invoice } from '../types';
import {
  composeInvoice, convertQuoteDraft, duplicateDraft, getAmountToRequest, getDisplayStatus, getOverdueAmount, getPlanOverdueAmount,
  getPlanStatus, invoiceToDraft, isOverdue, nextInstallment, planAmounts, validatePlan, type InvoiceDraft,
} from './invoice';
import { buildReminderMessage } from './whatsapp';

const draft: InvoiceDraft = {
  customerId: 'c-1', invoiceNumber: 'INV-020', currency: 'NGN', dateIssued: '2026-10-01', dueDate: '',
  items: [{ description: 'Wedding outfit', quantity: 1, unitPrice: 100000 }],
  discountType: 'percentage', discountRate: 0, taxRate: 0, taxLabel: 'VAT', notes: '', deliveryDate: '',
  plan: [
    { label: 'Deposit', percent: 50, dueDate: '2026-10-01' },
    { label: 'At fitting', percent: 30, dueDate: '2026-10-10' },
    { label: 'On collection', percent: 20, dueDate: '' },
  ],
  costs: [],
  depositAmount: 0,
};
const now = new Date('2026-10-01T09:00:00Z');
const withPaid = (inv: Invoice, paid: number): Invoice => ({ ...inv, depositAmount: paid, status: paid >= inv.grandTotal ? 'paid' : paid > 0 ? 'partial' : 'pending' });

describe('payment plans', () => {
  const inv = composeInvoice(draft, undefined, now);

  it('stores percentages and splits the total exactly', () => {
    expect(inv.paymentPlan?.map(p => p.percent)).toEqual([50, 30, 20]);
    expect(planAmounts(100000, inv.paymentPlan!)).toEqual([50000, 30000, 20000]);
    expect(planAmounts(100, [{ percent: 33.33 }, { percent: 33.33 }, { percent: 33.34 }])).toEqual([33.33, 33.33, 33.34]);
    expect(planAmounts(10, [{ percent: 33.33 }, { percent: 66.67 }]).reduce((a, b) => a + b)).toBe(10);
  });

  it('fills instalments in order with payments', () => {
    const states = getPlanStatus(withPaid(inv, 60000), '2026-10-05');
    expect(states.map(s => [s.paid, s.remaining, s.state])).toEqual([
      [50000, 0, 'paid'],
      [10000, 20000, 'part-paid'],
      [0, 20000, 'upcoming'],
    ]);
    expect(nextInstallment(withPaid(inv, 60000), '2026-10-05')?.installment.label).toBe('At fitting');
  });

  it('only a missed instalment makes the invoice overdue, for that amount', () => {
    expect(isOverdue(inv, '2026-10-02')).toBe(true); // deposit was due on the 1st
    expect(getPlanOverdueAmount(inv, '2026-10-02')).toBe(50000);
    const depositPaid = withPaid(inv, 50000);
    expect(isOverdue(depositPaid, '2026-10-09')).toBe(false);
    expect(getDisplayStatus(depositPaid, '2026-10-11')).toBe('overdue');
    expect(getPlanOverdueAmount(depositPaid, '2026-10-11')).toBe(30000);
    expect(getOverdueAmount(depositPaid, '2026-10-11')).toBe(30000);
    expect(getOverdueAmount({ ...depositPaid, dueDate: new Date('2026-10-05T00:00:00Z') }, '2026-10-11')).toBe(50000);
    // "On collection" has no date, so it is never overdue
    expect(isOverdue(withPaid(inv, 80000), '2030-01-01')).toBe(false);
  });

  it('asks for what is due now, or else the next instalment', () => {
    expect(getAmountToRequest(inv, '2026-10-01')).toBe(50000); // due today
    expect(getAmountToRequest(withPaid(inv, 50000), '2026-10-05')).toBe(30000); // next one
    expect(getAmountToRequest(withPaid(inv, 20000), '2026-10-11')).toBe(60000); // rest of deposit + fitting
    expect(getAmountToRequest({ ...withPaid(inv, 20000), paymentPlan: undefined }, '2026-10-11')).toBe(80000);
  });

  it('the reminder asks for the instalment, not the whole balance', () => {
    const message = buildReminderMessage(withPaid(inv, 50000), { name: 'Ada' }, { businessName: 'Biz', bankName: '', accountNumber: '', accountName: '' }, '2026-10-11');
    expect(message).toContain('*₦30,000.00*');
    expect(message).toContain('At fitting');
    expect(message).toContain('₦50,000.00 in total');
  });

  it('round-trips through the form and moves dates with duplicates and conversions', () => {
    expect(invoiceToDraft(inv).plan).toEqual(draft.plan);
    expect(duplicateDraft(inv, 'INV-021', '2026-11-01').plan.map(p => p.dueDate)).toEqual(['2026-11-01', '2026-11-10', '']);
    const quote = composeInvoice(draft, undefined, now, 'quote');
    expect(convertQuoteDraft(quote, 'INV-022', undefined, '2026-10-05').plan.map(p => p.dueDate)).toEqual(['2026-10-05', '2026-10-14', '']);
    expect(composeInvoice({ ...draft, plan: [] }, undefined, now).paymentPlan).toBeUndefined();
  });

  it('validates the plan being entered', () => {
    expect(validatePlan([])).toBeNull();
    expect(validatePlan(draft.plan)).toBeNull();
    expect(validatePlan([{ label: 'All', percent: 100, dueDate: '' }])).toMatch(/at least two/);
    expect(validatePlan([{ label: 'A', percent: 50, dueDate: '' }, { label: 'B', percent: 40, dueDate: '' }])).toMatch(/90%/);
    expect(validatePlan([{ label: 'A', percent: 100, dueDate: '' }, { label: 'B', percent: 0, dueDate: '' }])).toMatch(/above 0/);
  });
});

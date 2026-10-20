import { describe, expect, it } from 'vitest';
import type { Customer, Invoice } from '../types';
import { dashboardStats, greetingFor } from './dashboardStats';

const TODAY = '2026-06-10';
const customers: Customer[] = [{ id: 'c-1', name: 'Ada Obi', phone: '08031234567', createdAt: new Date('2026-01-01') }];

const inv = (overrides: Partial<Invoice> = {}): Invoice => ({
  id: crypto.randomUUID(),
  customerId: 'c-1',
  invoiceNumber: 'INV-001',
  items: [],
  subtotal: 1000, discount: 0, tax: 0, grandTotal: 1000,
  depositAmount: 0,
  payments: [],
  currency: 'NGN',
  status: 'pending',
  dateIssued: new Date('2026-06-01T00:00:00Z'),
  isSynced: false,
  createdAt: new Date('2026-06-01T00:00:00Z'),
  updatedAt: new Date('2026-06-01T00:00:00Z'),
  ...overrides,
});

describe('dashboard stats', () => {
  it('is all zeros without invoices in the currency', () => {
    const stats = dashboardStats([inv({ currency: 'USD' })], customers, 'NGN', TODAY);
    expect(stats).toMatchObject({ collected: 0, pending: 0, invoiced: 0, paidShare: 0, count: 0, recent: [] });
  });

  it('adds up what is owed, collected and overdue', () => {
    const stats = dashboardStats([
      inv({ grandTotal: 3000, depositAmount: 1000, status: 'partial', dueDate: new Date('2026-06-05T00:00:00Z') }),
      inv({ grandTotal: 1000, depositAmount: 1000, status: 'paid' }),
    ], customers, 'NGN', TODAY);
    expect(stats.collected).toBe(2000);
    expect(stats.pending).toBe(2000);
    expect(stats.overdue).toBe(2000);
    expect(stats.overdueCount).toBe(1);
    expect(stats.invoiced).toBe(4000);
    expect(stats.paid).toBe(2000);
    expect(stats.paidShare).toBe(0.5);
  });

  it('ignores quotes and other currencies', () => {
    const stats = dashboardStats([inv({ kind: 'quote', grandTotal: 9999 }), inv({ currency: 'GBP', grandTotal: 500 })], customers, 'NGN', TODAY);
    expect(stats.invoiced).toBe(0);
    expect(stats.count).toBe(0);
  });

  it('keeps cash from a voided invoice as collected, but not as owed or invoiced', () => {
    const stats = dashboardStats([inv({ grandTotal: 1000, depositAmount: 400, voidedAt: new Date('2026-06-02T00:00:00Z') })], customers, 'NGN', TODAY);
    expect(stats.collected).toBe(400);
    expect(stats.pending).toBe(0);
    expect(stats.invoiced).toBe(0);
    expect(stats.paidShare).toBe(0);
    expect(stats.count).toBe(0);
  });

  it('does not count an unconfirmed transfer as paid', () => {
    const stats = dashboardStats([inv({ payments: [{ id: 'p', date: '2026-06-09', amount: 500, unconfirmed: true }] })], customers, 'NGN', TODAY);
    expect(stats.unconfirmed).toBe(500);
    expect(stats.paidShare).toBe(0);
  });

  it('lists the three newest invoices with the client name', () => {
    const stats = dashboardStats([1, 2, 3, 4].map(n => inv({ invoiceNumber: `INV-00${n}`, dateIssued: new Date(`2026-06-0${n}T00:00:00Z`) })), customers, 'NGN', TODAY);
    expect(stats.recent.map(r => r.invoiceNumber)).toEqual(['INV-004', 'INV-003', 'INV-002']);
    expect(stats.recent[0].customerName).toBe('Ada Obi');
  });

  it('never reports more than 100% paid', () => {
    const stats = dashboardStats([inv({ grandTotal: 1000, depositAmount: 1500, status: 'paid' })], customers, 'NGN', TODAY);
    expect(stats.paidShare).toBe(1);
  });
});

describe('greeting', () => {
  it('changes at noon and at five', () => {
    expect([0, 11, 12, 16, 17, 23].map(greetingFor)).toEqual(['Good morning', 'Good morning', 'Good afternoon', 'Good afternoon', 'Good evening', 'Good evening']);
  });
});

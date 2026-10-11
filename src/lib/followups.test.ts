import { describe, expect, it } from 'vitest';
import type { Customer, Invoice } from '../types';
import { buildFollowUps, followUpReasons } from './followups';

const customer: Customer = { id: 'c-1', name: 'Ada Obi', phone: '08031234567', createdAt: new Date('2026-01-01') };
const TODAY = '2026-06-10';

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
  orderStage: 'in_progress',
  isSynced: false,
  createdAt: new Date('2026-06-01T00:00:00Z'),
  updatedAt: new Date('2026-06-01T00:00:00Z'),
  ...overrides,
});

describe('follow-ups', () => {
  it('lists overdue balances, ready orders, unchecked transfers and deliveries', () => {
    expect(followUpReasons(inv({ dueDate: new Date('2026-06-05T00:00:00Z') }), TODAY)).toEqual(['overdue']);
    expect(followUpReasons(inv({ orderStage: 'ready', status: 'paid', depositAmount: 1000 }), TODAY)).toEqual(['ready']);
    expect(followUpReasons(inv({ payments: [{ id: 'p', date: '2026-06-09', amount: 500, unconfirmed: true }] }), TODAY)).toEqual(['unconfirmed']);
    expect(followUpReasons(inv({ deliveryDate: new Date('2026-06-09T00:00:00Z') }), TODAY)).toEqual(['delivery-late']);
    expect(followUpReasons(inv({ deliveryDate: new Date('2026-06-10T00:00:00Z') }), TODAY)).toEqual(['delivery-today']);
  });

  it('ignores quotes, settled orders and things not yet due', () => {
    expect(followUpReasons(inv({ kind: 'quote', dueDate: new Date('2026-06-05T00:00:00Z') }), TODAY)).toEqual([]);
    expect(followUpReasons(inv({ orderStage: 'delivered', status: 'paid', depositAmount: 1000, deliveryDate: new Date('2026-06-01T00:00:00Z') }), TODAY)).toEqual([]);
    expect(followUpReasons(inv({ dueDate: new Date('2026-06-20T00:00:00Z'), deliveryDate: new Date('2026-06-15T00:00:00Z') }), TODAY)).toEqual([]);
    expect(followUpReasons(inv({ orderStage: undefined }), TODAY)).toEqual([]);
  });

  it('orders by urgency then balance, with clients messaged today last', () => {
    const overdueSmall = inv({ invoiceNumber: 'A', grandTotal: 500, dueDate: new Date('2026-06-01T00:00:00Z') });
    const overdueBig = inv({ invoiceNumber: 'B', grandTotal: 9000, dueDate: new Date('2026-06-01T00:00:00Z') });
    const ready = inv({ invoiceNumber: 'C', orderStage: 'ready' });
    const remindedToday = inv({ invoiceNumber: 'D', grandTotal: 99000, dueDate: new Date('2026-06-01T00:00:00Z'), lastReminderAt: new Date(2026, 5, 10, 9) });
    const list = buildFollowUps([overdueSmall, remindedToday, overdueBig, ready, inv({ invoiceNumber: 'E' })], [customer], TODAY);
    expect(list.map(f => f.invoice.invoiceNumber)).toEqual(['C', 'B', 'A', 'D']);
    expect(list[0]).toMatchObject({ needsMessage: true, done: false, customer });
    expect(list[3].done).toBe(true);
  });

  it('a client messaged today still shows if a transfer needs checking', () => {
    const [f] = buildFollowUps([inv({
      dueDate: new Date('2026-06-01T00:00:00Z'),
      lastReminderAt: new Date(2026, 5, 10, 9),
      payments: [{ id: 'p', date: '2026-06-10', amount: 500, unconfirmed: true }],
    })], [customer], TODAY);
    expect(f.done).toBe(false);
  });
});

import type { Customer, Invoice } from '../types';
import { getBalance, getUnconfirmedAmount, isOverdue, isQuote, todayInputValue, toDateInputValue } from './invoice';
import { isDeliveryLate, isOpenOrder } from './orders';

/** Why an invoice needs attention today, most urgent first. */
export type FollowUpReason = 'unconfirmed' | 'ready' | 'overdue' | 'delivery-late' | 'delivery-today';

const REASON_ORDER: FollowUpReason[] = ['unconfirmed', 'ready', 'overdue', 'delivery-late', 'delivery-today'];

export interface FollowUp {
  invoice: Invoice;
  customer?: Customer;
  reasons: FollowUpReason[];
  /** The client should get a WhatsApp message (order ready, or payment overdue). */
  needsMessage: boolean;
  /** Only needed a message and the client was already messaged today. */
  done: boolean;
}

const MESSAGE_REASONS: FollowUpReason[] = ['ready', 'overdue'];

export function followUpReasons(invoice: Invoice, today: string = todayInputValue()): FollowUpReason[] {
  if (isQuote(invoice) || invoice.voidedAt) return [];
  const reasons: FollowUpReason[] = [];
  if (getUnconfirmedAmount(invoice) > 0) reasons.push('unconfirmed');
  // A paid order that is ready still needs the client told
  if (invoice.orderStage === 'ready') reasons.push('ready');
  if (isOverdue(invoice, today) && getBalance(invoice) > 0) reasons.push('overdue');
  if (isDeliveryLate(invoice, today)) reasons.push('delivery-late');
  else if (isOpenOrder(invoice) && invoice.orderStage !== 'ready' && invoice.deliveryDate && toDateInputValue(invoice.deliveryDate) === today) {
    reasons.push('delivery-today');
  }
  return reasons;
}

/**
 * The dashboard's "today" list: invoices needing a message, a bank check or a delivery.
 * Ones already handled today drop to the bottom; otherwise most urgent, then largest balance.
 */
export function buildFollowUps(invoices: Invoice[], customers: Customer[], today: string = todayInputValue()): FollowUp[] {
  const byId = new Map(customers.map(c => [c.id, c]));
  const rank = (f: FollowUp) => REASON_ORDER.indexOf(f.reasons[0]);
  return invoices
    .map(invoice => {
      const reasons = followUpReasons(invoice, today);
      const messagedToday = !!invoice.lastReminderAt && todayInputValue(new Date(invoice.lastReminderAt)) === today;
      return {
        invoice,
        customer: byId.get(invoice.customerId),
        reasons,
        needsMessage: reasons.some(r => MESSAGE_REASONS.includes(r)),
        done: messagedToday && reasons.every(r => MESSAGE_REASONS.includes(r)),
      };
    })
    .filter(f => f.reasons.length > 0)
    .sort((a, b) =>
      Number(a.done) - Number(b.done) ||
      rank(a) - rank(b) ||
      getBalance(b.invoice) - getBalance(a.invoice)
    );
}

import type { Invoice, OrderStage } from '../types';
import { isQuote, todayInputValue, toDateInputValue } from './invoice';

export const ORDER_STAGES: { id: OrderStage; label: string }[] = [
  { id: 'in_progress', label: 'In progress' },
  { id: 'ready', label: 'Ready' },
  { id: 'delivered', label: 'Delivered' },
];

export function stageLabel(stage: OrderStage): string {
  return ORDER_STAGES.find(s => s.id === stage)?.label ?? stage;
}

/** The stage after this one, or null once delivered. */
export function nextStage(stage: OrderStage): OrderStage | null {
  const index = ORDER_STAGES.findIndex(s => s.id === stage);
  return ORDER_STAGES[index + 1]?.id ?? null;
}

/** A tracked invoice whose goods have not been handed over yet. */
export function isOpenOrder(invoice: Pick<Invoice, 'kind' | 'orderStage' | 'voidedAt'>): boolean {
  return !isQuote(invoice) && !invoice.voidedAt && (invoice.orderStage === 'in_progress' || invoice.orderStage === 'ready');
}

/** Delivery date has passed but the order is not delivered. */
export function isDeliveryLate(invoice: Pick<Invoice, 'kind' | 'orderStage' | 'deliveryDate' | 'voidedAt'>, today: string = todayInputValue()): boolean {
  return isOpenOrder(invoice) && !!invoice.deliveryDate && toDateInputValue(invoice.deliveryDate) < today;
}

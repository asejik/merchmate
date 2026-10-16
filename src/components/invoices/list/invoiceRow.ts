import type { Customer, Invoice, OrderStage } from '../../../types';
import { isOpenOrder } from '../../../lib/orders';
import type { DisplayStatus } from '../../../lib/invoice';

export interface InvoiceRow extends Invoice {
  customer?: Customer;
  customerName: string;
  displayStatus: DisplayStatus;
}

export type Filter = 'all' | 'to-deliver' | 'unpaid' | 'overdue' | 'paid';

export const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'to-deliver', label: 'To deliver' },
  { id: 'unpaid', label: 'Unpaid' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'paid', label: 'Paid' },
];

export const STAGE_STYLES: Record<OrderStage, string> = {
  in_progress: 'text-amber-300 bg-amber-400/10 border-amber-400/20',
  ready: 'text-sky-300 bg-sky-400/10 border-sky-400/20',
  delivered: 'text-slate-400 bg-slate-400/10 border-slate-400/20',
};

export const STATUS_STYLES: Record<DisplayStatus, string> = {
  paid: 'text-green-400 bg-green-400/10 border-green-400/20',
  partial: 'text-orange-400 bg-orange-400/10 border-orange-400/20',
  overdue: 'text-red-400 bg-red-400/10 border-red-400/20',
  pending: 'text-slate-400 bg-slate-400/10 border-slate-400/20',
  void: 'text-slate-500 bg-slate-500/10 border-slate-500/20 line-through',
  open: 'text-sky-400 bg-sky-400/10 border-sky-400/20',
  expired: 'text-slate-500 bg-slate-500/10 border-slate-500/20',
  converted: 'text-green-400 bg-green-400/10 border-green-400/20',
};

export function matchesFilter(row: InvoiceRow, filter: Filter): boolean {
  switch (filter) {
    case 'to-deliver': return isOpenOrder(row);
    case 'unpaid': return row.status !== 'paid' && !row.voidedAt;
    case 'overdue': return row.displayStatus === 'overdue';
    case 'paid': return row.status === 'paid';
    default: return true;
  }
}

export function timeAgo(date: Date): string {
  const days = Math.floor((Date.now() - new Date(date).getTime()) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}

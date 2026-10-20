import type { Customer, Invoice, OrderStage } from '../../../types';
import { isOpenOrder } from '../../../lib/orders';
import type { DisplayStatus } from '../../../lib/invoice';
import type { ChipTone } from '../../ui/Chip';

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

export const STAGE_TONES: Record<OrderStage, ChipTone> = {
  in_progress: 'warning',
  ready: 'primary',
  delivered: 'neutral',
};

export const STATUS_TONES: Record<DisplayStatus, ChipTone> = {
  paid: 'success',
  partial: 'warning',
  overdue: 'danger',
  pending: 'neutral',
  void: 'neutral',
  open: 'primary',
  expired: 'neutral',
  converted: 'success',
};

/** Words for the status chips: sentence case, plain. */
export const STATUS_LABELS: Record<DisplayStatus, string> = {
  paid: 'Paid',
  partial: 'Partly paid',
  overdue: 'Overdue',
  pending: 'Unpaid',
  void: 'Void',
  open: 'Open',
  expired: 'Expired',
  converted: 'Converted',
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

// React 18 has no typed `inert` prop; the attribute itself works in every current browser
export const INERT = { inert: '' } as Record<string, string>;

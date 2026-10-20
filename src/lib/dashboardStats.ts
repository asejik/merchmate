import type { CurrencyCode, Customer, Invoice } from '../types';
import { getAmountCollected, getBalance, getDisplayStatus, getOverdueAmount, getUnconfirmedAmount, isQuote, round2, type DisplayStatus } from './invoice';

export interface RecentInvoice extends Invoice {
  customerName: string;
  displayStatus: DisplayStatus;
}

export interface DashboardStats {
  /** Cash received, including on invoices voided later (the money is still in hand). */
  collected: number;
  /** Transfers not yet seen in the bank: not part of `collected`. */
  unconfirmed: number;
  /** Owed on live invoices. */
  pending: number;
  overdue: number;
  overdueCount: number;
  /** Live (not voided) invoices in this currency. */
  count: number;
  /** Total value of live invoices, how much of it is paid, and that as a share (0 to 1). */
  invoiced: number;
  paid: number;
  paidShare: number;
  recent: RecentInvoice[];
}

const EMPTY: DashboardStats = { collected: 0, unconfirmed: 0, pending: 0, overdue: 0, overdueCount: 0, count: 0, invoiced: 0, paid: 0, paidShare: 0, recent: [] };

/** The dashboard's numbers for one currency. Quotes are estimates, not money owed, so they never count. */
export function dashboardStats(invoices: Invoice[], customers: Customer[], currency: CurrencyCode, today: string): DashboardStats {
  const inCurrency = invoices.filter(inv => !isQuote(inv) && inv.currency === currency);
  if (inCurrency.length === 0) return EMPTY;

  const collected = inCurrency.reduce((sum, inv) => sum + getAmountCollected(inv), 0);
  const live = inCurrency.filter(inv => !inv.voidedAt);
  const unconfirmed = live.reduce((sum, inv) => sum + getUnconfirmedAmount(inv), 0);
  const pending = live.reduce((sum, inv) => sum + getBalance(inv), 0);
  const overdueInvoices = live.filter(inv => getDisplayStatus(inv, today) === 'overdue');
  const overdue = overdueInvoices.reduce((sum, inv) => sum + getOverdueAmount(inv, today), 0);

  const invoiced = round2(live.reduce((sum, inv) => sum + inv.grandTotal, 0));
  const paid = round2(live.reduce((sum, inv) => sum + getAmountCollected(inv), 0));
  const paidShare = invoiced > 0 ? Math.min(1, Math.max(0, paid / invoiced)) : 0;

  const names = new Map(customers.map(c => [c.id, c.name]));
  const recent = [...live]
    .sort((a, b) => new Date(b.dateIssued).getTime() - new Date(a.dateIssued).getTime())
    .slice(0, 3)
    .map(inv => ({ ...inv, customerName: names.get(inv.customerId) ?? 'Unknown', displayStatus: getDisplayStatus(inv, today) }));

  return { collected, unconfirmed, pending, overdue, overdueCount: overdueInvoices.length, count: live.length, invoiced, paid, paidShare, recent };
}

/** The greeting for an hour of the day (0 to 23). */
export function greetingFor(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

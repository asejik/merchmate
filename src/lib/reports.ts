import type { CurrencyCode, Customer, Invoice } from '../types';
import { getBalance, getConfirmedPayments, isQuote, round2 } from './invoice';

export interface MonthBucket {
  key: string; // "YYYY-MM"
  label: string; // "May"
  amount: number;
}

const monthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

/** Cash received per calendar month (by payment date, local time), oldest first, ending with the current month. */
export function monthlyCollections(invoices: Invoice[], currency: CurrencyCode, months = 6, now: Date = new Date()): MonthBucket[] {
  const buckets: MonthBucket[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({ key: monthKey(d), label: d.toLocaleDateString('en-GB', { month: 'short' }), amount: 0 });
  }
  const index = new Map(buckets.map((b, i) => [b.key, i]));

  for (const inv of invoices) {
    if (isQuote(inv) || inv.currency !== currency) continue;
    for (const payment of getConfirmedPayments(inv)) {
      const i = index.get(monthKey(new Date(payment.date)));
      if (i !== undefined) buckets[i].amount = round2(buckets[i].amount + payment.amount);
    }
  }
  return buckets;
}

export interface ClientRank {
  customerId: string;
  name: string;
  invoiced: number;
  outstanding: number;
  count: number;
}

/** Clients ranked by total invoiced in one currency. */
export function topClients(invoices: Invoice[], customers: Customer[], currency: CurrencyCode, limit = 5): ClientRank[] {
  const names = new Map(customers.map(c => [c.id, c.name]));
  const byClient = new Map<string, ClientRank>();
  for (const inv of invoices) {
    if (isQuote(inv) || inv.voidedAt || inv.currency !== currency) continue;
    const rank = byClient.get(inv.customerId) ?? {
      customerId: inv.customerId, name: names.get(inv.customerId) ?? 'Unknown', invoiced: 0, outstanding: 0, count: 0,
    };
    rank.invoiced = round2(rank.invoiced + inv.grandTotal);
    rank.outstanding = round2(rank.outstanding + getBalance(inv));
    rank.count += 1;
    byClient.set(inv.customerId, rank);
  }
  return [...byClient.values()].sort((a, b) => b.invoiced - a.invoiced || a.name.localeCompare(b.name)).slice(0, limit);
}

/** Rounds an axis maximum up to a clean value: 1, 2, 2.5 or 5 times a power of ten. */
export function niceMax(value: number): number {
  if (value <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find(s => s * power >= value) ?? 10;
  return step * power;
}

/** Compact axis labels: 1,500 -> "1.5K", 2,000,000 -> "2M". */
export function compactNumber(value: number): string {
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

import type { CurrencyCode, Invoice } from '../types';
import { isQuote, round2, todayInputValue, toDateInputValue } from './invoice';

export interface JobProfit {
  revenue: number; // total excluding tax: tax is collected for the government, not earned
  cost: number;
  profit: number;
  margin: number | null; // whole percent of revenue; null when there is no revenue
}

/** Profit for one total and list of costs (also used live in the form). */
export function computeProfit(grandTotal: number, tax: number, costs: { amount: unknown }[]): JobProfit {
  const revenue = round2(grandTotal - tax);
  const cost = round2(costs.reduce((sum, c) => sum + (Number(c.amount) || 0), 0));
  const profit = round2(revenue - cost);
  return { revenue, cost, profit, margin: revenue > 0 ? Math.round((profit / revenue) * 100) : null };
}

/** Profit on a job, or null when no costs were entered (so profit is unknown, not 100%). */
export function getJobProfit(invoice: Pick<Invoice, 'grandTotal' | 'tax' | 'costs'>): JobProfit | null {
  if (!invoice.costs?.length) return null;
  return computeProfit(invoice.grandTotal, invoice.tax, invoice.costs);
}

export interface PeriodProfit extends JobProfit {
  jobs: number; // invoices with costs entered
  jobsWithoutCosts: number; // invoices left out because their costs are unknown
}

/** Profit on invoices issued in the current calendar month, in one currency. */
export function monthProfit(invoices: Invoice[], currency: CurrencyCode, today: string = todayInputValue()): PeriodProfit {
  const month = today.slice(0, 7);
  const inMonth = invoices.filter(inv => !isQuote(inv) && inv.currency === currency && toDateInputValue(inv.dateIssued).slice(0, 7) === month);
  const known = inMonth.map(getJobProfit).filter((p): p is JobProfit => p !== null);
  const revenue = round2(known.reduce((sum, p) => sum + p.revenue, 0));
  const cost = round2(known.reduce((sum, p) => sum + p.cost, 0));
  const profit = round2(revenue - cost);
  return {
    revenue, cost, profit,
    margin: revenue > 0 ? Math.round((profit / revenue) * 100) : null,
    jobs: known.length,
    jobsWithoutCosts: inMonth.length - known.length,
  };
}

import type { CurrencyCode, Invoice } from '../types';
import { getBalance, getDisplayStatus, isQuote, round2, todayInputValue, type DisplayStatus } from './invoice';

export interface StatementRow {
  invoiceNumber: string;
  dateIssued: Date;
  dueDate?: Date;
  total: number;
  paid: number;
  balance: number;
  status: DisplayStatus;
}

export interface StatementGroup {
  currency: CurrencyCode;
  rows: StatementRow[];
  invoiced: number;
  paid: number;
  balance: number;
  overdue: number;
}

/** A client's invoices (quotes and voided invoices excluded), oldest first, grouped per currency: amounts in different currencies are never added together. */
export function buildStatement(invoices: Invoice[], today: string = todayInputValue()): StatementGroup[] {
  const groups = new Map<CurrencyCode, StatementGroup>();
  const sorted = invoices
    .filter(inv => !isQuote(inv) && !inv.voidedAt)
    .sort((a, b) => new Date(a.dateIssued).getTime() - new Date(b.dateIssued).getTime());

  for (const inv of sorted) {
    const group = groups.get(inv.currency) ?? { currency: inv.currency, rows: [], invoiced: 0, paid: 0, balance: 0, overdue: 0 };
    const balance = getBalance(inv);
    const status = getDisplayStatus(inv, today);
    const paid = Math.min(inv.depositAmount, inv.grandTotal);
    group.rows.push({
      invoiceNumber: inv.invoiceNumber,
      dateIssued: new Date(inv.dateIssued),
      dueDate: inv.dueDate ? new Date(inv.dueDate) : undefined,
      total: inv.grandTotal,
      paid,
      balance,
      status,
    });
    group.invoiced = round2(group.invoiced + inv.grandTotal);
    group.paid = round2(group.paid + paid);
    group.balance = round2(group.balance + balance);
    if (status === 'overdue') group.overdue = round2(group.overdue + balance);
    groups.set(inv.currency, group);
  }
  return [...groups.values()];
}

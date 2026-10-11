import type { Customer, Invoice } from '../types';
import { getBalance, getDisplayStatus, getConfirmedPayments, kindOf, todayInputValue, toDateInputValue } from './invoice';

type Cell = string | number | null | undefined;

// Spreadsheet apps execute cells starting with these as formulas (CSV injection)
const FORMULA_START = /^[=+\-@\t\r]/;

function escapeCell(cell: Cell): string {
  if (cell === null || cell === undefined) return '';
  if (typeof cell === 'number') return Number.isFinite(cell) ? String(cell) : '';
  const safe = FORMULA_START.test(cell) ? `'${cell}` : cell;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(rows: Cell[][]): string {
  return rows.map(row => row.map(escapeCell).join(',')).join('\r\n');
}

/** UTF-8 BOM so Excel shows ₦, £, € and non-English names correctly. */
export function csvFile(csv: string, filename: string): File {
  return new File(['﻿' + csv], filename, { type: 'text/csv' });
}

const day = (date?: Date | string) => (date ? toDateInputValue(date) : '');

export function invoicesCsv(invoices: Invoice[], customers: Customer[], today: string = todayInputValue()): string {
  const names = new Map(customers.map(c => [c.id, c.name]));
  const sorted = [...invoices].sort((a, b) => new Date(a.dateIssued).getTime() - new Date(b.dateIssued).getTime());
  return toCsv([
    ['Type', 'Number', 'Client', 'Date', 'Due / Valid Until', 'Currency', 'Subtotal', 'Discount', 'Tax', 'Total', 'Paid', 'Balance', 'Status'],
    ...sorted.map(inv => {
      const quote = kindOf(inv) === 'quote';
      return [
        quote ? 'Quote' : 'Invoice',
        inv.invoiceNumber,
        names.get(inv.customerId) ?? 'Unknown',
        day(inv.dateIssued),
        day(inv.dueDate),
        inv.currency,
        inv.subtotal,
        inv.discount,
        inv.tax,
        inv.grandTotal,
        quote ? '' : inv.depositAmount,
        quote ? '' : getBalance(inv),
        getDisplayStatus(inv, today),
      ];
    }),
  ]);
}

export function paymentsCsv(invoices: Invoice[], customers: Customer[]): string {
  const names = new Map(customers.map(c => [c.id, c.name]));
  const rows = invoices
    .filter(inv => kindOf(inv) === 'invoice')
    .flatMap(inv => getConfirmedPayments(inv).map(p => ({ inv, p })))
    .sort((a, b) => new Date(a.p.date).getTime() - new Date(b.p.date).getTime());
  return toCsv([
    ['Date', 'Invoice', 'Client', 'Currency', 'Amount', 'Note'],
    ...rows.map(({ inv, p }) => [day(p.date), inv.invoiceNumber, names.get(inv.customerId) ?? 'Unknown', inv.currency, p.amount, p.note ?? '']),
  ]);
}
